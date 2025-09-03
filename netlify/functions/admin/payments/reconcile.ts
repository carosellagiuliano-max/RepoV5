import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { addDays, format, subDays } from 'date-fns'

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReconciliationResult {
  date: string
  stripeTransactions: number
  internalPayments: number
  matched: number
  discrepancies: number
  totalStripeAmount: number
  totalInternalAmount: number
  totalFees: number
  success: boolean
  errors: string[]
}

/**
 * Payment Reconciliation Job
 * Daily job to reconcile Stripe Balance Transactions with internal payment records
 * Can be triggered manually or via scheduled function
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('Payment reconciliation job started:', {
    method: event.httpMethod,
    trigger: event.headers['x-netlify-cron'] ? 'scheduled' : 'manual'
  })

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  try {
    // Verify authentication for manual triggers
    if (!event.headers['x-netlify-cron']) {
      const isAuthenticated = await verifyAuthentication(event)
      if (!isAuthenticated) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized' })
        }
      }
    }

    // Get date to reconcile (default to yesterday)
    const reconciliationDate = event.queryStringParameters?.date || 
      format(subDays(new Date(), 1), 'yyyy-MM-dd')

    console.log(`Reconciling payments for date: ${reconciliationDate}`)

    // Check if reconciliation already completed for this date
    const existingReconciliation = await checkExistingReconciliation(reconciliationDate)
    if (existingReconciliation && !event.queryStringParameters?.force) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          message: 'Reconciliation already completed for this date',
          date: reconciliationDate,
          existing: existingReconciliation
        })
      }
    }

    // Perform reconciliation
    const result = await performReconciliation(reconciliationDate)

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Reconciliation completed',
        result
      })
    }

  } catch (error) {
    console.error('Reconciliation job error:', error)
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Reconciliation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}

/**
 * Verify authentication for manual triggers
 */
async function verifyAuthentication(event: HandlerEvent): Promise<boolean> {
  // Check for cron secret for scheduled jobs
  const cronSecret = event.headers['x-netlify-cron-secret']
  if (cronSecret === process.env.NETLIFY_CRON_SECRET) {
    return true
  }

  // Check for admin authentication for manual triggers
  const authHeader = event.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return false
  }

  try {
    const jwt = await import('jsonwebtoken')
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    
    // Get user profile and check admin role
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', decoded.sub)
      .single()

    return !error && profile?.role === 'admin'
  } catch (error) {
    console.error('Authentication error:', error)
    return false
  }
}

/**
 * Check if reconciliation already exists for date
 */
async function checkExistingReconciliation(date: string) {
  try {
    const { data, error } = await supabase
      .from('payment_reconciliation')
      .select('*')
      .eq('reconciliation_date', date)
      .eq('reconciled', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking existing reconciliation:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error checking existing reconciliation:', error)
    return null
  }
}

/**
 * Perform the actual reconciliation
 */
async function performReconciliation(date: string): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    date,
    stripeTransactions: 0,
    internalPayments: 0,
    matched: 0,
    discrepancies: 0,
    totalStripeAmount: 0,
    totalInternalAmount: 0,
    totalFees: 0,
    success: false,
    errors: []
  }

  try {
    // Get Stripe balance transactions for the date
    const stripeTransactions = await getStripeBalanceTransactions(date)
    result.stripeTransactions = stripeTransactions.length

    // Get internal payments for the date
    const internalPayments = await getInternalPayments(date)
    result.internalPayments = internalPayments.length

    console.log(`Found ${stripeTransactions.length} Stripe transactions and ${internalPayments.length} internal payments`)

    // Calculate totals
    result.totalStripeAmount = stripeTransactions.reduce((sum, tx) => sum + tx.amount, 0)
    result.totalFees = stripeTransactions.reduce((sum, tx) => sum + tx.fee, 0)
    result.totalInternalAmount = internalPayments.reduce((sum, payment) => sum + payment.amount_cents, 0)

    // Match transactions
    const { matched, discrepancies } = await matchTransactions(stripeTransactions, internalPayments)
    result.matched = matched.length
    result.discrepancies = discrepancies.length

    // Store reconciliation results
    await storeReconciliationResults(date, stripeTransactions, matched, discrepancies)

    // Log any discrepancies
    if (discrepancies.length > 0) {
      result.errors.push(`Found ${discrepancies.length} discrepancies`)
      console.warn('Reconciliation discrepancies found:', discrepancies)
      
      // Create admin alerts for discrepancies
      await createDiscrepancyAlerts(date, discrepancies)
    }

    result.success = true
    console.log('Reconciliation completed successfully:', result)

  } catch (error) {
    result.success = false
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    console.error('Reconciliation error:', error)
  }

  return result
}

/**
 * Get Stripe balance transactions for a specific date
 */
async function getStripeBalanceTransactions(date: string): Promise<Stripe.BalanceTransaction[]> {
  const startTimestamp = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000)
  const endTimestamp = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000)

  const transactions: Stripe.BalanceTransaction[] = []
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const params: Stripe.BalanceTransactionListParams = {
      limit: 100,
      created: {
        gte: startTimestamp,
        lte: endTimestamp
      },
      type: 'charge' // Only get charge transactions (successful payments)
    }

    if (startingAfter) {
      params.starting_after = startingAfter
    }

    const response = await stripe.balanceTransactions.list(params)
    transactions.push(...response.data)

    hasMore = response.has_more
    if (hasMore && response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id
    }
  }

  return transactions
}

/**
 * Get internal payments for a specific date
 */
