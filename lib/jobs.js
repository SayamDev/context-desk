import {randomUUID,createHash} from 'node:crypto';

// One bounded worker per queue. A checkpoint is committed before each provider
// request and after each result; an ambiguous request is never replayed on boot.
// resumeOnBoot: carry on after a restart instead of waiting for the user. The section that was in
// flight is requested again (at most one repeated request); completed sections are never redone.
export function createJobQueue({store,kind,execute,publicJob=j=>j,resumeOnBoot=false}){
  const jobs=new Map();let active=null,scheduled=false;
  const save=j=>{if(store)store.putRecord(kind,j.id,JSON.parse(JSON.stringify(j)));};
  for(const saved of store?.listRecords(kind)||[]){
    const j={...saved,running:false,pause:false,cancel:false};
    if(['queued','running'].includes(j.status)&&resumeOnBoot){j.status='queued';j.phase='Resuming after restart';j.inFlight=null;j.error='';save(j)}
    else if(['queued','running'].includes(j.status)){
      j.status='interrupted';j.phase='Resume required after restart';
      j.error=j.inFlight?'The previous provider request may have completed remotely. Resume explicitly to retry this unfinished section; it may incur another charge.':'Processing was interrupted. Completed sections are saved. Resume to continue.';save(j);
    }jobs.set(j.id,j);
  }
  const sorted=()=>[...jobs.values()].sort((a,b)=>a.order-b.order||a.createdAt-b.createdAt||a.id.localeCompare(b.id));
  function snapshot(j){const queued=sorted().filter(x=>x.status==='queued');return {...publicJob(j),queuePosition:j.status==='queued'?queued.findIndex(x=>x.id===j.id)+1:0};}
  const get=id=>{const j=jobs.get(id);if(!j)throw Error('Processing job not found.');return j};
  function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;void drain()})}
  async function drain(){
    if(active)return;const j=sorted().find(x=>x.status==='queued');if(!j)return;
    active=j.id;j.running=true;j.status='running';j.phase='Starting worker';j.startedAt=Date.now();j.pause=false;j.cancel=false;j.error='';
    try{save(j);const complete=await execute(j,{checkpoint:()=>save(j),shouldStop:()=>j.pause||j.cancel});j.status=j.cancel?'cancelled':complete===true?'complete':j.pause?'paused':'complete';j.phase=j.status==='complete'?'Ready for review':j.status==='cancelled'?'Cancelled · completed sections kept':'Paused · completed sections kept';j.inFlight=null;}
    catch(error){j.status=j.cancel?'cancelled':'error';j.phase=j.cancel?'Cancelled · completed sections kept':'Stopped · completed sections kept';j.error=j.cancel?'':error.message||'Processing failed.';}
    finally{j.finishedAt=Date.now();j.running=false;active=null;try{save(j)}catch(error){j.status='error';j.error='Could not save job checkpoint: '+error.message}schedule()}
  }
  if(resumeOnBoot&&[...jobs.values()].some(j=>j.status==='queued'))schedule();
  return {
    list:()=>sorted().map(snapshot),get:id=>snapshot(get(id)),document:id=>get(id),
    add(document,{idempotencyKey}={}){if(idempotencyKey){const existing=[...jobs.values()].find(j=>j.idempotencyKey===idempotencyKey);if(existing)return snapshot(existing)}if(jobs.size>=500)throw Error('The saved job limit is reached.');const now=Date.now(),j={...document,id:randomUUID(),kind,createdAt:now,order:Math.max(now,...[...jobs.values()].map(j=>j.order+1)),status:'queued',phase:'Waiting for a worker',running:false,pause:false,cancel:false,inFlight:null,idempotencyKey};save(j);jobs.set(j.id,j);schedule();return snapshot(j)},
    command(id,action){const j=get(id);if(action==='pause'){j.pause=true;if(j.running)j.phase='Pausing after this section';else if(j.status==='queued')j.status='paused'}
      else if(action==='cancel'){j.cancel=true;if(j.running)j.phase='Cancelling after this section';else if(j.status!=='complete')j.status='cancelled'}
      else if(action==='resume'){if(!j.running&&j.status!=='complete'){j.status='queued';j.pause=false;j.cancel=false;j.error='';schedule()}}
      else if(action==='first'){if(j.status!=='queued')throw Error('Only waiting jobs can be reordered.');j.order=Math.min(...sorted().map(j=>j.order))-1}
      else if(action==='review'){if(j.status!=='complete')throw Error('Finish every section before confirming the track.');j.reviewed=true}
      else throw Error('Unknown job action.');save(j);return snapshot(j)},
    counts(){const all=[...jobs.values()],count=status=>all.filter(j=>j.status===status).length;return {waiting:count('queued'),running:count('running'),completed:count('complete'),failed:count('error'),paused:count('paused')+count('interrupted'),cancelled:count('cancelled')}}
  };
}
export const jobIdentity=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
