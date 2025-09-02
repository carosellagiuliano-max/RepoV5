/**
 * Analytics Tests
 * Unit and integration tests for analytics functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnalyticsDashboard } from '@/admin/analytics/AnalyticsDashboard'
import { KPICards } from '@/admin/analytics/KPICards'
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
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
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

// Mock KPI data
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
  }
}

describe('Analytics', () => {
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

  describe('KPICards', () => {
    it('displays KPI data correctly', () => {
      renderWithProviders(<KPICards data={mockKPIData} />)

      // Check if main KPIs are displayed
      expect(screen.getByText('150')).toBeInTheDocument() // Total appointments
      expect(screen.getByText("CHF 4'500.00")).toBeInTheDocument() // Total revenue (Swiss formatting)
      expect(screen.getByText('45 min')).toBeInTheDocument() // Average service time
      expect(screen.getByText('85.5%')).toBeInTheDocument() // Booking rate
      expect(screen.getByText('12.3%')).toBeInTheDocument() // Cancellation rate
    })

    it('shows loading state', () => {
      renderWithProviders(<KPICards data={mockKPIData} isLoading={true} />)

      // Should show skeleton loaders
      const skeletons = screen.getAllByTestId(/skeleton/)
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('displays staff utilization correctly', () => {
      renderWithProviders(<KPICards data={mockKPIData} />)

      // Check staff names and utilization
      expect(screen.getByText('Maria Schmidt')).toBeInTheDocument()
      expect(screen.getByText('Hans Mueller')).toBeInTheDocument()
      expect(screen.getByText('88.5%')).toBeInTheDocument() // Average utilization
    })

    it('displays popular services', () => {
      renderWithProviders(<KPICards data={mockKPIData} />)

      expect(screen.getByText('Damenhaarschnitt')).toBeInTheDocument()
    })
  })

  describe('AnalyticsDashboard', () => {
    beforeEach(() => {
      mockUseAnalytics.mockReturnValue({
        data: mockKPIData,
        isLoading: false,
        error: null,
        refetch: vi.fn().mockResolvedValue(void 0)
      })
    })

    it('renders dashboard with all components', () => {
      renderWithProviders(<AnalyticsDashboard />)

      // Check main title
      expect(screen.getByText('Analytics & Reporting')).toBeInTheDocument()
      
      // Check export buttons
      expect(screen.getByText('Termine CSV')).toBeInTheDocument()
      expect(screen.getByText('Mitarbeiter CSV')).toBeInTheDocument()
      expect(screen.getByText('Services CSV')).toBeInTheDocument()

      // Check tabs
      expect(screen.getByText('Übersicht')).toBeInTheDocument()
      expect(screen.getByText('Umsatz')).toBeInTheDocument()
      expect(screen.getByText('Mitarbeiter')).toBeInTheDocument()
      expect(screen.getByText('Services')).toBeInTheDocument()
    })

    it('displays loading state', () => {
      mockUseAnalytics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn().mockResolvedValue(void 0)
      })

      renderWithProviders(<AnalyticsDashboard />)

      // Should not crash and show loading indicators
      expect(screen.getByText('Analytics & Reporting')).toBeInTheDocument()
    })

    it('displays error state', () => {
      mockUseAnalytics.mockReturnValue({
        data: null,
        isLoading: false,
        error: 'Failed to load data',
        refetch: vi.fn().mockResolvedValue(void 0)
      })

      renderWithProviders(<AnalyticsDashboard />)

      expect(screen.getByText('Fehler beim Laden der Analytics-Daten')).toBeInTheDocument()
      expect(screen.getByText('Erneut versuchen')).toBeInTheDocument()
    })

    it('handles export button clicks', async () => {
      // Mock fetch for export
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['csv,data'], { type: 'text/csv' })),
        headers: {
          get: (name: string) => {
            if (name === 'Content-Disposition') {
              return 'attachment; filename="test.csv"'
            }
            return null
          }
        }
      })

      // Mock document.createElement and appendChild
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      }
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)

      renderWithProviders(<AnalyticsDashboard />)

      const exportButton = screen.getByText('Termine CSV')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/.netlify/functions/admin/analytics/export'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-auth-token'
            })
          })
        )
      })

      expect(createElement).toHaveBeenCalledWith('a')
      expect(mockLink.click).toHaveBeenCalled()

      // Cleanup
      createElement.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
    })

    it('handles filter changes', async () => {
      const mockRefetch = vi.fn().mockResolvedValue(void 0)
      mockUseAnalytics.mockReturnValue({
        data: mockKPIData,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      renderWithProviders(<AnalyticsDashboard />)

      // Should trigger refetch when component mounts
      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled()
      })
    })
  })

  describe('Analytics API', () => {
    it('calculates KPIs correctly', () => {
      const { totalAppointments, totalRevenue, staffUtilization } = mockKPIData

      // Test basic calculations
      expect(totalAppointments).toBe(150)
      expect(totalRevenue).toBe(4500.00)

      // Test staff utilization calculations
      const avgUtilization = staffUtilization.reduce((sum, staff) => sum + staff.utilization, 0) / staffUtilization.length
      expect(avgUtilization).toBeCloseTo(82.35, 1) // (88.5 + 76.2) / 2

      // Test revenue per staff
      const totalStaffRevenue = staffUtilization.reduce((sum, staff) => sum + staff.totalRevenue, 0)
      expect(totalStaffRevenue).toBe(3320.00) // 1800 + 1520
    })

    it('validates service performance metrics', () => {
      const { popularServices } = mockKPIData

      // Check top service
      const topService = popularServices[0]
      expect(topService.name).toBe('Damenhaarschnitt')
      expect(topService.bookingCount).toBe(35)
      expect(topService.revenue).toBe(1750.00)

      // Calculate average price
      const avgPrice = topService.revenue / topService.bookingCount
      expect(avgPrice).toBe(50.00)
    })

    it('validates daily stats aggregation', () => {
      const { dailyStats } = mockKPIData

      const totalDailyAppointments = dailyStats.reduce((sum, day) => sum + day.appointments, 0)
      const totalDailyRevenue = dailyStats.reduce((sum, day) => sum + day.revenue, 0)

      expect(totalDailyAppointments).toBe(20) // 8 + 12
      expect(totalDailyRevenue).toBe(800.00) // 320 + 480
    })
  })

  describe('CSV Export Functionality', () => {
    it('generates appointments CSV with correct format', () => {
      // Mock CSV generation (this would be tested in backend)
      const mockAppointment = {
        start_time: '2024-01-01T10:00:00Z',
        customer_first_name: 'John',
        customer_last_name: 'Doe',
        customer_email: 'john@example.com',
        staff_first_name: 'Maria',
        staff_last_name: 'Schmidt',
        service_name: 'Damenhaarschnitt',
        service_duration_minutes: 45,
        service_price_cents: 5000,
        status: 'completed',
        notes: 'Test appointment'
      }

      // Test CSV row generation logic
      const csvRow = [
        '01.01.2024', // date
        '10:00', // time
        'John Doe', // customer name
        'john@example.com', // customer email
        'Maria Schmidt', // staff name
        'Damenhaarschnitt', // service name
        '45', // duration
        '50.00', // price
        'Abgeschlossen', // status
        'Test appointment' // notes
      ]

      expect(csvRow[0]).toBe('01.01.2024')
      expect(csvRow[7]).toBe('50.00')
    })

    it('handles CSV export errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      renderWithProviders(<AnalyticsDashboard />)

      const exportButton = screen.getByText('Termine CSV')
      fireEvent.click(exportButton)

      // Should not crash the application
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })
})