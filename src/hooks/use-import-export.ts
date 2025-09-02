/**
 * Custom hooks for customer CSV import/export functionality
 */

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

interface ExportFilters {
  format?: 'basic' | 'detailed' | 'gdpr_full'
  hasGdprConsent?: boolean
  city?: string
  postalCode?: string
  registeredAfter?: string
  registeredBefore?: string
  includeDeleted?: boolean
}

interface ExportPreview {
  total_records: number
  format: string
  filters: ExportFilters
  sample_csv: string
  sample_records: any[]
  estimated_file_size: string
  gdpr_compliance: {
    consent_required: boolean
    consent_filtered: boolean
  }
}

interface FieldMapping {
  csvColumn: string
  databaseField: string
  required: boolean
  transform?: 'date' | 'boolean' | 'phone' | 'email'
}

interface ImportValidationResult {
  import_log_id: string
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    duplicate_rows: number
    warning_rows: number
  }
  rows: ImportRow[]
  field_mapping: FieldMapping[]
  ready_for_import: boolean
}

interface ImportRow {
  rowNumber: number
  data: Record<string, string>
  processedData?: Record<string, any>
  errors: string[]
  warnings: string[]
  status: 'pending' | 'valid' | 'invalid' | 'duplicate' | 'success' | 'error'
  customerId?: string
}

interface ImportLog {
  id: string
  filename: string
  total_rows: number
  processed_rows: number
  successful_imports: number
  failed_imports: number
  skipped_rows: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  import_mode: 'create_only' | 'update_existing' | 'create_and_update'
  field_mapping: FieldMapping[]
  validation_errors?: any[]
  duplicate_handling: 'skip' | 'update' | 'create_new'
  dry_run: boolean
  created_at: string
  completed_at?: string
  imported_by_profile?: {
    id: string
    full_name: string
    email: string
  }
}

export function useCustomerExport() {
  const [loading, setLoading] = useState(false)
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const generateExportPreview = async (filters: ExportFilters, format: string = 'basic'): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/admin/customers/export/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters, format }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to generate export preview')
      }

      const preview = await response.json()
      setExportPreview(preview)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate export preview'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const exportCustomers = async (filters: ExportFilters): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    setLoading(true)

    try {
      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/.netlify/functions/admin/customers/export/csv?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to export customers')
      }

      const result = await response.json()

      if (result.count === 0) {
        toast({
          title: 'Keine Daten',
          description: 'Keine Kunden entsprechen den Exportkriterien',
          variant: 'destructive',
        })
        return false
      }

      // Create and download CSV file
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: 'Export erfolgreich',
        description: `${result.count} Kunden wurden exportiert`,
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export customers'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    exportPreview,
    generateExportPreview,
    exportCustomers,
  }
}

export function useCustomerImport() {
  const [loading, setLoading] = useState(false)
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const getImportTemplate = async (): Promise<any> => {
    if (!user) return null

    try {
      const response = await fetch('/.netlify/functions/admin/customers/import/template', {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to get import template')
      }

      const template = await response.json()

      // Download CSV template
      const blob = new Blob([template.csv_template], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'customer-import-template.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: 'Template heruntergeladen',
        description: 'Import-Vorlage wurde heruntergeladen',
      })

      return template.template
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get import template'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return null
    }
  }

  const validateImport = async (
    csvData: string,
    filename: string,
    fieldMapping: FieldMapping[],
    importMode: string = 'create_only',
    duplicateHandling: string = 'skip'
  ): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/admin/customers/import/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvData,
          filename,
          fieldMapping,
          importMode,
          duplicateHandling,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to validate import')
      }

      const result = await response.json()
      setValidationResult(result)

      toast({
        title: 'Validierung abgeschlossen',
        description: `${result.summary.valid_rows}/${result.summary.total_rows} Zeilen sind gültig`,
        variant: result.ready_for_import ? 'default' : 'destructive',
      })

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate import'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const executeImport = async (
    csvData?: string,
    fieldMapping?: FieldMapping[],
    importMode: string = 'create_only',
    duplicateHandling: string = 'skip'
  ): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Fehler',
        description: 'Sie müssen angemeldet sein',
        variant: 'destructive',
      })
      return false
    }

    if (!validationResult && !csvData) {
      toast({
        title: 'Fehler',
        description: 'Keine Validierungsdaten oder CSV-Daten verfügbar',
        variant: 'destructive',
      })
      return false
    }

    setLoading(true)

    try {
      const response = await fetch('/.netlify/functions/admin/customers/import/execute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          importLogId: validationResult?.import_log_id,
          csvData: csvData || '',
          fieldMapping: fieldMapping || validationResult?.field_mapping || [],
          importMode,
          duplicateHandling,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to execute import')
      }

      const result = await response.json()

      toast({
        title: 'Import abgeschlossen',
        description: `${result.summary.successful_imports} Kunden erfolgreich importiert`,
      })

      // Clear validation result after successful import
      setValidationResult(null)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute import'
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const clearValidation = () => {
    setValidationResult(null)
  }

  return {
    loading,
    validationResult,
    getImportTemplate,
    validateImport,
    executeImport,
    clearValidation,
  }
}

export function useImportLogs() {
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchImportLogs = async (filters: any = {}) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/.netlify/functions/admin/customers/import/logs?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch import logs: ${response.statusText}`)
      }

      const data = await response.json()
      setLogs(data.logs || [])
      setPagination(data.pagination || null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch import logs'
      setError(errorMessage)
      toast({
        title: 'Fehler',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const refetch = () => {
    fetchImportLogs()
  }

  return {
    logs,
    pagination,
    loading,
    error,
    fetchImportLogs,
    refetch,
  }
}

export type { 
  ExportFilters, 
  ExportPreview, 
  FieldMapping, 
  ImportValidationResult, 
  ImportRow, 
  ImportLog 
}