# Publication notes for the Business API website FAQ

These notes are for the website/content team. Publish the customer-facing content from [business-api-website-faq.en.md](business-api-website-faq.en.md); keep this file separate from the public FAQ.

For page layout, visual tokens, search, mobile behavior and optional learning paths/quizzes, use the companion [FAQ UI/UX guide](business-api-website-faq-ui-ux-guide.md).

## Format and scope

- Language: English, matching the request. The draft uses short explanations, examples, a glossary and 120 numbered questions.
- Each `##` heading can become a website category; each numbered `###` heading can become an accordion item or searchable FAQ entry.
- Preserve the country and fee tables, and keep the assumptions directly beside the fee examples.
- The document explains the payment API, access purchase and portal features. It does not claim that every Fondeka app product is exposed by the payment API.
- This delivery supplies Markdown content. It does not publish a website page, change product behavior or confirm a production deployment.

## Commercial statements supplied by the product owner

The following statements come from the requested business positioning, rather than a claim that a static code configuration establishes a permanent commercial policy:

1. The API is built for students, freelancers, small businesses and startups that have not yet obtained the administrative documents needed for direct aggregator integration.
2. Paid access simplifies the integration and operational complications of working with aggregators.
3. The average pricing explanation is approximately 3% aggregator fees plus 2% Fondeka fees, combined into one approximately 5% fee per operation. Actual operator/route fees vary, and the detailed account-specific information is available after access.
4. Country coverage follows the Fondeka app and includes DR Congo, Congo-Brazzaville, Côte d’Ivoire, Gabon, Kenya, Mozambique, Uganda, Rwanda, Senegal, Sierra Leone, Tanzania and Zambia. More coverage is planned.
5. Fondeka monitors each business and its volumes. As a business grows beyond the appropriate use of this service, Fondeka will advise direct aggregator integration and recommend the business to help establish trust. The recommendation does not guarantee another provider's acceptance or pricing.

The draft does not turn an average into a fixed tariff, promise a specific migration threshold, or invent a published access price.

## Technical basis reviewed on 3 November 2026

The portal's bundled documentation identifies contract release **1.3.0**, with merchant routes remaining under `/business-api/v1`. The primary local references were:

- [Published API overview](../public/docs/business-api/README.md), [quickstart](../public/docs/business-api/quickstart.md) and [go-live guide](../public/docs/business-api/go-live.md).
- [Amounts, wallets and payment states](../public/docs/business-api/concepts.md), including consolidated fees, fee modes, account-owned wallets, asynchronous outcomes and safe retries.
- [Mobile Money collection](../public/docs/business-api/guides/mobile-money-collection.md) and [payout](../public/docs/business-api/guides/mobile-money-payout.md).
- [Crypto collection](../public/docs/business-api/guides/crypto-collection.md) and [payout](../public/docs/business-api/guides/crypto-payout.md), including fiat request amounts, returned token instructions and reconciled settlement.
- [Testing](../public/docs/business-api/testing.md), [crypto simulations](../public/docs/business-api/crypto-sandbox-simulations.md), [webhooks](../public/docs/business-api/webhooks.md) and [OpenAPI](../public/docs/business-api/openapi.v1.json).
- Portal implementation: `src/components/developer-workspace.tsx`, `src/components/api-credentials.tsx`, `src/components/api-wallets.tsx`, `src/components/api-guide-catalog.tsx`, and the Business Tools access/payment modules.
- Matching backend reference documents: `docs/business-api-credential-management.md`, `docs/business-api-web-portal-payment-catalog.md`, `docs/business-tools-access-response-client-guide.md`, and `docs/business-api/payment-quotes-and-price-limits.md`, in the sibling backend repository.
- Currency labels and route currencies were checked against backend currency/method configuration, including `20260908_pawapay_new_mobile_money_methods.sql`. The table uses **SLE** for current Sierra Leonean leone and distinguishes **CDF/USD**, **XAF** and **XOF**.

The [public API introduction](https://www.fondeka.com/docs?lang=en) and [Business API product page](https://www.fondeka.com/business?lang=en) were also checked for the public positioning and navigation. The public pages identify `info@fondeka.com` as the contact email. The [End User Agreement](https://www.fondeka.com/end-user-agreement?lang=en) describes account verification, transaction conditions and acceptable use; this FAQ does not replace those terms.

## Points to keep aligned when publishing

1. **Coverage:** the public homepage still showed older coverage/count copy during research. The FAQ deliberately uses the product owner's 12-country list. Align other website sections with that list instead of reintroducing an older country count. Country coverage does not promise every operator/currency/direction combination.
2. **Access price and billing term:** use the account's current offer. The code supports bundle and individual access and variable billing metadata; sample prices in technical documents are illustrative. The FAQ therefore does not advertise a universal price or lifetime term.
3. **Live availability:** an access purchase or Live key does not itself enable new Live payments. Confirm the launch/operational state separately if the website adds a launch announcement. No Live payment or account access was exercised for this content review.
4. **Fee examples:** keep the “average” qualification and the explanation that examples assume the stated fee has been returned. Some routes calculate fees using gross amounts, floors or tiers, so a 5% average is not a reliable formula for every net request.
5. **Detailed fee visibility:** the portal provides combined route schedules. Do not promise a separate provider/Fondeka fee breakdown in the merchant response; its public field is one consolidated `fee`.
6. **Price-preview features:** newer backend documentation describes destination-aware payment quote endpoints and price caps. Those merchant quote routes are absent from the portal's currently bundled 1.3.0 OpenAPI artifact. The FAQ therefore refers to current server-calculated amounts without advertising a specific new quote endpoint or an unverified browser preview control. Add detailed quote/cap instructions after the matching release is published and deployed.
7. **Sandbox:** its virtual fees, currencies and simulated outcomes do not predict actual Live pricing, route eligibility or provider behavior. Test funds never become real money.
8. **No unsupported guarantees:** the FAQ does not invent an uptime SLA, a payment completion deadline, automatic refund timing, public refund/cancellation endpoints, universal rate limits, free unlimited processing, automatic bank settlement or a guaranteed aggregator referral outcome.
9. **Links and translation:** the draft uses public website/portal URLs, rather than internal backend paths. Review them in the website's deployment and preserve their meaning if creating a French version. The Support URL was present in the official navigation, but its content could not be retrieved by the research tool; verify that page in the normal website publishing check.

Keep these operational notes out of the customer-facing accordion. Update the FAQ's review date when its pricing explanation, country coverage, enabled features or linked documentation changes.
