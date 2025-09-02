/**
 * Settings Management Page
 * Main admin interface for managing business settings
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Settings, Building, Calendar, Mail } from 'lucide-react'
import { useSettings } from '@/hooks/use-settings'
import { BusinessSettingsForm } from './BusinessSettingsForm'
import { BookingSettingsForm } from './BookingSettingsForm'
import { EmailSettingsForm } from './EmailSettingsForm'

export function SettingsManagement() {
  const [activeTab, setActiveTab] = useState('business')
  const { data: settingsData, isLoading, error } = useSettings({ limit: 100 })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading settings...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-destructive">
            <p>Failed to load settings: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const settings = settingsData?.settings || []
  const businessSettings = settings.filter(s => s.category === 'business')
  const bookingSettings = settings.filter(s => s.category === 'booking')
  const emailSettings = settings.filter(s => s.category === 'email')

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Business Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Configure your business information, booking rules, and email settings.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Business Info
            <Badge variant="secondary" className="ml-2">
              {businessSettings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="booking" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Booking Rules
            <Badge variant="secondary" className="ml-2">
              {bookingSettings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email & SMTP
            <Badge variant="secondary" className="ml-2">
              {emailSettings.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Manage your business details, contact information, and opening hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessSettingsForm settings={businessSettings} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Booking Configuration
              </CardTitle>
              <CardDescription>
                Configure booking windows, buffer times, and cancellation policies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BookingSettingsForm settings={bookingSettings} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email & SMTP Configuration
              </CardTitle>
              <CardDescription>
                Configure SMTP settings for email notifications and test your configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailSettingsForm settings={emailSettings} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}