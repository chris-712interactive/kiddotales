-- Print-on-demand (Lulu) product config, pricing rules, and customer orders.

CREATE TABLE IF NOT EXISTS print_product_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  prints_enabled BOOLEAN NOT NULL DEFAULT false,
  default_pod_package_id TEXT NOT NULL DEFAULT '0850X1100.FC.STD.PB.060UW444.MXX',
  contact_email TEXT,
  default_shipping_option TEXT NOT NULL DEFAULT 'MAIL'
    CHECK (default_shipping_option IN (
      'MAIL', 'PRIORITY_MAIL', 'GROUND_HD', 'GROUND_BUS', 'GROUND', 'EXPEDITED', 'EXPRESS'
    )),
  allowed_shipping_options TEXT[] DEFAULT ARRAY[
      'MAIL', 'PRIORITY_MAIL', 'GROUND', 'EXPEDITED', 'EXPRESS'
    ]::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO print_product_config (id, prints_enabled, default_pod_package_id, contact_email)
VALUES (
  'default',
  false,
  '0850X1100.FC.STD.PB.060UW444.MXX',
  NULL
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS print_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  markup_percent NUMERIC(8, 2) NOT NULL DEFAULT 25,
  flat_fee_cents INT NOT NULL DEFAULT 0 CHECK (flat_fee_cents >= 0),
  min_retail_cents INT CHECK (min_retail_cents IS NULL OR min_retail_cents >= 0),
  max_retail_cents INT CHECK (max_retail_cents IS NULL OR max_retail_cents >= 0),
  round_to_nineteen BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO print_pricing_rules (is_active, markup_percent, flat_fee_cents)
SELECT true, 25, 0
WHERE NOT EXISTS (SELECT 1 FROM print_pricing_rules LIMIT 1);

CREATE TABLE IF NOT EXISTS print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN (
      'awaiting_payment',
      'paid',
      'building_files',
      'submitted_to_lulu',
      'lulu_unpaid',
      'lulu_in_production',
      'shipped',
      'delivered',
      'failed',
      'cancelled'
    )),
  pod_package_id TEXT NOT NULL,
  page_count INT NOT NULL CHECK (page_count > 0),
  shipping_option TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  customer_email TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  retail_amount_cents INT NOT NULL CHECK (retail_amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  wholesale_total_incl_tax TEXT,
  lulu_cost_snapshot JSONB,
  lulu_print_job_id TEXT,
  lulu_job_status TEXT,
  tracking_urls JSONB,
  interior_pdf_url TEXT,
  cover_pdf_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_orders_user_id ON print_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_book_id ON print_orders(book_id);
CREATE INDEX IF NOT EXISTS idx_print_orders_status ON print_orders(status);
CREATE INDEX IF NOT EXISTS idx_print_orders_stripe_session ON print_orders(stripe_checkout_session_id);

ALTER TABLE print_product_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_orders ENABLE ROW LEVEL SECURITY;
