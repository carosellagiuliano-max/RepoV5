# Architecture Decision Record: Stripe Payment Integration

## Status
Accepted

## Context

The Schnittwerk hair salon booking system requires online payment functionality to:
- Allow customers to optionally pay for appointments online
- Reduce no-shows through payment commitment
- Streamline cash flow management
- Provide admin tools for payment management and reconciliation

## Decision

We will implement Stripe payment integration with the following architectural decisions:

### 1. Payment Intent vs Checkout Session

**Decision**: Use Payment Intents API instead of Checkout Sessions

**Rationale**:
- Greater control over payment flow and UX
- Better integration with existing booking flow
- Ability to handle complex scenarios (SCA/3DS, manual capture, etc.)
- More granular control over payment status updates

**Trade-offs**:
- More complex implementation vs. simple redirect to Checkout
- Need to handle PCI compliance considerations
- Requires custom payment form implementation

### 2. Database Schema Design

**Decision**: Comprehensive payment tracking with separate tables for events and reconciliation

**Tables**:
- `payments`: Core payment records with Stripe identifiers
- `payment_events`: Audit trail of all payment-related events
- `payment_reconciliation`: Daily reconciliation with Stripe Balance Transactions
- `admin_audit`: Admin action tracking
- `payment_idempotency`: Request deduplication

**Rationale**:
- Complete audit trail for compliance and debugging
- Separation of concerns between payment data and events
- Support for financial reconciliation processes
- Idempotency protection against duplicate requests

### 3. Webhook Processing Strategy

**Decision**: Comprehensive webhook handling with signature verification and idempotency

**Implementation**:
- Verify webhook signatures for security
- Process webhooks idempotently to handle retries
- Store all webhook events for audit purposes
- Update payment status based on webhook events

**Rationale**:
- Ensures data consistency between Stripe and internal systems
- Provides complete event history for troubleshooting
- Handles network issues and retry scenarios gracefully

### 4. Idempotency Strategy

**Decision**: Multi-level idempotency protection

**Levels**:
1. API request level with `X-Idempotency-Key` headers
2. Webhook event level with Stripe event IDs
3. Database operation level with unique constraints

**Rationale**:
- Prevents duplicate payments from network retries
- Handles webhook replay scenarios
- Ensures data consistency under concurrent load

### 5. Security and Compliance

**Decision**: PCI DSS Level 1 compliance through Stripe

**Implementation**:
- Never store sensitive card data (PAN, CVV)
- Only store PCI-compliant data (last4, brand, expiry)
- Use Stripe's secure tokenization
- Implement proper webhook signature verification

**Rationale**:
- Minimizes PCI compliance scope
- Leverages Stripe's security infrastructure
- Reduces liability and security risks

### 6. SCA/3DS Compliance

**Decision**: Full SCA compliance with graceful handling

**Implementation**:
- Automatic 3DS triggering based on EU regulations
- `requires_action` status handling in frontend
- Return URL support for redirect-based authentication
- Fallback to `payment_method.card.three_d_secure_usage = 'any'`

**Rationale**:
- Ensures compliance with EU PSD2 regulations
- Optimizes conversion rates through risk-based authentication
- Provides good UX even with authentication requirements

### 7. Error Handling Strategy

**Decision**: Graceful degradation with multiple payment options

**Implementation**:
- Online payment as optional enhancement
- Cash payment as always-available fallback
- Clear error messaging and recovery paths
- Admin tools for manual intervention

**Rationale**:
- Ensures booking flow never completely fails
- Provides flexibility for different customer preferences
- Allows manual resolution of payment issues

### 8. Admin Management Features

**Decision**: Comprehensive admin interface for payment operations

**Features**:
- Payment listing with filtering and search
- Refund processing (full and partial)
- Payment capture for manual capture mode
- Void/cancellation capabilities
- Audit trail of all admin actions

**Rationale**:
- Provides necessary tools for payment management
- Ensures proper audit trail for compliance
- Enables efficient customer service

### 9. Reconciliation Strategy

**Decision**: Automated daily reconciliation with manual override

**Implementation**:
- Daily scheduled job to reconcile with Stripe
- Match Balance Transactions with internal payments
- Flag discrepancies for manual review
- Store reconciliation results for reporting

**Rationale**:
- Ensures financial accuracy
- Provides early warning of discrepancies
- Supports accounting and financial reporting

### 10. Currency and Multi-Regional Support

**Decision**: CHF-primary with extensible currency support

**Implementation**:
- Default CHF currency for Swiss market
- Support for zero-decimal currencies (JPY, KRW)
- Configurable currency via environment variables
- Proper decimal handling in all calculations

**Rationale**:
- Optimized for primary Swiss market
- Prepared for future international expansion
- Handles currency edge cases correctly

## Consequences

### Positive
- Secure, PCI-compliant payment processing
- Comprehensive audit trail and reconciliation
- Flexible payment options for customers
- Robust admin tools for payment management
- SCA/3DS compliance for EU regulations
- Graceful error handling and fallbacks

### Negative
- Increased system complexity
- More extensive testing requirements
- Additional monitoring and alerting needs
- Higher development and maintenance costs

### Risks and Mitigations

**Risk**: Payment processing failures
**Mitigation**: Comprehensive error handling, fallback to cash payments, admin override tools

**Risk**: Webhook processing issues
**Mitigation**: Webhook replay protection, manual reconciliation tools, monitoring and alerting

**Risk**: Security vulnerabilities
**Mitigation**: Regular security audits, webhook signature verification, PCI compliance practices

**Risk**: Reconciliation discrepancies
**Mitigation**: Daily automated reconciliation, manual review processes, audit trails

## Implementation Notes

1. **Testing**: Comprehensive test suite covering webhook scenarios, error conditions, and edge cases
2. **Monitoring**: Implement alerting for payment failures, webhook issues, and reconciliation discrepancies
3. **Documentation**: Maintain up-to-date documentation for payment flows and admin procedures
4. **Rollback**: Maintain ability to disable online payments and fall back to cash-only operations

## Future Considerations

1. **Additional Payment Methods**: Apple Pay, Google Pay, SEPA Direct Debit
2. **Subscription Support**: For recurring services or memberships
3. **Multi-Currency**: Full international payment support
4. **Enhanced Analytics**: Payment conversion analysis and reporting
5. **Mobile App**: Native payment integration for mobile applications