# Fondeka Business Web

Next.js App Router + React + strict TypeScript. A separate customer web application for Fondeka’s B2B services, using the existing customer backend and Cognito login.

## Run locally

Use Node.js 22 LTS (`nvm use`) and npm; Node 20.19+ is also supported. The default port is **4200**, keeping the existing commerce and admin apps separate.

```sh
npm install
npm run dev
```

Open [http://localhost:4200](http://localhost:4200). The default is a clearly labeled demo with fictional data. Demo changes are persisted in this browser only; Settings → Reset demo restores the initial workspace. Demo never falls back to or calls the live backend.

The interface opens in light mode by default. The sun/moon button in the workspace header, sign-in screen, and browser verification screen switches between dark and light themes. A saved preference takes precedence over the default, persists in browser storage, synchronizes across tabs, and is applied before first paint. Both themes use locally served Geist typography, layered surfaces, and the Fondeka green accent. Decorative motion respects the system’s reduced-motion preference.

On phones, the workspace uses bottom navigation, compact lists in place of wide tables, and full-screen forms or bottom sheets. POS keeps the catalog visible with a floating sale total and a cart sheet. Secondary banners are hidden and the integration guide is collapsed; API tools and settings remain accessible from More. Touch controls, input sizes, and safe-area spacing adapt to small screens in both themes.

## Connect the existing backend

Copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_DEMO_MODE=false`, and provide:

```dotenv
FONDEKA_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-customer-pool
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=your-public-customer-client
```

Use a Cognito **customer app client without a client secret**, supporting the existing `CUSTOM_WITHOUT_SRP` email challenge flow. Restart Next.js after changing environment variables; public values are embedded at build time. The customer app client must be accepted by the backend’s JWT audience configuration. Use HTTPS for deployed apps.

The portal reuses the Admin dashboard’s email → OTP authentication pattern, configured for the **mobile app’s customer identity**:

| Portal setting                            | Mobile app setting                  |
| ----------------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID`        | `EXPO_PUBLIC_USER_POOL_ID`          |
| `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | `EXPO_PUBLIC_COGNITO_APP_CLIENT_ID` |
| `FONDEKA_API_BASE_URL`                    | `EXPO_PUBLIC_API_BASE_URL`          |

The user enters their existing Fondeka email, receives the existing Cognito custom-challenge OTP, and confirms it with `confirmSignIn`. Amplify restores/refreshes the resulting browser session through `fetchAuthSession`; authenticated users visiting `/login` return to their workspace. The same customer account owns their mobile and portal data, while each client maintains its own session. Region is derived by Amplify from the user pool ID. The mobile app’s `fondeka://` OAuth callbacks are not used by this direct email OTP flow. Local sign-out affects this browser session; it does not globally sign the user out of the mobile app.

The backend URL remains server-only. An allowlisted same-origin `/api/backend/**` gateway forwards the customer access token and trusted-device headers. The backend remains responsible for JWT validation, `CUSTOMER` role, ownership, staff permissions, device policy, and financial rules. Admin endpoints and server-to-server collections/payouts are not exposed by the gateway.

Sign-in uses the same email OTP flow as the mobile app. Cognito tokens and verified device sessions use tab-scoped session storage. Browser verification follows the existing register → challenge → RSA-SHA256 verify flow. Account-scoped non-exportable private keys live in IndexedDB; public keys and signatures use the existing backend format. Pending browsers show approval instructions and an explicit approval check. Device errors route to verification, separately from login expiration, without retrying financial submissions. Private-browsing policies must permit IndexedDB/Web Crypto. Clearing browser storage requires registering the browser again. Device recovery and replacement management remain in the mobile app/support flow.

## Implemented flows

- **Overview:** recent stores and payment requests, counts from individual paginated endpoint totals, and shortcuts. No invented account balance or cross-currency totals.
- **Stores:** paginated discovery, store details/editing, catalog, basic physical-product creation, and order history. Additional stores are included in account-level Business Tools access; creation has no separate payment step or payment-method payload.
- **POS:** active-store selection, paginated catalog, cart, server quotation, cash-received confirmation, cash sale recording, and receipt. Uses the store’s currency. Financial writes have no automatic retries; uncertain submissions instruct the operator to check order history. Fondeka-funded POS, partial/credit sales, and FX checkout are not implemented. The store picker currently lists the newest 100 stores.
- **Payment requests:** paginated requests, payment links/invoices, creation, returned-link copying, and explicit cancellation. Search applies to the current page. Settlement defaults to the existing Fondeka account.
- **API & developers:** paginated owned Business discovery; default Business preference; display-only operational/KYB status; API key metadata including revoked keys, self-service generation with one-time secret display and confirmed revocation; server-filtered, paginated API history; transaction details and manual status refresh; sanitized asynchronous crypto instructions. Business changes remount the view and discard stale requests. Missing Business/key/history responses have distinct empty states; failed/older backend routes show errors rather than empty success.
- **Settings:** environment information and isolated demo reset.

The API portal consumes `/customer-api/businesses/**`, never a merchant API key or admin token. Filters combine with AND, exact references preserve case, date bounds are inclusive local calendar days converted to Unix milliseconds, and pages are loaded on demand. Each amount retains its stored fiat currency. Crypto token amounts are shown separately. `UNKNOWN` and `MANUAL_INTERVENTION_REQUIRED` are displayed as unresolved states, and refunds use the backend’s `refunded` flag. Business/KYB statuses do not introduce client-side payment gates. Owners can generate/revoke credentials using customer authentication; admins retain management access. Secrets appear once in component memory and are cleared on close or Business/navigation/logout changes, never persisted in browser storage, URLs or logs. Demo credential mutations are disabled. There is no reveal endpoint, payment submission control or webhook replay control in this portal.

API & developers defaults to LIVE and provides a SANDBOX selector. The selected environment is held in account-scoped memory outside the owner-data gate, so access refresh/resume does not silently switch SANDBOX to LIVE; logout/account changes clear it. The selected environment is sent on credential issuance, key/history reads and reference-based details. Changing Business/environment remounts the scoped workspace, clears filters, pagination and secret/detail dialogs, and aborts stale reads. Unexpected environments are rejected instead of showing live data as test activity. Credentials include environment labels and accept the corresponding `fdk_biz_` / `fdk_biz_test_` formats. Issuance refreshes only the scoped metadata/history so that refreshing the Business list does not immediately discard the one-time secret display.

Sandbox history uses `SBX` references and nullable financial transaction IDs. It has no links to generic numeric transaction details or inclusion in financial totals. Crypto fixtures are labeled not payable and have no copy-address, QR or invoice-opening controls. The environment-specific integration guide documents server-side scenarios and webhook environment verification; the browser never sends API-key-authenticated collections or payouts. Demo mode provides isolated fictional histories and keys for both environments, while credential mutations remain disabled. Backend sandbox support, the additive migration and compatible web/worker processes must be deployed before real sandbox credentials are issued; this portal does not deploy them.

No aggregate API analytics endpoint exists, so this app does not download all transaction pages to manufacture totals. Existing stores are discovered independently from Business profiles; the UI does not invent a relationship absent from the commerce contract.

## Business Tools activation

The portal includes one account-level access guard and purchase screen for Collecte, Online Stores, POS and API management. Set `NEXT_PUBLIC_BUSINESS_TOOLS_ENABLED=true` only after the backend contract is deployed, pricing is approved and grandfathering is ready. It defaults to `false` to avoid activating a client paywall during rollout. This setting never changes backend enforcement. A protected endpoint's explicit `BUSINESS_TOOLS_ACCESS_REQUIRED` denial triggers access recovery regardless of the setting; an access lookup error or older backend's `404` shows retry rather than granting access or demanding payment.

When enabled, owner routes and overview widgets wait for `/customer-api/business-tools/access` before mounting their data queries. All four shortcuts remain visible. Access is based on `accessGranted`, including admin/migration grants without purchases. Login, device approval, settings and logout remain outside the gate. Public browsing, checkout and payer experiences are not gated by this owner-area integration.

The shared purchase flow displays the Business Tools price and amount due from backend `pricing`, followed by payment processing fees and the final gross quote in normal currency units. Qualifying previous positive, completed, non-refunded store payments grant lifetime access through backend recognition, regardless of today's price or currency; the portal never calculates a top-up, infers eligibility from store history or demands a new payment record for an existing grant. Historical credit is shown only on accepted purchase snapshots. An obsolete partial-credit offer refreshes once for backend recognition, then shows review/support if access remains false, without a new purchase. Discovery supports returned balance wallets, mobile money, crypto networks and bank methods, using the versioned `X-Client-Version: 1.0.97` response and selected language. Payments use `BUSINESS_TOOLS_ACCESS` with exclusive fees. A disabled seeded offer shows unavailable activation with Back and Refresh actions and starts no payment discovery or quote. Zero due on an enabled, configured offer also refreshes once, then shows review/support if access is still false; it never grants access or submits a zero payment. Missing or malformed pricing is an error rather than a guessed charge. A pending purchase retains its accepted pricing snapshot and transaction instructions, even if today's offer has changed. A completed historical purchase with `BUSINESS_TOOLS_LEGACY_CREDIT_UNAVAILABLE` shows payment received/access review and cannot start another charge.

Before submission, the original payment selection and idempotency key are saved in account-scoped session storage. Uncertain results first check access and pending purchases; only an explicit continuation retries the identical intent. Accepted external purchases poll the purchase UUID sequentially, pause in the background and stop automatic checks after three minutes with a manual status option. Payment instructions use the returned transaction ID; asynchronous crypto invoices refresh without another purchase. Payment status alone never unlocks tools. Logout/account changes clear recovery and query state, and a denied owner write is never automatically replayed.

The demo returns a fictional existing access grant, so it remains navigable with the rollout setting enabled. No demo activation submits a real payment.

If an account already has access while an earlier purchase is still pending, tools open immediately. A separate payment-status notice provides a read-only status/instructions dialog and a support reference without starting another purchase or cancelling the existing one.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Tests cover monetary precision, exact-reference/date filtering, gateway authentication and device/version/language header forwarding, scoped credential generation/revocation and blocked admin/merchant-payment operations, demo POS inventory updates, API pagination, currency filters, unresolved transaction states, Business Tools grants/denials, wallet selection and gross quotes, sequential polling, duplicate submissions, uncertain recovery and account isolation. Live OTP, trusted-device approval, and production payment behavior require the configured backend and an authorized customer account; no production transactions or credentials are provisioned by this project.

## Source layout

```text
src/app/(workspace)/     B2B screens within the responsive workspace shell
src/app/login/           Existing customer email OTP login
src/app/api/backend/     Allowlisted, uncached backend gateway
src/components/          Shared UI and product flows
src/lib/                 Auth, browser device proof, API, demo adapter, types
tests/                   Contract and financial behavior checks
```

The shared green brand mark follows the existing Fondeka website. No external font or image service is required at runtime. The application is local source only; it has not been deployed.
