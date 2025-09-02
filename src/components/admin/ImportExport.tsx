import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Upload, FileText, CheckCircle, AlertTriangle, XCircle, Settings, Eye, History } from 'lucide-react'
import { useCustomerExport, useCustomerImport, useImportLogs, ExportFilters, FieldMapping } from '@/hooks/use-import-export'

export function ImportExport() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Import & Export</h2>
        <p className="text-muted-foreground">
          Kunden-Daten als CSV exportieren oder neue Kunden importieren
        </p>
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="logs">Import-Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <ExportTab />
        </TabsContent>

        <TabsContent value="import">
          <ImportTab />
        </TabsContent>

        <TabsContent value="logs">
          <ImportLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ExportTab() {
  const [filters, setFilters] = useState<ExportFilters>({
    format: 'basic',
    hasGdprConsent: undefined,
    city: '',
    postalCode: '',
    registeredAfter: '',
    registeredBefore: '',
    includeDeleted: false
  })

  const { loading, exportPreview, generateExportPreview, exportCustomers } = useCustomerExport()

  const handleFilterChange = (key: keyof ExportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handlePreview = () => {
    generateExportPreview(filters, filters.format || 'basic')
  }

  const handleExport = () => {
    exportCustomers(filters)
  }

  return (
    <div className="space-y-6">
      {/* Export Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Export-Einstellungen
          </CardTitle>
          <CardDescription>
            Konfigurieren Sie die Export-Parameter und Filter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Format */}
            <div className="space-y-2">
              <Label>Export-Format</Label>
              <Select
                value={filters.format}
                onValueChange={(value) => handleFilterChange('format', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basis (Name, E-Mail, Erstellungsdatum)</SelectItem>
                  <SelectItem value="detailed">Detailliert (Alle Kontaktdaten)</SelectItem>
                  <SelectItem value="gdpr_full">GDPR Vollständig (Mit Terminen)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {filters.format === 'basic' && 'Grundlegende Informationen für alle Kunden'}
                {filters.format === 'detailed' && 'Erfordert GDPR-Einverständnis der Kunden'}
                {filters.format === 'gdpr_full' && 'Vollständiger Export nur mit GDPR-Einverständnis'}
              </p>
            </div>

            {/* GDPR Consent */}
            <div className="space-y-2">
              <Label>GDPR-Einverständnis</Label>
              <Select
                value={filters.hasGdprConsent?.toString() || 'all'}
                onValueChange={(value) => 
                  handleFilterChange('hasGdprConsent', value === 'all' ? undefined : value === 'true')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kunden</SelectItem>
                  <SelectItem value="true">Nur mit Einverständnis</SelectItem>
                  <SelectItem value="false">Ohne Einverständnis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Include Deleted */}
            <div className="space-y-2">
              <Label>Gelöschte Kunden</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeDeleted"
                  checked={filters.includeDeleted}
                  onCheckedChange={(checked) => handleFilterChange('includeDeleted', checked)}
                />
                <Label htmlFor="includeDeleted" className="text-sm">
                  Gelöschte Kunden einschließen
                </Label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* City Filter */}
            <div className="space-y-2">
              <Label htmlFor="city">Stadt</Label>
              <Input
                id="city"
                placeholder="Stadt filtern"
                value={filters.city}
                onChange={(e) => handleFilterChange('city', e.target.value)}
              />
            </div>

            {/* Postal Code Filter */}
            <div className="space-y-2">
              <Label htmlFor="postalCode">PLZ</Label>
              <Input
                id="postalCode"
                placeholder="Postleitzahl"
                value={filters.postalCode}
                onChange={(e) => handleFilterChange('postalCode', e.target.value)}
              />
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="registeredAfter">Registriert nach</Label>
              <Input
                id="registeredAfter"
                type="date"
                value={filters.registeredAfter}
                onChange={(e) => handleFilterChange('registeredAfter', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registeredBefore">Registriert vor</Label>
              <Input
                id="registeredBefore"
                type="date"
                value={filters.registeredBefore}
                onChange={(e) => handleFilterChange('registeredBefore', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePreview} disabled={loading} variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              {loading ? 'Generiere Vorschau...' : 'Vorschau'}
            </Button>
            <Button onClick={handleExport} disabled={loading || !exportPreview}>
              <Download className="w-4 h-4 mr-2" />
              {loading ? 'Exportiere...' : 'Export starten'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Preview */}
      {exportPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Export-Vorschau
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{exportPreview.total_records}</div>
                <div className="text-sm text-muted-foreground">Datensätze</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{exportPreview.format}</div>
                <div className="text-sm text-muted-foreground">Format</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{exportPreview.estimated_file_size}</div>
                <div className="text-sm text-muted-foreground">Geschätzte Größe</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {exportPreview.gdpr_compliance.consent_filtered ? '✓' : '⚠️'}
                </div>
                <div className="text-sm text-muted-foreground">GDPR-konform</div>
              </div>
            </div>

            {exportPreview.gdpr_compliance.consent_required && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Dieser Export enthält nur Kunden mit GDPR-Einverständnis aufgrund des gewählten Formats.
                </AlertDescription>
              </Alert>
            )}

            {exportPreview.sample_csv && (
              <div className="space-y-2">
                <Label>CSV-Vorschau (erste 5 Zeilen)</Label>
                <Textarea
                  value={exportPreview.sample_csv}
                  readOnly
                  className="font-mono text-xs"
                  rows={8}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ImportTab() {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState('')
  const [fieldMapping, setFieldMapping] = useState<FieldMapping[]>([])
  const [importMode, setImportMode] = useState('create_only')
  const [duplicateHandling, setDuplicateHandling] = useState('skip')
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'execute'>('upload')

  const { loading, validationResult, getImportTemplate, validateImport, executeImport, clearValidation } = useCustomerImport()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setCsvFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        setCsvData(text)
        // Parse headers and create default mapping
        const lines = text.split('\n')
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
          const defaultMapping: FieldMapping[] = headers.map(header => ({
            csvColumn: header,
            databaseField: mapHeaderToField(header),
            required: ['full_name', 'email'].includes(mapHeaderToField(header)),
            transform: getTransformType(mapHeaderToField(header))
          }))
          setFieldMapping(defaultMapping)
          setStep('mapping')
        }
      }
      reader.readAsText(file)
    }
  }

  const handleValidate = async () => {
    if (csvData && csvFile) {
      const success = await validateImport(
        csvData,
        csvFile.name,
        fieldMapping,
        importMode,
        duplicateHandling
      )
      if (success) {
        setStep('validation')
      }
    }
  }

  const handleExecute = async () => {
    const success = await executeImport(
      csvData,
      fieldMapping,
      importMode,
      duplicateHandling
    )
    if (success) {
      setStep('upload')
      setCsvFile(null)
      setCsvData('')
      setFieldMapping([])
      clearValidation()
    }
  }

  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    setFieldMapping(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, ...updates } : mapping
    ))
  }

  return (
    <div className="space-y-6">
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              CSV-Import
            </CardTitle>
            <CardDescription>
              Laden Sie eine CSV-Datei hoch, um neue Kunden zu importieren
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csvFile">CSV-Datei auswählen</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Import-Modus</Label>
                <Select value={importMode} onValueChange={setImportMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_only">Nur neue Kunden erstellen</SelectItem>
                    <SelectItem value="update_existing">Nur bestehende Kunden aktualisieren</SelectItem>
                    <SelectItem value="create_and_update">Erstellen und aktualisieren</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dubletten-Behandlung</Label>
                <Select value={duplicateHandling} onValueChange={setDuplicateHandling}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Überspringen</SelectItem>
                    <SelectItem value="update">Aktualisieren</SelectItem>
                    <SelectItem value="create_new">Neuen erstellen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={getImportTemplate} variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Vorlage herunterladen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Feld-Zuordnung</CardTitle>
            <CardDescription>
              Ordnen Sie die CSV-Spalten den Datenbank-Feldern zu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV-Spalte</TableHead>
                    <TableHead>Datenbank-Feld</TableHead>
                    <TableHead>Erforderlich</TableHead>
                    <TableHead>Transformation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldMapping.map((mapping, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{mapping.csvColumn}</TableCell>
                      <TableCell>
                        <Select
                          value={mapping.databaseField}
                          onValueChange={(value) => updateFieldMapping(index, { databaseField: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_name">Name</SelectItem>
                            <SelectItem value="email">E-Mail</SelectItem>
                            <SelectItem value="phone">Telefon</SelectItem>
                            <SelectItem value="date_of_birth">Geburtsdatum</SelectItem>
                            <SelectItem value="address_street">Straße</SelectItem>
                            <SelectItem value="address_city">Stadt</SelectItem>
                            <SelectItem value="address_postal_code">PLZ</SelectItem>
                            <SelectItem value="emergency_contact_name">Notfallkontakt Name</SelectItem>
                            <SelectItem value="emergency_contact_phone">Notfallkontakt Telefon</SelectItem>
                            <SelectItem value="notes">Notizen</SelectItem>
                            <SelectItem value="gdpr_consent_given">GDPR-Einverständnis</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={mapping.required}
                          onCheckedChange={(checked) => updateFieldMapping(index, { required: !!checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping.transform || 'none'}
                          onValueChange={(value) => updateFieldMapping(index, { transform: value === 'none' ? undefined : value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Keine</SelectItem>
                            <SelectItem value="date">Datum</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="phone">Telefon</SelectItem>
                            <SelectItem value="email">E-Mail</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Zurück
              </Button>
              <Button onClick={handleValidate} disabled={loading}>
                {loading ? 'Validiere...' : 'Validierung starten'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'validation' && validationResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Validierungs-Ergebnis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{validationResult.summary.total_rows}</div>
                  <div className="text-sm text-muted-foreground">Gesamt</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{validationResult.summary.valid_rows}</div>
                  <div className="text-sm text-muted-foreground">Gültig</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{validationResult.summary.invalid_rows}</div>
                  <div className="text-sm text-muted-foreground">Ungültig</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{validationResult.summary.duplicate_rows}</div>
                  <div className="text-sm text-muted-foreground">Duplikate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{validationResult.summary.warning_rows}</div>
                  <div className="text-sm text-muted-foreground">Warnungen</div>
                </div>
              </div>

              {!validationResult.ready_for_import && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Der Import kann nicht ausgeführt werden, da es ungültige Zeilen gibt. 
                    Bitte korrigieren Sie die Daten und versuchen Sie es erneut.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  Zuordnung ändern
                </Button>
                <Button 
                  onClick={handleExecute} 
                  disabled={!validationResult.ready_for_import || loading}
                >
                  {loading ? 'Importiere...' : 'Import ausführen'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Show validation details */}
          <Card>
            <CardHeader>
              <CardTitle>Validierungs-Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeile</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Daten</TableHead>
                      <TableHead>Fehler/Warnungen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResult.rows.slice(0, 50).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.status === 'valid' && <Badge className="bg-green-600">Gültig</Badge>}
                          {row.status === 'invalid' && <Badge className="bg-red-600">Ungültig</Badge>}
                          {row.status === 'duplicate' && <Badge className="bg-yellow-600">Duplikat</Badge>}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {JSON.stringify(row.data)}
                        </TableCell>
                        <TableCell>
                          {row.errors.map((error, i) => (
                            <div key={i} className="text-red-600 text-xs">{error}</div>
                          ))}
                          {row.warnings.map((warning, i) => (
                            <div key={i} className="text-yellow-600 text-xs">{warning}</div>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function ImportLogsTab() {
  const { logs, pagination, loading, fetchImportLogs, refetch } = useImportLogs()

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600">Ausstehend</Badge>
      case 'processing':
        return <Badge variant="outline" className="text-blue-600">Verarbeitung</Badge>
      case 'completed':
        return <Badge variant="outline" className="text-green-600">Abgeschlossen</Badge>
      case 'failed':
        return <Badge variant="outline" className="text-red-600">Fehlgeschlagen</Badge>
      case 'cancelled':
        return <Badge variant="outline" className="text-gray-600">Abgebrochen</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Import-Verlauf
        </CardTitle>
        <CardDescription>
          Übersicht aller Import-Vorgänge
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Laden...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Keine Import-Logs gefunden
          </div>
        ) : (
          <div className="space-y-4">
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datei</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Zeilen</TableHead>
                    <TableHead>Erfolgreich</TableHead>
                    <TableHead>Fehlgeschlagen</TableHead>
                    <TableHead>Übersprungen</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Importiert von</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.filename}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>{log.total_rows}</TableCell>
                      <TableCell className="text-green-600">{log.successful_imports}</TableCell>
                      <TableCell className="text-red-600">{log.failed_imports}</TableCell>
                      <TableCell className="text-yellow-600">{log.skipped_rows}</TableCell>
                      <TableCell>{new Date(log.created_at).toLocaleString('de-DE')}</TableCell>
                      <TableCell>{log.imported_by_profile?.full_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <Button onClick={refetch} variant="outline">
              Aktualisieren
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Helper functions
function mapHeaderToField(header: string): string {
  const mapping: Record<string, string> = {
    'name': 'full_name',
    'full_name': 'full_name',
    'vollname': 'full_name',
    'email': 'email',
    'e-mail': 'email',
    'mail': 'email',
    'phone': 'phone',
    'telefon': 'phone',
    'birthday': 'date_of_birth',
    'geburtsdatum': 'date_of_birth',
    'street': 'address_street',
    'straße': 'address_street',
    'city': 'address_city',
    'stadt': 'address_city',
    'zip': 'address_postal_code',
    'plz': 'address_postal_code',
    'postal_code': 'address_postal_code',
    'notes': 'notes',
    'notizen': 'notes',
    'gdpr': 'gdpr_consent_given',
    'consent': 'gdpr_consent_given'
  }
  
  const normalized = header.toLowerCase().trim()
  return mapping[normalized] || 'notes'
}

function getTransformType(field: string): 'date' | 'boolean' | 'phone' | 'email' | undefined {
  switch (field) {
    case 'date_of_birth':
      return 'date'
    case 'gdpr_consent_given':
      return 'boolean'
    case 'phone':
    case 'emergency_contact_phone':
      return 'phone'
    case 'email':
      return 'email'
    default:
      return undefined
  }
}