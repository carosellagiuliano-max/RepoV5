import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Users, AlertTriangle, CheckCircle, XCircle, GitMerge, Eye, Trash2 } from 'lucide-react'
import { useDuplicateDetection, useDuplicateList, useDuplicateActions, CustomerDuplicate } from '@/hooks/use-duplicates'
import { MergeCustomersDialog } from './MergeCustomersDialog'

export function DuplicateDetection() {
  const [searchCustomerId, setSearchCustomerId] = useState('')
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7)
  const [selectedDuplicate, setSelectedDuplicate] = useState<CustomerDuplicate | null>(null)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [listFilters, setListFilters] = useState({
    status: 'pending',
    page: 1,
    limit: 20
  })

  const { duplicates: detectedDuplicates, loading: detecting, detectDuplicates } = useDuplicateDetection()
  const { duplicates: allDuplicates, pagination, loading: listLoading, refetch } = useDuplicateList(listFilters)
  const { markAsReviewed, dismissDuplicate } = useDuplicateActions()

  const handleDetectDuplicates = () => {
    detectDuplicates({
      customerId: searchCustomerId || undefined,
      confidenceThreshold,
      limit: 100
    })
  }

  const handleMarkReviewed = async (duplicateId: string) => {
    const success = await markAsReviewed(duplicateId)
    if (success) {
      refetch()
    }
  }

  const handleDismiss = async (duplicateId: string, reason: string) => {
    const success = await dismissDuplicate(duplicateId, reason)
    if (success) {
      refetch()
    }
  }

  const handleMergeClick = (duplicate: CustomerDuplicate) => {
    setSelectedDuplicate(duplicate)
    setShowMergeDialog(true)
  }

  const handleMergeComplete = () => {
    setShowMergeDialog(false)
    setSelectedDuplicate(null)
    refetch()
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'bg-red-500'
    if (score >= 0.8) return 'bg-orange-500'
    if (score >= 0.7) return 'bg-yellow-500'
    return 'bg-gray-500'
  }

  const getMatchTypeLabel = (type: string) => {
    switch (type) {
      case 'email': return 'E-Mail'
      case 'phone': return 'Telefon'
      case 'name_fuzzy': return 'Name (Ähnlich)'
      case 'manual': return 'Manuell'
      default: return type
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><AlertTriangle className="w-3 h-3 mr-1" />Ausstehend</Badge>
      case 'reviewed':
        return <Badge variant="outline" className="text-blue-600"><Eye className="w-3 h-3 mr-1" />Überprüft</Badge>
      case 'merged':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Zusammengeführt</Badge>
      case 'dismissed':
        return <Badge variant="outline" className="text-gray-600"><XCircle className="w-3 h-3 mr-1" />Abgewiesen</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dubletten-Erkennung</h2>
        <p className="text-muted-foreground">
          Finden Sie potenzielle Duplikate und führen Sie Kundenkonten zusammen
        </p>
      </div>

      <Tabs defaultValue="detect" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="detect">Neue Erkennung</TabsTrigger>
          <TabsTrigger value="manage">Verwaltung</TabsTrigger>
        </TabsList>

        <TabsContent value="detect" className="space-y-6">
          {/* Detection Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Dubletten-Erkennung starten
              </CardTitle>
              <CardDescription>
                Suchen Sie nach potenziellen Duplikaten basierend auf E-Mail, Telefon und Namen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerId">Kunden-ID (optional)</Label>
                  <Input
                    id="customerId"
                    placeholder="Spezifischen Kunden prüfen"
                    value={searchCustomerId}
                    onChange={(e) => setSearchCustomerId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="threshold">Mindest-Ähnlichkeit: {Math.round(confidenceThreshold * 100)}%</Label>
                  <Input
                    id="threshold"
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleDetectDuplicates}
                    disabled={detecting}
                    className="w-full"
                  >
                    {detecting ? 'Suche läuft...' : 'Dubletten suchen'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detection Results */}
          {detectedDuplicates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Erkannte Dubletten ({detectedDuplicates.length})</CardTitle>
                <CardDescription>
                  Neu gefundene potenzielle Duplikate zur Überprüfung
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {detectedDuplicates.map((duplicate, index) => (
                      <DuplicateCard
                        key={index}
                        duplicate={duplicate}
                        onMerge={handleMergeClick}
                        onMarkReviewed={handleMarkReviewed}
                        onDismiss={handleDismiss}
                        getConfidenceColor={getConfidenceColor}
                        getMatchTypeLabel={getMatchTypeLabel}
                        getStatusBadge={getStatusBadge}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={listFilters.status}
                    onValueChange={(value) => setListFilters(prev => ({ ...prev, status: value, page: 1 }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Ausstehend</SelectItem>
                      <SelectItem value="reviewed">Überprüft</SelectItem>
                      <SelectItem value="merged">Zusammengeführt</SelectItem>
                      <SelectItem value="dismissed">Abgewiesen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Duplicates List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Alle Dubletten ({pagination?.total || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listLoading ? (
                <div className="text-center py-8">Laden...</div>
              ) : allDuplicates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Dubletten gefunden
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {allDuplicates.map((duplicate) => (
                      <DuplicateCard
                        key={`${duplicate.customer_a_id}-${duplicate.customer_b_id}`}
                        duplicate={duplicate}
                        onMerge={handleMergeClick}
                        onMarkReviewed={handleMarkReviewed}
                        onDismiss={handleDismiss}
                        getConfidenceColor={getConfidenceColor}
                        getMatchTypeLabel={getMatchTypeLabel}
                        getStatusBadge={getStatusBadge}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setListFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={listFilters.page === 1}
                  >
                    Zurück
                  </Button>
                  <span className="flex items-center px-4">
                    Seite {listFilters.page} von {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setListFilters(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                    disabled={listFilters.page === pagination.totalPages}
                  >
                    Weiter
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Merge Dialog */}
      {selectedDuplicate && (
        <MergeCustomersDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          primaryCustomer={selectedDuplicate.customer_a!}
          mergeCustomer={selectedDuplicate.customer_b!}
          onMergeComplete={handleMergeComplete}
        />
      )}
    </div>
  )
}

interface DuplicateCardProps {
  duplicate: CustomerDuplicate
  onMerge: (duplicate: CustomerDuplicate) => void
  onMarkReviewed: (id: string) => void
  onDismiss: (id: string, reason: string) => void
  getConfidenceColor: (score: number) => string
  getMatchTypeLabel: (type: string) => string
  getStatusBadge: (status: string) => React.ReactNode
}

function DuplicateCard({ 
  duplicate, 
  onMerge, 
  onMarkReviewed, 
  onDismiss,
  getConfidenceColor,
  getMatchTypeLabel,
  getStatusBadge
}: DuplicateCardProps) {
  const [dismissReason, setDismissReason] = useState('')

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className={getConfidenceColor(duplicate.confidence_score)}>
              {Math.round(duplicate.confidence_score * 100)}% Ähnlichkeit
            </Badge>
            <Badge variant="outline">
              {getMatchTypeLabel(duplicate.match_type)}
            </Badge>
            {getStatusBadge(duplicate.status)}
          </div>
          <div className="text-sm text-muted-foreground">
            Erstellt: {new Date(duplicate.created_at).toLocaleString('de-DE')}
          </div>
        </div>

        {duplicate.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onMerge(duplicate)}
              className="gap-1"
            >
              <GitMerge className="w-3 h-3" />
              Zusammenführen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onMarkReviewed(`${duplicate.customer_a_id}-${duplicate.customer_b_id}`)}
            >
              Als geprüft markieren
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Dublette abweisen</AlertDialogTitle>
                  <AlertDialogDescription>
                    <div className="space-y-2">
                      <p>Möchten Sie diese Dublette als false positive markieren?</p>
                      <Input
                        placeholder="Grund (optional)"
                        value={dismissReason}
                        onChange={(e) => setDismissReason(e.target.value)}
                      />
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      onDismiss(`${duplicate.customer_a_id}-${duplicate.customer_b_id}`, dismissReason)
                      setDismissReason('')
                    }}
                  >
                    Abweisen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer A */}
        <div className="space-y-2">
          <h4 className="font-medium">Kunde A</h4>
          <div className="text-sm">
            <div><strong>Nr:</strong> {duplicate.customer_a?.customer_number}</div>
            <div><strong>Name:</strong> {duplicate.customer_a?.profiles?.full_name}</div>
            <div><strong>E-Mail:</strong> {duplicate.customer_a?.profiles?.email}</div>
            {duplicate.customer_a?.profiles?.phone && (
              <div><strong>Telefon:</strong> {duplicate.customer_a.profiles.phone}</div>
            )}
          </div>
        </div>

        {/* Customer B */}
        <div className="space-y-2">
          <h4 className="font-medium">Kunde B</h4>
          <div className="text-sm">
            <div><strong>Nr:</strong> {duplicate.customer_b?.customer_number}</div>
            <div><strong>Name:</strong> {duplicate.customer_b?.profiles?.full_name}</div>
            <div><strong>E-Mail:</strong> {duplicate.customer_b?.profiles?.email}</div>
            {duplicate.customer_b?.profiles?.phone && (
              <div><strong>Telefon:</strong> {duplicate.customer_b.profiles.phone}</div>
            )}
          </div>
        </div>
      </div>

      {/* Match Details */}
      {duplicate.match_details && (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          <strong>Details:</strong> {JSON.stringify(duplicate.match_details, null, 2)}
        </div>
      )}
    </div>
  )
}