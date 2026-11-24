-- Home page picture strip: pictures the owner uploads, scrolling left to right in a loop.
CREATE TABLE IF NOT EXISTS gallery (
  id TEXT PRIMARY KEY,
  image_key TEXT NOT NULL,
  caption_vi TEXT NOT NULL DEFAULT '', caption_en TEXT NOT NULL DEFAULT '', caption_km TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);
