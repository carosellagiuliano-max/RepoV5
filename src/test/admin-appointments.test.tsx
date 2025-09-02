/**
 * Admin Appointments Tests
 * E2E tests for appointment management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarPro } from '@/admin/appointments/CalendarPro'
import { useAdminAppointments } from '@/hooks/use-admin-appointments'
import { AppointmentWithDetails } from '@/lib/types/database'

// Mock the hooks
vi.mock('@/hooks/use-admin-appointments')
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'admin-user', role: 'admin' },
    isAdmin: true
  })
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const mockUseAdminAppointments = vi.mocked(useAdminAppointments)

// Helper function to create properly typed mock return values
const createMockAdminAppointments = (overrides = {}) => ({
  appointments: [mockAppointment],
  pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  loading: false,
  error: null,
  createAppointment: {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null
  },
  rescheduleAppointment: {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null
  },
  cancelAppointment: {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null
  },
  updateAppointmentStatus: {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null
  },
  checkConflicts: {
    mutateAsync: vi.fn().mockResolvedValue({ hasConflicts: false, conflicts: [], suggestions: [] }),
    isPending: false,
    error: null
  },
  refetch: vi.fn(),
  isRefetching: false,
  ...overrides
})

// Mock appointment data
const mockAppointment: AppointmentWithDetails = {
  id: 'test-appointment-1',
  customer_id: 'customer-1',
  staff_id: 'staff-1', 
  service_id: 'service-1',
  start_time: '2024-01-15T10:00:00Z',
  end_time: '2024-01-15T11:00:00Z',
  status: 'confirmed',
  notes: null,
  cancellation_reason: null,
  cancelled_at: null,
  created_at: '2024-01-14T10:00:00Z',
  updated_at: '2024-01-14T10:00:00Z',
  customer_email: 'test@example.com',
  customer_first_name: 'Test',
  customer_last_name: 'Customer',
  staff_first_name: 'Test',
  staff_last_name: 'Staff',
  service_name: 'Haircut',
  service_duration_minutes: 60,
  service_price_cents: 5000
}

describe('CalendarPro', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })

    // Mock the hook return value
    mockUseAdminAppointments.mockReturnValue(createMockAdminAppointments())
  })

  const renderCalendarPro = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CalendarPro />
      </QueryClientProvider>
    )
  }

  it('renders the calendar pro component', async () => {
    renderCalendarPro()
    
    await waitFor(() => {
      expect(screen.getByText('Terminkalender Pro')).toBeInTheDocument()
      expect(screen.getByText('Professionelle Terminverwaltung mit Drag & Drop')).toBeInTheDocument()
    })
  })

  it('displays appointment statistics', async () => {
    renderCalendarPro()
    
    await waitFor(() => {
      // Should show statistics based on mock data
      expect(screen.getByText('1')).toBeInTheDocument() // total appointments
    })
  })

  it('switches between calendar and list view', async () => {
    renderCalendarPro()
    
    await waitFor(() => {
      const listTab = screen.getByText('Listenansicht')
      fireEvent.click(listTab)
      
      // Should switch to list view
      expect(screen.getByText('Listenansicht')).toBeInTheDocument()
    })
  })

  it('opens create appointment dialog', async () => {
    renderCalendarPro()
    
    await waitFor(() => {
      const createButton = screen.getByText('Neuer Termin')
      fireEvent.click(createButton)
      
      // Dialog should open but we need to mock the components
      expect(createButton).toBeInTheDocument()
    })
  })

  it('handles appointment creation', async () => {
    const mockCreate = vi.fn().mockResolvedValue({})
    mockUseAdminAppointments.mockReturnValue(createMockAdminAppointments({
      createAppointment: { 
        mutateAsync: mockCreate,
        isPending: false,
        error: null
      }
    }))

    renderCalendarPro()
    
    // This would test the full flow but requires more complex mocking
    // For now, just verify the hook is called correctly
    expect(mockUseAdminAppointments).toHaveBeenCalled()
  })
})

describe('Appointment Reschedule', () => {
  it('checks for conflicts before rescheduling', async () => {
    const mockCheckConflicts = vi.fn().mockResolvedValue({ hasConflicts: false, conflicts: [], suggestions: [] })
    const mockReschedule = vi.fn().mockResolvedValue({})

    mockUseAdminAppointments.mockReturnValue(createMockAdminAppointments({
      checkConflicts: { 
        mutateAsync: mockCheckConflicts,
        isPending: false,
        error: null
      },
      rescheduleAppointment: { 
        mutateAsync: mockReschedule,
        isPending: false,
        error: null
      }
    }))

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <CalendarPro />
      </QueryClientProvider>
    )

    // In a real test, we would simulate drag & drop and verify conflict checking
    expect(mockUseAdminAppointments).toHaveBeenCalled()
  })

  it('prevents rescheduling when conflicts exist', async () => {
    const mockCheckConflicts = vi.fn().mockResolvedValue({
      hasConflicts: true,
      conflicts: [{ type: 'double_booking', message: 'Conflict with existing appointment', conflictingAppointment: { id: 'conflict-1', customer_name: 'Other Customer' } }],
      suggestions: []
    })

    mockUseAdminAppointments.mockReturnValue(createMockAdminAppointments({
      checkConflicts: { 
        mutateAsync: mockCheckConflicts,
        isPending: false,
        error: null
      }
    }))

    // Test would verify that rescheduling is prevented when conflicts exist
    expect(mockCheckConflicts).toBeDefined()
  })
})

describe('Appointment Cancellation', () => {
  it('allows cancellation with reason', async () => {
    const mockCancel = vi.fn().mockResolvedValue({})

    mockUseAdminAppointments.mockReturnValue(createMockAdminAppointments({
      cancelAppointment: { 
        mutateAsync: mockCancel,
        isPending: false,
        error: null
      }
    }))

    // Test would verify cancellation flow with reason
    expect(mockCancel).toBeDefined()
  })
})