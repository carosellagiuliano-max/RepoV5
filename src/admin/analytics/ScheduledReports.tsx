/**
 * Scheduled Reports Component
 * Management interface for automated report delivery
 */

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Plus, 
  Calendar, 
  Mail, 
  Download, 
  Settings,
  Clock,
  Edit,
  Trash2,
  Send,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ScheduledReport } from '@/lib/types/analytics'

const createReportSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.string().optional(),
  frequency: z.enum(['weekly', 'monthly']),
  format: z.enum(['csv', 'pdf']),
  recipients: z.string().min(1, 'Mindestens ein Empfänger erforderlich'),
  filters: z.object({
    staffId: z.string().optional(),
    serviceId: z.string().optional(),
    period: z.enum(['week', 'month']).default('month')
  })
})

type CreateReportForm = z.infer<typeof createReportSchema>

interface ScheduledReportsProps {
  permissions: {
    canManageReports: boolean
  }
}

export function ScheduledReports({ permissions }: ScheduledReportsProps) {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CreateReportForm>({
    resolver: zodResolver(createReportSchema),
    defaultValues: {
      frequency: 'monthly',
      format: 'csv',
      filters: {
        period: 'month'
      }
    }
  })

  const fetchReports = async () => {
    setIsLoading(true)
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/admin/analytics/reports', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch reports')
      }

      const result = await response.json()
      if (result.success) {
        setReports(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
      toast.error('Fehler beim Laden der Berichte')
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: CreateReportForm) => {
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Not authenticated')
      }

      const reportData = {
        ...data,
        recipients: data.recipients.split(',').map(email => email.trim()),
        isActive: true
      }

      const url = editingReport 
        ? `/.netlify/functions/admin/analytics/reports/${editingReport.id}`
        : '/.netlify/functions/admin/analytics/reports'
      
      const method = editingReport ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      })

      if (!response.ok) {
        throw new Error('Failed to save report')
      }

      const result = await response.json()
      if (result.success) {
        toast.success(editingReport ? 'Bericht aktualisiert' : 'Bericht erstellt')
        setIsCreateModalOpen(false)
        setEditingReport(null)
        reset()
        fetchReports()
      }
    } catch (error) {
      console.error('Failed to save report:', error)
      toast.error('Fehler beim Speichern des Berichts')
    }
  }

  const toggleReportStatus = async (reportId: string, isActive: boolean) => {
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/.netlify/functions/admin/analytics/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive })
      })

      if (!response.ok) {
        throw new Error('Failed to update report status')
      }

      toast.success(isActive ? 'Bericht aktiviert' : 'Bericht deaktiviert')
      fetchReports()
    } catch (error) {
      console.error('Failed to update report status:', error)
      toast.error('Fehler beim Aktualisieren des Berichtstatus')
    }
  }

  const deleteReport = async (reportId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Bericht löschen möchten?')) {
      return
    }

    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/.netlify/functions/admin/analytics/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete report')
      }

      toast.success('Bericht gelöscht')
      fetchReports()
    } catch (error) {
      console.error('Failed to delete report:', error)
      toast.error('Fehler beim Löschen des Berichts')
    }
  }

  const sendReportNow = async (reportId: string) => {
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/.netlify/functions/admin/analytics/reports/${reportId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to send report')
      }

      toast.success('Bericht wird gesendet...')
    } catch (error) {
      console.error('Failed to send report:', error)
      toast.error('Fehler beim Senden des Berichts')
    }
  }

  const startEdit = (report: ScheduledReport) => {
    setEditingReport(report)
    setValue('name', report.name)
    setValue('description', report.description || '')
    setValue('frequency', report.frequency)
    setValue('format', report.format)
    setValue('recipients', report.recipients.join(', '))
    setValue('filters.staffId', report.filters.staffId || '')
    setValue('filters.serviceId', report.filters.serviceId || '')
    setValue('filters.period', report.filters.period || 'month')
    setIsCreateModalOpen(true)
  }

  const getFrequencyLabel = (frequency: string) => {
    return frequency === 'weekly' ? 'Wöchentlich' : 'Monatlich'
  }

  const getFormatLabel = (format: string) => {
    return format === 'csv' ? 'CSV' : 'PDF'
  }

  useEffect(() => {
    if (permissions.canManageReports) {
      fetchReports()
    }
  }, [permissions.canManageReports])

  if (!permissions.canManageReports) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Sie haben keine Berechtigung zum Verwalten von Berichten</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Geplante Berichte</h3>
          <p className="text-sm text-muted-foreground">
            Automatische Berichtserstellung und -versendung konfigurieren
          </p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" onClick={() => {
              setEditingReport(null)
              reset()
            }}>
              <Plus className="w-4 h-4" />
              Neuer Bericht
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingReport ? 'Bericht bearbeiten' : 'Neuen Bericht erstellen'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="z.B. Monatlicher Umsatzbericht"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="frequency">Häufigkeit</Label>
                  <Select
                    value={watch('frequency')}
                    onValueChange={(value) => setValue('frequency', value as 'weekly' | 'monthly')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Wöchentlich</SelectItem>
                      <SelectItem value="monthly">Monatlich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Optionale Beschreibung des Berichts"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="format">Format</Label>
                  <Select
                    value={watch('format')}
                    onValueChange={(value) => setValue('format', value as 'csv' | 'pdf')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="period">Berichtszeitraum</Label>
                  <Select
                    value={watch('filters.period')}
                    onValueChange={(value) => setValue('filters.period', value as 'week' | 'month')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Woche</SelectItem>
                      <SelectItem value="month">Monat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="recipients">E-Mail Empfänger *</Label>
                <Input
                  id="recipients"
                  {...register('recipients')}
                  placeholder="email1@example.com, email2@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mehrere E-Mail-Adressen mit Komma trennen
                </p>
                {errors.recipients && (
                  <p className="text-sm text-red-600 mt-1">{errors.recipients.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false)
                    setEditingReport(null)
                    reset()
                  }}
                >
                  Abbrechen
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Speichern...' : (editingReport ? 'Aktualisieren' : 'Erstellen')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Konfigurierte Berichte
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2" />
              <p>Noch keine Berichte konfiguriert</p>
              <p className="text-sm">Erstellen Sie Ihren ersten automatischen Bericht</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Häufigkeit</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Nächster Lauf</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{report.name}</div>
                        {report.description && (
                          <div className="text-sm text-muted-foreground">
                            {report.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getFrequencyLabel(report.frequency)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getFormatLabel(report.format)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {report.recipients.length} Empfänger
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4" />
                        {format(new Date(report.nextRun), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={report.isActive}
                        onCheckedChange={(checked) => toggleReportStatus(report.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendReportNow(report.id)}
                          title="Jetzt senden"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(report)}
                          title="Bearbeiten"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReport(report.id)}
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}