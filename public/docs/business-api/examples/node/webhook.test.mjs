import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verify} from './webhook.mjs';
import {settings} from './client.mjs';
import {start} from './webhook.mjs';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const secret='example-test-signing-secret',timestamp='1800000000';
const event={id:'11111111-1111-4111-8111-111111111111',type:'business_api.collection.completed',environment:'SANDBOX',data:{fondekaReference:'SBX123',service:'BUSINESS_API',environment:'SANDBOX',action:'BUSINESS_API_COLLECTION',status:'COMPLETED',orderReference:'Facture été'}};
const raw=Buffer.from(JSON.stringify(event,null,2));
const signature='v1='+createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex');
const args={raw,timestamp,signature,eventId:event.id,secret,now:Number(timestamp)};
test('verify exact raw UTF-8 bytes including whitespace',()=>assert.deepEqual(verify(args),event));
for(const [name,change] of Object.entries({tampered:{raw:Buffer.from(JSON.stringify(event))},stale:{now:Number(timestamp)+301},future:{now:Number(timestamp)-301},signature:{signature:'v1=00'},header:{eventId:'another-event'},environment:{environment:'LIVE'},businessSecret:{secret:'another-business-key-secret'}})) {
  test(`reject ${name}`,()=>assert.throws(()=>verify({...args,...change})));
}
test('walkthrough rejects LIVE and non-loopback cleartext before writes',()=>{
  const env={FONDEKA_API_KEY:'fdk_biz_sandbox_example',FONDEKA_BUSINESS_ID:'42',FONDEKA_INTENT:'one-intent'};
  for(const key of ['fdk_biz_sandbox_example','fdk_biz_test_example']) assert.equal(settings({...env,FONDEKA_API_KEY:key}).business,'42');
  for(const key of ['fdk_biz_live_example','fdk_biz_example']) assert.throws(()=>settings({...env,FONDEKA_API_KEY:key}));
  assert.throws(()=>settings({...env,FONDEKA_BASE_URL:'http://merchant.example'}));
});
test('HTTP receiver persists before acknowledgment, deduplicates after restart, and retries storage failures',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'fondeka-doc-webhooks-')),file=join(dir,'inbox.jsonl');
  const servers=[];
  t.after(async()=>{for(const server of servers) await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});await rm(dir,{recursive:true,force:true});});
  const freshTimestamp=String(Math.floor(Date.now()/1000));
  const headers={'X-Fondeka-Timestamp':freshTimestamp,'X-Fondeka-Signature':'v1='+createHmac('sha256',secret).update(freshTimestamp+'.').update(raw).digest('hex'),'X-Fondeka-Event-Id':event.id};
  async function receiver(target) {
    const server=start({FONDEKA_WEBHOOK_SECRET:secret,FONDEKA_BUSINESS_ID:'42',FONDEKA_EVENT_STORE:target,PORT:'0'});servers.push(server);await once(server,'listening');
    return `http://127.0.0.1:${server.address().port}/fondeka/webhooks`;
  }
  const url=await receiver(file);
  for(let i=0;i<2;i++) assert.equal((await fetch(url,{method:'POST',headers,body:raw})).status,200);
  assert.equal((await readFile(file,'utf8')).trim().split('\n').length,1);
  assert.equal((await fetch(url,{method:'POST',headers,body:Buffer.from(JSON.stringify(event))})).status,400);
  const restarted=await receiver(file);
  assert.equal((await fetch(restarted,{method:'POST',headers,body:raw})).status,200);
  assert.equal((await readFile(file,'utf8')).trim().split('\n').length,1);
  const unavailable=join(dir,'unavailable');const broken=await receiver(unavailable);await mkdir(unavailable);
  assert.equal((await fetch(broken,{method:'POST',headers,body:raw})).status,500);
});
