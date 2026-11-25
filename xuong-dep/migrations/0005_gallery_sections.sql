-- Picture sections the owner fills himself: the scrolling strip, workshop photos, and orders just delivered.
ALTER TABLE gallery ADD COLUMN section TEXT NOT NULL DEFAULT 'strip';
