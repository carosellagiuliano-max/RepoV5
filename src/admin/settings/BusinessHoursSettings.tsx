/**
 * Business Hours Settings Component
 * Manages opening hours for each day of the week
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
import { Clock, Save, RefreshCw } from 'lucide-react'
import { useBusinessHours, useUpdateSetting } from '../../hooks/use-settings'
import { businessHoursSchema } from '../../lib/validation/schemas'
import { toast } from 'sonner'

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
] as const

type DayKey = typeof DAYS[number]['key']

type BusinessHoursFormData = {
  monday: { open: string; close: string; closed: boolean }
  tuesday: { open: string; close: string; closed: boolean }
  wednesday: { open: string; close: string; closed: boolean }
  thursday: { open: string; close: string; closed: boolean }
  friday: { open: string; close: string; closed: boolean }
  saturday: { open: string; close: string; closed: boolean }
  sunday: { open: string; close: string; closed: boolean }
}

export function BusinessHoursSettings() {
  const { businessHours, isLoading, error } = useBusinessHours()
  const updateSetting = useUpdateSetting()
  const [hasChanges, setHasChanges] = useState(false)

  const form = useForm<BusinessHoursFormData>({
    resolver: zodResolver(businessHoursSchema),
    defaultValues: businessHours || {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '16:00', closed: false },
      sunday: { open: '10:00', close: '16:00', closed: true }
    }
  })

  // Update form when data loads
  React.useEffect(() => {
    if (businessHours) {
      form.reset(businessHours)
      setHasChanges(false)
    }
  }, [businessHours, form])

  // Track changes
  React.useEffect(() => {
    const subscription = form.watch(() => setHasChanges(true))
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (data: BusinessHoursFormData) => {
    try {
      await updateSetting.mutateAsync({
        key: 'business_hours',
        data: { value: data }
      })
      setHasChanges(false)
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const resetForm = () => {
    if (businessHours) {
      form.reset(businessHours)
      setHasChanges(false)
    }
  }

  const copyHours = (fromDay: DayKey, toDay: DayKey) => {
    const fromHours = form.getValues(fromDay)
    form.setValue(toDay, fromHours)
    setHasChanges(true)
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
        Error loading business hours: {error.message}
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.map((day) => (
            <Card key={day.key} className="relative">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {day.label}
                  <FormField
                    control={form.control}
                    name={`${day.key}.closed`}
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={!field.value}
                            onCheckedChange={(checked) => field.onChange(!checked)}
                          />
                        </FormControl>
                        <FormLabel className="text-xs">
                          {field.value ? 'Closed' : 'Open'}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name={`${day.key}.closed`}
                  render={({ field }) => (
                    <div className={field.value ? 'opacity-50 pointer-events-none' : ''}>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name={`${day.key}.open`}
                          render={({ field: openField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Open</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...openField}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`${day.key}.close`}
                          render={({ field: closeField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Close</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...closeField}
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                />
                {!form.watch(`${day.key}.closed`) && (
                  <div className="text-xs text-muted-foreground">
                    {form.watch(`${day.key}.open`)} - {form.watch(`${day.key}.close`)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Changes affect booking availability immediately
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
              Save Hours
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Opening hours are displayed to customers during booking</p>
          <p>• Closed days will not allow any bookings</p>
          <p>• Times must be in 24-hour format (HH:MM)</p>
        </div>
      </form>
    </Form>
  )
}