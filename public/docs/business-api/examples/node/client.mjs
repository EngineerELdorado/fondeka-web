// Node.js 22+. No dependencies. This walkthrough refuses LIVE credentials before any write.
import {pathToFileURL} from 'node:url';

export function settings(env=process.env) {
  const base=new URL(env.FONDEKA_BASE_URL || 'https://api.fondeka.com');
  if(base.username || base.password || base.search || base.hash || base.pathname!=='/' ||
      (base.protocol!=='https:' && !(base.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname)))) throw new Error('Use HTTPS, or HTTP loopback for local development.');
  if(!['fdk_biz_sandbox_','fdk_biz_test_'].some(prefix=>env.FONDEKA_API_KEY?.startsWith(prefix))) throw new Error('This example requires a sandbox key.');
  if(!/^[1-9][0-9]*$/.test(env.FONDEKA_BUSINESS_ID || '')) throw new Error('Set FONDEKA_BUSINESS_ID.');
  if(!/^[A-Za-z0-9_.:-]{1,80}$/.test(env.FONDEKA_INTENT || '')) throw new Error('Set FONDEKA_INTENT once per logical run; keep it on retries.');
  return {base:base.origin,key:env.FONDEKA_API_KEY,business:env.FONDEKA_BUSINESS_ID,intent:env.FONDEKA_INTENT};
}
export async function api(config,method,path,body,key,simulationCode) {
  const response=await fetch(`${config.base}/business-api/v1/businesses/${config.business}${path}`,{
    method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{'X-API-Key':config.key,Accept:'application/json',
      ...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{}),...(simulationCode?{'X-Simulate-Error-Code':simulationCode}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok) throw new Error(`HTTP ${response.status}: ${result.errorCode || 'REQUEST_FAILED'}; ${result.message || 'Check request'}; requestId=${response.headers.get('X-Request-Id')}`);
  return result;
}
async function poll(config,reference) {
  for(let attempt=0;attempt<30;attempt++) {
    const result=await api(config,'GET',`/transactions/${encodeURIComponent(reference)}`);
    if(['COMPLETED','FAILED'].includes(result.status)) return result;
    if(!['ACCEPTED','PROCESSING'].includes(result.status)) throw new Error(`Unexpected payment status for ${reference}; preserve its reference and do not replace it.`);
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  throw new Error(`Polling timed out for ${reference}. Keep the reference/idempotency key and continue polling later.`);
}
export async function main() {
  const config=settings();
  const wallets=await api(config,'GET','/wallets?currency=USD');
  if(wallets.length!==1 || wallets[0].environment!=='SANDBOX') throw new Error('Backend did not confirm SANDBOX; no write sent.');
  const body={amount:10,currency:'USD',paymentMethodName:'MPESA_KENYA',accountRef:'+254707371664',clientReference:config.intent,feeApplicationMode:'EXCLUSIVE'};
  const collection=await api(config,'POST','/collections',body,`${config.intent}:collection`);
  const collected=await poll(config,collection.fondekaReference);
  console.log('Collection',JSON.stringify(collected));
  if(collected.status!=='COMPLETED') return;
  const payout=await api(config,'POST','/payouts',{...body,amount:5},`${config.intent}:payout`);
  console.log('Payout',JSON.stringify(await poll(config,payout.fondekaReference)));
  console.log('Wallets',JSON.stringify(await api(config,'GET','/wallets?currency=USD')));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
