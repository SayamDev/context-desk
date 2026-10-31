import path from 'node:path';
// Node's test files run in separate processes. Each owns a database; children
// deliberately spawned by a test inherit that test's data root for recovery QA.
if(process.env.NODE_TEST_CONTEXT==='child-v8'&&!process.env.CONTEXT_DESK_TEST_WORKER){
  process.env.CONTEXT_DESK_DATA_DIR=path.join(process.env.CONTEXT_DESK_DATA_DIR,'worker-'+process.pid);
  process.env.CONTEXT_DESK_TEST_WORKER='1';
}
