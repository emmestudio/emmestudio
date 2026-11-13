// The existing conversation UUID column also identifies projects and other production work.
export const conversationWorks = `
 SELECT t.owner_id,t.id,COALESCE(p.artist_id,t.artist_id) AS artist_id,
        COALESCE(NULLIF(t.data->>'title',''),'Senza titolo') AS title,t.kind,t.created_at
 FROM studio_production t
 LEFT JOIN studio_projects p ON p.owner_id=t.owner_id AND p.id=t.project_id
 LEFT JOIN studio_production parent ON parent.owner_id=t.owner_id AND parent.id::text=t.data->>'trackId'
 WHERE t.deleted_at IS NULL AND (t.project_id IS NULL OR (p.id IS NOT NULL AND p.deleted_at IS NULL))
 AND (NULLIF(t.data->>'trackId','') IS NULL OR (parent.id IS NOT NULL AND parent.deleted_at IS NULL))
 UNION ALL
 SELECT p.owner_id,p.id,p.artist_id,p.title,'project',p.created_at
 FROM studio_projects p WHERE p.deleted_at IS NULL
`;
