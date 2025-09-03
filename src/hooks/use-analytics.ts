/**
 * Enhanced Analytics Hook
 * Custom hook for fetching and managing analytics data with realtime updates
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { 
  AnalyticsFilters, 
  KPIData, 
  RealtimeConfig, 
  RealtimeEvent,
  AnalyticsPermissions 
} from '@/lib/types/analytics'

interface UseAnalyticsReturn {
  data: KPIData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  isRealTimeConnected: boolean
  permissions: AnalyticsPermissions | null
}

const defaultRealtimeConfig: RealtimeConfig = {
  enabled: true,
  fallbackPollingInterval: 30000, // 30 seconds
  maxReconnectAttempts: 5
}

export function useAnalytics(
  filters: AnalyticsFilters, 
  realtimeConfig: RealtimeConfig = defaultRealtimeConfig
): UseAnalyticsReturn {
  const [data, setData] = useState<KPIData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false)
  const [permissions, setPermissions] = useState<AnalyticsPermissions | null>(null)
  
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

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
        ...(filters.serviceId && { serviceId: filters.serviceId }),
        ...(filters.comparisonPeriod && { comparisonPeriod: filters.comparisonPeriod })
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

      setData({
        ...result.data,
        realTimeUpdate: true
      })
      
      // Extract permissions from response
      if (result.permissions) {
        setPermissions(result.permissions)
      }
      
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

  // Cleanup function
  const cleanup = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    
    setIsRealTimeConnected(false)
  }, [])

  // Realtime subscription setup
  const setupRealtimeSubscription = useCallback(() => {
    if (!realtimeConfig.enabled) return

    try {
      // Clean up existing subscription
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }

      // Subscribe to appointments table changes
      realtimeChannelRef.current = supabase
        .channel('analytics_updates')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'appointments' 
          }, 
          (payload) => {
            console.log('Realtime appointment update:', payload)
            
            // Debounce rapid updates
            setTimeout(() => {
              fetchAnalytics()
            }, 1000)
          }
        )
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'customers'
          },
          (payload) => {
            console.log('Realtime customer update:', payload)
            setTimeout(() => {
              fetchAnalytics()
            }, 1000)
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status)
          
          if (status === 'SUBSCRIBED') {
            setIsRealTimeConnected(true)
            reconnectAttemptsRef.current = 0
            toast.success('Live-Updates aktiviert')
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsRealTimeConnected(false)
            
            // Attempt reconnection
            if (reconnectAttemptsRef.current < realtimeConfig.maxReconnectAttempts) {
              reconnectAttemptsRef.current += 1
              console.log(`Attempting realtime reconnection ${reconnectAttemptsRef.current}/${realtimeConfig.maxReconnectAttempts}`)
              
              setTimeout(() => {
                setupRealtimeSubscription()
              }, 2000 * reconnectAttemptsRef.current) // Exponential backoff
            } else {
              console.log('Max reconnection attempts reached, falling back to polling')
              setupPolling()
            }
          }
        })
      
    } catch (error) {
      console.error('Failed to setup realtime subscription:', error)
      setupPolling()
    }
  }, [realtimeConfig, fetchAnalytics, setupPolling])

  // Fallback polling mechanism
  const setupPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchAnalytics()
    }, realtimeConfig.fallbackPollingInterval)
    
    console.log(`Analytics polling started with ${realtimeConfig.fallbackPollingInterval}ms interval`)
  }, [fetchAnalytics, realtimeConfig.fallbackPollingInterval])

  const refetch = useCallback(async () => {
    await fetchAnalytics()
  }, [fetchAnalytics])

  // Setup on mount and filter changes
  useEffect(() => {
    fetchAnalytics()
    
    if (realtimeConfig.enabled) {
      setupRealtimeSubscription()
    } else {
      setupPolling()
    }

    return cleanup
  }, [fetchAnalytics, setupRealtimeSubscription, setupPolling, cleanup, realtimeConfig.enabled])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    data,
    isLoading,
    error,
    refetch,
    isRealTimeConnected,
    permissions
  }
}