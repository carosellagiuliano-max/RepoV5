/**
 * SMTP Settings Component
 * Manages SMTP configuration with test functionality
 */

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Switch } from '../../components/ui/switch'
import { Textarea } from '../../components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Mail, Save, RefreshCw, TestTube, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useSmtpConfig, useUpdateSetting, useTestSmtp } from '../../hooks/use-settings'
import { smtpConfigSchema, smtpTestSchema } from '../../lib/validation/schemas'

type SmtpConfigFormData = {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_password: string
  smtp_from_email: string
  smtp_from_name: string
  smtp_use_tls: boolean
}

type SmtpTestFormData = {
  to_email: string
  subject: string
  message: string
}

export function SmtpSettings() {
  const { smtpConfig, isLoading, error } = useSmtpConfig()
  const updateSetting = useUpdateSetting()
  const testSmtp = useTestSmtp()
  const [hasChanges, setHasChanges] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)

  const form = useForm<SmtpConfigFormData>({
    resolver: zodResolver(smtpConfigSchema),
    defaultValues: smtpConfig || {
      smtp_host: '',
      smtp_port: 587,
      smtp_user: '',
      smtp_password: '',
      smtp_from_email: 'noreply@schnittwerk-your-style.de',
      smtp_from_name: 'Schnittwerk Your Style',
      smtp_use_tls: true
    }
  })

  const testForm = useForm<SmtpTestFormData>({
    resolver: zodResolver(smtpTestSchema),
    defaultValues: {
      to_email: '',
      subject: 'SMTP Test Email',
      message: 'This is a test email to verify SMTP configuration is working correctly.'
    }
  })

  // Update form when data loads
  React.useEffect(() => {
    if (smtpConfig) {
      // Remove quotes from string values if they exist
      const cleanConfig = {
        ...smtpConfig,
        smtp_host: String(smtpConfig.smtp_host).replace(/"/g, ''),
        smtp_user: String(smtpConfig.smtp_user).replace(/"/g, ''),
        smtp_password: String(smtpConfig.smtp_password).replace(/"/g, ''),
        smtp_from_email: String(smtpConfig.smtp_from_email).replace(/"/g, ''),
        smtp_from_name: String(smtpConfig.smtp_from_name).replace(/"/g, '')
      }
      form.reset(cleanConfig)
      setHasChanges(false)
    }
  }, [smtpConfig, form])

  // Track changes
  React.useEffect(() => {
    const subscription = form.watch(() => setHasChanges(true))
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (data: SmtpConfigFormData) => {
    try {
      // Update each SMTP setting individually
      await Promise.all([
        updateSetting.mutateAsync({
          key: 'smtp_host',
          data: { value: data.smtp_host }
        }),
        updateSetting.mutateAsync({
          key: 'smtp_port',
          data: { value: data.smtp_port }
        }),
        updateSetting.mutateAsync({
          key: 'smtp_user',
          data: { value: data.smtp_user }
        }),
        updateSetting.mutateAsync({
          key: 'smtp_password',
          data: { value: data.smtp_password }
        }),
        updateSetting.mutateAsync({
          key: 'smtp_from_email',
          data: { value: data.smtp_from_email }
        }),
        updateSetting.mutateAsync({
          key: 'smtp_from_name',
          data: { value: data.smtp_from_name }
        }),
        updateSetting.mutateAsync({
          key: 'smtp_use_tls',
          data: { value: data.smtp_use_tls }
        })
      ])
      setHasChanges(false)
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const onTestSubmit = async (data: SmtpTestFormData) => {
    try {
      await testSmtp.mutateAsync(data)
      setTestDialogOpen(false)
      testForm.reset()
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const resetForm = () => {
    if (smtpConfig) {
      form.reset(smtpConfig)
      setHasChanges(false)
    }
  }

  const isConfigComplete = () => {
    const values = form.getValues()
    return values.smtp_host && values.smtp_user && values.smtp_password && values.smtp_from_email
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
        Error loading SMTP configuration: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  SMTP Server
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="smtp_host"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Host</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="smtp.gmail.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Your email provider's SMTP server hostname
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtp_port"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Port</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="65535"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 587)}
                        />
                      </FormControl>
                      <FormDescription>
                        Common ports: 587 (TLS), 465 (SSL), 25 (unsecured)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtp_use_tls"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Use TLS Encryption</FormLabel>
                        <FormDescription className="text-sm">
                          Enable TLS/SSL encryption for secure email sending
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Authentication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="smtp_user"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your-email@domain.com"
                          autoComplete="username"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Your SMTP username (usually your email address)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smtp_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter password"
                            autoComplete="current-password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Your SMTP password or app-specific password
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
              <CardTitle className="text-base">Email Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="smtp_from_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="noreply@schnittwerk-your-style.de"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Email address that appears as sender
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="smtp_from_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Schnittwerk Your Style"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name that appears as sender
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                SMTP configuration for email notifications
              </span>
              {hasChanges && (
                <Badge variant="secondary">Unsaved changes</Badge>
              )}
              {isConfigComplete() && !hasChanges && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Configured
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!isConfigComplete() || hasChanges}
                  >
                    <TestTube className="h-4 w-4 mr-1" />
                    Test SMTP
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Test SMTP Configuration</DialogTitle>
                    <DialogDescription>
                      Send a test email to verify your SMTP settings are working correctly.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...testForm}>
                    <form onSubmit={testForm.handleSubmit(onTestSubmit)} className="space-y-4">
                      <FormField
                        control={testForm.control}
                        name="to_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>To Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="test@example.com"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={testForm.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={testForm.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Message</FormLabel>
                            <FormControl>
                              <Textarea rows={3} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setTestDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={testSmtp.isPending}
                        >
                          {testSmtp.isPending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                          ) : (
                            <TestTube className="h-4 w-4 mr-1" />
                          )}
                          Send Test
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

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
                Save SMTP
              </Button>
            </div>
          </div>
        </form>
      </Form>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>• SMTP configuration is required for sending email notifications</p>
        <p>• Test your configuration before saving to ensure emails are delivered</p>
        <p>• Use app-specific passwords for Gmail and other providers with 2FA</p>
        <p>• TLS encryption is recommended for security</p>
      </div>
    </div>
  )
}