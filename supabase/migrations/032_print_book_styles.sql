-- Approved print formats: Lulu POD package + trim (for PDF + mockup) + customer-facing copy.

CREATE TABLE IF NOT EXISTS print_book_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_package_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trim_width_in NUMERIC(8, 4) NOT NULL DEFAULT 8.5
    CHECK (trim_width_in > 0 AND trim_width_in <= 24),
  trim_height_in NUMERIC(8, 4) NOT NULL DEFAULT 11
    CHECK (trim_height_in > 0 AND trim_height_in <= 24),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_book_styles_active_sort
  ON print_book_styles (is_active, sort_order, name);

INSERT INTO print_book_styles (pod_package_id, name, description, trim_width_in, trim_height_in, sort_order, is_active)
SELECT '0850X1100.FC.STD.PB.060UW444.MXX',
       'Standard color paperback',
       '8.5×11″ full color, perfect bound — great for illustrated stories',
       8.5,
       11,
       0,
       true
WHERE NOT EXISTS (SELECT 1 FROM print_book_styles LIMIT 1);

ALTER TABLE print_orders
  ADD COLUMN IF NOT EXISTS print_book_style_id UUID REFERENCES print_book_styles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_print_orders_book_style ON print_orders(print_book_style_id);

ALTER TABLE print_book_styles ENABLE ROW LEVEL SECURITY;
