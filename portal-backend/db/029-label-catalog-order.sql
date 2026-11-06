ALTER TABLE studio_label_catalog ADD COLUMN IF NOT EXISTS sort_order integer;

WITH positions AS (
  SELECT id, row_number() OVER (
    PARTITION BY owner_id,kind ORDER BY sort_order NULLS LAST,
      CASE WHEN kind='release' THEN data->>'date' END DESC NULLS LAST,updated_at DESC,id
  ) AS position
  FROM studio_label_catalog
)
UPDATE studio_label_catalog c SET sort_order=positions.position
FROM positions WHERE c.id=positions.id AND c.sort_order IS NULL;

CREATE TABLE IF NOT EXISTS studio_label_catalog_seeded (
  owner_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE
);
