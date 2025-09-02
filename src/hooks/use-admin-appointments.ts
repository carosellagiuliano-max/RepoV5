/**
 * Admin Appointments Hook
 * Enhanced hook for admin appointment management with conflict checking,
 * drag & drop reschedule, and optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { AppointmentWithDetails } from '@/lib/types/database'
import { toast } from 'sonner'

export interface AppointmentFilters {
  staffId?: string
  serviceId?: string
  customerId?: string
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  startDate?: string
  endDate?: string
  search?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ConflictCheck {
  appointmentId?: string
  staffId: string
  startTime: string
  endTime: string
}

export interface AppointmentReschedule {
  appointmentId: string
  startTime: string
  endTime: string
  staffId?: string
}

export interface AppointmentCancel {
  appointmentId: string
  reason?: string
}

export interface AppointmentCreate {
  customerId: string
  staffId: string
  serviceId: string
  startTime: string
  endTime: string
  notes?: string
  status?: 'pending' | 'confirmed'
}

export interface AppointmentStatusUpdate {
  appointmentId: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  notes?: string
}

// API Response types
interface AdminAppointmentsResponse {
  appointments: AppointmentWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats?: {
    todayCount: number
    todayRevenue: number
    statusBreakdown: Array<{
      status: string
      count: number
      percentage: number
    }>
    topStaff: Array<{
      staffId: string
      staffName: string
      appointmentCount: number
      revenue: number
    }>
    topServices: Array<{
      serviceId: string
      serviceName: string
      bookingCount: number
      revenue: number
    }>
  }
}

interface ConflictCheckResponse {
  hasConflicts: boolean
  conflicts: Array<{
    type: string
    message: string
    conflictingAppointment?: AppointmentWithDetails
  }>
  suggestions: Array<{
    startTime: string
    endTime: string
    staffId: string
  }>
}

// Admin API base URL
const ADMIN_API_BASE = '/.netlify/functions/admin'

async function adminRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Get auth token from localStorage for now - in production this should use proper auth context
  const token = localStorage.getItem('admin_token') || localStorage.getItem('supabase.auth.token')
  
  const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

export function useAdminAppointments(filters: AppointmentFilters = {}) {
  const queryClient = useQueryClient()
  const { user, isAdmin } = useAuth()

  // Fetch appointments with filters
  const appointmentsQuery = useQuery({
    queryKey: ['admin-appointments', filters],
    queryFn: async () => {
      if (!isAdmin) throw new Error('Admin access required')
      
      const searchParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString())
        }
      })

      const data = await adminRequest<AdminAppointmentsResponse>(`/appointments/list?${searchParams}`)
      return data
    },
    enabled: !!user && isAdmin,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  // Check for appointment conflicts
  const checkConflictsMutation = useMutation({
    mutationFn: async (conflictData: ConflictCheck) => {
      const response = await adminRequest('/appointments/check-conflicts', {
        method: 'POST',
        body: JSON.stringify(conflictData),
      })
      return {
        hasConflicts: response.hasConflicts ?? Array.isArray(response.conflicts) && response.conflicts.length > 0,
        conflicts: response.conflicts ?? [],
        suggestions: response.suggestions ?? [],
      }
    },
  })

  // Create appointment
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: AppointmentCreate) => {
      return await adminRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify(appointmentData),
      })
    },
    onMutate: async (newAppointment) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-appointments'] })

      // Snapshot the previous value
      const previousAppointments = queryClient.getQueryData(['admin-appointments', filters])

      // Optimistically update to the new value
      const optimisticAppointment = {
        id: `temp-${Date.now()}`,
        ...newAppointment,
        status: newAppointment.status || 'pending',
        created_at: new Date().toISOString(),
        customer_name: 'Lädt...',
        staff_name: 'Lädt...',
        service_name: 'Lädt...',
      }

      queryClient.setQueryData(['admin-appointments', filters], (old: AdminAppointmentsResponse | undefined) => ({
        ...old,
        appointments: [...(old?.appointments || []), optimisticAppointment]
      }))

      return { previousAppointments, optimisticAppointment }
    },
    onError: (err, newAppointment, context) => {
      // Revert the optimistic update
      if (context?.previousAppointments) {
        queryClient.setQueryData(['admin-appointments', filters], context.previousAppointments)
      }
      toast.error('Fehler beim Erstellen des Termins')
    },
    onSuccess: () => {
      toast.success('Termin erfolgreich erstellt')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] })
    },
  })

  // Reschedule appointment
  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async (rescheduleData: AppointmentReschedule) => {
      return await adminRequest(`/appointments/${rescheduleData.appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          start_time: rescheduleData.startTime,
          end_time: rescheduleData.endTime,
          staff_id: rescheduleData.staffId,
        }),
      })
    },
    onMutate: async (rescheduleData) => {
      await queryClient.cancelQueries({ queryKey: ['admin-appointments'] })

      const previousAppointments = queryClient.getQueryData(['admin-appointments', filters])

      // Optimistically update the appointment
      queryClient.setQueryData(['admin-appointments', filters], (old: AdminAppointmentsResponse | undefined) => ({
        ...old,
        appointments: old?.appointments?.map((apt: AppointmentWithDetails) =>
          apt.id === rescheduleData.appointmentId
            ? {
                ...apt,
                start_time: rescheduleData.startTime,
                end_time: rescheduleData.endTime,
                staff_id: rescheduleData.staffId || apt.staff_id,
              }
            : apt
        ) || []
      }))

      return { previousAppointments }
    },
    onError: (err, rescheduleData, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(['admin-appointments', filters], context.previousAppointments)
      }
      toast.error('Fehler beim Verschieben des Termins')
    },
    onSuccess: () => {
      toast.success('Termin erfolgreich verschoben')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] })
    },
  })

  // Cancel appointment
  const cancelAppointmentMutation = useMutation({
    mutationFn: async (cancelData: AppointmentCancel) => {
      return await adminRequest(`/appointments/${cancelData.appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'cancelled',
          cancellation_reason: cancelData.reason,
        }),
      })
    },
    onMutate: async (cancelData) => {
      await queryClient.cancelQueries({ queryKey: ['admin-appointments'] })

      const previousAppointments = queryClient.getQueryData(['admin-appointments', filters])

      // Optimistically update the appointment
      queryClient.setQueryData(['admin-appointments', filters], (old: AdminAppointmentsResponse | undefined) => ({
        ...old,
        appointments: old?.appointments?.map((apt: AppointmentWithDetails) =>
          apt.id === cancelData.appointmentId
            ? { ...apt, status: 'cancelled', cancellation_reason: cancelData.reason }
            : apt
        ) || []
      }))

      return { previousAppointments }
    },
    onError: (err, cancelData, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(['admin-appointments', filters], context.previousAppointments)
      }
      toast.error('Fehler beim Stornieren des Termins')
    },
    onSuccess: () => {
      toast.success('Termin erfolgreich storniert')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] })
    },
  })

  // Update appointment status
  const updateAppointmentStatusMutation = useMutation({
    mutationFn: async (statusData: AppointmentStatusUpdate) => {
      return await adminRequest(`/appointments/${statusData.appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: statusData.status,
          notes: statusData.notes,
        }),
      })
    },
    onMutate: async (statusData) => {
      await queryClient.cancelQueries({ queryKey: ['admin-appointments'] })

      const previousAppointments = queryClient.getQueryData(['admin-appointments', filters])

      queryClient.setQueryData(['admin-appointments', filters], (old: AdminAppointmentsResponse | undefined) => ({
        ...old,
        appointments: old?.appointments?.map((apt: AppointmentWithDetails) =>
          apt.id === statusData.appointmentId
            ? { ...apt, status: statusData.status, notes: statusData.notes }
            : apt
        ) || []
      }))

      return { previousAppointments }
    },
    onError: (err, statusData, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(['admin-appointments', filters], context.previousAppointments)
      }
      toast.error('Fehler beim Aktualisieren des Terminstatus')
    },
    onSuccess: () => {
      toast.success('Terminstatus erfolgreich aktualisiert')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] })
    },
  })

  return {
    // Data
    appointments: appointmentsQuery.data?.appointments || [],
    pagination: appointmentsQuery.data?.pagination,
    loading: appointmentsQuery.isLoading,
    error: appointmentsQuery.error,

    // Mutations
    createAppointment: createAppointmentMutation,
    rescheduleAppointment: rescheduleAppointmentMutation,
    cancelAppointment: cancelAppointmentMutation,
    updateAppointmentStatus: updateAppointmentStatusMutation,
    checkConflicts: checkConflictsMutation,

    // Utilities
    refetch: appointmentsQuery.refetch,
    isRefetching: appointmentsQuery.isRefetching,
  }
}