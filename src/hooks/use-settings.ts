/**
 * React Query hooks for business settings management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { BusinessSettings, SettingsCategory } from '../lib/types/database'
import { toast } from 'sonner'

const SETTINGS_QUERY_KEY = ['settings'] as const

// API functions
async function fetchSettings(category?: SettingsCategory, publicOnly = false): Promise<{ settings: BusinessSettings, raw: any[] }> {
  const params = new URLSearchParams()
  if (category) params.append('category', category)
  if (publicOnly) params.append('public_only', 'true')

  const response = await fetch(`/.netlify/functions/admin/settings?${params}`, {
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch settings')
  }

  const result = await response.json()
  return result.data
}

async function updateSetting(key: string, data: { value: any, description?: string, category?: string, is_public?: boolean }) {
  const params = new URLSearchParams({ key })

  const response = await fetch(`/.netlify/functions/admin/settings?${params}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to update setting')
  }

  const result = await response.json()
  return result.data
}

async function testSmtp(data: { to_email: string, subject: string, message: string }) {
  const response = await fetch('/.netlify/functions/admin/settings/test-smtp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'SMTP test failed')
  }

  const result = await response.json()
  return result.data
}

// Hooks
export function useSettings(category?: SettingsCategory, publicOnly = false) {
  return useQuery({
    queryKey: [...SETTINGS_QUERY_KEY, category, publicOnly],
    queryFn: () => fetchSettings(category, publicOnly),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true
  })
}

export function useBusinessHours() {
  const { data, ...rest } = useSettings('business_hours')
  return {
    ...rest,
    businessHours: data?.settings.business_hours
  }
}

export function useBookingConfig() {
  const { data, ...rest } = useSettings('booking')
  return {
    ...rest,
    bookingConfig: data?.settings ? {
      booking_window_days: data.settings.booking_window_days,
      buffer_time_minutes: data.settings.buffer_time_minutes,
      min_advance_booking_hours: data.settings.min_advance_booking_hours,
      max_appointments_per_day: data.settings.max_appointments_per_day,
      cancellation_hours: data.settings.cancellation_hours,
      no_show_policy: data.settings.no_show_policy
    } : undefined
  }
}

export function useBusinessInfo() {
  const { data, ...rest } = useSettings('business_info')
  return {
    ...rest,
    businessInfo: data?.settings ? {
      business_name: data.settings.business_name,
      business_address: data.settings.business_address,
      business_phone: data.settings.business_phone,
      business_email: data.settings.business_email
    } : undefined
  }
}

export function useSmtpConfig() {
  const { data, ...rest } = useSettings('email')
  return {
    ...rest,
    smtpConfig: data?.settings ? {
      smtp_host: data.settings.smtp_host,
      smtp_port: data.settings.smtp_port,
      smtp_user: data.settings.smtp_user,
      smtp_password: data.settings.smtp_password,
      smtp_from_email: data.settings.smtp_from_email,
      smtp_from_name: data.settings.smtp_from_name,
      smtp_use_tls: data.settings.smtp_use_tls
    } : undefined
  }
}

export function useNotificationConfig() {
  const { data, ...rest } = useSettings('notifications')
  return {
    ...rest,
    notificationConfig: data?.settings ? {
      email_notifications_enabled: data.settings.email_notifications_enabled,
      sms_notifications_enabled: data.settings.sms_notifications_enabled,
      booking_confirmation_email: data.settings.booking_confirmation_email,
      booking_reminder_email: data.settings.booking_reminder_email,
      reminder_hours_before: data.settings.reminder_hours_before
    } : undefined
  }
}

export function useUpdateSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ key, data }: { key: string, data: any }) => updateSetting(key, data),
    onSuccess: (data, variables) => {
      // Invalidate all settings queries to refetch
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      
      toast.success(`Setting '${variables.key}' updated successfully`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to update setting: ${error.message}`)
    }
  })
}

export function useTestSmtp() {
  return useMutation({
    mutationFn: testSmtp,
    onSuccess: (data) => {
      toast.success(`Test email sent successfully to ${data.sentTo}`)
    },
    onError: (error: Error) => {
      toast.error(`SMTP test failed: ${error.message}`)
    }
  })
}

// Utility functions
export function getSettingValue(settings: BusinessSettings | undefined, key: keyof BusinessSettings) {
  return settings?.[key]
}

export function isSettingEnabled(settings: BusinessSettings | undefined, key: keyof BusinessSettings): boolean {
  const value = getSettingValue(settings, key)
  return value === true || value === 'true'
}

// Hook to get a single setting value
export function useSetting<T = any>(key: string): {
  value: T | undefined
  isLoading: boolean
  error: Error | null
  update: (value: T) => void
} {
  const { data, isLoading, error } = useSettings()
  const updateMutation = useUpdateSetting()

  const value = data?.settings?.[key as keyof BusinessSettings] as T | undefined

  const update = (newValue: T) => {
    updateMutation.mutate({
      key,
      data: { value: newValue }
    })
  }

  return {
    value,
    isLoading: isLoading || updateMutation.isPending,
    error: error || updateMutation.error,
    update
  }
}