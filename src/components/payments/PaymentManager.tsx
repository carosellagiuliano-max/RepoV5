import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CreditCard, 
  RefreshCw, 
  Download, 
  Search, 
  Filter,
  MoreHorizontal,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { 
  usePayments, 
  useRefundPayment, 
  useCapturePayment, 
  useVoidPayment,
  usePaymentSummary,
  formatPaymentAmount, 
  getPaymentStatusInfo,
  getPaymentMethodInfo
} from '@/hooks/use-payments'
import { PaymentStatus, PaymentMethodType } from '@/lib/types/database'
import { toast } from '@/hooks/use-toast'

interface PaymentManagerProps {
  className?: string
}

export function PaymentManager({ className }: PaymentManagerProps) {
  // Filters state
  const [filters, setFilters] = useState({
    status: '',
    customer_id: '',
    search: '',
    start_date: '',
    end_date: ''
  })
  
  // Pagination state
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0
  })

  // Dialog states
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; payment: any }>({
    open: false,
    payment: null
  })
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  // Fetch data
  const { data: paymentsData, isLoading, refetch } = usePayments({
    ...filters,
    ...pagination
  })
  
  const { data: summary } = usePaymentSummary({
    start_date: filters.start_date || undefined,
    end_date: filters.end_date || undefined
  })

  // Mutations
  const refundPayment = useRefundPayment()
  const capturePayment = useCapturePayment()
  const voidPayment = useVoidPayment()

  const handleRefund = async (payment: any) => {
    try {
      const amountCents = refundAmount ? 
        Math.round(parseFloat(refundAmount) * 100) : 
        undefined

      await refundPayment.mutateAsync({
        payment_id: payment.id,
        amount_cents: amountCents,
        reason: refundReason || 'Admin refund'
      })

      setRefundDialog({ open: false, payment: null })
      setRefundAmount('')
      setRefundReason('')
      
      toast({
        title: "Rückerstattung erfolgreich",
        description: `Zahlung wurde ${amountCents ? 'teilweise' : 'vollständig'} erstattet.`
      })
    } catch (error) {
      toast({
        title: "Rückerstattung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten.",
        variant: "destructive"
      })
    }
  }

  const handleCapture = async (payment: any) => {
    try {
      await capturePayment.mutateAsync({
        payment_id: payment.id
      })
      
      toast({
        title: "Zahlung erfasst",
        description: "Die Zahlung wurde erfolgreich erfasst."
      })
    } catch (error) {
      toast({
        title: "Erfassung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten.",
        variant: "destructive"
      })
    }
  }

  const handleVoid = async (payment: any) => {
    try {
      await voidPayment.mutateAsync({
        payment_id: payment.id,
        reason: 'Admin void'
      })
      
      toast({
        title: "Zahlung storniert",
        description: "Die Zahlung wurde erfolgreich storniert."
      })
    } catch (error) {
      toast({
        title: "Stornierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten.",
        variant: "destructive"
      })
    }
  }

  const getActionButtons = (payment: any) => {
    const buttons = []

    if (payment.status === 'requires_capture') {
      buttons.push(
        <Button
          key="capture"
          size="sm"
          onClick={() => handleCapture(payment)}
          disabled={capturePayment.isPending}
        >
          Erfassen
        </Button>
      )
    }

    if (payment.status === 'succeeded') {
      buttons.push(
        <Button
          key="refund"
          size="sm"
          variant="outline"
          onClick={() => setRefundDialog({ open: true, payment })}
          disabled={refundPayment.isPending}
        >
          Erstatten
        </Button>
      )
    }

    if (['pending', 'requires_capture', 'requires_action'].includes(payment.status)) {
      buttons.push(
        <Button
          key="void"
          size="sm"
          variant="destructive"
          onClick={() => handleVoid(payment)}
          disabled={voidPayment.isPending}
        >
          Stornieren
        </Button>
      )
    }

    return buttons
  }

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Zahlungsverwaltung</h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle Zahlungen und Transaktionen
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportieren
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamtumsatz</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPaymentAmount(summary.total_amount_cents)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.transaction_count} Transaktionen
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Erfolgreich</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.successful_payments}
              </div>
              <p className="text-xs text-muted-foreground">
                {((summary.successful_payments / summary.transaction_count) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fehlgeschlagen</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summary.failed_payments}
              </div>
              <p className="text-xs text-muted-foreground">
                {((summary.failed_payments / summary.transaction_count) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gebühren</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPaymentAmount(summary.total_fee_cents)}
              </div>
              <p className="text-xs text-muted-foreground">
                Stripe Gebühren
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <Label>Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Alle Status</SelectItem>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="succeeded">Erfolgreich</SelectItem>
                  <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                  <SelectItem value="requires_capture">Erfassung erforderlich</SelectItem>
                  <SelectItem value="canceled">Storniert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Suche</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Kunde, E-Mail..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <Label>Von Datum</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Bis Datum</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={() => setFilters({
                  status: '',
                  customer_id: '',
                  search: '',
                  start_date: '',
                  end_date: ''
                })}
                variant="outline"
              >
                Zurücksetzen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Zahlungen</CardTitle>
          <CardDescription>
            {paymentsData?.pagination.total} Zahlungen gefunden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Methode</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsData?.payments?.map((payment: any) => {
                const statusInfo = getPaymentStatusInfo(payment.status)
                const methodInfo = getPaymentMethodInfo(payment.payment_method_type)
                
                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {format(new Date(payment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {payment.appointment?.customer?.first_name} {payment.appointment?.customer?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.appointment?.customer?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {formatPaymentAmount(payment.amount_cents, payment.currency)}
                        </div>
                        {payment.fee_cents > 0 && (
                          <div className="text-sm text-muted-foreground">
                            -{formatPaymentAmount(payment.fee_cents, payment.currency)} Gebühr
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={statusInfo.color === 'green' ? 'default' : 'secondary'}
                        className="flex items-center gap-1 w-fit"
                      >
                        <span>{statusInfo.icon}</span>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{methodInfo.icon}</span>
                        {methodInfo.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {getActionButtons(payment)}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialog.open} onOpenChange={(open) => {
        if (!open) {
          setRefundDialog({ open: false, payment: null })
          setRefundAmount('')
          setRefundReason('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zahlung erstatten</DialogTitle>
            <DialogDescription>
              Erstatten Sie die Zahlung ganz oder teilweise.
            </DialogDescription>
          </DialogHeader>
          
          {refundDialog.payment && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Originalbetrag: {formatPaymentAmount(refundDialog.payment.amount_cents, refundDialog.payment.currency)}
                </AlertDescription>
              </Alert>
              
              <div>
                <Label htmlFor="refund-amount">Erstattungsbetrag (leer = vollständig)</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={`Max: ${(refundDialog.payment.amount_cents / 100).toFixed(2)}`}
                />
              </div>
              
              <div>
                <Label htmlFor="refund-reason">Grund für Erstattung</Label>
                <Input
                  id="refund-reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Grund eingeben..."
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRefundDialog({ open: false, payment: null })}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={() => handleRefund(refundDialog.payment)}
              disabled={refundPayment.isPending}
            >
              {refundPayment.isPending ? 'Wird erstattet...' : 'Erstatten'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PaymentManager