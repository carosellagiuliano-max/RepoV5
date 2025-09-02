/**
 * Custom hooks for customer management API calls with GDPR compliance
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

interface Customer {
  id: string;
  customer_number: string;
  profile_id: string;
  date_of_birth?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  gdpr_consent_given: boolean;
  gdpr_consent_date?: string;
  is_deleted: boolean;
  deleted_at?: string;
  deleted_by?: string;
  deletion_reason?: string;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    email: string;
    full_name: string;
    phone?: string;
    role: string;
    created_at: string;
    updated_at: string;
  };
  stats?: {
    total_appointments: number;
    upcoming_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    total_spent: number;
    last_appointment_date?: string;
  };
}

interface CustomerFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isDeleted?: boolean;
  hasGdprConsent?: boolean;
  city?: string;
  postalCode?: string;
  registeredAfter?: string;
  registeredBefore?: string;
}

interface CustomerCreateData {
  email: string;
  full_name: string;
  phone?: string;
  customer_number?: string;
  date_of_birth?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  gdpr_consent_given?: boolean;
}

interface CustomerUpdateData {
  full_name?: string;
  phone?: string;
  date_of_birth?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  gdpr_consent_given?: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useCustomers(filters: CustomerFilters = {}) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchCustomers = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/.netlify/functions/admin/customers?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch customers: ${response.statusText}`)
      }

      const data = await response.json()
      setCustomers(data.customers || [])
      setPagination(data.pagination || null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch customers'
      setError(errorMessage)
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [user]) // Remove complex JSON.stringify dependency to avoid re-renders

  // Separate useEffect for filters to manually trigger refetch
  useEffect(() => {
    if (user) {
      fetchCustomers()
    }
  }, [filters, user])

  const refetch = () => {
    fetchCustomers()
  }

  return {
    customers,
    pagination,
    loading,
    error,
    refetch,
  }
}

export function useCustomer(customerId: string | null) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchCustomer = async (id: string) => {
    if (!user || !id) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/.netlify/functions/admin/customers/${id}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch customer: ${response.statusText}`)
      }

      const data = await response.json()
      setCustomer(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch customer'
      setError(errorMessage)
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (customerId && user) {
      fetchCustomer(customerId)
    } else {
      setCustomer(null)
    }
  }, [customerId, user])

  return {
    customer,
    loading,
    error,
    refetch: () => customerId && fetchCustomer(customerId),
  }
}

export function useCustomerActions() {
  const { user } = useAuth()
  const { toast } = useToast()

  const createCustomer = async (data: CustomerCreateData): Promise<Customer | null> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return null
    }

    try {
      const response = await fetch('/.netlify/functions/admin/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create customer')
      }

      const customer = await response.json()
      toast({
        title: 'Erfolg',
        description: 'Kunde wurde erfolgreich erstellt',
      })
      return customer
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create customer'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }

  const updateCustomer = async (id: string, data: CustomerUpdateData): Promise<Customer | null> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return null
    }

    try {
      const response = await fetch(`/.netlify/functions/admin/customers/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update customer')
      }

      const customer = await response.json()
      toast({
        title: 'Erfolg',
        description: 'Kunde wurde erfolgreich aktualisiert',
      })
      return customer
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update customer'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }

  const softDeleteCustomer = async (id: string, reason?: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    try {
      const response = await fetch(`/.netlify/functions/admin/customers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete customer')
      }

      toast({
        title: 'Erfolg',
        description: 'Kunde wurde erfolgreich gelöscht',
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete customer'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    }
  }

  const restoreCustomer = async (id: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    try {
      const response = await fetch(`/.netlify/functions/admin/customers/${id}/restore`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to restore customer')
      }

      toast({
        title: 'Erfolg',
        description: 'Kunde wurde erfolgreich wiederhergestellt',
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore customer'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    }
  }

  const exportCustomerData = async (id: string): Promise<Record<string, unknown> | null> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return null
    }

    try {
      const response = await fetch(`/.netlify/functions/admin/customers/${id}/export`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to export customer data')
      }

      const exportData = await response.json()
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-export-${id}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: 'Erfolg',
        description: 'Kundendaten wurden erfolgreich exportiert',
      })
      return exportData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export customer data'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }

  const getCustomerAuditLog = async (id: string): Promise<Record<string, unknown>[] | null> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return null
    }

    try {
      const response = await fetch(`/.netlify/functions/admin/customers/${id}/audit-log`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch audit log')
      }

      const data = await response.json()
      return data.auditLog || []
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch audit log'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }

  return {
    createCustomer,
    updateCustomer,
    softDeleteCustomer,
    restoreCustomer,
    exportCustomerData,
    getCustomerAuditLog,
  }
}

// Legacy exports for backward compatibility
export { useCustomers as useCustomersCompat }
export type { Customer }