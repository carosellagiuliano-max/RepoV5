import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { 
  Payment, 
  PaymentIntentCreateRequest, 
  PaymentStatus, 
  PaymentMethodType,
  PaymentSummary 
} from '@/lib/types/database'

/**
 * Hook to create a payment intent
 */
export const useCreatePaymentIntent = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: PaymentIntentCreateRequest & { idempotencyKey: string }) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/admin/payments/create?action=create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
          'X-Idempotency-Key': data.idempotencyKey
        },
        body: JSON.stringify({
          appointment_id: data.appointment_id,
          amount_cents: data.amount_cents,
          currency: data.currency,
          payment_method_type: data.payment_method_type,
          description: data.description,
          metadata: data.metadata,
          capture_method: data.capture_method
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create payment intent')
      }

      const result = await response.json()
      return result
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ 
        queryKey: ['payment', data.payment.appointment_id] 
      })
    }
  })
}

/**
 * Hook to confirm a payment intent
 */
export const useConfirmPaymentIntent = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      payment_intent_id: string
      payment_method_id?: string
      return_url?: string
    }) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/admin/payments/create?action=confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to confirm payment intent')
      }

      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    }
  })
}

/**
 * Hook to retrieve payment intent status
 */
export const usePaymentIntent = (paymentIntentId: string | null) => {
  return useQuery({
    queryKey: ['payment-intent', paymentIntentId],
    queryFn: async () => {
      if (!paymentIntentId) return null

      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `/.netlify/functions/admin/payments/create?action=retrieve&payment_intent_id=${paymentIntentId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to retrieve payment intent')
      }

      const result = await response.json()
      return result
    },
    enabled: !!paymentIntentId,
    refetchInterval: (data) => {
      // Poll if payment is still processing
      const status = data?.payment?.status
      return ['pending', 'processing', 'requires_action'].includes(status) ? 2000 : false
    }
  })
}

/**
 * Hook to cancel a payment intent
 */
export const useCancelPaymentIntent = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { 
      payment_intent_id: string
      reason?: string 
    }) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/admin/payments/create?action=cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel payment intent')
      }

      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-intent'] })
    }
  })
}

/**
 * Hook to get payment for an appointment
 */
export const useAppointmentPayment = (appointmentId: string | null) => {
  return useQuery({
    queryKey: ['payment', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null

      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    },
    enabled: !!appointmentId
  })
}

/**
 * Hook to list payments (admin/staff only)
 */
export const usePayments = (params: {
  limit?: number
  offset?: number
  status?: PaymentStatus
  customer_id?: string
  appointment_id?: string
  start_date?: string
  end_date?: string
  search?: string
} = {}) => {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const searchParams = new URLSearchParams({
        action: 'list',
        ...Object.fromEntries(
          Object.entries(params).filter(([_, value]) => value !== undefined)
        )
      })

      const response = await fetch(
        `/.netlify/functions/admin/payments/manage?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch payments')
      }

      const result = await response.json()
      return result
    }
  })
}

/**
 * Hook to refund a payment (admin/staff only)
 */
export const useRefundPayment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      payment_id: string
      amount_cents?: number
      reason?: string
      metadata?: Record<string, any>
    }) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/admin/payments/manage?action=refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to refund payment')
      }

      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] })
    }
  })
}

/**
 * Hook to capture a payment (admin/staff only)
 */
export const useCapturePayment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      payment_id: string
      amount_cents?: number
    }) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/admin/payments/manage?action=capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to capture payment')
      }

      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] })
    }
  })
}

/**
 * Hook to void a payment (admin/staff only)
 */
export const useVoidPayment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      payment_id: string
      reason?: string
    }) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/.netlify/functions/admin/payments/manage?action=void', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to void payment')
      }

      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    }
  })
}

/**
 * Hook to get payment summary (admin only)
 */
export const usePaymentSummary = (params: {
  start_date?: string
  end_date?: string
} = {}) => {
  return useQuery({
    queryKey: ['payment-summary', params],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const searchParams = new URLSearchParams({
        action: 'summary',
        ...Object.fromEntries(
          Object.entries(params).filter(([_, value]) => value !== undefined)
        )
      })

      const response = await fetch(
        `/.netlify/functions/admin/payments/manage?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch payment summary')
      }

      const result = await response.json()
      return result.summary as PaymentSummary
    }
  })
}

/**
 * Hook to trigger payment reconciliation (admin only)
 */
export const usePaymentReconciliation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      date?: string
      force?: boolean
    } = {}) => {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session?.access_token) {
        throw new Error('Not authenticated')
      }

      const searchParams = new URLSearchParams()
      if (data.date) searchParams.append('date', data.date)
      if (data.force) searchParams.append('force', 'true')

      const response = await fetch(
        `/.netlify/functions/admin/payments/reconcile?${searchParams}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`
          }
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to run reconciliation')
      }

      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    }
  })
}

/**
 * Utility function to generate idempotency key
 */
export const generateIdempotencyKey = (prefix: string = 'payment') => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2)
  return `${prefix}-${timestamp}-${random}`
}

/**
 * Utility function to format payment amount
 */
export const formatPaymentAmount = (amountCents: number, currency: string = 'CHF') => {
  const amount = amountCents / 100
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount)
}

/**
 * Utility function to get payment status display info
 */
export const getPaymentStatusInfo = (status: PaymentStatus) => {
  const statusMap = {
    pending: { label: 'Ausstehend', color: 'yellow', icon: '⏳' },
    processing: { label: 'Verarbeitung', color: 'blue', icon: '⚡' },
    requires_action: { label: 'Aktion erforderlich', color: 'orange', icon: '🔐' },
    succeeded: { label: 'Erfolgreich', color: 'green', icon: '✅' },
    requires_capture: { label: 'Erfassung erforderlich', color: 'purple', icon: '📝' },
    canceled: { label: 'Storniert', color: 'gray', icon: '❌' },
    failed: { label: 'Fehlgeschlagen', color: 'red', icon: '❌' }
  }

  return statusMap[status] || { label: status, color: 'gray', icon: '❓' }
}

/**
 * Utility function to get payment method display info
 */
export const getPaymentMethodInfo = (method: PaymentMethodType) => {
  const methodMap = {
    card: { label: 'Kreditkarte', icon: '💳' },
    paypal: { label: 'PayPal', icon: '🟦' },
    apple_pay: { label: 'Apple Pay', icon: '🍎' },
    google_pay: { label: 'Google Pay', icon: '🟢' },
    sepa_debit: { label: 'SEPA Lastschrift', icon: '🏦' },
    bancontact: { label: 'Bancontact', icon: '🟣' },
    ideal: { label: 'iDEAL', icon: '🟠' },
    cash: { label: 'Barzahlung', icon: '💰' }
  }

  return methodMap[method] || { label: method, icon: '💳' }
}