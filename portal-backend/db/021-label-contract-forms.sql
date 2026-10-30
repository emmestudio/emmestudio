-- Latest catalog constraint. Supersedes the narrower check in 020.
ALTER TABLE studio_form_documents DROP CONSTRAINT IF EXISTS studio_form_documents_template_check;
ALTER TABLE studio_form_documents ADD CONSTRAINT studio_form_documents_template_check CHECK(template IN('studio-services-v1','project-intake-v1','author-split-v1','release-sheet-v1','delivery-approval-v1','label-release-agreement-v1','master-license-v1','revenue-recoupment-v1','work-change-v1'));
