/**
 * Notification Settings Component
 * Manages notification preferences and timing
 */

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import { Switch } from '../../components/ui/switch'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Bell, Mail, MessageSquare, Save, RefreshCw, Clock } from 'lucide-react'
import { useNotificationConfig, useUpdateSetting } from '../../hooks/use-settings'
import { notificationConfigSchema } from '../../lib/validation/schemas'

export function NotificationSettings() {
  const { notificationConfig, isLoading, error } = useNotificationConfig()
  const updateSetting = useUpdateSetting()
  const [hasChanges, setHasChanges] = useState(false)

  const form = useForm({
    resolver: zodResolver(notificationConfigSchema),
    defaultValues: notificationConfig || {
      email_notifications_enabled: true,
      sms_notifications_enabled: false,
      booking_confirmation_email: true,
      booking_reminder_email: true,
      reminder_hours_before: 24
    }
  })

  // Update form when data loads
  React.useEffect(() => {
    if (notificationConfig) {
      form.reset(notificationConfig)
      setHasChanges(false)
    }
  }, [notificationConfig, form])

  // Track changes
  React.useEffect(() => {
    const subscription = form.watch(() => setHasChanges(true))
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (data: any) => {
    try {
      // Update each notification setting individually
      await Promise.all([
        updateSetting.mutateAsync({
          key: 'email_notifications_enabled',
          data: { value: data.email_notifications_enabled }
        }),
        updateSetting.mutateAsync({
          key: 'sms_notifications_enabled',
          data: { value: data.sms_notifications_enabled }
        }),
        updateSetting.mutateAsync({
          key: 'booking_confirmation_email',
          data: { value: data.booking_confirmation_email }
        }),
        updateSetting.mutateAsync({
          key: 'booking_reminder_email',
          data: { value: data.booking_reminder_email }
        }),
        updateSetting.mutateAsync({
          key: 'reminder_hours_before',
          data: { value: data.reminder_hours_before }
        })
      ])
      setHasChanges(false)
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const resetForm = () => {
    if (notificationConfig) {
      form.reset(notificationConfig)
      setHasChanges(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 p-4">
        Error loading notification configuration: {error.message}
      </div>
    )
  }

  const emailEnabled = form.watch('email_notifications_enabled')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email_notifications_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Enable Email Notifications</FormLabel>
                      <FormDescription className="text-sm">
                        Send automated emails to customers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className={emailEnabled ? '' : 'opacity-50 pointer-events-none'}>
                <FormField
                  control={form.control}
                  name="booking_confirmation_email"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Booking Confirmations</FormLabel>
                        <FormDescription className="text-sm">
                          Send confirmation emails after booking
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!emailEnabled}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="booking_reminder_email"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Appointment Reminders</FormLabel>
                        <FormDescription className="text-sm">
                          Send reminder emails before appointments
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!emailEnabled}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                SMS Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="sms_notifications_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Enable SMS Notifications</FormLabel>
                      <FormDescription className="text-sm">
                        Send SMS messages to customers (requires SMS provider)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">SMS Provider Required</p>
                    <p className="text-yellow-700">
                      SMS notifications require integration with an SMS service provider like Twilio, AWS SNS, or similar.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Reminder Timing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="reminder_hours_before"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Send reminders (hours before appointment)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="168"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 24)}
                      className="max-w-xs"
                    />
                  </FormControl>
                  <FormDescription>
                    How many hours before the appointment to send reminder notifications (1-168 hours)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Notification preferences for customer communications
            </span>
            {hasChanges && (
              <Badge variant="secondary">Unsaved changes</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
              disabled={!hasChanges || updateSetting.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!hasChanges || updateSetting.isPending}
            >
              {updateSetting.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Settings
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Email notifications require SMTP configuration</p>
          <p>• Reminders are sent automatically based on timing settings</p>
          <p>• Customers can opt out of notifications individually</p>
          <p>• SMS notifications require additional service provider setup</p>
        </div>
      </form>
    </Form>
  )
}