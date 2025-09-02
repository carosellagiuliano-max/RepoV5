/**
 * Booking Settings Form
 * Form for managing booking rules and policies
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { schemas } from '@/lib/validation/schemas'
import { Setting } from '@/lib/types/settings'
import { useUpdateMultipleSettings } from '@/hooks/use-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, Calendar, Clock, XCircle, Info } from 'lucide-react'

interface BookingSettingsFormProps {
  settings: Setting[]
}

export function BookingSettingsForm({ settings }: BookingSettingsFormProps) {
  const updateSettings = useUpdateMultipleSettings()

  // Extract current values from settings
  const getSettingValue = (key: string, defaultValue: any = 0) => {
    const setting = settings.find(s => s.key === key)
    return setting?.value ?? defaultValue
  }

  const bookingFormData = {
    window_days: getSettingValue('booking.window_days', 30),
    buffer_time_minutes: getSettingValue('booking.buffer_time_minutes', 15),
    cancellation_hours: getSettingValue('booking.cancellation_hours', 24)
  }

  const form = useForm({
    resolver: zodResolver(schemas.settings.bookingSettings),
    defaultValues: bookingFormData
  })

  const onSubmit = async (data: typeof bookingFormData) => {
    try {
      const updates = [
        { key: 'booking.window_days', update: { value: data.window_days } },
        { key: 'booking.buffer_time_minutes', update: { value: data.buffer_time_minutes } },
        { key: 'booking.cancellation_hours', update: { value: data.cancellation_hours } }
      ]

      await updateSettings.mutateAsync(updates as any)
    } catch (error) {
      console.error('Failed to update booking settings:', error)
    }
  }

  const watchedValues = form.watch()

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          These settings affect all new bookings. Existing appointments will not be changed.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Booking Window */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Booking Window
            </CardTitle>
            <CardDescription>
              How far in advance customers can book
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="window_days">Maximum Days in Advance</Label>
              <Input
                id="window_days"
                type="number"
                min="1"
                max="365"
                {...form.register('window_days', { valueAsNumber: true })}
                placeholder="30"
              />
              {form.formState.errors.window_days && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.window_days.message}
                </p>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Current setting: Customers can book up to{' '}
              <span className="font-medium text-foreground">
                {watchedValues.window_days} days
              </span>{' '}
              in advance
            </div>
          </CardContent>
        </Card>

        {/* Buffer Time */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Buffer Time
            </CardTitle>
            <CardDescription>
              Time between consecutive appointments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buffer_time_minutes">Minutes Between Appointments</Label>
              <Input
                id="buffer_time_minutes"
                type="number"
                min="0"
                max="120"
                {...form.register('buffer_time_minutes', { valueAsNumber: true })}
                placeholder="15"
              />
              {form.formState.errors.buffer_time_minutes && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.buffer_time_minutes.message}
                </p>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Current setting:{' '}
              <span className="font-medium text-foreground">
                {watchedValues.buffer_time_minutes} minutes
              </span>{' '}
              between appointments
            </div>
          </CardContent>
        </Card>

        {/* Cancellation Policy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <XCircle className="h-5 w-5" />
              Cancellation Policy
            </CardTitle>
            <CardDescription>
              Minimum notice required for cancellations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancellation_hours">Hours Before Appointment</Label>
              <Input
                id="cancellation_hours"
                type="number"
                min="0"
                max="168"
                {...form.register('cancellation_hours', { valueAsNumber: true })}
                placeholder="24"
              />
              {form.formState.errors.cancellation_hours && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.cancellation_hours.message}
                </p>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Current setting: Cancellations allowed up to{' '}
              <span className="font-medium text-foreground">
                {watchedValues.cancellation_hours} hours
              </span>{' '}
              before appointment
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Guidelines */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-900">Configuration Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <span className="font-medium">Booking Window:</span>
            <span>Typically 30-60 days. Longer windows increase bookings but may affect staff scheduling flexibility.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium">Buffer Time:</span>
            <span>15-30 minutes recommended. Allows time for cleanup, preparation, and unexpected delays.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium">Cancellation Hours:</span>
            <span>24-48 hours is standard. Balances customer flexibility with business scheduling needs.</span>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={updateSettings.isPending}
          className="min-w-[140px]"
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  )
}