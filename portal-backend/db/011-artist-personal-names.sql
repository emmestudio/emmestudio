-- Preserve every existing artistic/group name. Personal names are intentionally empty.
ALTER TABLE studio_artists ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '' CHECK(length(first_name)<=200);
ALTER TABLE studio_artists ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '' CHECK(length(last_name)<=200);
