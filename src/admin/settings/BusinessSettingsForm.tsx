/**
 * Business Settings Form
 * Form for managing business information and opening hours
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { schemas } from '@/lib/validation/schemas'
import { Setting, OpeningHours, defaultOpeningHours } from '@/lib/types/settings'
import { useUpdateMultipleSettings } from '@/hooks/use-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, Clock, Save } from 'lucide-react'
import { toast } from 'sonner'

interface BusinessSettingsFormProps {
  settings: Setting[]
}

const dayNames = {
  monday: 'Monday',
  tuesday: 'Tuesday', 
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
}

export function BusinessSettingsForm({ settings }: BusinessSettingsFormProps) {
  const updateSettings = useUpdateMultipleSettings()

  // Extract current values from settings
  const getSettingValue = (key: string, defaultValue: any = '') => {
    const setting = settings.find(s => s.key === key)
    return setting?.value ?? defaultValue
  }

  const businessFormData = {
    name: getSettingValue('business.name', ''),
    address: getSettingValue('business.address', ''),
    phone: getSettingValue('business.phone', ''),
    email: getSettingValue('business.email', ''),
    opening_hours: getSettingValue('business.opening_hours', defaultOpeningHours)
  }

  const form = useForm({
    resolver: zodResolver(schemas.settings.businessInfo.extend({
      opening_hours: schemas.settings.openingHours
    })),
    defaultValues: businessFormData
  })

  const onSubmit = async (data: typeof businessFormData) => {
    try {
      const updates = [
        { key: 'business.name', update: { value: data.name } },
        { key: 'business.address', update: { value: data.address } },
        { key: 'business.phone', update: { value: data.phone } },
        { key: 'business.email', update: { value: data.email } },
        { key: 'business.opening_hours', update: { value: data.opening_hours } }
      ]

      await updateSettings.mutateAsync(updates as any)
    } catch (error) {
      console.error('Failed to update business settings:', error)
    }
  }

  const openingHours = form.watch('opening_hours') || defaultOpeningHours

  const updateOpeningHours = (day: keyof OpeningHours, field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    const current = form.getValues('opening_hours') || defaultOpeningHours
    const updated = {
      ...current,
      [day]: {
        ...current[day],
        [field]: value
      }
    }
    form.setValue('opening_hours', updated)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Business Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Business Name</Label>
          <Input
            id="name"
            {...form.register('name')}
            placeholder="Your Business Name"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Business Email</Label>
          <Input
            id="email"
            type="email"
            {...form.register('email')}
            placeholder="info@yourbusiness.com"
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            {...form.register('phone')}
            placeholder="+49 123 456789"
          />
          {form.formState.errors.phone && (
            <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Business Address</Label>
          <Input
            id="address"
            {...form.register('address')}
            placeholder="Street, City, Postal Code"
          />
          {form.formState.errors.address && (
            <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Opening Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Opening Hours
          </CardTitle>
          <CardDescription>
            Set your default opening hours for each day of the week.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(dayNames).map(([dayKey, dayName]) => {
            const daySettings = openingHours[dayKey as keyof OpeningHours]
            
            return (
              <div key={dayKey} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className="flex items-center space-x-2 min-w-[100px]">
                  <Switch
                    checked={daySettings?.enabled || false}
                    onCheckedChange={(checked) => 
                      updateOpeningHours(dayKey as keyof OpeningHours, 'enabled', checked)
                    }
                  />
                  <Label className="font-medium">{dayName}</Label>
                </div>

                {daySettings?.enabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={daySettings.start || '09:00'}
                      onChange={(e) => 
                        updateOpeningHours(dayKey as keyof OpeningHours, 'start', e.target.value)
                      }
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={daySettings.end || '18:00'}
                      onChange={(e) => 
                        updateOpeningHours(dayKey as keyof OpeningHours, 'end', e.target.value)
                      }
                      className="w-32"
                    />
                  </div>
                )}

                {!daySettings?.enabled && (
                  <span className="text-muted-foreground">Closed</span>
                )}
              </div>
            )
          })}
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