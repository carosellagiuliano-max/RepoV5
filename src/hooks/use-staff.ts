import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, Staff, ServiceWithCustomPrice } from '@/lib/supabase'

// Hook to fetch all staff
export const useStaff = (options?: {
  serviceId?: string
  includeInactive?: boolean
  includeServices?: boolean
}) => {
  return useQuery({
    queryKey: ['staff', options],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const params = new URLSearchParams()
      if (options?.serviceId) {
        params.append('service_id', options.serviceId)
      }
      if (options?.includeInactive) {
        params.append('include_inactive', 'true')
      }
      if (options?.includeServices) {
        params.append('include_services', 'true')
      }

      const response = await fetch(`/.netlify/functions/staff?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch staff')
      }

      const result = await response.json()
      return result.staff as Staff[]
    },
  })
}

// Hook to fetch staff members who offer a specific service
export const useStaffByService = (serviceId: string) => {
  return useStaff({ serviceId, includeServices: true })
}

// Hook to fetch active staff with their services
export const useActiveStaffWithServices = () => {
  return useStaff({ includeServices: true })
}

// Hook to create a new staff member (admin only)
export const useCreateStaff = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (staffData: {
      staff_number: string
      full_name: string
      email?: string
      phone?: string
      status?: 'active' | 'inactive'
      specialties?: string[]
      bio?: string
      hire_date?: string
      hourly_rate?: number
      avatar_url?: string
    }) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify(staffData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create staff member')
      }

      const result = await response.json()
      return result.staff as Staff
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// Hook to update a staff member (admin only)
export const useUpdateStaff = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updateData 
    }: { 
      id: string 
    } & Partial<{
      staff_number: string
      full_name: string
      email: string
      phone: string
      status: 'active' | 'inactive'
      specialties: string[]
      bio: string
      hire_date: string
      hourly_rate: number
      avatar_url: string
    }>) => {
      const { data, error } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Staff
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// Hook to deactivate a staff member (admin only)
export const useDeactivateStaff = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (staffId: string) => {
      const { data, error } = await supabase
        .from('staff')
        .update({ status: 'inactive' })
        .eq('id', staffId)
        .select()
        .single()

      if (error) throw error
      return data as Staff
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}

// Hook to manage staff-service assignments
export const useStaffServiceAssignment = () => {
  const queryClient = useQueryClient()

  const assignService = useMutation({
    mutationFn: async (assignment: {
      staff_id: string
      service_id: string
      custom_price?: number
      estimated_duration_minutes?: number
    }) => {
      const { data, error } = await supabase
        .from('staff_services')
        .insert(assignment)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  const unassignService = useMutation({
    mutationFn: async ({ staffId, serviceId }: { staffId: string; serviceId: string }) => {
      const { error } = await supabase
        .from('staff_services')
        .delete()
        .eq('staff_id', staffId)
        .eq('service_id', serviceId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  const updateAssignment = useMutation({
    mutationFn: async ({
      staffId,
      serviceId,
      custom_price,
      estimated_duration_minutes,
      is_active
    }: {
      staffId: string
      serviceId: string
      custom_price?: number
      estimated_duration_minutes?: number
      is_active?: boolean
    }) => {
      const { data, error } = await supabase
        .from('staff_services')
        .update({
          custom_price,
          estimated_duration_minutes,
          is_active
        })
        .eq('staff_id', staffId)
        .eq('service_id', serviceId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  return {
    assignService,
    unassignService,
    updateAssignment
  }
}