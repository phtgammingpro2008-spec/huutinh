-- Warehouse and shipping, part 1: bags with a random QR code, truck trips to Cambodia, and an append-only scan history.
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'dang_xep',
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  departed_at TEXT, departed_by TEXT,
  closed_at TEXT, closed_by TEXT
);
CREATE TABLE IF NOT EXISTS bags (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id),
  seq INTEGER NOT NULL,
  ri TEXT NOT NULL DEFAULT '{}',
  pairs INTEGER NOT NULL DEFAULT 0,
  extra_note TEXT NOT NULL DEFAULT '',
  extra_pairs INTEGER NOT NULL DEFAULT 0,
  over INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'da_dong',
  trip_id TEXT REFERENCES trips(id),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (order_id, seq)
);
CREATE TABLE IF NOT EXISTS bag_events (
  id TEXT PRIMARY KEY,
  bag_id TEXT NOT NULL REFERENCES bags(id),
  trip_id TEXT,
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  user_id TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bags_order ON bags(order_id);
CREATE INDEX IF NOT EXISTS idx_bags_trip ON bags(trip_id);
CREATE INDEX IF NOT EXISTS idx_bags_status ON bags(status);
CREATE INDEX IF NOT EXISTS idx_bag_events_bag ON bag_events(bag_id);
CREATE TRIGGER IF NOT EXISTS bag_events_no_update BEFORE UPDATE ON bag_events BEGIN SELECT RAISE(ABORT, 'bag_events is append-only'); END;
CREATE TRIGGER IF NOT EXISTS bag_events_no_delete BEFORE DELETE ON bag_events BEGIN SELECT RAISE(ABORT, 'bag_events is append-only'); END;
