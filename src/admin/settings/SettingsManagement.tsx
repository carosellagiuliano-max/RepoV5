/**
 * Business Settings Management Component
 * Main page for managing all business settings in the admin panel
 */

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Badge } from '../../components/ui/badge'
import { Clock, Calendar, Mail, Building, Bell, Settings } from 'lucide-react'
import { BusinessHoursSettings } from './BusinessHoursSettings'
import { BookingSettings } from './BookingSettings'
import { SmtpSettings } from './SmtpSettings'
import { BusinessInfoSettings } from './BusinessInfoSettings'
import { NotificationSettings } from './NotificationSettings'
import { useSettings } from '../../hooks/use-settings'

export function SettingsManagement() {
  const { data: settings, isLoading, error } = useSettings()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error Loading Settings</CardTitle>
            <CardDescription className="text-red-600">
              {error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const settingsCount = settings?.raw?.length || 0
  const publicSettingsCount = settings?.raw?.filter(s => s.is_public)?.length || 0

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Settings</h1>
          <p className="text-muted-foreground">
            Configure business operations, booking rules, and notifications
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">
            {settingsCount} total settings
          </Badge>
          <Badge variant="outline">
            {publicSettingsCount} public
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="business-hours" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="business-hours" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hours
          </TabsTrigger>
          <TabsTrigger value="booking" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Booking
          </TabsTrigger>
          <TabsTrigger value="business-info" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business-hours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Business Hours
              </CardTitle>
              <CardDescription>
                Set your salon's opening hours for each day of the week. These hours will be visible to customers and affect booking availability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessHoursSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Booking Configuration
              </CardTitle>
              <CardDescription>
                Configure booking rules, time windows, and appointment limits that affect the entire booking flow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BookingSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business-info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Manage your business contact information and details displayed to customers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessInfoSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Configuration
              </CardTitle>
              <CardDescription>
                Configure SMTP settings for sending emails to customers. Test your configuration before saving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SmtpSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Control when and how notifications are sent to customers for bookings and reminders.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}