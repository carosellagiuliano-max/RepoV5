import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bookingHelpers, Appointment } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

// Hook to fetch user's appointments (customers see their own, admins see all)
export const useAppointments = () => {
  const { user, isAdmin } = useAuth()

  return useQuery({
    queryKey: ['appointments', user?.id, isAdmin],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')
      
      if (isAdmin) {
        const { data, error } = await bookingHelpers.getAllAppointments()
        if (error) throw error
        return data
      } else {
        const { data, error } = await bookingHelpers.getUserAppointments(user.id)
        if (error) throw error
        return data
      }
    },
    enabled: !!user,
  })
}

// Hook to create a new appointment
export const useCreateAppointment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (appointmentData: {
      customer_id: string
      staff_id: string
      service_id: string
      start_time: string  // ✅ FIXED: Changed from starts_at
      end_time: string    // ✅ FIXED: Changed from ends_at
      price_cents: number // ✅ FIXED: Changed from price
      notes?: string
    }) => {
      const result = await bookingHelpers.createAppointment(appointmentData)
      return result.appointment as Appointment
    },
    onSuccess: () => {
      // Invalidate and refetch appointments
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      // Also invalidate availability to reflect the new booking
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

// Hook to cancel an appointment
export const useCancelAppointment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason?: string }) => {
      const result = await bookingHelpers.cancelAppointment(appointmentId, reason)
      return result.appointment as Appointment
    },
    onSuccess: () => {
      // Invalidate and refetch appointments
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      // Also invalidate availability to reflect the cancellation
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

// Hook to update appointment status (admin/staff only)
export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      appointmentId, 
      status, 
      notes 
    }: { 
      appointmentId: string
      status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
      notes?: string 
    }) => {
      const { data, error } = await import('@/lib/supabase').then(({ supabase }) => 
        supabase
          .from('appointments')
          .update({ 
            status,
            ...(notes && { internal_notes: notes })
          })
          .eq('id', appointmentId)
          .select(`
            *,
            customers (
              id,
              profiles (full_name, email, phone)
            ),
            staff (
              id,
              full_name,
              email,
              phone
            ),
            services (
              id,
              name,
              description,
              category,
              duration_minutes
            )
          `)
          .single()
      )

      if (error) throw error
      return data as Appointment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

// Hook to get appointments for a specific date range
export const useAppointmentsByDateRange = (startDate: string, endDate: string) => {
  const { user, isAdmin } = useAuth()

  return useQuery({
    queryKey: ['appointments', 'date-range', startDate, endDate, user?.id, isAdmin],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')
      
      const { supabase } = await import('@/lib/supabase')
      
      let query = supabase
        .from('appointments')
        .select(`
          *,
          customers (
            id,
            profiles (first_name, last_name, email, phone)
          ),
          staff (
            id,
            profiles (first_name, last_name, email, phone)
          ),
          services (
            id,
            name,
            description,
            category,
            duration_minutes,
            price_cents
          )
        `)
        .gte('start_time', startDate)  // ✅ FIXED: Changed from starts_at
        .lte('start_time', endDate)    // ✅ FIXED: Changed from starts_at
        .order('start_time', { ascending: true })  // ✅ FIXED: Changed from starts_at

      // If not admin, filter by customer
      if (!isAdmin) {
        // Get customer ID first
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('profile_id', user.id)
          .single()

        if (customerError || !customer) {
          return []
        }

        query = query.eq('customer_id', customer.id)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Appointment[]
    },
    enabled: !!user && !!startDate && !!endDate,
  })
}

// Hook to get appointments for a specific staff member
export const useStaffAppointments = (staffId: string, startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: ['appointments', 'staff', staffId, startDate, endDate],
    queryFn: async () => {
      const { supabase } = await import('@/lib/supabase')
      
      let query = supabase
        .from('appointments')
        .select(`
          *,
          customers (
            id,
            profiles (first_name, last_name, email, phone)
          ),
          services (
            id,
            name,
            description,
            category,
            duration_minutes,
            price_cents
          )
        `)
        .eq('staff_id', staffId)
        .order('start_time', { ascending: true })  // ✅ FIXED: Changed from starts_at

      if (startDate) {
        query = query.gte('start_time', startDate)  // ✅ FIXED: Changed from starts_at
      }
      if (endDate) {
        query = query.lte('start_time', endDate)    // ✅ FIXED: Changed from starts_at
      }

      const { data, error } = await query

      if (error) throw error
      return data as Appointment[]
    },
    enabled: !!staffId,
  })
}

// Legacy interface for backwards compatibility
export const useLegacyAppointments = () => {
  const { user } = useAuth()
  const { data: appointments = [], isLoading: loading, error: queryError, refetch } = useAppointments()
  const cancelMutation = useCancelAppointment()

  const cancelAppointment = async (appointmentId: string) => {
    if (!user) return { error: 'User not authenticated' }

    try {
      await cancelMutation.mutateAsync({ appointmentId })
      return { data: true }
    } catch (err: unknown) {
      return { error: (err as Error).message || 'Failed to cancel appointment' }
    }
  }

  const refreshAppointments = () => {
    refetch()
  }

  return {
    appointments,
    loading,
    error: queryError?.message || null,
    cancelAppointment,
    refreshAppointments
  }
}