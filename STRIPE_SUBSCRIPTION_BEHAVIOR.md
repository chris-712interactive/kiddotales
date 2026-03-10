# Stripe Subscription Behavior

This document describes how KiddoTales handles subscription lifecycle with Stripe.

## Behaviors Implemented

### 1. One Active Subscription Per User
- Users with an existing subscription **cannot** create a new one via checkout.
- Plan changes (upgrade/downgrade) use the **change-plan** API, which updates the existing subscription.
- Checkout is only used for **new** subscribers (free tier → paid).

### 2. Cancel at Period End
- When a user cancels via the Stripe Customer Portal, the subscription stays **active** until the end of the current billing period.
- **Config required in Stripe Dashboard**: Settings → Billing → Customer portal → Cancellation. Enable "Cancel at the end of the billing period" (or equivalent).
- Our webhook handles `customer.subscription.deleted` when the subscription actually ends.

### 3. Upgrade with Proration
- When a user upgrades (e.g. Spark → Magic), the change is **immediate**.
- Stripe prorates: the customer gets credit for unused time on the old plan and is charged the difference for the new plan.
- Implemented via `stripe.subscriptions.update()` with `proration_behavior: 'create_prorations'`.

### 4. Downgrade at Next Billing Cycle
- When a user downgrades (e.g. Magic → Spark), the change is **scheduled** for the end of the current billing period.
- The user keeps their current plan until the period ends.
- Implemented via Stripe **Subscription Schedules**.

## Stripe Dashboard Configuration

1. **Customer Portal** (Settings → Billing → Customer portal):
   - **Cancellation**: Enable "Cancel at the end of the billing period" so users retain access until their paid period ends.
   - **Plan changes**: If you want users to change plans via the Portal, ensure your products/prices are configured. Our app uses the pricing page + change-plan API for plan changes.

2. **Webhooks**: Ensure your webhook endpoint receives:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `subscription_schedule.updated`
   - `subscription_schedule.completed`
   - `subscription_schedule.released`
   - `invoice.payment_failed`

## API Endpoints

- **POST /api/stripe/checkout** – New subscriptions only (rejects if user already has one).
- **POST /api/stripe/change-plan** – Upgrade (immediate + proration) or downgrade (scheduled at period end).
- **POST /api/stripe/portal** – Opens Stripe Customer Portal for managing payment methods and cancellation.
