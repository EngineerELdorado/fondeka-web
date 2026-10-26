import hashlib,hmac,json,unittest
import os,pathlib,sqlite3,subprocess,sys,tempfile,time,urllib.request,urllib.error
from client import Client
from webhook import verify

class ExamplesTest(unittest.TestCase):
    def setUp(self):
        self.event={'id':'11111111-1111-4111-8111-111111111111','type':'business_api.collection.completed','environment':'SANDBOX','data':{'fondekaReference':'SBX123','service':'BUSINESS_API','environment':'SANDBOX','action':'BUSINESS_API_COLLECTION','status':'COMPLETED','orderReference':'Facture été'}}
        self.raw=json.dumps(self.event,ensure_ascii=False,indent=2).encode();self.secret='example-test-signing-secret';self.timestamp='1800000000'
        self.signature='v1='+hmac.new(self.secret.encode(),self.timestamp.encode()+b'.'+self.raw,hashlib.sha256).hexdigest()
        self.args={'raw':self.raw,'timestamp':self.timestamp,'signature':self.signature,'event_id':self.event['id'],'secret':self.secret,'now':1800000000}
    def test_exact_utf8_raw_body(self): self.assertEqual(self.event,verify(**self.args))
    def test_tampering_staleness_environment_and_ownership(self):
        for change in ({'raw':json.dumps(self.event).encode()},{'now':1800000301},{'now':1799999699},{'signature':'v1=00'},{'event_id':'another-event'},{'secret':'another-business-key-secret'},{'environment':'LIVE'}):
            with self.subTest(change=list(change)),self.assertRaises(ValueError): verify(**{**self.args,**change})
    def test_walkthrough_rejects_live_and_cleartext_before_network_io(self):
        env={'FONDEKA_API_KEY':'fdk_biz_sandbox_example','FONDEKA_BUSINESS_ID':'42','FONDEKA_INTENT':'one-intent'}
        for key in ('fdk_biz_sandbox_example','fdk_biz_test_example'):
            self.assertEqual('42',Client({**env,'FONDEKA_API_KEY':key}).business)
        for change in ({'FONDEKA_API_KEY':'fdk_biz_live_example'},{'FONDEKA_API_KEY':'fdk_biz_example'},{'FONDEKA_BASE_URL':'http://merchant.example'}):
            with self.assertRaises(ValueError): Client({**env,**change})
    def test_http_receiver_commits_once_and_deduplicates_after_restart(self):
        with tempfile.TemporaryDirectory(prefix='fondeka-doc-webhooks-') as folder:
            filename=str(pathlib.Path(folder)/'inbox.sqlite')
            def receiver():
                child=subprocess.Popen([sys.executable,'-B','-u',str(pathlib.Path(__file__).with_name('webhook.py'))],
                    env={**os.environ,'FONDEKA_WEBHOOK_SECRET':self.secret,'FONDEKA_BUSINESS_ID':'42','FONDEKA_EXPECTED_ENV':'SANDBOX','FONDEKA_EVENT_STORE':filename,'PORT':'0'},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                self.addCleanup(child.terminate)
                line=child.stdout.readline().strip();self.assertIn('http://127.0.0.1:',line)
                return child,line.split(' on ')[1]
            def deliver(url,raw):
                stamp=str(int(time.time()));signature='v1='+hmac.new(self.secret.encode(),stamp.encode()+b'.'+self.raw,hashlib.sha256).hexdigest()
                request=urllib.request.Request(url,data=raw,headers={'X-Fondeka-Timestamp':stamp,'X-Fondeka-Signature':signature,'X-Fondeka-Event-Id':self.event['id']},method='POST')
                with urllib.request.urlopen(request,timeout=5) as response:return response.status
            first,url=receiver()
            try:
                self.assertEqual(200,deliver(url,self.raw));self.assertEqual(200,deliver(url,self.raw))
                with sqlite3.connect(filename) as db:self.assertEqual(1,db.execute('SELECT count(*) FROM inbox').fetchone()[0])
                with self.assertRaises(urllib.error.HTTPError) as error:deliver(url,json.dumps(self.event).encode())
                self.assertEqual(400,error.exception.code)
            finally:first.terminate();first.communicate(timeout=5)
            second,url=receiver()
            try:
                self.assertEqual(200,deliver(url,self.raw))
                with sqlite3.connect(filename) as db:self.assertEqual(1,db.execute('SELECT count(*) FROM inbox').fetchone()[0])
            finally:second.terminate();second.communicate(timeout=5)

if __name__=='__main__': unittest.main()
