import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, Service } from '@/lib/supabase'

// Hook to fetch all services
export const useServices = (includeInactive = false) => {
  return useQuery({
    queryKey: ['services', includeInactive],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const params = new URLSearchParams()
      if (includeInactive) {
        params.append('include_inactive', 'true')
      }

      const response = await fetch(`/.netlify/functions/services?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch services')
      }

      const result = await response.json()
      return result.services as Service[]
    },
  })
}

// Hook to fetch services by category
export const useServicesByCategory = (includeInactive = false) => {
  const { data: services, ...rest } = useServices(includeInactive)
  
  const servicesByCategory = services?.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = []
    }
    acc[service.category].push(service)
    return acc
  }, {} as Record<string, Service[]>) || {}

  return { data: servicesByCategory, services, ...rest }
}

// Hook to create a new service (admin only)
export const useCreateService = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (serviceData: {
      name: string
      description?: string
      category: string
      duration_minutes: number
      base_price: number
      is_active?: boolean
      sort_order?: number
    }) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify(serviceData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create service')
      }

      const result = await response.json()
      return result.service as Service
    },
    onSuccess: () => {
      // Invalidate services queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

// Hook to update a service (admin only)
export const useUpdateService = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updateData 
    }: { 
      id: string 
    } & Partial<{
      name: string
      description: string
      category: string
      duration_minutes: number
      base_price: number
      is_active: boolean
      sort_order: number
    }>) => {
      const { data, error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Service
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

// Hook to delete/deactivate a service (admin only)
export const useDeleteService = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (serviceId: string) => {
      // Instead of deleting, we set is_active to false to preserve data integrity
      const { data, error } = await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', serviceId)
        .select()
        .single()

      if (error) throw error
      return data as Service
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
}