/**
 * React Query hooks for business settings management
 * Handles client-side state management for settings
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { BusinessSettings, EmailSettings, SettingsState, SettingValue } from '../types/database'
import { toast } from 'sonner'

const SETTINGS_QUERY_KEY = ['settings']

interface UseSettingsOptions {
  category?: 'business' | 'email' | 'all'
}

// Fetch settings from database
export function useSettings(options: UseSettingsOptions = {}) {
  const { category = 'all' } = options

  return useQuery({
    queryKey: [...SETTINGS_QUERY_KEY, category],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const url = `/.netlify/functions/admin/settings${category !== 'all' ? `?category=${category}` : ''}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to fetch settings')
      }

      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: true
  })
}

// Get business settings only
export function useBusinessSettings() {
  const { data, isLoading, error } = useSettings({ category: 'business' })
  
  return {
    settings: data?.settings?.business as BusinessSettings | undefined,
    isLoading,
    error
  }
}

// Get email settings only
export function useEmailSettings() {
  const { data, isLoading, error } = useSettings({ category: 'email' })
  
  return {
    settings: data?.settings?.email as EmailSettings | undefined,
    isLoading,
    error
  }
}

// Update business settings
export function useUpdateBusinessSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Partial<BusinessSettings>) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const response = await fetch('/.netlify/functions/admin/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: 'business',
          settings
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to update business settings')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch settings
      queryClient.invalidateQueries(SETTINGS_QUERY_KEY)
      toast.success('Business settings updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update business settings: ${error.message}`)
    }
  })
}

// Update email settings
export function useUpdateEmailSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Partial<EmailSettings>) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const response = await fetch('/.netlify/functions/admin/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: 'email',
          settings
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to update email settings')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries(SETTINGS_QUERY_KEY)
      toast.success('Email settings updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update email settings: ${error.message}`)
    }
  })
}

// Update single setting
export function useUpdateSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ key, value, description, category, is_public }: {
      key: string
      value: SettingValue
      description?: string
      category?: string
      is_public?: boolean
    }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const response = await fetch(`/.netlify/functions/admin/settings?key=${key}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value,
          description,
          category,
          is_public
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to update setting')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries(SETTINGS_QUERY_KEY)
      toast.success('Setting updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update setting: ${error.message}`)
    }
  })
}

// SMTP test functionality
export function useSmtpTest() {
  return useMutation({
    mutationFn: async ({ to_email, subject, message }: {
      to_email: string
      subject?: string
      message?: string
    }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      const response = await fetch('/.netlify/functions/admin/smtp-test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to_email,
          subject,
          message
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to send test email')
      }

      return response.json()
    },
    onSuccess: (data) => {
      toast.success(`Test email sent successfully to ${data.data.to}`)
    },
    onError: (error: Error) => {
      toast.error(`SMTP test failed: ${error.message}`)
    }
  })
}

// Utility hook to get opening hours for a specific day
export function useOpeningHours() {
  const { settings, isLoading } = useBusinessSettings()

  const getHoursForDay = (dayOfWeek: number) => {
    if (!settings?.opening_hours) return null
    return settings.opening_hours[dayOfWeek.toString()]
  }

  const isOpenOnDay = (dayOfWeek: number) => {
    const hours = getHoursForDay(dayOfWeek)
    return hours?.is_open || false
  }

  const getOpeningTime = (dayOfWeek: number) => {
    const hours = getHoursForDay(dayOfWeek)
    return hours?.start_time || null
  }

  const getClosingTime = (dayOfWeek: number) => {
    const hours = getHoursForDay(dayOfWeek)
    return hours?.end_time || null
  }

  return {
    openingHours: settings?.opening_hours,
    isLoading,
    getHoursForDay,
    isOpenOnDay,
    getOpeningTime,
    getClosingTime
  }
}

// Utility hook to validate appointment timing against business rules
export function useAppointmentValidation() {
  const { settings: businessSettings } = useBusinessSettings()

  const validateAppointmentTime = (startTime: Date, endTime: Date) => {
    if (!businessSettings) {
      return { isValid: false, error: 'Business settings not loaded' }
    }

    const now = new Date()
    const dayOfWeek = startTime.getDay()
    const maxAdvanceDays = businessSettings.max_advance_booking_days || 30

    // Check if appointment is in the past
    if (startTime <= now) {
      return { isValid: false, error: 'Appointment cannot be in the past' }
    }

    // Check if appointment is too far in advance
    const maxDate = new Date(now.getTime() + (maxAdvanceDays * 24 * 60 * 60 * 1000))
    if (startTime > maxDate) {
      return { isValid: false, error: `Appointment cannot be more than ${maxAdvanceDays} days in advance` }
    }

    // Check if day is open
    const dayHours = businessSettings.opening_hours?.[dayOfWeek.toString()]
    if (!dayHours?.is_open) {
      return { isValid: false, error: 'Business is closed on this day' }
    }

    // Check if appointment is within business hours
    const appointmentStart = startTime.toTimeString().substring(0, 5) // HH:MM
    const appointmentEnd = endTime.toTimeString().substring(0, 5) // HH:MM
    
    if (appointmentStart < dayHours.start_time || appointmentEnd > dayHours.end_time) {
      return { isValid: false, error: `Appointment must be between ${dayHours.start_time} and ${dayHours.end_time}` }
    }

    return { isValid: true, error: null }
  }

  return {
    validateAppointmentTime,
    businessSettings,
    isLoading: !businessSettings
  }
}