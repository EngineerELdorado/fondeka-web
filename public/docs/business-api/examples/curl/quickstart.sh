#!/usr/bin/env bash
# Requires curl and Python 3. Sandbox-only example. Keep FONDEKA_INTENT on retries.
set -euo pipefail
: "${FONDEKA_API_KEY:?Set a sandbox API key}"
: "${FONDEKA_BUSINESS_ID:?Set your Business ID}"
: "${FONDEKA_INTENT:?Set a unique intent once, then preserve it on retries}"
[[ "$FONDEKA_API_KEY" == fdk_biz_sandbox_* || "$FONDEKA_API_KEY" == fdk_biz_test_* ]] || { echo 'Sandbox key required' >&2; exit 1; }
[[ "$FONDEKA_BUSINESS_ID" =~ ^[1-9][0-9]*$ && "$FONDEKA_INTENT" =~ ^[A-Za-z0-9_.:-]{1,80}$ ]] || exit 1
base="${FONDEKA_BASE_URL:-https://api.fondeka.com}"
python3 - "$base" <<'PY'
import sys,urllib.parse
u=urllib.parse.urlparse(sys.argv[1])
assert not(u.username or u.password or u.query or u.fragment or u.path.strip('/'))
assert u.scheme=='https' or (u.scheme=='http' and u.hostname in ('localhost','127.0.0.1','::1'))
PY
api="$base/business-api/v1/businesses/$FONDEKA_BUSINESS_ID"
wallets="$(curl --fail-with-body --silent --show-error --max-time 30 "$api/wallets?currency=USD" -H "X-API-Key: $FONDEKA_API_KEY")"
python3 - "$wallets" <<'PY'
import sys,json
w=json.loads(sys.argv[1]);assert len(w)==1 and w[0]['environment']=='SANDBOX','SANDBOX not confirmed; no write sent'
PY
# This response is acceptance only. Copy fondekaReference, then use GET below until terminal.
curl --fail-with-body --silent --show-error --max-time 30 -X POST "$api/collections" \
  -H "X-API-Key: $FONDEKA_API_KEY" -H "Idempotency-Key: $FONDEKA_INTENT:collection" \
  -H 'Content-Type: application/json' \
  --data "{\"amount\":10,\"currency\":\"USD\",\"paymentMethodName\":\"MPESA_KENYA\",\"accountRef\":\"+254707371664\",\"clientReference\":\"$FONDEKA_INTENT\",\"feeApplicationMode\":\"EXCLUSIVE\"}"
echo
# curl --fail-with-body --silent --show-error "$api/transactions/YOUR_REFERENCE" -H "X-API-Key: $FONDEKA_API_KEY"
