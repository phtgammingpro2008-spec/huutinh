-- Xưởng dép — D1 schema (SQLite). Chạy một lần trên D1 trống.
-- Tiền lưu bằng đơn vị nhỏ nhất: VND = đồng, USD = cent.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_search TEXT NOT NULL DEFAULT '', -- tên không dấu, chữ thường, để tìm kiếm
  zalo TEXT NOT NULL DEFAULT '',
  messenger TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'vi' CHECK (lang IN ('vi', 'en', 'km')),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency IN ('VND', 'USD')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('sole', 'strap', 'style')),
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  name_km TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL -- JSON
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'cho_bao_gia',
  currency TEXT NOT NULL CHECK (currency IN ('VND', 'USD')),
  needed_by TEXT,
  note TEXT NOT NULL DEFAULT '',
  allow_public INTEGER NOT NULL DEFAULT 0,
  quote_token TEXT UNIQUE,
  quote_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  quoted_at TEXT,
  accepted_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_images (
  id TEXT PRIMARY KEY,
  order_id TEXT, -- NULL: ảnh chỉ lưu vào thư viện
  key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS order_images_order ON order_images(order_id);

CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  crop_key TEXT NOT NULL,
  image_id TEXT,
  crop TEXT, -- JSON Box
  label TEXT NOT NULL DEFAULT 'dat_rieng' CHECK (label IN ('co_dinh', 'dat_rieng')),
  sole_id TEXT,
  strap_id TEXT,
  style_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  note_search TEXT NOT NULL DEFAULT '', -- ghi chú không dấu, để tìm kiếm
  allow_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  design_id TEXT NOT NULL,
  image_id TEXT,
  tag_no INTEGER NOT NULL,
  tap_x REAL,
  tap_y REAL,
  crop TEXT, -- JSON Box
  crop_key TEXT NOT NULL DEFAULT '',
  sole_id TEXT,
  strap_id TEXT,
  style_id TEXT,
  color_note TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_design ON order_items(design_id);

CREATE TABLE IF NOT EXISTS item_lines (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES order_items(id),
  line_key TEXT NOT NULL,
  size_from INTEGER NOT NULL,
  size_to INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('even', 'per_size', 'total')),
  qty_each INTEGER NOT NULL DEFAULT 0,
  per_size TEXT NOT NULL DEFAULT '{}', -- JSON
  unit_price INTEGER,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS item_lines_item ON item_lines(item_id);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL, -- JSON
  sent_at TEXT NOT NULL,
  accepted_at TEXT,
  UNIQUE (order_id, version)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  amount INTEGER NOT NULL,
  paid_on TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS payments_order ON payments(order_id);

INSERT OR IGNORE INTO settings (key, value) VALUES ('lines',
  '[{"key":"nam","label":{"vi":"Nam","en":"Men","km":"បុរស"},"sizeFrom":39,"sizeTo":44},{"key":"nu","label":{"vi":"Nữ","en":"Women","km":"នារី"},"sizeFrom":35,"sizeTo":40}]');

INSERT OR IGNORE INTO settings (key, value) VALUES ('quote_message',
  '{"vi":"Xưởng gửi báo giá đơn {code}, tổng {total}. Mời anh/chị xem và bấm Đồng ý tại: {url}","en":"Here is the quote for order {code}, total {total}. Please review and tap Accept here: {url}","km":"នេះជាតារាងតម្លៃសម្រាប់ការបញ្ជាទិញ {code} សរុប {total}។ សូមពិនិត្យ ហើយចុចយល់ព្រមនៅទីនេះ៖ {url}"}');
