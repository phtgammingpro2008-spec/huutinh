-- Promo posters (like the printed posters): a layout switch, a linked product, an accent colour,
-- a highlighted second title line and a small badge on the photo. Existing posters stay 'classic'.
ALTER TABLE posters ADD COLUMN layout TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE posters ADD COLUMN product_id TEXT;
ALTER TABLE posters ADD COLUMN accent TEXT NOT NULL DEFAULT '#E2B65B';
ALTER TABLE posters ADD COLUMN highlight_vi TEXT NOT NULL DEFAULT '';
ALTER TABLE posters ADD COLUMN highlight_en TEXT NOT NULL DEFAULT '';
ALTER TABLE posters ADD COLUMN highlight_km TEXT NOT NULL DEFAULT '';
ALTER TABLE posters ADD COLUMN badge_vi TEXT NOT NULL DEFAULT '';
ALTER TABLE posters ADD COLUMN badge_en TEXT NOT NULL DEFAULT '';
ALTER TABLE posters ADD COLUMN badge_km TEXT NOT NULL DEFAULT '';
