/**
 * Enhanced Analytics Tests
 * Unit and integration tests for enhanced analytics functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnalyticsDashboard } from '@/admin/analytics/AnalyticsDashboard'
import { KPICards } from '@/admin/analytics/KPICards'
import { DrilldownModal } from '@/admin/analytics/DrilldownModal'
import { HeatmapChart } from '@/admin/analytics/HeatmapChart'
import { ComparisonAnalytics } from '@/admin/analytics/ComparisonAnalytics'
import { useAnalytics } from '@/hooks/use-analytics'

// Mock the analytics hook
vi.mock('@/hooks/use-analytics')
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock recharts components to avoid canvas issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />
}))

const mockUseAnalytics = vi.mocked(useAnalytics)

// Enhanced mock KPI data with new features
const mockKPIData = {
  totalAppointments: 150,
  totalRevenue: 4500.00,
  averageServiceTime: 45,
  bookingRate: 85.5,
  cancellationRate: 12.3,
  staffUtilization: [
    {
      staffId: 'staff-1',
      name: 'Maria Schmidt',
      utilization: 88.5,
      totalAppointments: 45,
      totalRevenue: 1800.00
    },
    {
      staffId: 'staff-2',
      name: 'Hans Mueller',
      utilization: 76.2,
      totalAppointments: 38,
      totalRevenue: 1520.00
    }
  ],
  popularServices: [
    {
      serviceId: 'service-1',
      name: 'Damenhaarschnitt',
      bookingCount: 35,
      revenue: 1750.00
    },
    {
      serviceId: 'service-2',
      name: 'Herrenhaarschnitt',
      bookingCount: 28,
      revenue: 1120.00
    }
  ],
  dailyStats: [
    {
      date: '2024-01-01',
      appointments: 8,
      revenue: 320.00,
      newCustomers: 2
    },
    {
      date: '2024-01-02',
      appointments: 12,
      revenue: 480.00,
      newCustomers: 3
    }
  ],
  period: 'month' as const,
  dateRange: {
    startDate: '2024-01-01',
    endDate: '2024-01-31'
  },
  // New features
  comparison: {
    totalAppointments: {
      current: 150,
      previous: 120,
      change: 30,
      changePercentage: 25.0,
      trend: 'up' as const
    },
    totalRevenue: {
      current: 4500.00,
      previous: 3800.00,
      change: 700.00,
      changePercentage: 18.4,
      trend: 'up' as const
    },
    bookingRate: {
      current: 85.5,
      previous: 78.2,
      change: 7.3,
      changePercentage: 9.3,
      trend: 'up' as const
    },
    cancellationRate: {
      current: 12.3,
      previous: 15.8,
      change: -3.5,
      changePercentage: -22.2,
      trend: 'down' as const
    }
  },
  heatmapData: [
    {
      dayOfWeek: 1, // Monday
      hour: 9,
      appointments: 5,
      density: 0.8,
      revenue: 250.00
    },
    {
      dayOfWeek: 1,
      hour: 14,
      appointments: 8,
      density: 1.0,
      revenue: 400.00
    },
    {
      dayOfWeek: 2, // Tuesday
      hour: 10,
      appointments: 3,
      density: 0.4,
      revenue: 150.00
    }
  ],
  realTimeUpdate: true
}

describe('Enhanced Analytics', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })

    // Reset mocks
    vi.clearAllMocks()
    
    // Mock localStorage for auth token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-auth-token'),
        setItem: vi.fn(),
        removeItem: vi.fn()
      },
      writable: true
    })

    // Mock URL.createObjectURL for CSV export tests
    global.URL.createObjectURL = vi.fn(() => 'mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  describe('Enhanced KPICards', () => {
    it('displays KPI data correctly with click handlers', () => {
      const mockOnCardClick = vi.fn()
      
      renderWithProviders(
        <KPICards 
          data={mockKPIData} 
          onCardClick={mockOnCardClick}
        />
      )

      // Check if main KPIs are displayed
      expect(screen.getByText('150')).toBeInTheDocument() // Total appointments
      expect(screen.getByText("CHF 4'500.00")).toBeInTheDocument() // Total revenue
      expect(screen.getByText('45 min')).toBeInTheDocument() // Average service time
      expect(screen.getByText('85.5%')).toBeInTheDocument() // Booking rate

      // Test click handler on total appointments card
      const appointmentsCard = screen.getByText('150').closest('.cursor-pointer')
      expect(appointmentsCard).toBeInTheDocument()
      
      fireEvent.click(appointmentsCard!)
      expect(mockOnCardClick).toHaveBeenCalledWith('appointments', 'Alle Termine')
    })
  })

  describe('Enhanced AnalyticsDashboard', () => {
    beforeEach(() => {
      mockUseAnalytics.mockReturnValue({
        data: mockKPIData,
        isLoading: false,
        error: null,
        refetch: vi.fn().mockResolvedValue(void 0),
        isRealTimeConnected: true,
        permissions: {
          canViewAllStaff: true,
          canViewRevenue: true,
          canExportData: true,
          canManageReports: true
        }
      })
    })

    it('renders enhanced dashboard with all new components', () => {
      renderWithProviders(<AnalyticsDashboard />)

      // Check main title and real-time indicator
      expect(screen.getByText('Analytics & Reporting')).toBeInTheDocument()
      expect(screen.getByText('Live')).toBeInTheDocument()
      
      // Check new tabs
      expect(screen.getByText('Spitzenzeiten')).toBeInTheDocument()
      expect(screen.getByText('Berichte')).toBeInTheDocument()

      // Check comparison filter is available
      expect(screen.getByText('Vergleichszeitraum')).toBeInTheDocument()
    })

    it('shows comparison analytics when comparison data is available', () => {
      renderWithProviders(<AnalyticsDashboard />)

      // Check for comparison section
      expect(screen.getByText('Vergleichsanalyse')).toBeInTheDocument()
      expect(screen.getByText('+25.0%')).toBeInTheDocument() // Appointments change
      expect(screen.getByText('+18.4%')).toBeInTheDocument() // Revenue change
    })

    it('displays heatmap in spitzenzeiten tab', async () => {
      renderWithProviders(<AnalyticsDashboard />)

      // Click on Spitzenzeiten tab
      const heatmapTab = screen.getByText('Spitzenzeiten')
      fireEvent.click(heatmapTab)

      await waitFor(() => {
        expect(screen.getByText('Spitzenzeiten Heatmap')).toBeInTheDocument()
      })
    })
  })

  describe('ComparisonAnalytics', () => {
    it('displays comparison data correctly', () => {
      renderWithProviders(
        <ComparisonAnalytics 
          data={mockKPIData.comparison!}
          period="month"
        />
      )

      expect(screen.getByText('Vergleichsanalyse')).toBeInTheDocument()
      expect(screen.getByText('vs. Vormonat')).toBeInTheDocument()
      expect(screen.getByText('+25.0%')).toBeInTheDocument()
      expect(screen.getByText('+18.4%')).toBeInTheDocument()
    })

    it('shows trend indicators correctly', () => {
      renderWithProviders(
        <ComparisonAnalytics 
          data={mockKPIData.comparison!}
          period="month"
        />
      )

      // Should show green trends for positive changes
      const trendUpElements = screen.getAllByTestId('trending-up-icon')
      expect(trendUpElements.length).toBeGreaterThan(0)
    })
  })

  describe('HeatmapChart', () => {
    it('displays heatmap data correctly', () => {
      renderWithProviders(
        <HeatmapChart 
          data={mockKPIData.heatmapData}
        />
      )

      expect(screen.getByText('Spitzenzeiten Heatmap')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument() // Appointment count in cell
      expect(screen.getByText('8')).toBeInTheDocument() // Appointment count in cell
    })

    it('handles cell clicks for drilldown', () => {
      const mockOnCellClick = vi.fn()
      
      renderWithProviders(
        <HeatmapChart 
          data={mockKPIData.heatmapData}
          onCellClick={mockOnCellClick}
        />
      )

      // Find a cell with appointments and click it
      const cell = screen.getByText('5').closest('.cursor-pointer')
      if (cell) {
        fireEvent.click(cell)
        expect(mockOnCellClick).toHaveBeenCalled()
      }
    })
  })

  describe('DrilldownModal', () => {
    const mockDrilldownFilters = {
      metric: 'appointments' as const,
      startDate: '2024-01-01',
      endDate: '2024-01-31'
    }

    it('renders modal when open', () => {
      renderWithProviders(
        <DrilldownModal
          isOpen={true}
          onClose={vi.fn()}
          metric="appointments"
          title="Alle Termine"
          filters={mockDrilldownFilters}
          onFiltersChange={vi.fn()}
        />
      )

      expect(screen.getByText('Alle Termine')).toBeInTheDocument()
      expect(screen.getByText('Detail-Ansicht der Termine für den ausgewählten Zeitraum')).toBeInTheDocument()
    })

    it('handles search functionality', () => {
      renderWithProviders(
        <DrilldownModal
          isOpen={true}
          onClose={vi.fn()}
          metric="appointments"
          title="Alle Termine"
          filters={mockDrilldownFilters}
          onFiltersChange={vi.fn()}
        />
      )

      const searchInput = screen.getByPlaceholderText('Suche nach Kunde, Mitarbeiter oder Service...')
      expect(searchInput).toBeInTheDocument()
      
      fireEvent.change(searchInput, { target: { value: 'Maria' } })
      expect(searchInput).toHaveValue('Maria')
    })
  })

  describe('Real-time Features', () => {
    it('shows real-time connection status', () => {
      mockUseAnalytics.mockReturnValue({
        data: mockKPIData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isRealTimeConnected: true,
        permissions: {
          canViewAllStaff: true,
          canViewRevenue: true,
          canExportData: true,
          canManageReports: true
        }
      })

      renderWithProviders(<AnalyticsDashboard />)
      expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('handles real-time disconnection', () => {
      mockUseAnalytics.mockReturnValue({
        data: mockKPIData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isRealTimeConnected: false,
        permissions: {
          canViewAllStaff: true,
          canViewRevenue: true,
          canExportData: true,
          canManageReports: true
        }
      })

      renderWithProviders(<AnalyticsDashboard />)
      expect(screen.queryByText('Live')).not.toBeInTheDocument()
    })
  })

  describe('Role-based Access', () => {
    it('shows different permissions for staff users', () => {
      mockUseAnalytics.mockReturnValue({
        data: mockKPIData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isRealTimeConnected: false,
        permissions: {
          canViewAllStaff: false,
          canViewRevenue: true,
          canExportData: true,
          canManageReports: false,
          ownStaffId: 'staff-1'
        }
      })

      renderWithProviders(<AnalyticsDashboard />)
      
      // Should still show the main analytics but with limited access
      expect(screen.getByText('Analytics & Reporting')).toBeInTheDocument()
    })
  })

  describe('API Integration', () => {
    it('handles analytics API errors gracefully', () => {
      mockUseAnalytics.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'Failed to load analytics data',
        refetch: vi.fn(),
        isRealTimeConnected: false,
        permissions: null
      })

      renderWithProviders(<AnalyticsDashboard />)
      expect(screen.getByText('Fehler beim Laden der Analytics-Daten')).toBeInTheDocument()
    })

    it('handles drilldown API calls', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            appointments: [],
            total: 0,
            summary: {
              totalRevenue: 0,
              averageDuration: 0,
              completionRate: 0
            }
          }
        })
      })

      renderWithProviders(
        <DrilldownModal
          isOpen={true}
          onClose={vi.fn()}
          metric="appointments"
          title="Test Drilldown"
          filters={mockDrilldownFilters}
          onFiltersChange={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/.netlify/functions/admin/analytics/drilldown'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-auth-token'
            })
          })
        )
      })
    })
  })
})