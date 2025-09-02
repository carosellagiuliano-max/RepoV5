import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, Customer } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

// Hook to fetch customers (admin can see all, customers see only their own)
export const useCustomers = () => {
  const { user, isAdmin } = useAuth()

  return useQuery({
    queryKey: ['customers', user?.id, isAdmin],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      let query = supabase
        .from('customers')
        .select(`
          *,
          profiles (
            id,
            email,
            full_name,
            phone,
            role
          )
        `)

      // If not admin, only show own customer record
      if (!isAdmin) {
        query = query.eq('profile_id', user.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return data as Customer[]
    },
    enabled: !!user,
  })
}

// Hook to get current user's customer profile
export const useCurrentCustomer = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['customer', 'current', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          profiles (
            id,
            email,
            full_name,
            phone,
            role
          )
        `)
        .eq('profile_id', user.id)
        .single()

      if (error) {
        // If no customer record exists, return null instead of throwing
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }
      return data as Customer
    },
    enabled: !!user,
  })
}

// Hook to create a customer profile
export const useCreateCustomer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (customerData: {
      profile_id?: string
      customer_number?: string
      date_of_birth?: string
      address_street?: string
      address_city?: string
      address_postal_code?: string
      emergency_contact_name?: string
      emergency_contact_phone?: string
      notes?: string
    }) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select(`
          *,
          profiles (
            id,
            email,
            full_name,
            phone,
            role
          )
        `)
        .single()

      if (error) throw error
      return data as Customer
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}

// Hook to update customer profile
export const useUpdateCustomer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updateData 
    }: { 
      id: string 
    } & Partial<{
      customer_number: string
      date_of_birth: string
      address_street: string
      address_city: string
      address_postal_code: string
      emergency_contact_name: string
      emergency_contact_phone: string
      notes: string
    }>) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          profiles (
            id,
            email,
            full_name,
            phone,
            role
          )
        `)
        .single()

      if (error) throw error
      return data as Customer
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}

// Hook to create customer from existing user profile
export const useCreateCustomerFromProfile = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (additionalData?: {
      date_of_birth?: string
      address_street?: string
      address_city?: string
      address_postal_code?: string
      emergency_contact_name?: string
      emergency_contact_phone?: string
      notes?: string
    }) => {
      if (!user) throw new Error('User not authenticated')

      // Generate customer number
      const customerNumber = `C${Date.now().toString().slice(-6)}`

      const customerData = {
        profile_id: user.id,
        customer_number: customerNumber,
        ...additionalData
      }

      const { data, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select(`
          *,
          profiles (
            id,
            email,
            full_name,
            phone,
            role
          )
        `)
        .single()

      if (error) throw error
      return data as Customer
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}

// Hook to update user profile information
export const useUpdateProfile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updateData 
    }: { 
      id: string 
    } & Partial<{
      full_name: string
      phone: string
    }>) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
    },
  })
}

// Hook to search customers (admin only)
export const useSearchCustomers = (searchTerm: string) => {
  const { isAdmin } = useAuth()

  return useQuery({
    queryKey: ['customers', 'search', searchTerm],
    queryFn: async () => {
      if (!isAdmin) throw new Error('Insufficient permissions')
      if (!searchTerm || searchTerm.length < 2) return []

      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          profiles (
            id,
            email,
            full_name,
            phone,
            role
          )
        `)
        .or(`customer_number.ilike.%${searchTerm}%,profiles.full_name.ilike.%${searchTerm}%,profiles.email.ilike.%${searchTerm}%,profiles.phone.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data as Customer[]
    },
    enabled: !!searchTerm && searchTerm.length >= 2 && isAdmin,
  })
}