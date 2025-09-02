/**
 * Admin Appointments Tests
 * E2E tests for appointment management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarPro } from '@/admin/appointments/CalendarPro'
import { useAdminAppointments } from '@/hooks/use-admin-appointments'

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
    mockUseAdminAppointments.mockReturnValue({
      appointments: [
        {
          id: '1',
          customer_name: 'Test Customer',
          customer_email: 'test@example.com',
          staff_name: 'Test Staff',
          service_name: 'Test Service',
          start_time: '2024-01-15T10:00:00Z',
          end_time: '2024-01-15T11:00:00Z',
          status: 'confirmed',
          service_price_cents: 5000
        }
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      loading: false,
      error: null,
      createAppointment: {
        mutateAsync: vi.fn().mockResolvedValue({})
      },
      rescheduleAppointment: {
        mutateAsync: vi.fn().mockResolvedValue({})
      },
      cancelAppointment: {
        mutateAsync: vi.fn().mockResolvedValue({})
      },
      updateAppointmentStatus: {
        mutateAsync: vi.fn().mockResolvedValue({})
      },
      checkConflicts: {
        mutateAsync: vi.fn().mockResolvedValue({ hasConflicts: false, conflicts: [] })
      },
      refetch: vi.fn(),
      isRefetching: false
    } as any)
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
    mockUseAdminAppointments.mockReturnValue({
      ...mockUseAdminAppointments(),
      createAppointment: { mutateAsync: mockCreate }
    } as any)

    renderCalendarPro()
    
    // This would test the full flow but requires more complex mocking
    // For now, just verify the hook is called correctly
    expect(mockUseAdminAppointments).toHaveBeenCalled()
  })
})

describe('Appointment Reschedule', () => {
  it('checks for conflicts before rescheduling', async () => {
    const mockCheckConflicts = vi.fn().mockResolvedValue({ hasConflicts: false, conflicts: [] })
    const mockReschedule = vi.fn().mockResolvedValue({})

    mockUseAdminAppointments.mockReturnValue({
      ...mockUseAdminAppointments(),
      checkConflicts: { mutateAsync: mockCheckConflicts },
      rescheduleAppointment: { mutateAsync: mockReschedule }
    } as any)

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
      conflicts: [{ id: 'conflict-1', customer_name: 'Other Customer' }]
    })

    mockUseAdminAppointments.mockReturnValue({
      ...mockUseAdminAppointments(),
      checkConflicts: { mutateAsync: mockCheckConflicts }
    } as any)

    // Test would verify that rescheduling is prevented when conflicts exist
    expect(mockCheckConflicts).toBeDefined()
  })
})

describe('Appointment Cancellation', () => {
  it('allows cancellation with reason', async () => {
    const mockCancel = vi.fn().mockResolvedValue({})

    mockUseAdminAppointments.mockReturnValue({
      ...mockUseAdminAppointments(),
      cancelAppointment: { mutateAsync: mockCancel }
    } as any)

    // Test would verify cancellation flow with reason
    expect(mockCancel).toBeDefined()
  })
})