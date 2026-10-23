// Durable inbox example, Node.js 22+. TLS belongs at your HTTPS reverse proxy/tunnel.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {createServer} from 'node:http';
import {appendFileSync,readFileSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export function verify({raw,timestamp,signature,eventId,secret,businessId,environment='SANDBOX',now=Math.floor(Date.now()/1000)}) {
  if(!secret || !/^[0-9]{1,12}$/.test(timestamp || '') || Math.abs(now-Number(timestamp))>300 || !/^v1=[a-f0-9]{64}$/.test(signature || '')) throw new Error('Invalid webhook authentication');
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature.slice(3),'hex'))) throw new Error('Invalid webhook authentication');
  const event=JSON.parse(raw.toString('utf8'));
  const action=event.data?.action==='BUSINESS_API_COLLECTION'?'collection':event.data?.action==='BUSINESS_API_PAYOUT'?'payout':null;
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(event.id || '') || event.id!==eventId || !action || !['COMPLETED','FAILED','CANCELED'].includes(event.data?.status)
      || event.type!==`business_api.${action}.${event.data.status.toLowerCase()}` || event.environment!==environment || event.data.environment!==environment
      || String(event.data.businessId)!==String(businessId)) throw new Error('Unexpected webhook envelope or ownership');
  return event;
}

export function start(env=process.env) {
  const secret=env.FONDEKA_WEBHOOK_SECRET,businessId=env.FONDEKA_BUSINESS_ID;
  const environment=env.FONDEKA_EXPECTED_ENV || 'SANDBOX';
  if(!secret || !/^[1-9][0-9]*$/.test(businessId || '') || !['SANDBOX','LIVE'].includes(environment)) throw new Error('Set webhook secret, Business ID and expected environment.');
  const file=env.FONDEKA_EVENT_STORE || join(tmpdir(),'fondeka-example-webhooks.jsonl');
  const seen=new Map();
  try {for(const line of readFileSync(file,'utf8').split('\n').filter(Boolean)) {const row=JSON.parse(line);seen.set(row.id,row.rawBase64);}}
  catch(error) {if(error.code!=='ENOENT') throw error;}
  const server=createServer(async(req,res)=>{
    if(req.method!=='POST' || req.url!=='/fondeka/webhooks') {res.writeHead(404).end();return;}
    const chunks=[];let size=0;let verified=false;
    try {
      for await(const chunk of req) {size+=chunk.length;if(size>1048576) {res.writeHead(413).end();return;}chunks.push(chunk);}
      const raw=Buffer.concat(chunks);
      const event=verify({raw,timestamp:req.headers['x-fondeka-timestamp'],signature:req.headers['x-fondeka-signature'],eventId:req.headers['x-fondeka-event-id'],secret,businessId,environment});
      verified=true;
      const encoded=raw.toString('base64');
      if(seen.has(event.id) && seen.get(event.id)!==encoded) {res.writeHead(409).end();return;}
      if(!seen.has(event.id)) {
        // No await between checking and fsync: single-process duplicate delivery cannot race this insert.
        const fd=openSync(file,'a',0o600);
        try {appendFileSync(fd,JSON.stringify({id:event.id,rawBase64:encoded})+'\n');fsyncSync(fd);} finally {closeSync(fd);}
        seen.set(event.id,encoded);
        console.log('Event durably accepted:',event.id); // Process the inbox asynchronously; do not print secrets/body.
      }
      res.writeHead(200).end('accepted');
    } catch {res.writeHead(verified?500:400).end('Webhook not accepted');}
  });
  server.listen(Number(env.PORT || 8787),'127.0.0.1',()=>console.log('Webhook receiver on http://127.0.0.1:'+(env.PORT || 8787)+'/fondeka/webhooks'));
  return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) start();
