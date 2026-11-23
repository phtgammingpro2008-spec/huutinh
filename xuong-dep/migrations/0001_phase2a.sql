-- Giai đoạn 2a: tài khoản khách, trang công khai, thư viện dùng chung.
-- Chỉ thêm (ADD COLUMN / CREATE ... IF NOT EXISTS / INSERT OR IGNORE): dữ liệu đang chạy được giữ nguyên.

ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN customer_id TEXT;
ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email) WHERE email IS NOT NULL;

ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE orders ADD COLUMN seen_by_admin INTEGER NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN deliver_note TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN cancel_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN cancelled_by TEXT;

ALTER TABLE designs ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE designs ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE designs ADD COLUMN has_brand_logo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE designs ADD COLUMN source TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE order_items ADD COLUMN product_id TEXT;
ALTER TABLE order_items ADD COLUMN color_id TEXT;
ALTER TABLE order_items ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  name_km TEXT NOT NULL DEFAULT '',
  desc_vi TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  desc_km TEXT NOT NULL DEFAULT '',
  style_id TEXT,
  sole_id TEXT,
  strap_id TEXT,
  lines TEXT NOT NULL DEFAULT '[]', -- JSON LineSetting[]
  is_new INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  has_brand_logo INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_colors (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  name_km TEXT NOT NULL DEFAULT '',
  image_key TEXT NOT NULL,
  design_id TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS product_colors_product ON product_colors(product_id);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  title_km TEXT NOT NULL DEFAULT '',
  subtitle_vi TEXT NOT NULL DEFAULT '',
  subtitle_en TEXT NOT NULL DEFAULT '',
  subtitle_km TEXT NOT NULL DEFAULT '',
  cover_key TEXT,
  color TEXT NOT NULL DEFAULT '#1b3b2c',
  published INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collection_products (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

CREATE TABLE IF NOT EXISTS posters (
  id TEXT PRIMARY KEY,
  tag_vi TEXT NOT NULL DEFAULT '', tag_en TEXT NOT NULL DEFAULT '', tag_km TEXT NOT NULL DEFAULT '',
  title_vi TEXT NOT NULL, title_en TEXT NOT NULL DEFAULT '', title_km TEXT NOT NULL DEFAULT '',
  body_vi TEXT NOT NULL DEFAULT '', body_en TEXT NOT NULL DEFAULT '', body_km TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  cta_label_vi TEXT NOT NULL DEFAULT '', cta_label_en TEXT NOT NULL DEFAULT '', cta_label_km TEXT NOT NULL DEFAULT '',
  cta_href TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS uploads_user ON uploads(user_id);

CREATE TABLE IF NOT EXISTS user_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reset', 'verify')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('shop', '{"zalo":"","messenger":"","workshopAddress":"","warehouseAddress":""}');
