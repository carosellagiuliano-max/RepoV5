-- Stripe Payments Integration - Database Schema
-- This migration adds comprehensive payment management with Stripe integration

-- Payment status enum
CREATE TYPE payment_status AS ENUM (
  'pending',           -- Payment intent created but not confirmed
  'processing',        -- Payment is being processed by Stripe
  'requires_action',   -- SCA/3DS required
  'succeeded',         -- Payment completed successfully
  'requires_capture',  -- Payment authorized, waiting for manual capture
  'canceled',          -- Payment canceled before completion
  'failed'             -- Payment failed
);

-- Payment method types
CREATE TYPE payment_method_type AS ENUM (
  'card',              -- Credit/debit card
  'paypal',            -- PayPal
  'apple_pay',         -- Apple Pay
  'google_pay',        -- Google Pay
  'sepa_debit',        -- SEPA Direct Debit
  'bancontact',        -- Bancontact
  'ideal',             -- iDEAL
  'cash'               -- Payment at location
);

-- Payment event types for audit trail
CREATE TYPE payment_event_type AS ENUM (
  'payment_intent_created',
  'payment_method_attached',
  'payment_confirmed',
  'payment_succeeded',
  'payment_failed',
  'payment_canceled',
  'payment_captured',
  'payment_refunded',
  'payment_disputed',
  'webhook_received',
  'manual_action'
);

-- Main payments table
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL NOT NULL,
  
  -- Stripe identifiers
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  
  -- Payment details
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'CHF',
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method_type payment_method_type NOT NULL DEFAULT 'card',
  
  -- Card information (PCI-compliant - no sensitive data)
  card_last4 TEXT,
  card_brand TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  card_funding TEXT, -- credit, debit, prepaid, unknown
  
  -- Payment flow tracking
  requires_action BOOLEAN DEFAULT false,
  client_secret TEXT, -- For frontend confirmation
  next_action JSONB, -- Stripe next_action object
  
  -- Financial details
  fee_cents INTEGER DEFAULT 0, -- Stripe fees
  net_amount_cents INTEGER, -- Amount after fees
  application_fee_cents INTEGER DEFAULT 0, -- Our application fee
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',
  receipt_email TEXT,
  receipt_url TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure net amount is calculated correctly
  CONSTRAINT valid_net_amount CHECK (
    net_amount_cents = amount_cents - fee_cents - application_fee_cents
  )
);

-- Payment events table for comprehensive audit trail
CREATE TABLE payment_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
  
  -- Event details
  event_type payment_event_type NOT NULL,
  stripe_event_id TEXT, -- Stripe webhook event ID
  
  -- Event data
  event_data JSONB NOT NULL DEFAULT '{}',
  amount_cents INTEGER,
  status payment_status,
  
  -- Processing details
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  
  -- Idempotency
  idempotency_key TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure idempotency for webhook events
  UNIQUE(stripe_event_id, payment_id)
);

