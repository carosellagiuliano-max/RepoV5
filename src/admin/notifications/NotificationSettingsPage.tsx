import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'
import { Separator } from '../../components/ui/separator'
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '../../components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, MessageSquare, Settings, Clock, RefreshCw, TestTube } from 'lucide-react'
import { useNotificationSettings } from '../../hooks/use-notification-settings'
import { NotificationSettings, EmailSettings, SmsSettings } from '../../lib/types/database'

// Form schemas
const emailSettingsSchema = z.object({
  smtp_host: z.string().min(1, 'SMTP Host ist erforderlich'),
  smtp_port: z.number().min(1).max(65535, 'Port muss zwischen 1 und 65535 liegen'),
  smtp_username: z.string().min(1, 'Benutzername ist erforderlich'),
  smtp_password: z.string().min(1, 'Passwort ist erforderlich'),
  smtp_from_email: z.string().email('Ungültige E-Mail-Adresse'),
  smtp_from_name: z.string().min(1, 'Absendername ist erforderlich'),
  smtp_use_tls: z.boolean()
})

const notificationSettingsSchema = z.object({
  email_enabled: z.boolean(),
  sms_enabled: z.boolean(),
  reminder_hours_before: z.number().min(1).max(168, 'Vorlaufzeit muss zwischen 1 und 168 Stunden liegen'),
  send_confirmations: z.boolean(),
  send_cancellations: z.boolean(),
  send_daily_schedule: z.boolean(),
  daily_schedule_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Ungültiges Zeitformat (HH:MM)'),
  retry_attempts: z.number().min(1).max(10, 'Wiederholungsversuche müssen zwischen 1 und 10 liegen'),
  retry_delay_minutes: z.number().min(1).max(1440, 'Verzögerung muss zwischen 1 und 1440 Minuten liegen')
})

const smsSettingsSchema = z.object({
  twilio_account_sid: z.string().optional(),
  twilio_auth_token: z.string().optional(),
  twilio_phone_number: z.string().optional(),
  enabled: z.boolean()
})

