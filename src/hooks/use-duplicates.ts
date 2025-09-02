/**
 * Custom hooks for customer duplicate detection and merging
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

interface DuplicateCustomer {
  id: string
  customer_number: string
  created_at: string
  profiles: {
    id: string
    email: string
    full_name: string
    phone?: string
  }
}

interface CustomerDuplicate {
  customer_a_id: string
  customer_b_id: string
  match_type: 'email' | 'phone' | 'name_fuzzy' | 'manual'
  confidence_score: number
  match_details: Record<string, any>
  status: 'pending' | 'reviewed' | 'merged' | 'dismissed'
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  customer_a?: DuplicateCustomer
  customer_b?: DuplicateCustomer
}

interface DuplicateDetectionFilters {
  customerId?: string
  confidenceThreshold?: number
  limit?: number
}

interface DuplicateListFilters {
  page?: number
  limit?: number
  status?: string
  matchType?: string
  minConfidence?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface MergePreview {
  primary_customer: any
  merge_customer: any
  merged_result: any
  transfer_summary: {
    appointments_to_transfer: number
    total_appointments_after_merge: number
  }
  merge_strategy: Record<string, string>
}

interface MergeStrategy {
  full_name?: 'primary' | 'merge'
  phone?: 'primary' | 'merge' | 'combine'
  date_of_birth?: 'primary' | 'merge'
  address_street?: 'primary' | 'merge'
  address_city?: 'primary' | 'merge'
  address_postal_code?: 'primary' | 'merge'
  emergency_contact_name?: 'primary' | 'merge'
  emergency_contact_phone?: 'primary' | 'merge'
  notes?: 'primary' | 'merge' | 'combine'
}

export function useDuplicateDetection() {
  const [duplicates, setDuplicates] = useState<CustomerDuplicate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const detectDuplicates = async (filters: DuplicateDetectionFilters = {}) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      if (filters.customerId) queryParams.append('customerId', filters.customerId)
      if (filters.confidenceThreshold) queryParams.append('confidenceThreshold', filters.confidenceThreshold.toString())
      if (filters.limit) queryParams.append('limit', filters.limit.toString())

      const response = await fetch(`/.netlify/functions/admin/customers/merge/detect?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to detect duplicates: ${response.statusText}`)
      }

      const data = await response.json()
      setDuplicates(data.duplicates || [])
      
      toast({
        title: 'Dubletten-Erkennung abgeschlossen',
        description: `${data.total} potenzielle Dubletten gefunden`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to detect duplicates'
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

  return {
    duplicates,
    loading,
    error,
    detectDuplicates,
  }
}

export function useDuplicateList(filters: DuplicateListFilters = {}) {
  const [duplicates, setDuplicates] = useState<CustomerDuplicate[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchDuplicates = async () => {
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

      const response = await fetch(`/.netlify/functions/admin/customers/merge/list?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch duplicates: ${response.statusText}`)
      }

      const data = await response.json()
      setDuplicates(data.duplicates || [])
      setPagination(data.pagination || null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch duplicates'
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
    fetchDuplicates()
  }, [user, filters])

  const refetch = () => {
    fetchDuplicates()
  }

  return {
    duplicates,
    pagination,
    loading,
    error,
    refetch,
  }
}

export function useDuplicateActions() {
  const { user } = useAuth()
  const { toast } = useToast()

  const markAsReviewed = async (duplicateId: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    try {
      const response = await fetch('/.netlify/functions/admin/customers/merge/mark-reviewed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ duplicateId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to mark as reviewed')
      }

      toast({
        title: 'Erfolg',
        description: 'Dublette als überprüft markiert',
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark as reviewed'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    }
  }

  const dismissDuplicate = async (duplicateId: string, reason?: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    try {
      const response = await fetch('/.netlify/functions/admin/customers/merge/dismiss', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ duplicateId, reason }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to dismiss duplicate')
      }

      toast({
        title: 'Erfolg',
        description: 'Dublette wurde abgewiesen',
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to dismiss duplicate'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    }
  }

  return {
    markAsReviewed,
    dismissDuplicate,
  }
}

export function useCustomerMerge() {
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const generateMergePreview = async (
    primaryCustomerId: string,
    mergeCustomerId: string,
    mergeStrategy: MergeStrategy
  ): Promise<MergePreview | null> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return null
    }

    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/admin/customers/merge/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryCustomerId,
          mergeCustomerId,
          mergeStrategy,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to generate merge preview')
      }

      return await response.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate merge preview'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  const executeMerge = async (
    primaryCustomerId: string,
    mergeCustomerId: string,
    mergeStrategy: MergeStrategy,
    notes?: string
  ): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/admin/customers/merge/execute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryCustomerId,
          mergeCustomerId,
          mergeStrategy,
          notes,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to execute merge')
      }

      const result = await response.json()
      toast({
        title: 'Erfolg',
        description: `Kunden erfolgreich zusammengeführt. ${result.appointments_transferred} Termine übertragen.`,
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute merge'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const getMergeHistory = async (filters: any = {}) => {
    if (!user) return null

    try {
      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/.netlify/functions/admin/customers/merge/history?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch merge history: ${response.statusText}`)
      }

      return await response.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch merge history'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }

  return {
    loading,
    generateMergePreview,
    executeMerge,
    getMergeHistory,
  }
}

export type { CustomerDuplicate, MergeStrategy, MergePreview, DuplicateCustomer }