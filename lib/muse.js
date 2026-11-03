// One structured Muse Spark request: developer instructions, user input, a strict JSON schema.
// Errors keep the provider's HTTP status so callers can tell a bad key from a bad answer.
const ENDPOINT='https://api.meta.ai/v1/chat/completions';

export async function museJson({fetchImpl=fetch,key,model='muse-spark-1.3',name,schema,instructions,input,maxTokens=3000,effort='low',timeout=120000}){
  const response=await fetchImpl(ENDPOINT,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${String(key).trim()}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,reasoning_effort:effort,max_completion_tokens:maxTokens,response_format:{type:'json_schema',json_schema:{name,strict:true,schema}},messages:[{role:'developer',content:instructions},{role:'user',content:input}]}),signal:AbortSignal.timeout(timeout)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(Error(data?.error?.message||'Muse Spark did not answer.'),{status:response.status});
  const content=data?.choices?.[0]?.message?.content,answer=typeof content==='string'?content:Array.isArray(content)?content.map(part=>part.text||'').join(''):'';
  const match=answer.match(/\{[\s\S]*\}/);if(!match)throw Error('The Muse Spark answer could not be read. Try again.');
  return JSON.parse(match[0]);
}

export const httpError=(message,status)=>Object.assign(Error(message),{status});
export const text=(value,length)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,length);
