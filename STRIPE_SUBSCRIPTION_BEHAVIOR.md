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
- When a user upgrades (e.g. Spark → Magic), the change is **immediate** and the **billing period end date does not change** (same subscription, new price on the item).
- Stripe normally prorates: credit for unused time on the old plan and charge for the new plan. We use `subscriptionItems.update` with `proration_behavior: 'always_invoice'` so that amount is collected right away when it is meaningful.
- **Small proration waiver**: If the previewed invoice `amount_due` is **below** `UPGRADE_PRORATION_WAIVER_THRESHOLD_CENTS` (default **100** = under **$1.00** in USD cents), we upgrade with `proration_behavior: 'none'` instead: **no charge today**, new plan applies immediately, **renewal date unchanged**; the next regular invoice uses the new price. Set the env var to **0** to disable waiving and always invoice proration.

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
- **POST /api/stripe/change-plan** – Upgrade (immediate; proration invoiced or waived per threshold) or downgrade (scheduled at period end).
- **POST /api/stripe/preview-upgrade** – Preview charge today; includes `prorationWaived` when under threshold.
- **POST /api/stripe/portal** – Opens Stripe Customer Portal for managing payment methods and cancellation.
