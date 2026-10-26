<?php
// PHP 8.1+ with cURL. Sandbox only; run from a server/terminal, never expose the key in a web page.
declare(strict_types=1);
$base=rtrim(getenv('FONDEKA_BASE_URL') ?: 'https://api.fondeka.com','/');
$key=getenv('FONDEKA_API_KEY') ?: ''; $business=getenv('FONDEKA_BUSINESS_ID') ?: ''; $intent=getenv('FONDEKA_INTENT') ?: '';
$url=parse_url($base);
if (!$url || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment']) || !empty($url['path']) ||
    (($url['scheme'] ?? '')!=='https' && !(($url['scheme'] ?? '')==='http' && in_array($url['host'] ?? '',['localhost','127.0.0.1','[::1]'],true)))) throw new RuntimeException('Use HTTPS or HTTP loopback.');
if ((!str_starts_with($key,'fdk_biz_sandbox_') && !str_starts_with($key,'fdk_biz_test_')) || !preg_match('/^[1-9][0-9]*$/D',$business) || !preg_match('/^[A-Za-z0-9_.:-]{1,80}$/D',$intent)) throw new RuntimeException('Set sandbox key, Business ID and a stable FONDEKA_INTENT.');
function api(string $method,string $path,?array $body=null,?string $idempotency=null,?string $simulationCode=null): array {
    global $base,$key,$business;
    $headers=['X-API-Key: '.$key,'Accept: application/json'];
    if ($body!==null) $headers[]='Content-Type: application/json';
    if ($idempotency!==null) $headers[]='Idempotency-Key: '.$idempotency;
    if ($simulationCode!==null) $headers[]='X-Simulate-Error-Code: '.$simulationCode;
    $requestId=''; $curl=curl_init($base.'/business-api/v1/businesses/'.$business.$path);
    curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>30,
        CURLOPT_HEADERFUNCTION=>function($curl,$header) use (&$requestId) {if(stripos($header,'X-Request-Id:')===0) $requestId=trim(substr($header,13));return strlen($header);}]);
    if ($body!==null) curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body,JSON_THROW_ON_ERROR));
    $raw=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);$error=curl_error($curl);curl_close($curl);
    if ($raw===false) throw new RuntimeException('Network failure; retry the same key. '.$error);
    $result=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
    if ($status<200 || $status>=300) throw new RuntimeException('HTTP '.$status.' '.($result['errorCode'] ?? 'REQUEST_FAILED').' requestId='.$requestId);
    return $result;
}
function poll(string $reference): array {
    for($i=0;$i<30;$i++) {
        $payment=api('GET','/transactions/'.rawurlencode($reference));
        if(in_array($payment['status'],['COMPLETED','FAILED'],true)) return $payment;
        if(!in_array($payment['status'],['ACCEPTED','PROCESSING'],true)) throw new RuntimeException('Unexpected payment status for '.$reference.'; preserve its reference and do not create a replacement.');
        sleep(2);
    }
    throw new RuntimeException('Continue polling '.$reference.' later; preserve its idempotency key.');
}
$wallets=api('GET','/wallets?currency=USD');
if(count($wallets)!==1 || $wallets[0]['environment']!=='SANDBOX') throw new RuntimeException('SANDBOX not confirmed; no write sent.');
$body=['amount'=>10,'currency'=>'USD','paymentMethodName'=>'MPESA_KENYA','accountRef'=>'+254707371664','clientReference'=>$intent,'feeApplicationMode'=>'EXCLUSIVE'];
$collection=api('POST','/collections',$body,$intent.':collection');
$completed=poll($collection['fondekaReference']); echo "Collection ".json_encode($completed,JSON_THROW_ON_ERROR).PHP_EOL;
if($completed['status']==='COMPLETED') {
    $body['amount']=5;$payout=api('POST','/payouts',$body,$intent.':payout');
    echo "Payout ".json_encode(poll($payout['fondekaReference']),JSON_THROW_ON_ERROR).PHP_EOL;
}
echo "Wallets ".json_encode(api('GET','/wallets?currency=USD'),JSON_THROW_ON_ERROR).PHP_EOL;