async function getInternalPayments(date: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('status', 'succeeded')
    .gte('created_at', `${date}T00:00:00Z`)
    .lte('created_at', `${date}T23:59:59Z`)

  if (error) {
    console.error('Error fetching internal payments:', error)
    throw error
  }

  return data || []
}

/**
 * Match Stripe transactions with internal payments
 */
async function matchTransactions(
  stripeTransactions: Stripe.BalanceTransaction[],
  internalPayments: any[]
) {
  const matched: Array<{
    stripeTransaction: Stripe.BalanceTransaction
    internalPayment: any
  }> = []
  
  const discrepancies: Array<{
    type: 'stripe_only' | 'internal_only' | 'amount_mismatch'
    stripeTransaction?: Stripe.BalanceTransaction
    internalPayment?: any
    details: string
  }> = []

  // Create maps for efficient lookup
  const stripeByChargeId = new Map<string, Stripe.BalanceTransaction>()
  const internalByChargeId = new Map<string, any>()

  // Index Stripe transactions by charge ID
  for (const tx of stripeTransactions) {
    if (tx.source && typeof tx.source === 'string') {
      stripeByChargeId.set(tx.source, tx)
    }
  }

  // Index internal payments by Stripe charge ID
  for (const payment of internalPayments) {
    if (payment.stripe_charge_id) {
      internalByChargeId.set(payment.stripe_charge_id, payment)
    }
  }

  // Find matches
  for (const [chargeId, stripeTx] of stripeByChargeId) {
    const internalPayment = internalByChargeId.get(chargeId)
    
    if (internalPayment) {
      // Check if amounts match
      if (stripeTx.amount === internalPayment.amount_cents) {
        matched.push({
          stripeTransaction: stripeTx,
          internalPayment
        })
      } else {
        discrepancies.push({
          type: 'amount_mismatch',
          stripeTransaction: stripeTx,
          internalPayment,
          details: `Amount mismatch: Stripe ${stripeTx.amount}, Internal ${internalPayment.amount_cents}`
        })
      }
      
      // Remove from internal map to track unmatched
      internalByChargeId.delete(chargeId)
    } else {
      discrepancies.push({
        type: 'stripe_only',
        stripeTransaction: stripeTx,
        details: `Stripe transaction without matching internal payment: ${chargeId}`
      })
    }
  }

  // Remaining internal payments are unmatched
  for (const [chargeId, internalPayment] of internalByChargeId) {
    discrepancies.push({
      type: 'internal_only',
      internalPayment,
      details: `Internal payment without matching Stripe transaction: ${chargeId}`
    })
  }

  return { matched, discrepancies }
}

/**
 * Store reconciliation results in database
 */
async function storeReconciliationResults(
  date: string,
  stripeTransactions: Stripe.BalanceTransaction[],
  matched: any[],
  discrepancies: any[]
) {
  // Calculate summary totals
  const grossAmount = stripeTransactions.reduce((sum, tx) => sum + tx.amount, 0)
  const feeAmount = stripeTransactions.reduce((sum, tx) => sum + tx.fee, 0)
  const netAmount = grossAmount - feeAmount

  // Get payment IDs from matched transactions
  const paymentIds = matched.map(m => m.internalPayment.id)

  // Store or update reconciliation record
  const { error } = await supabase
    .from('payment_reconciliation')
    .upsert({
      reconciliation_date: date,
      gross_amount_cents: grossAmount,
      fee_amount_cents: feeAmount,
      net_amount_cents: netAmount,
      payment_ids: paymentIds,
      reconciled: discrepancies.length === 0,
      reconciled_at: new Date().toISOString(),
      reconciliation_notes: discrepancies.length > 0 ? 
        `${discrepancies.length} discrepancies found` : 
        'Reconciliation completed successfully'
    })

  if (error) {
    console.error('Error storing reconciliation results:', error)
    throw error
  }

  // Store individual balance transaction records for reference
  for (const tx of stripeTransactions) {
    await supabase
      .from('payment_reconciliation')
      .upsert({
        reconciliation_date: date,
        stripe_balance_transaction_id: tx.id,
        gross_amount_cents: tx.amount,
        fee_amount_cents: tx.fee,
        net_amount_cents: tx.net,
        currency: tx.currency.toUpperCase(),
        reconciled: true,
        reconciled_at: new Date().toISOString()
      })
  }
}

/**
 * Create admin alerts for reconciliation discrepancies
 */
async function createDiscrepancyAlerts(date: string, discrepancies: any[]) {
  for (const discrepancy of discrepancies) {
    await supabase
      .from('admin_audit')
      .insert({
        action_type: 'reconciliation_discrepancy',
        resource_type: 'payment_reconciliation',
        resource_id: date,
        admin_id: 'system',
        admin_email: 'system@schnittwerk.com',
        action_data: {
          discrepancy_type: discrepancy.type,
          details: discrepancy.details,
          stripe_transaction_id: discrepancy.stripeTransaction?.id,
          internal_payment_id: discrepancy.internalPayment?.id,
          requires_review: true
        },
        success: false,
        error_message: `Reconciliation discrepancy: ${discrepancy.details}`
      })
  }

  // Create summary alert if multiple discrepancies
  if (discrepancies.length > 1) {
    await supabase
      .from('admin_audit')
      .insert({
        action_type: 'reconciliation_summary',
        resource_type: 'payment_reconciliation',
        resource_id: date,
        admin_id: 'system',
        admin_email: 'system@schnittwerk.com',
        action_data: {
          total_discrepancies: discrepancies.length,
          date: date,
          requires_review: true
        },
        success: false,
        error_message: `${discrepancies.length} reconciliation discrepancies found for ${date}`
      })
  }
}