-- Payment reconciliation table for daily reconciliation with Stripe
CREATE TABLE payment_reconciliation (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reconciliation_date DATE NOT NULL,
  
  -- Stripe data
  stripe_balance_transaction_id TEXT UNIQUE,
  stripe_payout_id TEXT,
  
  -- Financial summary
  gross_amount_cents INTEGER NOT NULL,
  fee_amount_cents INTEGER NOT NULL,
  net_amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CHF',
  
  -- Reconciliation status
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciliation_notes TEXT,
  
  -- Related payments
  payment_ids UUID[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(reconciliation_date, stripe_balance_transaction_id)
);

-- Admin audit table for payment management actions
CREATE TABLE admin_audit (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- Action details
  action_type TEXT NOT NULL, -- capture, refund, void, cancel, etc.
  resource_type TEXT NOT NULL, -- payment, appointment, customer
  resource_id UUID NOT NULL,
  
  -- Admin details
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  admin_email TEXT NOT NULL,
  
  -- Action details
  action_data JSONB NOT NULL DEFAULT '{}',
  reason TEXT,
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Audit trail
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for efficient queries
  INDEX idx_admin_audit_resource (resource_type, resource_id),
  INDEX idx_admin_audit_admin (admin_id),
  INDEX idx_admin_audit_created (created_at DESC)
);

-- Idempotency table for payment operations
CREATE TABLE payment_idempotency (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  
  -- Request details
  request_hash TEXT NOT NULL, -- SHA-256 of request body
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  
  -- Response
  response_status INTEGER,
  response_body JSONB,
  
  -- Expiry (24 hours default)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_payment_idempotency_key (idempotency_key),
  INDEX idx_payment_idempotency_expires (expires_at)
);

-- Indexes for optimal performance
CREATE INDEX idx_payments_appointment ON payments(appointment_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created ON payments(created_at DESC);

CREATE INDEX idx_payment_events_payment ON payment_events(payment_id);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_created ON payment_events(created_at DESC);
CREATE INDEX idx_payment_events_stripe_event ON payment_events(stripe_event_id);

CREATE INDEX idx_reconciliation_date ON payment_reconciliation(reconciliation_date DESC);
CREATE INDEX idx_reconciliation_status ON payment_reconciliation(reconciled);

-- Functions for payment management

-- Function to create payment intent
CREATE OR REPLACE FUNCTION create_payment_intent(
  p_appointment_id UUID,
  p_amount_cents INTEGER,
  p_currency TEXT DEFAULT 'CHF',
  p_payment_method_type payment_method_type DEFAULT 'card',
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_customer_id UUID;
BEGIN
  -- Get customer ID from appointment
  SELECT customer_id INTO v_customer_id
  FROM appointments
  WHERE id = p_appointment_id;
  
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found or has no customer';
  END IF;
  
  -- Create payment record
  INSERT INTO payments (
    appointment_id,
    customer_id,
    amount_cents,
    currency,
    payment_method_type,
    description,
    metadata,
    status
  ) VALUES (
    p_appointment_id,
    v_customer_id,
    p_amount_cents,
    p_currency,
    p_payment_method_type,
    p_description,
    p_metadata,
    'pending'
  ) RETURNING id INTO v_payment_id;
  
  -- Log event
  INSERT INTO payment_events (
    payment_id,
    event_type,
    event_data,
    amount_cents,
    status
  ) VALUES (
    v_payment_id,
    'payment_intent_created',
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'amount_cents', p_amount_cents,
      'currency', p_currency
    ),
    p_amount_cents,
    'pending'
  );
  
  RETURN v_payment_id;
END;
$$;

-- Function to process webhook events with idempotency
CREATE OR REPLACE FUNCTION process_payment_webhook(
  p_stripe_event_id TEXT,
  p_payment_intent_id TEXT,
  p_event_type payment_event_type,
  p_event_data JSONB,
  p_new_status payment_status DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_current_status payment_status;
  v_processed BOOLEAN := false;
BEGIN
  -- Find payment by Stripe payment intent ID
  SELECT id, status INTO v_payment_id, v_current_status
  FROM payments
  WHERE stripe_payment_intent_id = p_payment_intent_id;
  
  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment not found for payment intent: %', p_payment_intent_id;
  END IF;
  
  -- Check if event already processed (idempotency)
  SELECT processed INTO v_processed
  FROM payment_events
  WHERE stripe_event_id = p_stripe_event_id
    AND payment_id = v_payment_id;
  
  IF v_processed THEN
    RETURN true; -- Already processed
  END IF;
  
  -- Update payment status if provided and different
  IF p_new_status IS NOT NULL AND p_new_status != v_current_status THEN
    UPDATE payments
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = v_payment_id;
  END IF;
  
  -- Insert or update event record
  INSERT INTO payment_events (
    payment_id,
    event_type,
    stripe_event_id,
    event_data,
    status,
    processed,
    processed_at
  ) VALUES (
    v_payment_id,
    p_event_type,
    p_stripe_event_id,
    p_event_data,
    COALESCE(p_new_status, v_current_status),
    true,
    NOW()
  )
  ON CONFLICT (stripe_event_id, payment_id)
  DO UPDATE SET
    processed = true,
    processed_at = NOW(),
    event_data = p_event_data,
    status = COALESCE(p_new_status, payment_events.status);
  
  RETURN true;
END;
$$;

-- Function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM payment_idempotency
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- Add payment status to appointments table
ALTER TABLE appointments 
ADD COLUMN payment_status TEXT DEFAULT 'unpaid' 
CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded', 'failed'));

-- Add payment method preference to customers
ALTER TABLE customers 
ADD COLUMN preferred_payment_method payment_method_type DEFAULT 'card',
ADD COLUMN stripe_customer_id TEXT UNIQUE;

-- Update appointments when payment status changes
CREATE OR REPLACE FUNCTION sync_appointment_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update appointment payment status based on payment status
  UPDATE appointments
  SET payment_status = CASE
    WHEN NEW.status = 'succeeded' THEN 'paid'
    WHEN NEW.status IN ('failed', 'canceled') THEN 'failed'
    WHEN NEW.status IN ('pending', 'processing', 'requires_action', 'requires_capture') THEN 'pending'
    ELSE 'unpaid'
  END
  WHERE id = NEW.appointment_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to sync appointment payment status
CREATE TRIGGER sync_appointment_payment_status_trigger
  AFTER INSERT OR UPDATE OF status ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_appointment_payment_status();

-- RLS Policies will be added in a separate migration file
-- Grant permissions to service role for Netlify Functions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;