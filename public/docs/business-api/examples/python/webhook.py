"""Python 3.10+, raw-body verification and a SQLite durable inbox. TLS terminates at a reverse proxy/tunnel."""
import hashlib, hmac, json, os, re, sqlite3, tempfile, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Select the key's secret from trusted Business configuration, never from the body.
def verify(raw,timestamp,signature,event_id,secret,environment='SANDBOX',now=None):
    now=time.time() if now is None else now
    if not secret or not re.fullmatch(r'[0-9]{1,12}',timestamp or '') or abs(now-int(timestamp))>300 or not re.fullmatch(r'v1=[a-f0-9]{64}',signature or ''):
        raise ValueError('Invalid webhook authentication')
    expected='v1='+hmac.new(secret.encode(),timestamp.encode()+b'.'+raw,hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected,signature): raise ValueError('Invalid webhook authentication')
    event=json.loads(raw)
    if not isinstance(event,dict) or not isinstance(event.get('data'),dict): raise ValueError('Invalid webhook envelope')
    data=event['data']
    uuid.UUID(event['id'])
    operation={'BUSINESS_API_COLLECTION':'collection','BUSINESS_API_PAYOUT':'payout'}.get(data.get('action'))
    if event['id']!=event_id or not operation or data.get('status') not in ('COMPLETED','FAILED') or event.get('type')!='business_api.'+operation+'.'+data['status'].lower() or event.get('environment')!=environment or data.get('environment')!=environment or data.get('service')!='BUSINESS_API' or not isinstance(data.get('fondekaReference'),str) or not data['fondekaReference'].strip():
        raise ValueError('Unexpected webhook envelope')
    return event

def main():
    secret=os.environ['FONDEKA_WEBHOOK_SECRET']; business_id=os.environ['FONDEKA_BUSINESS_ID']
    environment=os.environ.get('FONDEKA_EXPECTED_ENV','SANDBOX')
    if not secret or not re.fullmatch(r'[1-9][0-9]*',business_id) or environment not in ('SANDBOX','LIVE'): raise ValueError('Invalid receiver settings')
    filename=os.environ.get('FONDEKA_EVENT_STORE',os.path.join(tempfile.gettempdir(),f'fondeka-example-webhooks-{business_id}-{environment}.sqlite'))
    fd=os.open(filename,os.O_CREAT|os.O_WRONLY,0o600); os.close(fd)
    with sqlite3.connect(filename) as db:
        db.execute('CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY,raw_body BLOB NOT NULL,received_at INTEGER NOT NULL)')

    class Receiver(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def do_POST(self):
            if self.path!='/fondeka/webhooks': self.send_error(404); return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if size<=0 or size>1048576: self.send_error(413); return
                raw=self.rfile.read(size)
                event=verify(raw,self.headers.get('X-Fondeka-Timestamp'),self.headers.get('X-Fondeka-Signature'),self.headers.get('X-Fondeka-Event-Id'),secret,environment)
            except (ValueError,KeyError,TypeError): self.send_error(400,'Webhook not accepted'); return
            try:
                with sqlite3.connect(filename) as db:
                    db.execute('INSERT OR IGNORE INTO inbox VALUES(?,?,?)',(event['id'],raw,int(time.time())))
                    stored=db.execute('SELECT raw_body FROM inbox WHERE id=?',(event['id'],)).fetchone()[0]
                    if stored!=raw: self.send_error(409); return
                # Commit before acknowledgment. Process durable inbox rows asynchronously and idempotently.
                self.send_response(200); self.end_headers(); self.wfile.write(b'accepted')
            except sqlite3.Error: self.send_error(500,'Inbox unavailable')

    port=int(os.environ.get('PORT','8787'))
    server=ThreadingHTTPServer(('127.0.0.1',port),Receiver)
    print(f'Webhook receiver on http://127.0.0.1:{server.server_port}/fondeka/webhooks',flush=True)
    server.serve_forever()

if __name__=='__main__': main()
