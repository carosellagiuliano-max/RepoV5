# Stripe Payment Integration Documentation

## Overview

This document describes the complete Stripe payment integration for the Schnittwerk hair salon booking system. The integration provides secure, PCI-compliant online payment processing with support for multiple payment methods, SCA/3DS compliance, and comprehensive admin management features.

## Architecture

### Payment Flow Architecture

```
Customer Booking Flow:
1. Customer selects service and time slot
2. Optional payment step with Stripe Checkout/Payment Element
3. Payment processing with SCA/3DS support
4. Webhook confirmation and database updates
5. Booking confirmation with payment receipt

Admin Management Flow:
1. Admin views all payments with filtering
2. Payment operations: refund, capture, void
3. Audit trail for all actions
4. Daily reconciliation with Stripe
```

### Database Schema

#### Core Tables

**payments**
- Primary payment records linked to appointments
- Stores Stripe identifiers and payment metadata
- PCI-compliant card information (last4, brand, expiry)
- Financial tracking (amount, fees, net amount)

**payment_events**
- Comprehensive audit trail of all payment events
- Webhook event processing with idempotency
- Manual actions by admin/staff

**payment_reconciliation**
- Daily reconciliation with Stripe Balance Transactions
- Ensures financial accuracy between Stripe and internal records

**admin_audit**
- Admin action audit trail
- IP tracking and session management
- Success/failure logging

**payment_idempotency**
- Request deduplication with 24-hour TTL
- SHA-256 request body hashing
- Automatic cleanup of expired keys

### API Endpoints

#### Payment Creation API
`POST /.netlify/functions/admin/payments/create`

**Actions:**
- `?action=create` - Create payment intent
- `?action=confirm` - Confirm payment with payment method
- `?action=retrieve` - Get payment status
- `?action=cancel` - Cancel payment intent

**Required Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Idempotency-Key: <unique_key>` (for create action)

#### Payment Management API
`GET/POST /.netlify/functions/admin/payments/manage`

**Actions:**
- `?action=list` - List payments with filtering
- `?action=refund` - Process refund (full or partial)
- `?action=capture` - Capture authorized payment
- `?action=void` - Void/cancel payment
- `?action=summary` - Get payment summary (admin only)

#### Stripe Webhook Handler
`POST /.netlify/functions/webhooks/stripe/webhook`

**Supported Events:**
- `payment_intent.created`
- `payment_intent.requires_action` (SCA/3DS)
- `payment_intent.processing`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.captured`
- `charge.dispute.created`

## Security & Compliance

### PCI Compliance
- **No sensitive card data storage** - Only last4, brand, expiry stored
- **Stripe handles all PAN data** - Never touches our servers
- **TLS encryption** for all communications
- **Webhook signature verification** prevents tampering

### SCA/3DS Support
- **Automatic 3DS triggering** for EU regulations
- **Dynamic authentication** based on risk assessment
- **Graceful handling** of authentication requirements
- **Return URL support** for redirect flows

### GDPR Compliance
- **Data minimization** - Only necessary payment data stored
- **Right to be forgotten** - Customer data deletion procedures
- **Data portability** - Export capabilities for customers
- **Consent tracking** - Payment method saving consent

### Webhook Security
- **Signature verification** using Stripe webhook secrets
- **Timestamp validation** prevents replay attacks
- **Idempotency protection** prevents duplicate processing
- **IP whitelisting** (optional) for additional security

## Payment State Machine

```
pending → processing → succeeded
   ↓           ↓
   ↓      requires_action → succeeded
   ↓           ↓
   ↓      canceled/failed
   ↓
canceled/failed

requires_capture → succeeded (manual capture)
        ↓
   canceled (void)
```

### State Transitions

- **pending** → **processing**: Payment method attached and processing starts
- **pending** → **requires_action**: SCA/3DS authentication required
- **requires_action** → **succeeded**: Authentication completed successfully
- **processing** → **succeeded**: Payment completed
- **requires_capture** → **succeeded**: Manual capture completed
- **any** → **canceled**: Payment canceled before completion
- **any** → **failed**: Payment failed due to error

## Configuration

### Environment Variables

```bash
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # Frontend publishable key
STRIPE_SECRET_KEY=sk_test_...           # Backend secret key
STRIPE_WEBHOOK_SECRET=whsec_...         # Webhook endpoint secret

# Payment Settings
VITE_PAYMENT_ENABLED=true              # Enable/disable payments
VITE_PAYMENT_CURRENCY=CHF               # Default currency
VITE_PAYMENT_METHODS=card,apple_pay     # Enabled payment methods
VITE_PAYMENT_CAPTURE_METHOD=automatic   # automatic or manual
VITE_MIN_PAYMENT_AMOUNT_CENTS=500       # Minimum amount (5.00 CHF)
VITE_MAX_PAYMENT_AMOUNT_CENTS=50000     # Maximum amount (500.00 CHF)

# Apple Pay (Production)
VITE_APPLE_PAY_DOMAIN=your-domain.com   # Registered Apple Pay domain
```

### Stripe Dashboard Configuration

1. **Webhooks**: Configure endpoint URL in Stripe Dashboard
   - URL: `https://your-domain.netlify.app/.netlify/functions/webhooks/stripe/webhook`
   - Events: Select all payment_intent.* and charge.* events

