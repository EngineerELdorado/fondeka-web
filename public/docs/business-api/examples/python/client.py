"""Python 3.10+, standard library only. Refuses LIVE before submitting any payment."""
import json, os, re, time, urllib.error, urllib.parse, urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class Client:
    def __init__(self, env=os.environ):
        self.base=env.get('FONDEKA_BASE_URL','https://api.fondeka.com').rstrip('/')
        parsed=urllib.parse.urlparse(self.base)
        if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path or (parsed.scheme!='https' and not(parsed.scheme=='http' and parsed.hostname in ('localhost','127.0.0.1','::1'))):
            raise ValueError('Use HTTPS or HTTP loopback for local development.')
        self.key=env.get('FONDEKA_API_KEY',''); self.business=env.get('FONDEKA_BUSINESS_ID',''); self.intent=env.get('FONDEKA_INTENT','')
        if not self.key.startswith(('fdk_biz_sandbox_','fdk_biz_test_')): raise ValueError('This example requires a sandbox key.')
        if not re.fullmatch(r'[1-9][0-9]*',self.business): raise ValueError('Set FONDEKA_BUSINESS_ID.')
        if not re.fullmatch(r'[A-Za-z0-9_.:-]{1,80}',self.intent): raise ValueError('Set FONDEKA_INTENT once per logical run; preserve it on retries.')
        self.http=urllib.request.build_opener(NoRedirect())

    def request(self,method,path,body=None,key=None,simulationCode=None):
        headers={'X-API-Key':self.key,'Accept':'application/json'}
        if body is not None: headers['Content-Type']='application/json'
        if key: headers['Idempotency-Key']=key
        if simulationCode: headers['X-Simulate-Error-Code']=simulationCode
        request=urllib.request.Request(self.base+'/business-api/v1/businesses/'+self.business+path,
            method=method,headers=headers,data=json.dumps(body).encode() if body is not None else None)
        try:
            with self.http.open(request,timeout=30) as response: return json.load(response)
        except urllib.error.HTTPError as response:
            error=json.load(response)
            raise RuntimeError(f"HTTP {response.code}: {error.get('errorCode','REQUEST_FAILED')}; {error.get('message','Check request')}; requestId={response.headers.get('X-Request-Id')}") from None

    def poll(self,reference):
        for _ in range(30):
            result=self.request('GET','/transactions/'+urllib.parse.quote(reference,safe=''))
            if result['status'] in ('COMPLETED','FAILED'): return result
            if result['status'] not in ('ACCEPTED','PROCESSING'): raise RuntimeError('Unexpected payment status for '+reference+'; preserve its reference and do not submit a replacement.')
            time.sleep(2)
        raise TimeoutError('Continue polling '+reference+' later. Preserve the original idempotency key.')

def main():
    client=Client()
    wallets=client.request('GET','/wallets?currency=USD')
    if len(wallets)!=1 or wallets[0]['environment']!='SANDBOX': raise RuntimeError('SANDBOX was not confirmed; no write sent.')
    body={'amount':10,'currency':'USD','paymentMethodName':'MPESA_KENYA','accountRef':'+254707371664','clientReference':client.intent,'feeApplicationMode':'EXCLUSIVE'}
    collection=client.request('POST','/collections',body,client.intent+':collection')
    completed=client.poll(collection['fondekaReference']); print('Collection',json.dumps(completed))
    if completed['status']!='COMPLETED': return
    payout=client.request('POST','/payouts',{**body,'amount':5},client.intent+':payout')
    print('Payout',json.dumps(client.poll(payout['fondekaReference'])))
    print('Wallets',json.dumps(client.request('GET','/wallets?currency=USD')))

if __name__=='__main__': main()
