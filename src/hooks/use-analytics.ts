/**
 * Analytics Hook
 * Custom hook for fetching and managing analytics data
 */

import React, { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

interface AnalyticsFilters {
  startDate: string
  endDate: string
  staffId: string
  serviceId: string
  period: 'day' | 'week' | 'month'
}

interface KPIData {
  totalAppointments: number
  totalRevenue: number
  averageServiceTime: number
  bookingRate: number
  cancellationRate: number
  staffUtilization: Array<{
    staffId: string
    name: string
    utilization: number
    totalAppointments: number
    totalRevenue: number
  }>
  popularServices: Array<{
    serviceId: string
    name: string
    bookingCount: number
    revenue: number
  }>
  dailyStats: Array<{
    date: string
    appointments: number
    revenue: number
    newCustomers: number
  }>
  period: 'day' | 'week' | 'month'
  dateRange: {
    startDate: string
    endDate: string
  }
}

interface UseAnalyticsReturn {
  data: KPIData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useAnalytics(filters: AnalyticsFilters): UseAnalyticsReturn {
  const [data, setData] = useState<KPIData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get auth token (simplified for demo - in production you'd use proper auth context)
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Not authenticated')
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        period: filters.period,
        startDate: filters.startDate,
        endDate: filters.endDate,
        ...(filters.staffId && { staffId: filters.staffId }),
        ...(filters.serviceId && { serviceId: filters.serviceId })
      })

      const response = await fetch(`/.netlify/functions/admin/analytics/kpis?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        if (response.status === 403) {
          throw new Error('Access denied - admin permissions required')
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded - please try again later')
        }
        
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch analytics data')
      }

      setData(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      console.error('Analytics fetch error:', err)
      
      // Show user-friendly error message
      if (errorMessage.includes('Authentication')) {
        toast.error('Anmeldung erforderlich')
      } else if (errorMessage.includes('Access denied')) {
        toast.error('Keine Berechtigung für Analytics')
      } else if (errorMessage.includes('Rate limit')) {
        toast.error('Zu viele Anfragen - bitte warten Sie kurz')
      } else {
        toast.error('Fehler beim Laden der Analytics-Daten')
      }
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  const refetch = useCallback(async () => {
    await fetchAnalytics()
  }, [fetchAnalytics])

  // Auto-fetch when filters change
  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return {
    data,
    isLoading,
    error,
    refetch
  }
}