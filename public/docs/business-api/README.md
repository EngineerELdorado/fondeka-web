# Fondeka Business API

Collect and send payments through mobile money and crypto, settling in your account's fiat wallets. Start in sandbox with virtual money, then use live credentials when your integration is ready.

Merchant requests use a Business-specific `X-API-Key`.

| Start here | What you will build |
| --- | --- |
| [Quickstart](quickstart.md) | Your first collection, verified webhook and payout |
| [Mobile-money collections](guides/mobile-money-collection.md) | Collect from a customer's phone |
| [Mobile-money payouts](guides/mobile-money-payout.md) | Send funds to a recipient's phone |
| [Crypto collections](guides/crypto-collection.md) | Create an invoice and receive fiat settlement |
| [Crypto payouts](guides/crypto-payout.md) | Pay a crypto address from a fiat wallet |
| [Amounts, wallets and payment states](concepts.md) | Understand the financial effects |
| [Webhooks](webhooks.md) | Verify, persist and process terminal events |
| [Testing and troubleshooting](testing.md) | Simulate outcomes, fund wallets and retry safely |
| [Go live](go-live.md) | Prepare production credentials and operations |
| [Changelog](changelog.md) | Track the published contract |

Download [OpenAPI v1](openapi.v1.json) for the complete endpoint, parameter, response and callback reference. Import the [sandbox Postman collection](postman.v1.json) to explore requests. These files can power a documentation site independently of the backend's runtime documentation endpoints.

Base URL: `https://api.fondeka.com`. LIVE and SANDBOX use the same routes. The credential determines the environment; a URL or client-side environment label does not switch it.

The API major version is `/business-api/v1`. The OpenAPI `info.version` identifies the documentation contract release. Only documented merchant endpoints are part of this contract. Available payment routes and currencies depend on configuration; an enum value alone is not an availability guarantee.
