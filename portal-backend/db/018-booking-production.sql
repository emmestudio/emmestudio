ALTER TABLE studio_bookings ADD COLUMN IF NOT EXISTS production_id uuid REFERENCES studio_production(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS studio_bookings_production_unique ON studio_bookings(production_id) WHERE production_id IS NOT NULL;
