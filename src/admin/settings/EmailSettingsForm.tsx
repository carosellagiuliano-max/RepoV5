/**
 * Email Settings Form
 * Form for managing SMTP configuration and testing email functionality
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { schemas } from '@/lib/validation/schemas'
import { Setting } from '@/lib/types/settings'
import { useUpdateMultipleSettings, useTestSmtpSettings } from '@/hooks/use-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, Save, Mail, Send, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react'

interface EmailSettingsFormProps {
  settings: Setting[]
}

export function EmailSettingsForm({ settings }: EmailSettingsFormProps) {
  const [showPasswords, setShowPasswords] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  
  const updateSettings = useUpdateMultipleSettings()
  const testSmtp = useTestSmtpSettings()

  // Extract current values from settings
  const getSettingValue = (key: string, defaultValue: any = '') => {
    const setting = settings.find(s => s.key === key)
    // Remove quotes if present in string values
    const value = setting?.value ?? defaultValue
    return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : value
  }

  const smtpFormData = {
    host: getSettingValue('smtp.host', ''),
    port: getSettingValue('smtp.port', 587),
    user: getSettingValue('smtp.user', ''),
    password: getSettingValue('smtp.password', ''),
    from_email: getSettingValue('smtp.from_email', ''),
    from_name: getSettingValue('smtp.from_name', '')
  }

  const form = useForm({
    resolver: zodResolver(schemas.settings.smtpSettings),
    defaultValues: smtpFormData
  })

  const testForm = useForm({
    resolver: zodResolver(schemas.settings.testEmail),
    defaultValues: {
      to: '',
      subject: 'SMTP Test Email',
      body: 'This is a test email to verify your SMTP configuration is working correctly.'
    }
  })

  const onSubmit = async (data: typeof smtpFormData) => {
    try {
      const updates = [
        { key: 'smtp.host', update: { value: data.host } },
        { key: 'smtp.port', update: { value: data.port } },
        { key: 'smtp.user', update: { value: data.user } },
        { key: 'smtp.password', update: { value: data.password } },
        { key: 'smtp.from_email', update: { value: data.from_email } },
        { key: 'smtp.from_name', update: { value: data.from_name } }
      ]

      await updateSettings.mutateAsync(updates as any)
    } catch (error) {
      console.error('Failed to update SMTP settings:', error)
    }
  }

  const onTestEmail = async (data: { to: string; subject: string; body: string }) => {
    try {
      await testSmtp.mutateAsync(data)
      setTestDialogOpen(false)
      testForm.reset()
    } catch (error) {
      console.error('Failed to send test email:', error)
    }
  }

  const isConfigurationComplete = () => {
    const values = form.getValues()
    return values.host && values.port && values.user && values.password && 
           values.from_email && values.from_name
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            SMTP credentials are stored securely and are only visible to administrators. 
            Ensure you use application-specific passwords where required.
          </AlertDescription>
        </Alert>

        {/* SMTP Server Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>SMTP Server Configuration</CardTitle>
            <CardDescription>
              Configure your email server settings for sending notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">SMTP Host</Label>
                <Input
                  id="host"
                  {...form.register('host')}
                  placeholder="smtp.gmail.com"
                />
                {form.formState.errors.host && (
                  <p className="text-sm text-destructive">{form.formState.errors.host.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">SMTP Port</Label>
                <Input
                  id="port"
                  type="number"
                  {...form.register('port', { valueAsNumber: true })}
                  placeholder="587"
                />
                {form.formState.errors.port && (
                  <p className="text-sm text-destructive">{form.formState.errors.port.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user">SMTP Username</Label>
                <Input
                  id="user"
                  {...form.register('user')}
                  placeholder="your-email@gmail.com"
                />
                {form.formState.errors.user && (
                  <p className="text-sm text-destructive">{form.formState.errors.user.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">SMTP Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPasswords ? 'text' : 'password'}
                    {...form.register('password')}
                    placeholder="Your app password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPasswords(!showPasswords)}
                  >
                    {showPasswords ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Email Identity</CardTitle>
            <CardDescription>
              Configure the sender information for outgoing emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from_email">From Email Address</Label>
                <Input
                  id="from_email"
                  type="email"
                  {...form.register('from_email')}
                  placeholder="noreply@yourbusiness.com"
                />
                {form.formState.errors.from_email && (
                  <p className="text-sm text-destructive">{form.formState.errors.from_email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  {...form.register('from_name')}
                  placeholder="Your Business Name"
                />
                {form.formState.errors.from_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.from_name.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                type="button" 
                variant="outline"
                disabled={!isConfigurationComplete() || updateSettings.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Test Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Test Email</DialogTitle>
                <DialogDescription>
                  Send a test email to verify your SMTP configuration is working correctly.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={testForm.handleSubmit(onTestEmail)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test_to">Send To</Label>
                  <Input
                    id="test_to"
                    type="email"
                    {...testForm.register('to')}
                    placeholder="test@example.com"
                  />
                  {testForm.formState.errors.to && (
                    <p className="text-sm text-destructive">{testForm.formState.errors.to.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test_subject">Subject</Label>
                  <Input
                    id="test_subject"
                    {...testForm.register('subject')}
                    placeholder="Test email subject"
                  />
                  {testForm.formState.errors.subject && (
                    <p className="text-sm text-destructive">{testForm.formState.errors.subject.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test_body">Message</Label>
                  <Textarea
                    id="test_body"
                    {...testForm.register('body')}
                    placeholder="Test email content"
                    rows={4}
                  />
                  {testForm.formState.errors.body && (
                    <p className="text-sm text-destructive">{testForm.formState.errors.body.message}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setTestDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={testSmtp.isPending}>
                    {testSmtp.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Test
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

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

      {/* Configuration Status */}
      <Card className={`${isConfigurationComplete() ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            {isConfigurationComplete() ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">
                  SMTP configuration is complete
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-900">
                  SMTP configuration is incomplete
                </span>
              </>
            )}
          </div>
          <p className="text-sm mt-2 text-muted-foreground">
            {isConfigurationComplete() 
              ? 'Your email configuration is ready. You can now send test emails and notifications will be delivered.'
              : 'Please fill in all SMTP settings to enable email notifications and test functionality.'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  )
}