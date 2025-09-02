/**
 * Settings Hook
 * React Query hooks for business settings management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Setting, SettingKey, SettingUpdate, SettingsFormData } from '@/lib/types/settings'
import { toast } from 'sonner'

const SETTINGS_QUERY_KEY = 'settings'

// API functions
const fetchSettings = async (params: {
  category?: string
  search?: string
  include_sensitive?: boolean
  page?: number
  limit?: number
} = {}): Promise<{ settings: Setting[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
  const queryParams = new URLSearchParams()
  
  if (params.category) queryParams.append('category', params.category)
  if (params.search) queryParams.append('search', params.search)
  if (params.include_sensitive) queryParams.append('include_sensitive', 'true')
  queryParams.append('page', String(params.page || 1))
  queryParams.append('limit', String(params.limit || 50))

  const response = await fetch(`/.netlify/functions/admin/settings?${queryParams}`, {
    headers: {
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch settings')
  }

  return response.json()
}

const updateSetting = async (key: SettingKey, update: SettingUpdate): Promise<Setting> => {
  const response = await fetch(`/.netlify/functions/admin/settings/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
    body: JSON.stringify(update),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to update setting')
  }

  return response.json()
}

const updateMultipleSettings = async (updates: Array<{ key: SettingKey; update: SettingUpdate }>): Promise<Setting[]> => {
  const results = await Promise.all(
    updates.map(({ key, update }) => updateSetting(key, update))
  )
  return results
}

const testSmtpSettings = async (testData: {
  to: string
  subject: string
  body: string
}): Promise<{ message: string; messageId: string }> => {
  const response = await fetch('/.netlify/functions/admin/settings-test-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
    },
    body: JSON.stringify(testData),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to send test email')
  }

  return response.json()
}

// React Query hooks
export const useSettings = (params: {
  category?: string
  search?: string
  include_sensitive?: boolean
  page?: number
  limit?: number
} = {}) => {
  return useQuery({
    queryKey: [SETTINGS_QUERY_KEY, params],
    queryFn: () => fetchSettings(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  })
}

export const useSettingsByCategory = (category: string) => {
  return useQuery({
    queryKey: [SETTINGS_QUERY_KEY, 'category', category],
    queryFn: () => fetchSettings({ category, limit: 100 }),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.settings,
  })
}

export const useUpdateSetting = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ key, update }: { key: SettingKey; update: SettingUpdate }) =>
      updateSetting(key, update),
    onSuccess: (data, variables) => {
      // Invalidate and refetch settings queries
      queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] })
      toast.success(`Setting "${variables.key}" updated successfully`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to update setting: ${error.message}`)
    },
  })
}

export const useUpdateMultipleSettings = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateMultipleSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] })
      toast.success('Settings updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update settings: ${error.message}`)
    },
  })
}

export const useUpdateSettingsForm = () => {
  const updateMultiple = useUpdateMultipleSettings()

  return useMutation({
    mutationFn: (formData: SettingsFormData) => {
      const updates = [
        // Business settings
        { key: 'business.name' as SettingKey, update: { value: formData.business.name } },
        { key: 'business.address' as SettingKey, update: { value: formData.business.address } },
        { key: 'business.phone' as SettingKey, update: { value: formData.business.phone } },
        { key: 'business.email' as SettingKey, update: { value: formData.business.email } },
        { key: 'business.opening_hours' as SettingKey, update: { value: formData.business.opening_hours } },
        
        // Booking settings
        { key: 'booking.window_days' as SettingKey, update: { value: formData.booking.window_days } },
        { key: 'booking.buffer_time_minutes' as SettingKey, update: { value: formData.booking.buffer_time_minutes } },
        { key: 'booking.cancellation_hours' as SettingKey, update: { value: formData.booking.cancellation_hours } },
        
        // SMTP settings
        { key: 'smtp.host' as SettingKey, update: { value: formData.smtp.host } },
        { key: 'smtp.port' as SettingKey, update: { value: formData.smtp.port } },
        { key: 'smtp.user' as SettingKey, update: { value: formData.smtp.user } },
        { key: 'smtp.password' as SettingKey, update: { value: formData.smtp.password } },
        { key: 'smtp.from_email' as SettingKey, update: { value: formData.smtp.from_email } },
        { key: 'smtp.from_name' as SettingKey, update: { value: formData.smtp.from_name } },
      ]

      return updateMultiple.mutateAsync(updates)
    },
    onSuccess: updateMultiple.onSuccess,
    onError: updateMultiple.onError,
  })
}

export const useTestSmtpSettings = () => {
  return useMutation({
    mutationFn: testSmtpSettings,
    onSuccess: () => {
      toast.success('Test email sent successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to send test email: ${error.message}`)
    },
  })
}

// Helper hook to get a single setting value
export const useSetting = <T = unknown>(key: SettingKey): T | undefined => {
  const { data } = useSettings({ limit: 100 })
  const setting = data?.settings.find(s => s.key === key)
  return setting?.value as T
}

// Helper hook to get settings by category as a key-value object
export const useSettingsObject = (category: string) => {
  const { data } = useSettingsByCategory(category)
  
  if (!data) return {}
  
  return data.reduce((acc, setting) => {
    acc[setting.key] = setting.value
    return acc
  }, {} as Record<string, unknown>)
}