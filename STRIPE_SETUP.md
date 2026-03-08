# Stripe Subscription Setup Guide

This guide walks you through connecting your Stripe account to KiddoTales for secure subscription payments.

## Prerequisites

- Stripe account (developer mode for testing)
- Products and prices created in Stripe Dashboard for Spark, Magic, and Legend tiers

---

## Step 1: Create Products & Prices in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Products** → **Add product**
2. Create 3 products with these prices:

| Product | Monthly Price | Yearly Price | Book Limit |
|---------|---------------|--------------|------------|
| **Spark** | $4.99/month | $49/year | 20 books/month |
| **Magic** | $9.99/month | $99/year | 60 books/month |
| **Legend** | $14.99/month | $149/year | 200 books/month |

3. For each product:
   - Set **Recurring** billing
   - Create both **monthly** and **yearly** prices (yearly = custom price, billed annually)
   - Copy the **Price ID** (starts with `price_`) for each

---

## Step 2: Configure Environment Variables

Add these to your `.env` file (use `.env.local` for local development):

```env
# Stripe API Keys (Dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Price IDs (NEXT_PUBLIC_ required - pricing page runs in browser)
NEXT_PUBLIC_STRIPE_PRICE_SPARK_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_SPARK_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_MAGIC_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_MAGIC_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_LEGEND_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_LEGEND_YEARLY=price_xxx

# App URL (for redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 3: Run Database Migration

Apply the Stripe-related columns to your `users` table:

```bash
npx supabase db push
# or manually run: supabase/migrations/003_stripe_subscriptions.sql
```

---

## Step 4: Set Up Stripe Webhooks

Webhooks keep your app in sync when subscriptions change (new, updated, canceled).

### Local development (Stripe CLI)

1. [Install Stripe CLI](https://docs.stripe.com/stripe-cli)
2. Login: `stripe login`
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Copy the **webhook signing secret** (starts with `whsec_`) and add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Production

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed` (optional, for logging)
5. Copy the **Signing secret** and add to your production env:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## Step 5: Enable Customer Portal (optional)

For "Manage subscription" to work, enable the Billing Portal in Stripe:

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Settings** → **Billing** → **Customer portal**
2. Enable the portal and configure:
   - Allow customers to **update** payment method
   - Allow **cancel** subscription
   - Set return URL to your app (e.g. `https://yourdomain.com/settings`)

---

## Step 6: Test the Flow

1. Start your app: `npm run dev`
2. Start Stripe CLI (if local): `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Sign in and go to `/pricing`
4. Use test card `4242 4242 4242 4242` for successful payment
5. After checkout, verify:
   - Redirect to `/settings?checkout=success`
   - Plan shows as upgraded
   - Book limit increased

---

## Security Notes

- **Never** expose `STRIPE_SECRET_KEY` to the client
- Checkout sessions are created **server-side only** (`/api/stripe/checkout`)
- Webhook signature verification prevents forged events
- Stripe Checkout is PCI-compliant; card data never touches your server

---

## Going Live

1. Switch Stripe to **Live mode** in the Dashboard
2. Create live products/prices (or use the same structure)
3. Update env vars with live keys and price IDs
4. Add production webhook endpoint
5. Test with a real card in live mode