export function NotificationSettingsPage() {
  const { 
    settings, 
    saveEmailSettings, 
    saveNotificationSettings, 
    saveSmsSettings,
    testEmailConfiguration,
    loading 
  } = useNotificationSettings()

  const emailForm = useForm<EmailSettings>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: settings.email
  })

  const notificationForm = useForm<NotificationSettings>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: settings.notifications
  })

  const smsForm = useForm<SmsSettings>({
    resolver: zodResolver(smsSettingsSchema),
    defaultValues: settings.sms
  })

  // Update form values when settings change
  React.useEffect(() => {
    emailForm.reset(settings.email)
    notificationForm.reset(settings.notifications)
    smsForm.reset(settings.sms)
  }, [settings, emailForm, notificationForm, smsForm])

  const onEmailSubmit = async (data: EmailSettings) => {
    await saveEmailSettings(data)
  }

  const onNotificationSubmit = async (data: NotificationSettings) => {
    await saveNotificationSettings(data)
  }

  const onSmsSubmit = async (data: SmsSettings) => {
    await saveSmsSettings(data)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Benachrichtigungseinstellungen</h1>
      </div>

      <div className="grid gap-6">
        {/* General Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Allgemeine Benachrichtigungseinstellungen
            </CardTitle>
            <CardDescription>
              Konfigurieren Sie, wann und wie Benachrichtigungen gesendet werden sollen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...notificationForm}>
              <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={notificationForm.control}
                    name="email_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            E-Mail-Benachrichtigungen
                          </FormLabel>
                          <FormDescription>
                            E-Mail-Benachrichtigungen aktivieren
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

                  <FormField
                    control={notificationForm.control}
                    name="sms_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            SMS-Benachrichtigungen
                          </FormLabel>
                          <FormDescription>
                            SMS-Benachrichtigungen aktivieren
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
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={notificationForm.control}
                    name="reminder_hours_before"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Erinnerung (Stunden vorher)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="168"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Wie viele Stunden vor dem Termin soll die Erinnerung gesendet werden?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={notificationForm.control}
                    name="daily_schedule_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tagesplan-Uhrzeit</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Wann soll der Tagesplan an Mitarbeiter gesendet werden?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Benachrichtigungstypen</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={notificationForm.control}
                      name="send_confirmations"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Bestätigungen</FormLabel>
                            <FormDescription className="text-xs">
                              Terminbestätigungen senden
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

                    <FormField
                      control={notificationForm.control}
                      name="send_cancellations"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Stornierungen</FormLabel>
                            <FormDescription className="text-xs">
                              Stornierungsbestätigungen senden
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

                    <FormField
                      control={notificationForm.control}
                      name="send_daily_schedule"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Tagesplan</FormLabel>
                            <FormDescription className="text-xs">
                              Täglichen Terminplan an Mitarbeiter senden
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
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={notificationForm.control}
                    name="retry_attempts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Wiederholungsversuche
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Wie oft soll bei fehlgeschlagenen Nachrichten wiederholt werden?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={notificationForm.control}
                    name="retry_delay_minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wiederholungsverzögerung (Minuten)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="1440"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Verzögerung zwischen Wiederholungsversuchen in Minuten
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" disabled={loading}>
                  Benachrichtigungseinstellungen speichern
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              E-Mail-Konfiguration
            </CardTitle>
            <CardDescription>
              SMTP-Einstellungen für den E-Mail-Versand konfigurieren.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={emailForm.control}
                    name="smtp_host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Host</FormLabel>
                        <FormControl>
                          <Input placeholder="smtp.gmail.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailForm.control}
                    name="smtp_port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Port</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="587"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={emailForm.control}
                    name="smtp_username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Benutzername</FormLabel>
                        <FormControl>
                          <Input placeholder="your-email@gmail.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailForm.control}
                    name="smtp_password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Passwort</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={emailForm.control}
                    name="smtp_from_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Absender E-Mail</FormLabel>
                        <FormControl>
                          <Input placeholder="noreply@salon.de" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={emailForm.control}
                    name="smtp_from_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Absendername</FormLabel>
                        <FormControl>
                          <Input placeholder="Schnittwerk Your Style" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={emailForm.control}
                  name="smtp_use_tls"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">TLS verwenden</FormLabel>
                        <FormDescription>
                          Sichere Verbindung mit TLS/SSL verwenden
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

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    E-Mail-Einstellungen speichern
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testEmailConfiguration}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <TestTube className="h-4 w-4" />
                    Konfiguration testen
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* SMS Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS-Konfiguration (Optional)
            </CardTitle>
            <CardDescription>
              Twilio-Einstellungen für den SMS-Versand konfigurieren. SMS-Funktionalität ist optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...smsForm}>
              <form onSubmit={smsForm.handleSubmit(onSmsSubmit)} className="space-y-4">
                <FormField
                  control={smsForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">SMS aktivieren</FormLabel>
                        <FormDescription>
                          SMS-Benachrichtigungen über Twilio aktivieren
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

                {smsForm.watch('enabled') && (
                  <div className="space-y-4">
                    <FormField
                      control={smsForm.control}
                      name="twilio_account_sid"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twilio Account SID</FormLabel>
                          <FormControl>
                            <Input placeholder="AC..." {...field} />
                          </FormControl>
                          <FormDescription>
                            Ihre Twilio Account SID aus dem Twilio Dashboard
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={smsForm.control}
                      name="twilio_auth_token"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twilio Auth Token</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormDescription>
                            Ihr Twilio Auth Token aus dem Twilio Dashboard
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={smsForm.control}
                      name="twilio_phone_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twilio Telefonnummer</FormLabel>
                          <FormControl>
                            <Input placeholder="+1234567890" {...field} />
                          </FormControl>
                          <FormDescription>
                            Ihre verifizierte Twilio Telefonnummer im E.164 Format
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <Button type="submit" disabled={loading}>
                  SMS-Einstellungen speichern
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}