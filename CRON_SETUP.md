# Retention Cron Job Setup

The retention cron runs daily at 2:00 UTC to remove books per the [data retention policy](./COPPA_COMPLIANCE.md#34-data-retention-policy).

## Option A: Vercel Cron (Recommended)

Vercel automatically sends `CRON_SECRET` in the `Authorization` header when it invokes your cron. You only need to add the env var.

### Steps

1. **Generate a secret**
   ```bash
   openssl rand -hex 32
   ```

2. **Add to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) → your project → **Settings** → **Environment Variables**
   - Add:
     - **Name:** `CRON_SECRET`
     - **Value:** (paste the generated secret)
     - **Environments:** Production
   - Save

3. **Redeploy** (or wait for the next deployment)

That’s it. Vercel will send `Authorization: Bearer <your-secret>` when the cron runs. The route verifies it and runs the retention job.

---

## Option B: External Cron with Secret in URL

If you use an external scheduler (e.g. [cron-job.org](https://cron-job.org)), pass the secret in the URL:

1. Add `CRON_SECRET` to your Vercel env vars (same as above).

2. Configure your external cron:
   - **URL:** `https://your-domain.com/api/cron/retention?secret=YOUR_CRON_SECRET`
   - **Schedule:** Daily at 2:00 UTC (`0 2 * * *`)

3. If using Vercel’s built-in cron, remove or disable it in `vercel.json` so you don’t run the job twice.

---

## Testing Locally

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:3000/api/cron/retention"
```

Or with the secret in the URL:

```bash
curl "http://localhost:3000/api/cron/retention?secret=YOUR_CRON_SECRET"
```
