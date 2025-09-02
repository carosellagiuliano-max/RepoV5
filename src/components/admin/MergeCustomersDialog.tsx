import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GitMerge, AlertTriangle, CheckCircle, User, Phone, Mail, MapPin, FileText, Calendar } from 'lucide-react'
import { useCustomerMerge, MergeStrategy, MergePreview, DuplicateCustomer } from '@/hooks/use-duplicates'

interface MergeCustomersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  primaryCustomer: DuplicateCustomer
  mergeCustomer: DuplicateCustomer
  onMergeComplete: () => void
}

export function MergeCustomersDialog({
  open,
  onOpenChange,
  primaryCustomer,
  mergeCustomer,
  onMergeComplete
}: MergeCustomersDialogProps) {
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>({
    full_name: 'primary',
    phone: 'primary',
    date_of_birth: 'primary',
    address_street: 'primary',
    address_city: 'primary',
    address_postal_code: 'primary',
    emergency_contact_name: 'primary',
    emergency_contact_phone: 'primary',
    notes: 'combine'
  })
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [currentStep, setCurrentStep] = useState<'strategy' | 'preview' | 'confirm'>('strategy')

  const { loading, generateMergePreview, executeMerge } = useCustomerMerge()

  const handlePreview = async () => {
    const previewResult = await generateMergePreview(
      primaryCustomer.id,
      mergeCustomer.id,
      mergeStrategy
    )
    if (previewResult) {
      setPreview(previewResult)
      setCurrentStep('preview')
    }
  }

  const handleExecute = async () => {
    const success = await executeMerge(
      primaryCustomer.id,
      mergeCustomer.id,
      mergeStrategy,
      notes
    )
    if (success) {
      onMergeComplete()
      onOpenChange(false)
    }
  }

  const handleStrategyChange = (field: keyof MergeStrategy, value: any) => {
    setMergeStrategy(prev => ({ ...prev, [field]: value }))
  }

  const resetDialog = () => {
    setCurrentStep('strategy')
    setPreview(null)
    setNotes('')
  }

  useEffect(() => {
    if (!open) {
      resetDialog()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Kunden zusammenführen
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'strategy' && 'Wählen Sie, welche Daten vom zusammengeführten Kunden übernommen werden sollen'}
            {currentStep === 'preview' && 'Überprüfen Sie das Ergebnis der Zusammenführung'}
            {currentStep === 'confirm' && 'Bestätigen Sie die Zusammenführung'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {currentStep === 'strategy' && (
            <Tabs defaultValue="strategy" className="h-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="strategy">Merge-Strategie</TabsTrigger>
                <TabsTrigger value="customers">Kunden-Vergleich</TabsTrigger>
              </TabsList>

              <TabsContent value="strategy" className="space-y-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-6 pr-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Der <strong>primäre Kunde</strong> ({primaryCustomer.customer_number}) bleibt bestehen. 
                        Der <strong>zusammenzuführende Kunde</strong> ({mergeCustomer.customer_number}) wird gelöscht.
                        Alle Termine werden auf den primären Kunden übertragen.
                      </AlertDescription>
                    </Alert>

                    {/* Name */}
                    <MergeField
                      label="Name"
                      field="full_name"
                      primaryValue={primaryCustomer.profiles.full_name}
                      mergeValue={mergeCustomer.profiles.full_name}
                      strategy={mergeStrategy.full_name!}
                      onStrategyChange={(value) => handleStrategyChange('full_name', value)}
                      options={[
                        { value: 'primary', label: 'Primär verwenden' },
                        { value: 'merge', label: 'Zusammenführung verwenden' }
                      ]}
                    />

                    {/* Phone */}
                    <MergeField
                      label="Telefon"
                      field="phone"
                      primaryValue={primaryCustomer.profiles.phone || 'Nicht angegeben'}
                      mergeValue={mergeCustomer.profiles.phone || 'Nicht angegeben'}
                      strategy={mergeStrategy.phone!}
                      onStrategyChange={(value) => handleStrategyChange('phone', value)}
                      options={[
                        { value: 'primary', label: 'Primär verwenden' },
                        { value: 'merge', label: 'Zusammenführung verwenden' },
                        { value: 'combine', label: 'Ersten verfügbaren verwenden' }
                      ]}
                    />

                    {/* Date of Birth */}
                    <MergeField
                      label="Geburtsdatum"
                      field="date_of_birth"
                      primaryValue={primaryCustomer.profiles.full_name} // This would need actual date field
                      mergeValue={mergeCustomer.profiles.full_name} // This would need actual date field
                      strategy={mergeStrategy.date_of_birth!}
                      onStrategyChange={(value) => handleStrategyChange('date_of_birth', value)}
                      options={[
                        { value: 'primary', label: 'Primär verwenden' },
                        { value: 'merge', label: 'Zusammenführung verwenden' }
                      ]}
                    />

                    {/* Notes */}
                    <MergeField
                      label="Notizen"
                      field="notes"
                      primaryValue="Notizen vom primären Kunden"
                      mergeValue="Notizen vom zusammenzuführenden Kunden"
                      strategy={mergeStrategy.notes!}
                      onStrategyChange={(value) => handleStrategyChange('notes', value)}
                      options={[
                        { value: 'primary', label: 'Nur primäre Notizen' },
                        { value: 'merge', label: 'Nur zusammenführende Notizen' },
                        { value: 'combine', label: 'Beide Notizen kombinieren' }
                      ]}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="customers" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CustomerCard
                    title="Primärer Kunde (bleibt bestehen)"
                    customer={primaryCustomer}
                    isPrimary={true}
                  />
                  <CustomerCard
                    title="Zusammenzuführender Kunde (wird gelöscht)"
                    customer={mergeCustomer}
                    isPrimary={false}
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}

          {currentStep === 'preview' && preview && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Vorschau der Zusammenführung erstellt. 
                  {preview.transfer_summary.appointments_to_transfer} Termine werden übertragen.
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ergebnis der Zusammenführung</CardTitle>
                      <CardDescription>
                        So wird der resultierende Kunde aussehen
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div><strong>Name:</strong> {preview.merged_result.full_name}</div>
                      <div><strong>E-Mail:</strong> {preview.merged_result.email}</div>
                      <div><strong>Telefon:</strong> {preview.merged_result.phone || 'Nicht angegeben'}</div>
                      <div><strong>Adresse:</strong> {preview.merged_result.address_street || 'Nicht angegeben'}</div>
                      {preview.merged_result.notes && (
                        <div><strong>Notizen:</strong> {preview.merged_result.notes}</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Transfer-Zusammenfassung</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Zu übertragende Termine: <strong>{preview.transfer_summary.appointments_to_transfer}</strong></div>
                        <div>Gesamttermine nach Merge: <strong>{preview.transfer_summary.total_appointments_after_merge}</strong></div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label htmlFor="merge-notes">Notizen zur Zusammenführung (optional)</Label>
                    <Textarea
                      id="merge-notes"
                      placeholder="Grund oder zusätzliche Informationen zur Zusammenführung..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {currentStep === 'preview' && (
              <Button variant="outline" onClick={() => setCurrentStep('strategy')}>
                Zurück zur Strategie
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            
            {currentStep === 'strategy' && (
              <Button onClick={handlePreview} disabled={loading}>
                {loading ? 'Generiere Vorschau...' : 'Vorschau erstellen'}
              </Button>
            )}
            
            {currentStep === 'preview' && (
              <Button onClick={handleExecute} disabled={loading}>
                {loading ? 'Führe zusammen...' : 'Zusammenführung bestätigen'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface MergeFieldProps {
  label: string
  field: string
  primaryValue: string
  mergeValue: string
  strategy: string
  onStrategyChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

function MergeField({
  label,
  primaryValue,
  mergeValue,
  strategy,
  onStrategyChange,
  options
}: MergeFieldProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">PRIMÄR</Label>
            <div className="font-medium">{primaryValue}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">ZUSAMMENFÜHRUNG</Label>
            <div className="font-medium">{mergeValue}</div>
          </div>
        </div>
        
        <RadioGroup value={strategy} onValueChange={onStrategyChange}>
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={`${label}-${option.value}`} />
              <Label htmlFor={`${label}-${option.value}`} className="text-sm">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

interface CustomerCardProps {
  title: string
  customer: DuplicateCustomer
  isPrimary: boolean
}

function CustomerCard({ title, customer, isPrimary }: CustomerCardProps) {
  return (
    <Card className={isPrimary ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {isPrimary ? (
            <Badge className="bg-green-600">Primär</Badge>
          ) : (
            <Badge className="bg-red-600">Wird gelöscht</Badge>
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4" />
            <span><strong>Nr:</strong> {customer.customer_number}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4" />
            <span><strong>Name:</strong> {customer.profiles.full_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4" />
            <span><strong>E-Mail:</strong> {customer.profiles.email}</span>
          </div>
          {customer.profiles.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4" />
              <span><strong>Telefon:</strong> {customer.profiles.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" />
            <span><strong>Erstellt:</strong> {new Date(customer.created_at).toLocaleDateString('de-DE')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}