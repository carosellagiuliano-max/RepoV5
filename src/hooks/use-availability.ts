import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, AvailableSlot, StaffWithAvailability } from '@/lib/supabase'

// Hook to fetch availability for a service on a specific date
export const useAvailability = (serviceId: string, date: string, staffId?: string) => {
  return useQuery({
    queryKey: ['availability', serviceId, date, staffId],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const params = new URLSearchParams({
        service_id: serviceId,
        date: date
      })
      
      if (staffId) {
        params.append('staff_id', staffId)
      }

      const response = await fetch(`/.netlify/functions/availability?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch availability')
      }

      const result = await response.json()
      return result
    },
    enabled: !!serviceId && !!date,
  })
}

// Hook to fetch available slots for a specific staff member and service
export const useAvailableSlots = (staffId: string, serviceId: string, date: string) => {
  const { data, ...rest } = useAvailability(serviceId, date, staffId)
  
  return {
    data: data?.slots as AvailableSlot[] || [],
    ...rest
  }
}

// Hook to fetch available staff for a service on a date
export const useAvailableStaff = (serviceId: string, date: string) => {
  const { data, ...rest } = useAvailability(serviceId, date)
  
  return {
    data: data?.staff as StaffWithAvailability[] || [],
    ...rest
  }
}

// Hook to manage staff availability schedules
export const useStaffAvailability = (staffId?: string) => {
  const queryClient = useQueryClient()

  // Fetch availability schedule
  const { data: availability, ...queryRest } = useQuery({
    queryKey: ['staff-availability', staffId],
    queryFn: async () => {
      if (!staffId) return []

      const { data, error } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('staff_id', staffId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!staffId,
  })

  // Create availability slot
  const createAvailability = useMutation({
    mutationFn: async (availabilityData: {
      staff_id: string
      day_of_week: number
      start_time: string
      end_time: string
      availability_type?: 'available' | 'unavailable'
    }) => {
      const { data, error } = await supabase
        .from('staff_availability')
        .insert(availabilityData)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  // Update availability slot
  const updateAvailability = useMutation({
    mutationFn: async ({ 
      id, 
      ...updateData 
    }: { 
      id: string 
    } & Partial<{
      day_of_week: number
      start_time: string
      end_time: string
      availability_type: 'available' | 'unavailable'
    }>) => {
      const { data, error } = await supabase
        .from('staff_availability')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  // Delete availability slot
  const deleteAvailability = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff_availability')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  return {
    availability,
    ...queryRest,
    createAvailability,
    updateAvailability,
    deleteAvailability
  }
}

// Hook to manage staff time off
export const useStaffTimeoff = (staffId?: string) => {
  const queryClient = useQueryClient()

  // Fetch time off records
  const { data: timeoff, ...queryRest } = useQuery({
    queryKey: ['staff-timeoff', staffId],
    queryFn: async () => {
      if (!staffId) return []

      const { data, error } = await supabase
        .from('staff_timeoff')
        .select('*')
        .eq('staff_id', staffId)
        .order('start_date', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!staffId,
  })

  // Create time off
  const createTimeoff = useMutation({
    mutationFn: async (timeoffData: {
      staff_id: string
      start_date: string
      end_date: string
      start_time?: string
      end_time?: string
      reason?: string
      type?: string
    }) => {
      const { data, error } = await supabase
        .from('staff_timeoff')
        .insert(timeoffData)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-timeoff'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  // Update time off
  const updateTimeoff = useMutation({
    mutationFn: async ({ 
      id, 
      ...updateData 
    }: { 
      id: string 
    } & Partial<{
      start_date: string
      end_date: string
      start_time: string
      end_time: string
      reason: string
      type: string
    }>) => {
      const { data, error } = await supabase
        .from('staff_timeoff')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-timeoff'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  // Delete time off
  const deleteTimeoff = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff_timeoff')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-timeoff'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  return {
    timeoff,
    ...queryRest,
    createTimeoff,
    updateTimeoff,
    deleteTimeoff
  }
}