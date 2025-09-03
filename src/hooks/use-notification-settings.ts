import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  NotificationSettings, 
  EmailSettings, 
  SmsSettings,
  SettingValueMap 
} from '../lib/types/database'
import { useToast } from './use-toast'

interface NotificationSettingsState {
  email: EmailSettings
  notifications: NotificationSettings
  sms: SmsSettings
  loading: boolean
  error: string | null
}

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettingsState>({
    email: {
      smtp_host: '',
      smtp_port: 587,
      smtp_username: '',
      smtp_password: '',
      smtp_from_email: '',
      smtp_from_name: '',
      smtp_use_tls: true
    },
    notifications: {
      email_enabled: true,
      sms_enabled: false,
      reminder_hours_before: 24,
      send_confirmations: true,
      send_cancellations: true,
      send_daily_schedule: true,
      daily_schedule_time: '08:00',
      retry_attempts: 3,
      retry_delay_minutes: 15
    },
    sms: {
      twilio_account_sid: '',
      twilio_auth_token: '',
      twilio_phone_number: '',
      enabled: false
    },
    loading: false,
    error: null
  })

  const { toast } = useToast()

  // Load settings from database
  const loadSettings = async () => {
    setSettings(prev => ({ ...prev, loading: true, error: null }))

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          // Email settings
          'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 
          'smtp_from_email', 'smtp_from_name', 'smtp_use_tls',
          // Notification settings
          'email_enabled', 'sms_enabled', 'reminder_hours_before',
          'send_confirmations', 'send_cancellations', 'send_daily_schedule',
          'daily_schedule_time', 'retry_attempts', 'retry_delay_minutes',
          // SMS settings
          'twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number'
        ])

      if (error) throw error

      const settingsMap: Record<string, unknown> = {}
      data.forEach(item => {
        settingsMap[item.key] = item.value
      })

      setSettings(prev => ({
        ...prev,
        email: {
          smtp_host: settingsMap.smtp_host || '',
          smtp_port: settingsMap.smtp_port || 587,
          smtp_username: settingsMap.smtp_username || '',
          smtp_password: settingsMap.smtp_password || '',
          smtp_from_email: settingsMap.smtp_from_email || '',
          smtp_from_name: settingsMap.smtp_from_name || '',
          smtp_use_tls: settingsMap.smtp_use_tls ?? true
        },
        notifications: {
          email_enabled: settingsMap.email_enabled ?? true,
          sms_enabled: settingsMap.sms_enabled ?? false,
          reminder_hours_before: settingsMap.reminder_hours_before ?? 24,
          send_confirmations: settingsMap.send_confirmations ?? true,
          send_cancellations: settingsMap.send_cancellations ?? true,
          send_daily_schedule: settingsMap.send_daily_schedule ?? true,
          daily_schedule_time: settingsMap.daily_schedule_time ?? '08:00',
          retry_attempts: settingsMap.retry_attempts ?? 3,
          retry_delay_minutes: settingsMap.retry_delay_minutes ?? 15
        },
        sms: {
          twilio_account_sid: settingsMap.twilio_account_sid || '',
          twilio_auth_token: settingsMap.twilio_auth_token || '',
          twilio_phone_number: settingsMap.twilio_phone_number || '',
          enabled: settingsMap.sms_enabled ?? false
        },
        loading: false
      }))

    } catch (error) {
      console.error('Failed to load notification settings:', error)
      setSettings(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load settings'
      }))
    }
  }

  // Save a specific setting
  const saveSetting = async <K extends keyof SettingValueMap>(
    key: K,
    value: SettingValueMap[K],
    category: 'email' | 'notifications' | 'sms' = 'notifications'
  ) => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key,
          value,
          category,
          is_public: false
        }, {
          onConflict: 'key'
        })

      if (error) throw error

      // Update local state
      setSettings(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      }))

      toast({
        title: 'Einstellung gespeichert',
        description: 'Die Benachrichtigungseinstellung wurde erfolgreich aktualisiert.'
      })

    } catch (error) {
      console.error('Failed to save setting:', error)
      toast({
        title: 'Fehler',
        description: 'Die Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive'
      })
      throw error
    }
  }

  // Save all email settings
  const saveEmailSettings = async (emailSettings: Partial<EmailSettings>) => {
    setSettings(prev => ({ ...prev, loading: true }))

    try {
      const updates = Object.entries(emailSettings).map(([key, value]) => ({
        key,
        value,
        category: 'email',
        is_public: false
      }))

      const { error } = await supabase
        .from('settings')
        .upsert(updates, { onConflict: 'key' })

      if (error) throw error

      setSettings(prev => ({
        ...prev,
        email: {
          ...prev.email,
          ...emailSettings
        },
        loading: false
      }))

      toast({
        title: 'E-Mail-Einstellungen gespeichert',
        description: 'Die E-Mail-Konfiguration wurde erfolgreich aktualisiert.'
      })

    } catch (error) {
      console.error('Failed to save email settings:', error)
      setSettings(prev => ({ ...prev, loading: false }))
      toast({
        title: 'Fehler',
        description: 'Die E-Mail-Einstellungen konnten nicht gespeichert werden.',
        variant: 'destructive'
      })
      throw error
    }
  }

  // Save all notification settings
  const saveNotificationSettings = async (notificationSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, loading: true }))

    try {
      const updates = Object.entries(notificationSettings).map(([key, value]) => ({
        key,
        value,
        category: 'notifications',
        is_public: false
      }))

      const { error } = await supabase
        .from('settings')
        .upsert(updates, { onConflict: 'key' })

      if (error) throw error

      setSettings(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          ...notificationSettings
        },
        loading: false
      }))

      toast({
        title: 'Benachrichtigungseinstellungen gespeichert',
        description: 'Die Benachrichtigungskonfiguration wurde erfolgreich aktualisiert.'
      })

    } catch (error) {
      console.error('Failed to save notification settings:', error)
      setSettings(prev => ({ ...prev, loading: false }))
      toast({
        title: 'Fehler',
        description: 'Die Benachrichtigungseinstellungen konnten nicht gespeichert werden.',
        variant: 'destructive'
      })
      throw error
    }
  }

  // Save all SMS settings
  const saveSmsSettings = async (smsSettings: Partial<SmsSettings>) => {
    setSettings(prev => ({ ...prev, loading: true }))

    try {
      const updates = Object.entries(smsSettings).map(([key, value]) => ({
        key,
        value,
        category: 'sms',
        is_public: false
      }))

      const { error } = await supabase
        .from('settings')
        .upsert(updates, { onConflict: 'key' })

      if (error) throw error

      setSettings(prev => ({
        ...prev,
        sms: {
          ...prev.sms,
          ...smsSettings
        },
        loading: false
      }))

      toast({
        title: 'SMS-Einstellungen gespeichert',
        description: 'Die SMS-Konfiguration wurde erfolgreich aktualisiert.'
      })

    } catch (error) {
      console.error('Failed to save SMS settings:', error)
      setSettings(prev => ({ ...prev, loading: false }))
      toast({
        title: 'Fehler',
        description: 'Die SMS-Einstellungen konnten nicht gespeichert werden.',
        variant: 'destructive'
      })
      throw error
    }
  }

  // Test email configuration
  const testEmailConfiguration = async () => {
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          settings: settings.email
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'E-Mail-Test erfolgreich',
          description: 'Die E-Mail-Konfiguration funktioniert korrekt.'
        })
      } else {
        throw new Error(result.error?.message || 'E-Mail-Test fehlgeschlagen')
      }

    } catch (error) {
      console.error('Email test failed:', error)
      toast({
        title: 'E-Mail-Test fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive'
      })
    }
  }

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  return {
    settings,
    loadSettings,
    saveSetting,
    saveEmailSettings,
    saveNotificationSettings,
    saveSmsSettings,
    testEmailConfiguration,
    loading: settings.loading,
    error: settings.error
  }
}