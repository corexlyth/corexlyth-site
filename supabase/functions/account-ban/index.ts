const origin='https://corexlyth.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json'};
const response=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{status,headers:cors});
const durations:Record<string,string>={ban_1d:'24h',ban_7d:'168h',ban_long:'876000h',unban:'none'};

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return response(405,{error:'method'});
 const token=req.headers.get('Authorization');
 if(!token?.startsWith('Bearer '))return response(401,{error:'authentication'});
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return response(503,{error:'configuration'});
 let input:Record<string,unknown>;try{input=await req.json();}catch{return response(400,{error:'invalid_request'});}
 const operation=typeof input.operation==='string'?input.operation:'';
 if(!Object.hasOwn(durations,operation))return response(400,{error:'invalid_request'});
 const target=typeof input.target==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.target)?input.target:null;
 const comment=typeof input.comment==='string'&&/^\d{1,18}$/.test(input.comment)?input.comment:null;
 if(Boolean(target)===Boolean(comment))return response(400,{error:'invalid_request'});
 const userHeaders={'apikey':anon,'Authorization':token,'Content-Type':'application/json'};
 const serviceHeaders={'apikey':service,'Authorization':`Bearer ${service}`,'Content-Type':'application/json'};
 let job:string|undefined,account:string|undefined;
 try{
  const who=await fetch(`${url}/auth/v1/user`,{headers:userHeaders,signal:AbortSignal.timeout(15000)});
  if(!who.ok)return response(401,{error:'authentication'});
  const rpc=target?'cx_ban_operation_start':'cx_ban_from_comment';
  const payload=target?{p_target:target,p_operation:operation}:{p_comment:comment,p_operation:operation};
  const prepare=await fetch(`${url}/rest/v1/rpc/${rpc}`,{method:'POST',headers:userHeaders,body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  if(!prepare.ok)return response(403,{error:'not_authorized_or_unavailable'});
  const prepared=await prepare.json();job=target?prepared:prepared.id;account=target||prepared.target;
  if(typeof job!=='string'||typeof account!=='string')return response(500,{error:'preparation'});
  const change=await fetch(`${url}/auth/v1/admin/users/${account}`,{method:'PUT',headers:serviceHeaders,body:JSON.stringify({ban_duration:durations[operation]}),signal:AbortSignal.timeout(15000)});
  if(!change.ok){
   if(change.status>=400&&change.status<500)await fetch(`${url}/rest/v1/rpc/cx_ban_operation_finish`,{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_id:job,p_state:'failed'}),signal:AbortSignal.timeout(10000)});
   return response(502,{error:'auth_change_unconfirmed'});
  }
  const audit=await fetch(`${url}/rest/v1/rpc/cx_ban_operation_finish`,{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_id:job,p_state:'succeeded'}),signal:AbortSignal.timeout(10000)});
  if(!audit.ok || await audit.json()!==true)return response(502,{error:'audit_unconfirmed'});
  return response(200,{ok:true});
 }catch{return response(503,{error:'operation_unconfirmed'});}
});
