/**
 * Business Information Settings Component
 * Manages business contact information
 */

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Building, Save, RefreshCw } from 'lucide-react'
import { useBusinessInfo, useUpdateSetting } from '../../hooks/use-settings'
import { businessInfoSchema } from '../../lib/validation/schemas'

type BusinessInfoFormData = {
  business_name: string
  business_address: string
  business_phone: string
  business_email: string
}

export function BusinessInfoSettings() {
  const { businessInfo, isLoading, error } = useBusinessInfo()
  const updateSetting = useUpdateSetting()
  const [hasChanges, setHasChanges] = useState(false)

  const form = useForm<BusinessInfoFormData>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: businessInfo || {
      business_name: 'Schnittwerk Your Style',
      business_address: 'Musterstraße 123, 12345 Musterstadt',
      business_phone: '+49 123 456789',
      business_email: 'info@schnittwerk-your-style.de'
    }
  })

  // Update form when data loads
  React.useEffect(() => {
    if (businessInfo) {
      // Remove quotes from string values if they exist
      const cleanInfo = {
        business_name: String(businessInfo.business_name).replace(/"/g, ''),
        business_address: String(businessInfo.business_address).replace(/"/g, ''),
        business_phone: String(businessInfo.business_phone).replace(/"/g, ''),
        business_email: String(businessInfo.business_email).replace(/"/g, '')
      }
      form.reset(cleanInfo)
      setHasChanges(false)
    }
  }, [businessInfo, form])

  // Track changes
  React.useEffect(() => {
    const subscription = form.watch(() => setHasChanges(true))
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (data: BusinessInfoFormData) => {
    try {
      // Update each business info setting individually
      await Promise.all([
        updateSetting.mutateAsync({
          key: 'business_name',
          data: { value: data.business_name }
        }),
        updateSetting.mutateAsync({
          key: 'business_address',
          data: { value: data.business_address }
        }),
        updateSetting.mutateAsync({
          key: 'business_phone',
          data: { value: data.business_phone }
        }),
        updateSetting.mutateAsync({
          key: 'business_email',
          data: { value: data.business_email }
        })
      ])
      setHasChanges(false)
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const resetForm = () => {
    if (businessInfo) {
      form.reset(businessInfo)
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
        Error loading business information: {error.message}
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="business_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Your salon's name as displayed to customers
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormDescription>
                  Main contact email for your business
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Phone</FormLabel>
                <FormControl>
                  <Input type="tel" {...field} />
                </FormControl>
                <FormDescription>
                  Main contact phone number for your business
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_address"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Business Address</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Full business address displayed to customers
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Information displayed to customers
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
              Save Info
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Business information is displayed on booking forms and emails</p>
          <p>• Phone number should include country code for international customers</p>
          <p>• Email address is used for customer replies and notifications</p>
        </div>
      </form>
    </Form>
  )
}