2. **Payment Methods**: Enable desired payment methods
   - Cards (Visa, Mastercard, American Express)
   - Apple Pay / Google Pay
   - Local payment methods (SEPA, iDEAL, etc.)

3. **Apple Pay**: Register your domain for Apple Pay
   - Download domain verification file
   - Upload to `/.well-known/apple-developer-merchantid-domain-association`

## Testing

### Test Cards (Stripe)

```
# Successful payments
4242424242424242 - Visa
4000056655665556 - Visa (debit)
5555555555554444 - Mastercard

# 3DS Authentication Required
4000002500003155 - Visa (requires authentication)
4000002760003184 - Visa (requires authentication, insufficient funds after auth)

# Failed payments
4000000000000002 - Card declined
4000000000000069 - Expired card
4000000000000119 - Processing error

# Zero-decimal currencies (JPY, KRW)
4242424242424242 - Use amounts like 1000 (¥1000, not ¥10.00)
```

### Test Scenarios

1. **Successful Payment Flow**
   - Create booking with payment
   - Complete payment with test card
   - Verify webhook processing
   - Check payment status in admin

2. **3DS Authentication**
   - Use 3DS test card
   - Complete authentication flow
   - Verify status updates

3. **Failed Payments**
   - Test various failure scenarios
   - Verify error handling
   - Check admin audit logs

4. **Admin Operations**
   - Test refund operations
   - Verify capture for manual capture
   - Test void/cancellation

## Error Handling

### Payment Errors

```typescript
// Common error types
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined.",
    "decline_code": "generic_decline"
  }
}
```

### Webhook Error Handling

- **Signature verification failure**: Return 401
- **Duplicate events**: Return 200 (idempotency)
- **Processing errors**: Return 500, log for investigation
- **Retry mechanism**: Stripe automatically retries failed webhooks

## Monitoring & Alerts

### Key Metrics

- **Payment success rate**: Monitor for unusual declines
- **Processing time**: Track payment completion times
- **3DS completion rate**: Monitor authentication success
- **Webhook processing**: Ensure timely processing

### Admin Dashboard Features

- **Real-time payment status**
- **Filter by status, customer, date range**
- **Payment summary with totals and fees**
- **Audit log of all admin actions**
- **Reconciliation status tracking**

## Reconciliation

### Daily Reconciliation Process

1. **Fetch Stripe Balance Transactions** for previous day
2. **Match with internal payment records**
3. **Identify discrepancies** and flag for review
4. **Generate reconciliation report**
5. **Store reconciliation status** in database

### Reconciliation API

```bash
# Manual reconciliation trigger
POST /.netlify/functions/admin/payments/reconcile
Authorization: Bearer <admin_token>

{
  "date": "2024-01-15"
}
```

## Best Practices

### Development

1. **Always use test keys** in development
2. **Test webhook endpoints** with Stripe CLI
3. **Validate all user inputs** with Zod schemas
4. **Implement proper error handling** for all API calls
5. **Use idempotency keys** for all payment operations

### Production

1. **Monitor webhook processing** for failures
2. **Set up alerts** for payment anomalies
3. **Regular reconciliation** with Stripe data
4. **Backup payment data** according to retention policies
5. **Keep audit logs** for compliance requirements

### Security

1. **Never log sensitive data** (full card numbers, CVV)
2. **Validate webhook signatures** on every request
3. **Use HTTPS everywhere** for payment communications
4. **Implement rate limiting** on payment endpoints
5. **Regular security audits** of payment flow

## Troubleshooting

### Common Issues

**Webhook not processing:**
- Check webhook signature secret
- Verify endpoint URL is accessible
- Check Stripe Dashboard for delivery attempts

**Payment stuck in pending:**
- Check for 3DS authentication requirements
- Verify customer completed payment flow
- Check Stripe Dashboard for payment status

**Reconciliation mismatches:**
- Check for timing differences (timezone issues)
- Verify all webhooks processed successfully
- Review manual admin actions in audit log

### Debug Mode

Enable debug logging in development:

```bash
# Enable Stripe debug mode
STRIPE_LOG_LEVEL=debug

# Enable detailed webhook logging
WEBHOOK_DEBUG=true
```

## Support & Maintenance

### Regular Tasks

- **Weekly**: Review failed payments and retries
- **Monthly**: Reconciliation audit and discrepancy review
- **Quarterly**: Security audit and key rotation
- **Annually**: Compliance review and documentation updates

### TypeScript Type Safety

The payment integration uses comprehensive TypeScript types for type safety:

#### Core Types
- `Payment`: Complete payment record with proper Stripe types
- `PaymentEvent`: Event tracking with structured data
- `AuthenticatedUser`: JWT-decoded user with role-based access
- `Stripe.PaymentIntent`, `Stripe.Event`, etc.: Official Stripe types

#### Benefits
- **Compile-time validation**: Catch type errors before runtime
- **IDE support**: Enhanced autocomplete and refactoring
- **API safety**: Proper request/response typing for all endpoints
- **Database consistency**: Typed database operations with Supabase

All `any` types have been replaced with proper TypeScript types for maximum type safety.

### Key Contacts

- **Stripe Support**: For payment processing issues
- **Developer Team**: For integration and technical issues
- **Finance Team**: For reconciliation and reporting
- **Compliance Team**: For regulatory and security matters