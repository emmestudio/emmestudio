// One release only: no database access in local builds or other projects/environments.
if(process.env.VERCEL_ENV === 'production') {
 if(process.env.VERCEL_PROJECT_ID !== 'prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK')throw Error('MIGRATION_WRONG_PROJECT');
 await import('./migrate-consolidation.mjs');
 if(process.exitCode)throw Error('CONSOLIDATION_PREPARE_FAILED');
}
