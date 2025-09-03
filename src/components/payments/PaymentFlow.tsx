import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreditCard, Smartphone, Wallet, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { 
  useCreatePaymentIntent, 
  useAppointmentPayment, 
  formatPaymentAmount, 
  getPaymentStatusInfo,
  generateIdempotencyKey 
} from '@/hooks/use-payments'
import { PaymentMethodType } from '@/lib/types/database'
import { toast } from '@/hooks/use-toast'

interface PaymentFlowProps {
  appointmentId: string
  amount: number // in cents
  currency?: string
  onPaymentSuccess?: (paymentId: string) => void
  onPaymentSkip?: () => void
  required?: boolean
}

const PAYMENT_METHODS: Array<{
  type: PaymentMethodType
  label: string
  icon: React.ComponentType<{ className?: string }>
  enabled: boolean
}> = [
  { type: 'card', label: 'Kreditkarte', icon: CreditCard, enabled: true },
  { type: 'apple_pay', label: 'Apple Pay', icon: Smartphone, enabled: false },
  { type: 'google_pay', label: 'Google Pay', icon: Smartphone, enabled: false },
  { type: 'cash', label: 'Vor Ort bezahlen', icon: Wallet, enabled: true }
]

export function PaymentFlow({ 
  appointmentId, 
  amount, 
  currency = 'CHF', 
  onPaymentSuccess, 
  onPaymentSkip,
  required = false 
}: PaymentFlowProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(null)
  const [processingPayment, setProcessingPayment] = useState(false)

  // Get existing payment for this appointment
  const { data: existingPayment, isLoading } = useAppointmentPayment(appointmentId)
  
  // Payment creation mutation
  const createPaymentIntent = useCreatePaymentIntent()

  // Show existing payment status if payment already exists
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Zahlung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If payment already exists, show status
  if (existingPayment) {
    const statusInfo = getPaymentStatusInfo(existingPayment.status)
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Zahlung
          </CardTitle>
          <CardDescription>
            Betrag: {formatPaymentAmount(existingPayment.amount_cents, existingPayment.currency)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <Badge 
              variant={statusInfo.color === 'green' ? 'default' : 'secondary'}
              className="flex items-center gap-1"
            >
              <span>{statusInfo.icon}</span>
              {statusInfo.label}
            </Badge>
          </div>
          
          {existingPayment.status === 'succeeded' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Zahlung wurde erfolgreich verarbeitet.
              </AlertDescription>
            </Alert>
          )}
          
          {existingPayment.status === 'failed' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Zahlung fehlgeschlagen. Bitte versuchen Sie es erneut oder bezahlen Sie vor Ort.
              </AlertDescription>
            </Alert>
          )}
          
          {existingPayment.status === 'requires_action' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ihre Bank benötigt eine zusätzliche Authentifizierung. Bitte folgen Sie den Anweisungen.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    )
  }

  const handlePaymentMethodSelect = async (method: PaymentMethodType) => {
    if (method === 'cash') {
      // Handle cash payment (no Stripe processing needed)
      onPaymentSkip?.()
      toast({
        title: "Barzahlung ausgewählt",
        description: "Sie können vor Ort im Salon bezahlen."
      })
      return
    }

    setSelectedPaymentMethod(method)
    setProcessingPayment(true)

    try {
      // Generate idempotency key for this payment attempt
      const idempotencyKey = generateIdempotencyKey('booking')
      
      // Create payment intent
      const result = await createPaymentIntent.mutateAsync({
        appointment_id: appointmentId,
        amount_cents: amount,
        currency,
        payment_method_type: method,
        description: `Terminbuchung - ${formatPaymentAmount(amount, currency)}`,
        capture_method: 'automatic',
        idempotencyKey
      })

      if (result.success) {
        // In a real implementation, you would redirect to Stripe Checkout
        // or use Stripe Elements to collect payment details
        toast({
          title: "Zahlung wird verarbeitet",
          description: "Sie werden zur sicheren Zahlungsseite weitergeleitet..."
        })
        
        // Simulate successful payment for demo
        setTimeout(() => {
          onPaymentSuccess?.(result.payment.id)
          toast({
            title: "Zahlung erfolgreich",
            description: "Ihre Zahlung wurde erfolgreich verarbeitet."
          })
        }, 2000)
      }
    } catch (error) {
      console.error('Payment error:', error)
      toast({
        title: "Zahlung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.",
        variant: "destructive"
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Zahlung {required && <span className="text-red-500">*</span>}
        </CardTitle>
        <CardDescription>
          Betrag: {formatPaymentAmount(amount, currency)}
          {!required && " (optional)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!required && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Sie können auch vor Ort im Salon bezahlen. Online-Zahlung ist optional.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <h4 className="font-medium">Zahlungsmethode wählen:</h4>
          <div className="grid gap-2">
            {PAYMENT_METHODS.filter(method => method.enabled).map((method) => {
              const Icon = method.icon
              return (
                <Button
                  key={method.type}
                  variant="outline"
                  className="justify-start h-auto p-4"
                  onClick={() => handlePaymentMethodSelect(method.type)}
                  disabled={processingPayment}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-medium">{method.label}</div>
                      {method.type === 'card' && (
                        <div className="text-sm text-muted-foreground">
                          Visa, Mastercard, American Express
                        </div>
                      )}
                      {method.type === 'cash' && (
                        <div className="text-sm text-muted-foreground">
                          Bezahlung direkt im Salon
                        </div>
                      )}
                    </div>
                  </div>
                  {processingPayment && selectedPaymentMethod === method.type && (
                    <Clock className="h-4 w-4 animate-spin ml-auto" />
                  )}
                </Button>
              )
            })}
          </div>
        </div>

        {!required && (
          <>
            <Separator />
            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={onPaymentSkip}
              disabled={processingPayment}
            >
              Später bezahlen (vor Ort)
            </Button>
          </>
        )}
        
        <div className="text-xs text-muted-foreground">
          <p>🔒 Ihre Zahlungsdaten werden sicher über Stripe verarbeitet.</p>
          <p>💳 Wir speichern keine Kreditkarteninformationen.</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default PaymentFlow