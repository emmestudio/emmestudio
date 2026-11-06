DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='studio_label_catalog'::regclass AND conname='studio_label_catalog_kind_allowed'
  ) THEN
    ALTER TABLE studio_label_catalog DROP CONSTRAINT IF EXISTS studio_label_catalog_kind_check;
    ALTER TABLE studio_label_catalog ADD CONSTRAINT studio_label_catalog_kind_allowed
      CHECK (kind IN ('artist','release','partner'));
  END IF;
END $$;
