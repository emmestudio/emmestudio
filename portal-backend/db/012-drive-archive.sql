CREATE TABLE IF NOT EXISTS studio_drive_folders (
 owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 subject_key TEXT NOT NULL CHECK(length(subject_key) BETWEEN 1 AND 240),
 folder_id TEXT NOT NULL CHECK(folder_id ~ '^[A-Za-z0-9_-]{5,200}$'),
 name TEXT NOT NULL,
 parent_id TEXT,
 state TEXT NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','ready','error')),
 error TEXT NOT NULL DEFAULT '',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,subject_key),
 UNIQUE(owner_id,folder_id)
);
