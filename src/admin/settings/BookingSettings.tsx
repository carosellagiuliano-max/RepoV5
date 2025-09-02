/**
 * Booking Settings Component
 * Manages booking rules, time windows, and appointment limits
 */

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Textarea } from '../../components/ui/textarea'
import { Calendar, Clock, Users, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import { useBookingConfig, useUpdateSetting } from '../../hooks/use-settings'
import { bookingConfigSchema } from '../../lib/validation/schemas'

type BookingConfigFormData = {
  booking_window_days: number
  buffer_time_minutes: number
  min_advance_booking_hours: number
  max_appointments_per_day: number
  cancellation_hours: number
  no_show_policy: string
}

export function BookingSettings() {
  const { bookingConfig, isLoading, error } = useBookingConfig()
  const updateSetting = useUpdateSetting()
  const [hasChanges, setHasChanges] = useState(false)

  const form = useForm<BookingConfigFormData>({
    resolver: zodResolver(bookingConfigSchema),
    defaultValues: bookingConfig || {
      booking_window_days: 30,
      buffer_time_minutes: 15,
      min_advance_booking_hours: 24,
      max_appointments_per_day: 50,
      cancellation_hours: 24,
      no_show_policy: 'No-show appointments will be charged 50% of service fee'
    }
  })

  // Update form when data loads
  React.useEffect(() => {
    if (bookingConfig) {
      form.reset(bookingConfig)
      setHasChanges(false)
    }
  }, [bookingConfig, form])

  // Track changes
  React.useEffect(() => {
    const subscription = form.watch(() => setHasChanges(true))
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (data: BookingConfigFormData) => {
    try {
      // Update each setting individually since they're stored separately
      await Promise.all([
        updateSetting.mutateAsync({
          key: 'booking_window_days',
          data: { value: data.booking_window_days }
        }),
        updateSetting.mutateAsync({
          key: 'buffer_time_minutes',
          data: { value: data.buffer_time_minutes }
        }),
        updateSetting.mutateAsync({
          key: 'min_advance_booking_hours',
          data: { value: data.min_advance_booking_hours }
        }),
        updateSetting.mutateAsync({
          key: 'max_appointments_per_day',
          data: { value: data.max_appointments_per_day }
        }),
        updateSetting.mutateAsync({
          key: 'cancellation_hours',
          data: { value: data.cancellation_hours }
        }),
        updateSetting.mutateAsync({
          key: 'no_show_policy',
          data: { value: data.no_show_policy }
        })
      ])
      setHasChanges(false)
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const resetForm = () => {
    if (bookingConfig) {
      form.reset(bookingConfig)
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
        Error loading booking configuration: {error.message}
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Booking Window
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="booking_window_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum booking days in advance</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      How far in advance customers can book appointments (1-365 days)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_advance_booking_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum advance booking time</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="168"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum hours before appointment time (0-168 hours)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="buffer_time_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buffer time between appointments</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Time buffer between appointments in minutes (0-120)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_appointments_per_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum appointments per day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="200"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Total appointment limit per day (1-200)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Cancellation Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="cancellation_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cancellation deadline (hours before appointment)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="168"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Hours before appointment when cancellation is no longer allowed (0-168)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="no_show_policy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>No-show policy</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter your no-show policy..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    Policy displayed to customers regarding no-show appointments
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Changes affect booking logic immediately
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
          <p>• Buffer time prevents overlapping appointments</p>
          <p>• Booking window controls how far ahead customers can book</p>
          <p>• Appointment limits help manage daily capacity</p>
          <p>• Cancellation policy is displayed during booking</p>
        </div>
      </form>
    </Form>
  )
}