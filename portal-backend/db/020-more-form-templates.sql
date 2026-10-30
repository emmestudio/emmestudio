ALTER TABLE studio_form_documents DROP CONSTRAINT IF EXISTS studio_form_documents_template_check;
ALTER TABLE studio_form_documents ADD CONSTRAINT studio_form_documents_template_check CHECK(template IN('studio-services-v1','project-intake-v1','author-split-v1','release-sheet-v1','delivery-approval-v1'));
