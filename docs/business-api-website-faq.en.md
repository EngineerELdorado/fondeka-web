# Fondeka Payment API: your questions answered

Add Mobile Money and crypto payments to your website or application, even while your business is still taking shape.

Fondeka built this API for **students, freelancers, small businesses and startups that do not yet have the administrative documents needed to integrate directly with many payment aggregators**. You can build and test your payment flow through Fondeka, then use real payments when your account and the relevant payment routes are ready.

This guide explains what you get, why access is paid, how transaction fees work, where payments are supported, and how to start safely with Sandbox before moving to Live.

**The essentials:**

| Question                                        | Short answer                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What can I build?                               | Mobile Money and crypto collections and payouts, connected to your own application.                                                                                                                    |
| Who is it for?                                  | Students, freelancers, independent developers, small businesses and early-stage startups, including projects still preparing company documents.                                                        |
| Why pay for access?                             | Fondeka simplifies the integration and operational work involved in connecting to payment aggregators.                                                                                                 |
| What are the transaction fees?                  | On average, approximately 3% for the aggregator plus 2% for Fondeka, combined into one approximately 5% fee per operation. Actual fees vary by operator and payment route.                             |
| Where can I see detailed fees?                  | In the API area after access is active, through the available payment methods and their current fee information.                                                                                       |
| Can I test without real money?                  | Yes. Sandbox uses separate credentials, virtual balances and simulated payments.                                                                                                                       |
| Does paying automatically enable Live payments? | No. Access, identity/account requirements, route availability and Live-payment availability are separate checks.                                                                                       |
| What happens as my business grows?              | Fondeka monitors business activity and volumes. When direct integration becomes more suitable, we will advise you to work directly with an aggregator and recommend your business to help build trust. |

## Contents

- [Understanding the API and who it serves](#understanding-the-api-and-who-it-serves)
- [Countries, currencies and payment methods](#countries-currencies-and-payment-methods)
- [Paid access and what your payment unlocks](#paid-access-and-what-your-payment-unlocks)
- [Transaction fees, with examples](#transaction-fees-with-examples)
- [Sandbox and Live](#sandbox-and-live)
- [Getting started and managing your credentials](#getting-started-and-managing-your-credentials)
- [Collecting customer payments](#collecting-customer-payments)
- [Sending payouts](#sending-payouts)
- [Wallets, currencies and settlement](#wallets-currencies-and-settlement)
- [Payment status, notifications and safe retries](#payment-status-notifications-and-safe-retries)
- [Security, verification and responsible use](#security-verification-and-responsible-use)
- [Growing your business and moving to an aggregator](#growing-your-business-and-moving-to-an-aggregator)
- [Common problems and support](#common-problems-and-support)
- [Glossary and useful links](#glossary-and-useful-links)

## Understanding the API and who it serves

### 1. What is the Fondeka Payment API?

It is a way for your software to request payments, send supported payouts and check the results through Fondeka.

For example, a customer places an order on your website. Your server asks Fondeka to collect the payment using a supported method. Fondeka processes the request and sends your server an update when the result is known. Your application can then update the order.

An API is the connection between your software and Fondeka. It does not replace your website, app or customer service.

### 2. Who did Fondeka build this API for?

We built it especially for:

- **Students** building projects, prototypes or their first products.
- **Freelancers and independent developers** adding payments to services or client applications.
- **Small businesses** that want to collect and send payments through their own software.
- **Startups** building an MVP or launching before all company registration and administrative documents are ready.

Established teams can also assess whether the service fits their needs. Our main purpose is to make payment integration more accessible at an early stage.

### 3. Can I start if I do not have company documents yet?

Yes. This is one of the reasons the API exists. Direct aggregator onboarding can be difficult when you do not yet have the administrative documents that a provider requests. Fondeka gives you a simpler integration path while your business develops.

You still need an eligible Fondeka account and must complete the checks required for your situation. Identity verification, account restrictions and payment rules remain applicable, especially for real payouts. Starting without company paperwork does not mean using the service anonymously.

### 4. What is a payment aggregator?

A payment aggregator connects businesses to payment services, such as different Mobile Money operators. Instead of building a separate connection to every operator, a business can use the aggregator's connection.

Working directly with an aggregator can still involve company documentation, technical setup, provider-specific rules, payment status handling and operational follow-up. Fondeka simplifies access to supported payment routes through its own API and portal.

### 5. What complications does Fondeka simplify?

Fondeka provides a common way to submit supported payments, identify transactions, follow their status, receive signed notifications and view the relevant wallet balances. You can also explore supported methods and fee information from the Business portal.

You still build your application's checkout, order records, webhook receiver and business rules. The benefit is that your team works with Fondeka's documented payment flow instead of managing each underlying connection separately.

### 6. What payment operations does the API cover?

The published payment guides cover four main flows:

| Operation               | What it does                                                                        | Example                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Mobile Money collection | Requests payment from a customer's supported Mobile Money account.                  | A customer pays for an order using their phone.                                    |
| Mobile Money payout     | Sends money to a supported recipient's Mobile Money account.                        | Your application pays a supplier.                                                  |
| Crypto collection       | Creates crypto payment instructions for a price expressed in fiat money.            | A customer pays a USD-priced invoice using a supported crypto/network combination. |
| Crypto payout           | Uses a fiat wallet balance to send the quoted crypto amount to a supported address. | Your application pays an eligible recipient on the selected network.               |

The API also provides payment lookup, wallet balances and tools for Sandbox testing.

### 7. What kinds of products can I build with it?

Examples include an online shop, a service-booking app, a freelancer's invoice workflow, a student project, a subscription-management application or a startup's payment feature.

Your own application decides what is being sold and what happens after payment. For example, a subscription app can track renewal dates itself and request each payment through a supported flow. Do not assume that accepting a payment automatically creates a recurring debit mandate or a complete subscription service.

### 8. Is this the same as Payment Links, Online Stores or POS?

They are related Business Tools with different purposes. Payment Links, Online Stores and POS provide interfaces you can use directly. The API is for connecting payments to software that you or your developer control.

Depending on the offer shown to your account, API access may be included in a Business Tools bundle or sold individually. The purchase screen explains which tools your payment unlocks.

### 9. Does the API include every feature in the Fondeka app?

The API described here is focused on supported Mobile Money and crypto collections and payouts. The app may offer other products, such as cards or other financial services, with their own rules and interfaces.

A feature appearing in the app, or a method name appearing in a technical list, does not automatically mean that it is available through this payment API. Use the current API catalog and guides for your integration.

### 10. Do I need to know how to code?

You need a developer or a platform that can make secure requests from a server and receive payment notifications. The guides explain the requests and include examples, but the API does not build your application for you.

If you simply want a ready-to-use way to collect payments, explore Fondeka's Payment Links, Online Stores or POS tools. If you want payments inside your own product, the API is the relevant tool.

## Countries, currencies and payment methods

### 11. Which countries does Fondeka cover?

The API's coverage follows the countries and currencies supported by the Fondeka app. The current country coverage includes:

| Country                          | Name you may also see                   | Relevant local payment currencies                  |
| -------------------------------- | --------------------------------------- | -------------------------------------------------- |
| Democratic Republic of the Congo | RD-Congo, DR Congo, DRC, Congo-Kinshasa | Congolese franc (CDF), and USD on supported routes |
| Republic of the Congo            | Congo-Brazza, Congo-Brazzaville         | Central African CFA franc (XAF)                    |
| Côte d’Ivoire                    | Ivory Coast                             | West African CFA franc (XOF)                       |
| Gabon                            | Gabon                                   | Central African CFA franc (XAF)                    |
| Kenya                            | Kenya                                   | Kenyan shilling (KES)                              |
| Mozambique                       | Mozambique                              | Mozambican metical (MZN)                           |
| Uganda                           | Ouganda                                 | Ugandan shilling (UGX)                             |
| Rwanda                           | Rwanda                                  | Rwandan franc (RWF)                                |
| Senegal                          | Sénégal                                 | West African CFA franc (XOF)                       |
| Sierra Leone                     | Sierra Leone                            | Sierra Leonean leone (SLE)                         |
| Tanzania                         | Tanzanie                                | Tanzanian shilling (TZS)                           |
| Zambia                           | Zambie                                  | Zambian kwacha (ZMW)                               |

More countries and supported routes will be added as the service expands.

The table identifies country coverage and relevant local currencies. It is not a promise that every operator supports every currency, both payment directions or every settlement choice. Check the current route details in your API area before launching a particular flow.

### 12. Are DR Congo and Congo-Brazzaville the same payment destination?

No. They are different countries with different payment routes and currencies. DR Congo is commonly identified by country code **CD** and Congo-Brazzaville by **CG**.

Select the method for the customer's or recipient's actual country. Similar operator names do not make the routes interchangeable. Check the international phone number, country and currency together.

### 13. Can I use every Mobile Money operator in a listed country?

Use the operators currently shown for your account and the operation you want to perform. Country coverage does not mean every operator is connected or available at every moment.

The Business portal's **Available payment methods** section provides the supported identifiers and relevant information. A collection route and a payout route can have different availability, limits and fees, even when they use the same operator.

### 14. Can I collect and send money in every supported country?

Availability is checked separately for collections and payouts. A method can support one direction without supporting the other, or a route can be temporarily unavailable.

Before promising a payment option to your customers, confirm the specific country, operator, currency and direction. For payouts, recipient eligibility and available funds also matter. Your integration must display a useful message if a previously available route becomes unavailable.

### 15. Can a customer in another country pay my business?

That can be possible when the customer's payment route and your intended payment/settlement flow are supported. It is not a blanket promise that every combination of origin country, destination country and currency will work.

Check the actual route in the portal, then verify the relevant Live flow before offering it widely. For a cross-border business model, describe the countries and currencies you need when contacting support.

### 16. Can I use USD or another currency instead of the local currency?

Use the fiat currency accepted for the selected payment and settlement route. Some supported flows involve conversion between currencies; others have a more specific currency requirement.

Do not select a currency only because it exists in a wallet list or in a code example. The applicable conversion, fees and route availability must be checked for your actual request. Keep the currency displayed clearly beside every amount shown to the customer.

### 17. Which cryptocurrencies and networks can I use?

Use the crypto methods and compatible networks currently returned for your account. The guides include examples such as USDT on TRC20, but an example is not a permanent list of everything available.

The asset and network must match. A token supported on one network is not automatically supported on another. Show the exact returned network, address, token amount and any invoice expiry to the customer.

### 18. Does coverage mean the service is always available?

Country coverage means the service includes supported routes for that market. Individual operations can still be affected by operator maintenance, provider availability, account requirements, currency conversion availability or amount limits.

Build your interface to handle a route becoming unavailable. Confirm the latest method and fee information rather than treating a saved screenshot or an old list as a permanent promise.

### 19. Will more countries and currencies be added?

Yes, more coverage is planned as Fondeka expands its supported connections. Check the app, API area and Fondeka announcements for additions.

If your project needs a country, operator, currency or crypto network that is not currently available, contact support with the details. A requested route should only be advertised to your customers after its availability has been confirmed.

## Paid access and what your payment unlocks

### 20. Why does Fondeka charge for API access?

We charge for access because we simplify the work and complications involved in integrating with payment aggregators. This is particularly useful when you are still a student, working independently, running a small business or preparing your startup's administrative documents.

Your access payment supports the integration environment and tools you use to connect, test, manage credentials, understand supported payment routes and operate your payment flow through Fondeka. Transaction processing is charged separately when you use payment operations.

### 21. Why is there an access charge and also a fee per operation?

They pay for different things:

- **The access charge** activates the API tool or the Business Tools offer shown to your account.
- **Transaction fees** apply to the payment operations you perform, according to the selected route and current pricing.

Paying for access does not make payment processing free. It also does not turn the access charge into a wallet deposit or a balance you can send to customers.

### 22. How much does access cost?

The Business portal shows the current offer for your account, including the amount, currency and billing term. Check that screen before paying.

The offer can be for the full Business Tools bundle or for API access alone. Prices and available offers can change, so a price quoted by another user or shown in an old message may not be the offer available to you. The displayed payment total can also include the processing fees for the method used to pay for activation.

### 23. Is API access a one-time payment or a subscription?

Follow the billing term shown on your actual offer. If an offer is described as one-time or lifetime access, read its stated coverage and conditions. If a term or expiry is shown, take it into account.

This FAQ does not replace the offer displayed to your account. Do not assume that every account has the same price, billing term or included tools. Ask support before paying if the term is unclear.

### 24. Does paying for API access also unlock the other Business Tools?

It depends on the offer you purchase.

| Offer shown           | What it unlocks                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Business Tools bundle | The bundle's included tools: Payment Requests/Payment Links, Online Stores, POS and API access. |
| Individual API offer  | API access. Other tools require their own access unless you already have it.                    |

Selecting the API can show API-specific benefits while the payment is still for the full bundle. Read both the benefits and the coverage explanation. The price and plan shown on the purchase screen identify the actual offer.

### 25. What exactly do I get after paying for access?

Once Fondeka confirms the payment and your account's access is active, you can use the API management area covered by your offer. It provides:

1. **Your Business identity and ID**, used to identify your integration.
2. **API credential management**, including separate Sandbox and Live credentials, subject to the applicable account rules.
3. **A separate webhook signing secret**, so your server can verify notifications from Fondeka.
4. **Guides for the four payment flows**, plus explanations of amounts, payment states and errors.
5. **The available payment-method and crypto-network catalog**, with the relevant identifiers and current fee information.
6. **Sandbox tools**, including virtual wallet funding, virtual balances, history and supported test scenarios.
7. **Dedicated API wallet and transaction views**, with the selected environment kept visible.
8. **Credential controls**, such as updating a webhook URL and revoking a key.

Actual Live payment acceptance remains subject to Live availability and the checks for your account and payment route. Your purchase does not automatically provide payout funds, customer orders, a finished website or guaranteed transaction approval.

### 26. Will an API key be sent automatically when I pay?

After access is active, you generate your credentials in the Business portal for the Business and environment you want to use. The access payment and credential generation are separate steps.

Save both the API key and the webhook signing secret when they are shown. Complete secrets are displayed only at generation time. A masked key shown later is an identifier, not a replacement for the complete secret.

### 27. Can I read anything before buying access?

You can read Fondeka's public API introduction and published technical documentation to understand the service and prepare your project. Account-specific management features and the detailed available-method fee information require the relevant authenticated access.

Read the public guides and ask questions before buying if your project depends on a particular country, operator, feature or Live launch date. Access should be purchased with a clear understanding of the service you intend to use.

### 28. Does my access payment give me money to use for payouts?

No. Access is permission to use the tool covered by the offer. Payouts need a separate, sufficient wallet balance, including the applicable fees.

Sandbox has its own virtual funding tools for testing. Virtual funds cannot be withdrawn or turned into Live money. For real payouts, fund the appropriate real wallet through the supported Fondeka account flow.

### 29. How can I pay the access charge?

Use the payment methods returned on your activation screen. Depending on availability, these can include a Fondeka balance, Mobile Money, crypto or bank-transfer instructions.

Review the access amount, payment-processing fees and final total before confirming. Follow the exact instructions for the selected method. The methods used to purchase access are separate from the methods your own application can use through the payment API.

### 30. What should I do if I paid but access is still locked?

Refresh your access or check the existing payment's status. Keep the purchase reference and any payment receipt or instructions.

Some payment methods complete asynchronously. A payment being submitted, or money leaving an external account, does not by itself confirm that access has been granted. Do not immediately make another purchase. If the payment appears completed but the tool remains locked, contact support with the purchase reference and the account email you used.

### 31. Can I close the payment screen and come back later?

Yes. An accepted pending payment should be resumed through its existing reference and instructions. Closing the screen does not by itself cancel the payment.

When you return, check the pending payment before starting another one. If you have already sent a bank transfer or crypto payment, avoid sending it a second time merely because the screen still shows a pending status.

### 32. What happens if pricing changes while my access payment is pending?

An accepted pending purchase keeps its recorded payment flow and price information. Reopening the screen or refreshing explanatory text should not create a new purchase.

Use the instructions associated with that purchase and check its status. If you need to change an unpaid payment method, only use the option offered by the portal. Do not assume an old reference can be reused with new instructions or a different amount.

### 33. Do I have to pay again if I already have access?

Use the current access state shown for your account. If API access is already granted through your bundle, an individual purchase or another recognized grant, you should be able to open the tool without buying the same access again.

Access to POS or Online Stores alone does not automatically mean API access is included. Check the coverage of your actual grant. Contact support if your previous payment or access appears to be missing.

### 34. Is paying for access a guarantee that my business can process any amount?

No. Access does not remove transaction limits, available-balance requirements, operator rules, account restrictions or Fondeka's monitoring of business activity.

Your project must fit the supported payment flows. If you expect substantial volumes or have a specialized activity, discuss it with Fondeka before relying on a particular operational setup.

## Transaction fees, with examples

### 35. What is Fondeka's average fee per operation?

Fondeka combines the underlying aggregator's fee and its own fee into a single consolidated charge for the operation.

The average explanation is:

| Component                      |          Average |
| ------------------------------ | ---------------: |
| Aggregator fee                 | Approximately 3% |
| Fondeka fee                    | Approximately 2% |
| Consolidated fee per operation | Approximately 5% |

These are averages, not a fixed tariff for every payment. Actual fees can differ from one operator to another and between payment routes, collections, payouts, currencies and amount ranges. The current detailed fee information becomes available in your API area after access is active.

### 36. Does “3% plus 2%” mean I pay three separate fees?

No. The 3% and 2% explain the average components of the consolidated 5% fee. They are not an additional 3%, then 2%, then another 5%.

For a simple illustration using a 100-unit fee base, 3 units for the aggregator plus 2 units for Fondeka equals 5 units in total. Fondeka presents the operation's combined fee. The merchant payment response exposes one `fee`, rather than a separate breakdown of the underlying components.

A fee per payment operation does not mean a new payment-processing fee each time you look up that same payment or receive another copy of its notification. Those actions do not create a new collection or payout.

### 37. Can you show a simple 5% example?

If the fee base is 100 USD and the applicable consolidated rate is exactly 5%, the total fee would be 5 USD: an illustrative 3 USD aggregator component plus 2 USD Fondeka component.

That example explains the average pricing model. It is not a quote for a particular operator. The actual fee can depend on the amount sent for processing, fee mode, minimum charges, tiers, conversion and rounding. Use the returned fee and payment amounts for the real operation.

### 38. Why can an operator's actual fee be higher or lower than 5%?

Operators and payment routes do not all have the same cost structure. A route may use a percentage, a fixed charge, a minimum fee, different amount bands or a combination of these. Collections and payouts can also be priced differently.

For that reason, applying a hard-coded 5% to every request would be misleading. The average helps explain the model; the current route-specific information and the server-calculated amounts determine the actual operation.

### 39. Where can I see the exact fee details?

After access is active, open **API Guides → Available payment methods** in the Business portal. Explore the relevant operator or crypto method and check the fee information for the operation and currency you intend to use.

A catalog or fee range helps you understand pricing. The actual amount and destination can affect routing and the final calculation. Use the current server-calculated amounts for the payment rather than estimating a final charge from the FAQ or an old catalog screenshot.

### 40. Are access-purchase fees the same as API transaction fees?

No. Paying to activate the API is one payment flow. The collections and payouts your application later requests are separate payment operations.

The activation screen shows the processing fees and total for your access purchase. Your API area's payment-method information explains operation pricing. Do not treat a fee paid during activation as a prepaid allowance for future API transactions.

### 41. Who pays the fee: my customer or my business?

For supported payment requests, the fee mode controls how the fee relates to the requested amount:

- **EXCLUSIVE:** request a net amount and add the fee to calculate the total.
- **INCLUSIVE:** request a total budget and deduct the fee to calculate the net amount.

For a collection, this lets you distinguish between collecting your target amount plus fees and keeping the customer's total within a stated amount. Make the customer's total clear before they approve payment. If you omit the mode, the applicable default policy is used; set it explicitly when your pricing depends on it.

### 42. What do EXCLUSIVE and INCLUSIVE look like with numbers?

Assume the returned fee is 5 USD in each example:

| Operation and mode    |     Requested amount |   Fee | Total collected or debited |                                  Net credited or sent |
| --------------------- | -------------------: | ----: | -------------------------: | ----------------------------------------------------: |
| Collection, EXCLUSIVE |          100 USD net | 5 USD |      Customer pays 105 USD |                             Business receives 100 USD |
| Collection, INCLUSIVE |        100 USD total | 5 USD |      Customer pays 100 USD |                              Business receives 95 USD |
| Payout, EXCLUSIVE     |          100 USD net | 5 USD |  Wallet is debited 105 USD | Recipient receives 100 USD of the quoted payout value |
| Payout, INCLUSIVE     | 100 USD total budget | 5 USD |  Wallet is debited 100 USD |  Recipient receives 95 USD of the quoted payout value |

These examples assume the stated fee has already been calculated. They do not imply that every 100 USD request produces a 5 USD fee. For crypto, the actual token amount comes from the returned conversion instructions.

### 43. What do “amount,” “fee” and “gross amount” mean?

In the compact payment response:

- **`amount`** is the net fiat amount. For a completed collection, it represents the reconciled wallet credit.
- **`fee`** is the consolidated operation fee.
- **`grossAmount`** is the net amount plus the fee.
- **`currency`** tells you which fiat currency those numbers use.

For a payout, the gross amount is the amount reserved or debited from the wallet. Read these fields together. A number without its currency or fee mode can give the wrong impression of what the customer pays or what the business receives.

Request amounts use normal currency units: `10` with `currency: "USD"` means 10 USD, not 10 cents. Monetary requests allow at most two decimal places. Your developer should handle money with decimal arithmetic and should not automatically multiply every amount by 100.

### 44. Do currency conversion or crypto rates affect the result?

They can. The request's fiat amount, the selected payment route, any necessary currency conversion and the crypto instructions have different roles.

Use the amounts and currencies returned for the actual payment. For crypto, use the returned token quantity, asset and network. Do not assume that 100 USD means 100 tokens, that a rate is always 1:1, or that a test rate is a real market rate.

### 45. Is every charge outside Fondeka included in the consolidated fee?

The consolidated fee describes the fee Fondeka returns for its operation. It should not be read as a promise about every separate action a customer might take outside that operation, such as funding an external wallet or making a later withdrawal with another service.

Review the total presented for the Fondeka payment and any separate charges disclosed by the external operator or wallet for its own services. Ask support about a particular route if the relationship between those charges is unclear.

### 46. Are collection and payout fees identical? Will moving money twice incur two fees?

A collection and a payout are separate operations, and their pricing can differ. If your application first collects money and later sends a payout, review both operations' applicable fees.

Do not assume that paying a collection fee makes the later payout free, or that the approximate 5% average describes the total cost of an entire workflow containing several payments. Estimate your business model using the actual operations it requires.

### 47. Are fees fixed forever, and are failed-payment fees automatically refunded?

Review current pricing for each new operation. An accepted API payment retains its accepted pricing rather than being repriced merely because configuration changes later. A completed crypto collection can still have reconciled amounts that differ from its initial estimate when the customer underpays or overpays.

A failure status alone does not establish that money or fees have been returned. Refund handling depends on the operation and applicable policy. Check the relevant wallet records and contact support if the result is unclear. Do not automatically send another payout to compensate for a failed or unresolved one.

## Sandbox and Live

### 48. What is Sandbox?

**Sandbox is the API's testing environment.** It lets you develop a payment integration using virtual balances and simulated payment outcomes.

You can test submitting payments, following their status, receiving signed webhooks, handling failures and checking virtual wallet effects. Sandbox does not call the real payment providers or move real money. It is where you should build confidence in your integration before using customer funds.

### 49. What is Live?

**Live is the environment for real payments.** Successful operations can collect real customer money, credit real wallets or debit real funds for payouts.

Live requires the appropriate credential, access and account eligibility, a supported route, and Fondeka's availability for new Live API payments. A working Sandbox integration is preparation for Live; it is not authorization to process real payments by itself.

### 50. What is the difference between the website demo, Sandbox and Live?

| Environment | Purpose                                                                           | Uses real money? | Proves that a Live payment will work?                                       |
| ----------- | --------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| Portal demo | Explore the interface with fictional data.                                        | No               | No                                                                          |
| API Sandbox | Test an authenticated API integration with virtual wallets and simulated results. | No               | No                                                                          |
| API Live    | Process actual supported payments.                                                | Yes              | Only the actual verified outcome establishes what happened to that payment. |

Opening a demo workspace is not the same as testing your own server with a Sandbox API key. Keep the selected environment visible when developing and reviewing transactions.

### 51. Do Sandbox and Live use different keys?

Yes. Generate separate credentials for each environment. Newly issued keys use `fdk_sandbox_` for Sandbox and `fdk_live_` for Live. Each credential also has its own webhook signing secret.

The stored credential determines the environment. Changing a label in your interface, editing a prefix or adding “sandbox” to an unrelated URL does not change what a key can do. Older valid key formats can remain supported; follow the environment recorded for the credential.

### 52. Do I need a different API URL for Sandbox?

The documented base URL is `https://api.fondeka.com`, with merchant routes under `/business-api/v1`. Sandbox and Live use the same documented routes; the credential selects the environment.

Keep your environment configuration explicit on your server. For example, store the Sandbox and Live credentials separately and check the returned environment when processing a payment or webhook.

### 53. Do I need real money to fund a Sandbox wallet?

No. Sandbox has a virtual top-up feature. It adds test funds to the selected virtual currency wallet so you can exercise payouts and wallet calculations.

These funds have no cash value. They do not increase your real account balance, cannot pay for actual purchases and cannot be withdrawn. Use only the Sandbox tools for virtual funding; never send real money or real crypto to a Sandbox payment instruction.

### 54. Can I test currency conversion in Sandbox?

Yes. The Sandbox tools let you preview and execute a virtual conversion between supported test currencies. A preview does not reserve money or lock a rate. Execution is a separate action using the configured synthetic rates.

Sandbox conversion is for learning how your integration handles amounts, balances and history. It does not establish the real exchange rate, actual Live fee or availability of a production conversion route.

### 55. Can I test failures as well as successful payments?

Yes. The error catalog describes supported simulations for the relevant operation. Examples can include a rejected request, insufficient funds, a canceled payment, an expired crypto invoice, a network failure or a payment waiting for confirmations.

Developers can use the documented Sandbox simulation header, `X-Simulate-Error-Code`, with a supported value. Some simulations reject the request immediately; others accept the payment and produce a later outcome. Your application should handle both situations correctly.

### 56. Can I test a payment that remains pending?

Yes, where the error catalog advertises a compatible pending scenario. For example, a crypto-confirmations-pending simulation remains in `PROCESSING` instead of producing a completed or failed event.

This is useful for checking that your app does not deliver goods, release funds or send a duplicate payout while the result is unresolved. A simulated pending payment does not become a success merely because your own waiting timer ends.

### 57. Do Sandbox fees match the real 5% average?

No. Sandbox uses synthetic, configurable test fees. Published examples may use a small flat fee, such as 0.30 in the requested fiat currency, so you can check the arithmetic.

Those figures are test fixtures, not a commercial offer. Use the actual Live fee information when planning your margins or explaining charges to customers. The average 3% aggregator plus 2% Fondeka explanation concerns real-operation pricing, not a requirement that every Sandbox example use 5%.

### 58. Does a successful Sandbox payment prove that an operator will accept a Live payment?

No. Sandbox exercises the integration flow without making a real provider request. It does not prove that a real phone number, crypto address, country/currency combination or transaction amount will be accepted in Live.

Before launch, confirm the actual route, account eligibility, limits, fees and Live availability. Then verify the relevant Live flow with an appropriate small real operation when the service is enabled.

### 59. Does paying for access or generating a Live key mean Live payments are enabled?

No. These are separate steps. You can have API access and a Live credential while new Live payments are not yet enabled or are temporarily paused.

If you receive `BUSINESS_API_LIVE_PAYMENTS_DISABLED`, continue development in Sandbox and check availability with Fondeka. Do not keep retrying new Live payments in the hope of bypassing the restriction. Previously accepted payments retain their normal status tracking and processing.

### 60. How do I move from Sandbox to Live?

Before switching:

1. Confirm the relevant access, account verification and Live-payment availability.
2. Check the real methods, countries, currencies, networks, limits and fees your business needs.
3. Test successful, failed, duplicate and unresolved payments in Sandbox.
4. Deploy a public HTTPS webhook receiver that verifies notifications and handles duplicates.
5. Create and securely store separate Live credentials.
6. Fund the relevant real wallet before requesting payouts.
7. Make an appropriate small Live test and reconcile its final status, notification and wallet effect.

Keep Sandbox credentials and data separate so development cannot accidentally trigger a production payment.

## Getting started and managing your credentials

### 61. What do I need before I start?

You need an eligible Fondeka account, access to the API tool, your Business identity, and a developer or platform that can run the integration securely on a server.

You also need a public HTTPS webhook destination before relying on automatic payment notifications. You can prepare your website and server while completing account setup. Review the supported route you intend to use before promising it to customers.

### 62. How do I start, step by step?

1. Create your Fondeka account through the supported account-registration flow, or use your existing account.
2. Sign in to the [Business portal](https://web.fondeka.com).
3. Open the API area and review the access offer if activation is required.
4. Once access is active, check your Business ID, payment methods and current fees.
5. Generate Sandbox credentials and save both secrets securely.
6. Follow the quickstart, test the payment flows you need and verify your webhooks.
7. Complete the Live-readiness steps before using real customer money.

### 63. What is my Business ID?

It is the identifier for your Business profile in Fondeka. Your integration uses it in the documented API paths, and it helps connect your requests to the correct Business.

It is different from an API secret and different from an individual payment reference. An API key belongs to a particular Business. You cannot make it operate another Business simply by changing the ID in the URL.

### 64. Can I manage several businesses?

The portal works with the Business profiles owned by your account. Where multiple profiles are available, select the correct Business before generating keys or reviewing transactions.

Credentials and payment references are Business-specific. However, Businesses belonging to the same account share that account's relevant wallet balances. Do not assume each profile automatically receives a financially separate wallet. If you need separate balances or a platform model for unrelated merchants, discuss the required structure with Fondeka.

### 65. What is an API key, and where do I use it?

An API key is a secret your server uses to authenticate merchant API requests. Send it in the documented `X-API-Key` header.

Keep it on your server or in a secret manager. Do not place it in a public web page, a mobile-app bundle, a Git repository, a screenshot or a shared example. Your customers should interact with your application; they should not receive your secret key.

### 66. What is the webhook signing secret?

It is a separate secret used to check that a payment notification was genuinely signed for your integration and was not altered.

Use the API key to make requests. Use the webhook signing secret to verify incoming notifications. They are not interchangeable. The webhook guide explains the exact verification procedure, including preserving the original request-body bytes.

### 67. Why can I only see the full secrets once?

The credential-generation result shows the complete API key and webhook signing secret. Later screens return masked identifiers and metadata rather than exposing those secrets again.

Save both values in a secure place at generation time. If you lose them, generate a replacement credential and update your server configuration. A masked key prefix does not contain enough information to reconstruct the original secret.

### 68. Can I create the webhook URL later or change it?

A webhook URL is required when generating credentials. It must have the supported HTTPS format. You can prepare that URL before its receiver is fully deployed, but saving it does not prove that delivery works.

For an active key, you can edit its webhook destination in the portal without rotating the key or signing secret. Prepare the new receiver to verify the existing secret first. Keep the old receiver available during the change because an attempt already in flight can still use the previous destination.

### 69. Can my webhook point to localhost?

Real delivery requires a reachable public HTTPS destination with valid TLS, using the default HTTPS port or port 443. A private or localhost address cannot receive Fondeka's deliveries.

For development, use a suitable public HTTPS tunnel or a deployed test receiver that forwards to your local development process. Test that it receives and verifies an actual Sandbox event before relying on it.

### 70. What if my key is exposed or I need to replace it?

Generate a replacement through the portal, update your server securely and revoke the exposed or retired key. Do not publish either the old or new secret while asking for help.

Revocation does not cancel already accepted payments. Their pending webhook events remain associated with the original credential and signing secret. Keep the necessary receiver and verification configuration for those payments until they have been reconciled.

### 71. Which languages and developer tools can I use?

The API uses HTTPS requests and JSON, so you can integrate it from a language or framework that supports those standards. Published examples include Node.js, Python, PHP and cURL.

The documentation also includes an OpenAPI reference and a Sandbox Postman collection. These are integration aids and examples; your production application still needs secure configuration, durable payment records, error handling and a verified webhook receiver.

## Collecting customer payments

### 72. How does a Mobile Money collection work?

Your server submits the amount, fiat currency, supported payment method and the payer's phone number, together with a unique retry identifier. Fondeka returns a payment reference and processes the request asynchronously.

Depending on the operator, the customer may need to approve the request on their phone. Your application follows the payment until it completes or fails. Deliver the product or service only after verified completion and the appropriate amount checks.

### 73. Does my customer need a Fondeka account to pay?

Customers using the documented Mobile Money or crypto collection flows do not need a Fondeka merchant account or access to your Business portal. Your business holds the Fondeka account and API credentials.

For a Mobile Money collection, the payer uses the supported Mobile Money account associated with their phone number.

For a crypto collection, the customer follows the returned invoice instructions using a suitable external wallet or service. The payer must still meet the requirements of the payment method they are using.

### 74. What phone number format should I use?

Use the documented international format for the selected country, including its calling code. Do not add an extra national trunk zero after the country code.

Validate the phone number with the customer and match it to the selected country and operator. A phone number being well formatted does not by itself prove that the account exists, has enough money or can approve the requested operation.

### 75. What if the customer has insufficient funds or does not approve the request?

The payment may fail or expire according to the provider's outcome. Your application should show the known result and any safe explanation returned for that payment.

Until the final outcome is established, do not automatically issue a replacement request. If the original payment is confirmed failed and the customer wants to try again, treat that as a deliberate new payment attempt with its own identity.

### 76. How does a crypto collection work?

You request a price in fiat currency, such as 25 USD, and select a supported crypto method and network. Fondeka creates the payment instructions asynchronously.

Once available, show the customer the returned asset, network, address, token quantity and expiry or invoice link. Your application must not invent an address, substitute a network or calculate its own token quantity from an assumed rate.

### 77. Does “25 USD paid in USDT” mean the customer sends exactly 25 USDT?

Use the returned token amount. The request's `amount` and `currency` describe the fiat-priced operation. The crypto instructions describe what the customer must actually transfer.

The fee mode, conversion and route can affect that quantity. Even when a token aims to track a fiat currency, your integration must display the quoted instructions rather than assuming a universal 1:1 relationship.

### 78. What if a crypto customer underpays, overpays or uses an expired invoice?

Read the actual final payment result. A completed collection's amount represents the reconciled net settlement, which can differ from the original estimate after an underpayment or overpayment.

Your application needs a policy for differences: for example, holding an order for review instead of delivering automatically when the credited amount is insufficient. Do not invite payment to an expired invoice, and do not assume that sending money on another network will settle the original invoice.

### 79. When should I deliver a paid product or service?

After your server has established that the correct payment is `COMPLETED`, belongs to the expected Business and environment, uses the expected currency, and settles enough for the order according to your fee arrangement.

A browser success page, customer screenshot, HTTP 202 response or unverified webhook is not sufficient evidence on its own. Keep your order-to-payment mapping and check the completed settlement before fulfilling.

## Sending payouts

### 80. How does a Mobile Money payout work?

Your server requests a payout to the recipient's supported international phone number. The request specifies the fiat amount, currency, selected method and fee mode.

The wallet must have enough available funds to cover the gross debit, including fees. When the request is accepted, the relevant amount is reserved or debited, and the payment is then processed. Confirm the final status before telling the recipient it is completed.

### 81. How does a crypto payout work?

You specify the fiat amount to use, the supported crypto method/network and the recipient's address. The operation uses the quoted conversion and debits or reserves the gross fiat amount from the account wallet.

The recipient receives the quoted token quantity on the selected network. Check the address and network carefully. A transfer to the wrong address or network may be unrecoverable, so do not infer compatibility from similar-looking address formats.

### 82. Must I fund the wallet before sending a payout?

Yes. A payout requires enough funds in the appropriate wallet to cover the total debit, not just the amount intended for the recipient.

For an EXCLUSIVE payout of 100 USD with a returned 5 USD fee, the wallet needs 105 USD. Use the actual returned pricing for your operation. Sandbox needs virtual funds; Live needs real funds. A pending incoming collection is not available payout money before it has completed and been credited.

### 83. Why can a payout be rejected even when the method appears in the catalog?

The catalog describes available configured choices. Submission also checks the actual recipient, amount, currency, applicable account requirements, limits, funding rules and current provider availability.

Some routes can depend on recipient or prior-funding eligibility. Treat the catalog as a way to choose supported identifiers and understand pricing, not as approval of every possible recipient or payout request.

### 84. Is my wallet debited again when a payout completes?

An accepted payout's gross amount is reserved or debited at acceptance. Completion does not create a second debit for that same payout.

Keep the original payment reference and retry identifier. If you submit a new logical payment because a previous one appears slow, you may create a separate payout. Prevent duplicate submissions and reconcile the original operation first.

### 85. If a payout fails, is the money immediately back in my wallet?

Do not assume that from the failure status alone. Refund behavior depends on the applicable policy and the established outcome. Some situations can require further reconciliation or manual follow-up.

Check the relevant wallet records and payment reference. If the refund is unclear, contact support. An unresolved payment can remain in processing with funds still reserved; sending another payout at that point can create an unwanted duplicate.

### 86. Can I cancel, reverse or refund any payment through the API?

The published merchant payment contract does not provide a general-purpose cancel, reverse or refund endpoint for every payment. A customer-facing “Cancel” button in your app should not promise to undo a payment that Fondeka has already accepted.

Contact support with the payment reference when you need help with an accepted operation. Whether funds can be recovered depends on the payment's state, the method and the actual financial outcome. Do not send a compensating payout automatically.

## Wallets, currencies and settlement

### 87. Where does collected money go?

A completed collection credits the relevant fiat wallet of the Business's owning Fondeka account according to the confirmed settlement. For crypto collections, the documented flow settles the confirmed proceeds in fiat.

The collection does not become available money merely because it was submitted. Check completion, the settled currency and the actual net amount. If your application has several businesses or orders, keep your own records of which collection belongs to which activity.

### 88. Is settlement automatically a transfer to my bank account?

The documented collection flow settles to the relevant Fondeka account wallet. Do not confuse that wallet credit with an automatic external bank settlement.

Moving funds onward is a separate action using a supported account or payout flow, with its own availability, fees and requirements. If your business needs a particular bank-settlement arrangement, confirm it with Fondeka before designing your operations around it.

### 89. What is the difference between a payment currency, a wallet currency and a crypto asset?

They describe different parts of the operation:

- The **fiat request/wallet currency** identifies the money value used by the API request, such as USD or KES.
- The **payment method** identifies the operator or crypto asset used for payment.
- The **crypto network and token amount**, when applicable, identify the actual blockchain instructions.

Keep those values separate in your application. For example, choosing a USDT method does not mean you should replace a USD fiat request currency with `USDT`.

### 90. Where can I see API balances and payment history?

Use the API area's dedicated **Wallets** and **Transactions** views, or the documented server-side balance and payment-lookup endpoints. Select the correct Business and environment.

API payments have their own dedicated history. Do not assume that the mobile app's general transaction list contains every API payment. Likewise, a Live wallet or transaction view should not be used to look for Sandbox virtual activity.

### 91. Are Sandbox and Live balances mixed? What about several businesses on one account?

Sandbox virtual balances are separate from the real Live balances. A test payment cannot fund your Live wallet or spend your real money.

Within one environment, the relevant balances belong to the owning account. Multiple Businesses under that account can therefore share them, even though credentials, payment references and Business records are separate. Plan your internal accounting accordingly.

### 92. How long does a payment take, and what limits apply?

Timing depends on the method, customer approval, provider response and, for crypto, network confirmations. There is no single completion time that applies to every operation in every country.

Minimums, maximums, verification requirements and available-balance rules also depend on the route and account. Check current information for your use case. A request accepted for processing can still have an unresolved outcome; do not turn a user-interface timeout into a claim that the payment failed.

## Payment status, notifications and safe retries

### 93. What are the payment statuses?

The published payment responses use four statuses:

| Status       | Meaning                                                                                           | What your app should do                                                       |
| ------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ACCEPTED`   | The request has been accepted and queued.                                                         | Save the reference and wait for the result.                                   |
| `PROCESSING` | Execution has started or the outcome is still being established.                                  | Keep a pending display and continue checking responsibly.                     |
| `COMPLETED`  | The payment has completed.                                                                        | Verify ownership, environment, currency and settled amount before fulfilling. |
| `FAILED`     | The payment has a definite failure outcome, including applicable cancellation or expiry outcomes. | Explain the known failure and reconcile any wallet/refund effect.             |

“Pending” is a useful description for customers, but `PENDING` is not an additional status in this merchant response contract.

### 94. Does HTTP 202 mean my customer has paid?

No. `202 Accepted` means Fondeka accepted the request for asynchronous processing. It usually returns an `ACCEPTED` payment and a Fondeka reference.

The actual operation can complete or fail later. Do not mark an order as paid, release goods or tell a recipient that a payout is finished just because the submission returned 202.

### 95. What is the Fondeka reference, and how is it different from my order reference?

`fondekaReference` identifies the Fondeka payment. Preserve it exactly and use it to look up the payment's status.

`orderReference` is your own optional reference for the order, invoice or business event. Store a reliable link between your record and the Fondeka payment. Your order reference is not a replacement for the separate idempotency key used to prevent duplicate submissions.

### 96. What is a webhook?

A webhook is an automatic message from Fondeka to your server when a payment reaches a supported final outcome. It lets your application update an order without relying only on a customer's browser staying open.

The payment events cover completed and failed collections and payouts. Payments still accepted or processing do not produce a final-outcome event merely because time has passed. You can also check the payment through the lookup endpoint.

### 97. Why must I verify webhook signatures and handle duplicates?

Your server should only act on a notification after verifying its signature, freshness and expected integration/environment. Otherwise, a fake or altered request could be mistaken for payment confirmation.

Delivery can repeat, for example when an acknowledgment is lost. Store verified event IDs and make order fulfillment safe to run more than once for the same payment reference. Receiving the same event twice should not deliver a digital product twice or send another payout.

### 98. What happens if my webhook endpoint is down?

Fondeka retries unsuccessful deliveries according to its delivery policy. The current documented policy allows up to ten attempts, with increasing delays. A redirect is not treated as a successful delivery.

Your application should also be able to look up the stored payment reference and reconcile the result. Fix the receiver rather than submitting a new payment. Updating a webhook URL does not automatically replay every previously delivered or exhausted event.

### 99. What is an idempotency key, in simple terms?

It is a unique label for one intended operation. Send the same key and the same payment information if you must retry that operation after a connection problem. This helps Fondeka recognize the existing request instead of creating another payment.

Use a different key for a genuinely new payment. Store the original key and request durably on your server. Reusing a key with different payment information causes a conflict rather than safely changing the original operation.

### 100. What should I do after a timeout, a lost response or a payment stuck in processing?

Keep the original idempotency key, request information and any Fondeka reference you already received. Look up the payment, or retry the same logical submission with its original key and unchanged content when appropriate.

Do not automatically generate a new key and start another collection or payout. A network timeout says that your application did not obtain an answer; it does not establish that no payment was accepted. Investigate long-running payments with support while keeping their references intact.

## Security, verification and responsible use

### 101. Does serving businesses without company documents mean there are no checks?

No. Fondeka makes integration accessible while business administration is still developing, but account identity, permitted activity, security and payment requirements continue to apply.

You may be asked to provide information needed for account verification or review of your activity. Specific operations, especially payouts, can have additional eligibility requirements. Discuss your situation with support if you are unsure which requirements apply before going Live.

### 102. Can every type of business use the API?

Your activity must be eligible for Fondeka's services and the relevant payment providers. Paying for access does not approve an otherwise restricted activity or override the rules applicable to a country or route.

If your business model involves collecting for other merchants, holding money for third parties or another specialized flow, explain it to Fondeka before launch. A standard payment integration should not be assumed to include a separate platform, escrow or merchant-onboarding service.

### 103. What are my responsibilities as the business owner?

Describe your activity accurately, keep your credentials secure, show customers the correct amounts, validate recipient details and keep reliable order/payment records. Your application should verify completion before fulfilling and handle errors without creating duplicate operations.

You are also responsible for your customer communication and your own application. Fondeka provides the payment connection and related tools; it does not automatically resolve disputes about the goods or services your business sells.

### 104. Should I send Fondeka my API key when asking for help?

Do not include API keys, webhook signing secrets, passwords, one-time login codes or a customer's Mobile Money PIN in a support message, screenshot or public issue.

Support can investigate using the Business ID, environment, Fondeka reference, request ID, approximate time and a description of the problem. Share sensitive customer information only through the appropriate support channel and only when it is needed for the investigation.

### 105. Does my application need its own payment security controls?

Yes. Keep secrets on the server, use HTTPS, restrict who can request payouts, verify webhook notifications and protect the records connecting orders to payments. Separate test and production configuration.

Your application should also prevent accidental double-click submissions and make fulfillment idempotent. These controls complement the API's own request validation and retry protection; they are part of operating a dependable payment feature.

## Growing your business and moving to an aggregator

### 106. Does Fondeka monitor each business?

Yes. Fondeka monitors the activity and payment volumes of each business using the service. This helps us follow how the business is growing, review its use of the payment service and assess whether the current integration remains suitable.

Keep your Business information up to date and be ready to explain the activity behind your transactions when needed. Monitoring continues as your business develops; access is not a substitute for an accurate business profile.

### 107. What happens when my business reaches much larger volumes?

When your transaction volumes become large enough that a direct relationship with an aggregator is more suitable, we will advise you to integrate directly with that aggregator.

Fondeka is intended to help you get started and build a working business. As you grow, direct integration may better fit your pricing, operational and account-management needs. We will discuss the appropriate next step with you rather than presenting Fondeka's average fee as the only long-term option.

### 108. Will Fondeka recommend my business to an aggregator?

Yes. As part of that growth discussion, we will recommend your business to an appropriate aggregator to help build trust and provide context about your activity with Fondeka.

A recommendation is not a guarantee that the aggregator will accept the business or offer a particular price. The aggregator makes its own onboarding decision and can request company documents, verification and other information. Your preparation and operating history will still matter.

### 109. What volume triggers a recommendation, and how should I prepare?

There is no single public threshold in this FAQ that applies to every business, payment route and activity. Contact Fondeka as your volumes grow so we can assess the appropriate setup with you.

Maintain clear business information, progress on your administrative documents, reliable payment records and a technical team able to manage the next integration. If you move to a direct provider, plan the transition so existing Fondeka payments, balances and webhook obligations can be reconciled correctly.

## Common problems and support

### 110. Why do I see “access required” after signing in?

Signing in identifies your Fondeka account. It does not by itself mean that API access is active for that account.

Check whether your offer includes the API and whether activation has completed. If you already paid or previously had access, refresh the current state and contact support with the relevant reference rather than making another payment immediately.

### 111. Why can I generate a key but not create a Live payment?

Credential management and new Live-payment acceptance are different capabilities. A Live key alone does not bypass a Live launch pause, an account requirement, a route restriction or insufficient payout funds.

Read the returned error. If it is `BUSINESS_API_LIVE_PAYMENTS_DISABLED`, use Sandbox and confirm Live availability with Fondeka. If it relates to another requirement, correct that issue before retrying.

### 112. Why do I get an unauthorized or forbidden error?

An unauthorized response can mean the key is missing, incorrect or revoked. A forbidden response can relate to the selected Business, access, account restrictions, Live availability or using a Live credential for a Sandbox-only operation.

Check the exact error code and request ID. Use the correct authentication for the endpoint: merchant payment calls use the Business API key, while portal-management calls use the signed-in owner's session. Do not substitute one for the other.

### 113. Why is a payment method, currency or network unavailable?

The combination may be unsupported for that operation, temporarily unavailable, restricted for the account or incompatible with the requested amount or destination. Refresh the current catalog and verify all request fields together.

A method appearing in a technical enum or a previous example does not make every route available. Show the returned error and offer another supported option only when appropriate; do not silently change the payment route or network.

### 114. Why do I get an insufficient-funds error when the wallet seems to cover the payment amount?

For a payout, the wallet needs enough for the gross amount, including fees. Check the correct currency and environment, available rather than assumed balances, and any money already reserved by another operation.

For example, 100 USD available is not enough for an EXCLUSIVE 100 USD payout when the actual total debit is 105 USD. A Sandbox balance also cannot cover a Live payment.

### 115. What does an idempotency conflict mean?

It means a retry identifier is already associated with different payment information. Your integration may have changed the amount, recipient, currency, method or another relevant part of a previously submitted request.

Recover and reconcile the original operation before deciding to create a new one. Do not automatically respond to a conflict by generating another key, particularly for payouts. That could turn a recovery issue into an unwanted second payment.

### 116. What should my developer do about rate limits or temporary errors?

Read the response code, preserve the request identity and use sensible delays before retrying. Repeated requests without waiting can make an incident harder to resolve.

Different endpoints can have different quotas. The current Sandbox funding rules allow up to 1,000,000 virtual currency units per top-up and 100 new top-ups per account/currency wallet per UTC day. Replaying the same successful top-up does not consume another slot. These are test-funding limits, not a statement of Live transaction capacity. Discuss expected production volumes with Fondeka.

### 117. Why is a completed API payment not visible in the app's usual transaction list?

Business API payments have dedicated transaction views. Look in the portal's API Transactions area or use the payment lookup endpoint with the exact Fondeka reference.

Check the Business and selected environment. Sandbox records remain separate from Live records. If the payment is still missing from the correct view, provide its reference and request ID to support.

### 118. What should I send when contacting support?

Include:

- The problem you are trying to solve and the expected result.
- Your Business ID and whether the issue is in Sandbox or Live.
- The operation: collection, payout, access activation, credential management or another action.
- The Fondeka payment or purchase reference, when one exists.
- The request ID, error code and approximate date/time.
- The country, operator or crypto network, currency and amount involved, when relevant.
- A description of what you have already checked, with secrets removed from any screenshot or sample.

This helps support distinguish a payment still processing from an access, configuration, integration or provider issue.

### 119. How do I contact Fondeka, and should I ask before paying?

Use [Fondeka Support](https://www.fondeka.com/support?lang=en) or email [info@fondeka.com](mailto:info@fondeka.com).

Contact us before paying if your decision depends on a particular operator, country/currency pair, Live launch date, document requirement, fee arrangement or high-volume business model. Explain your project and the payment flow you need. We can then help you assess the relevant access and integration steps.

### 120. What is the quickest summary before I decide?

Fondeka helps students, freelancers, small businesses and startups connect supported payments to their own products while they are still building their businesses and administrative readiness.

You pay for API or bundle access, then pay the applicable fees for the operations you use. The average fee model combines approximately **3% aggregator fees and 2% Fondeka fees into one approximately 5% charge per operation**, with actual operator-specific pricing available after access. Test with virtual money in Sandbox, confirm Live readiness separately, and keep payment confirmation and security built into your application. As your business grows, Fondeka can guide and recommend you toward direct aggregator integration.

## Glossary and useful links

| Term              | Simple meaning                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| API               | A documented way for your software to communicate with Fondeka.                                        |
| Aggregator        | A service connecting businesses to supported payment operators or networks.                            |
| Collection        | Receiving a payment from a customer.                                                                   |
| Payout            | Sending money to a recipient.                                                                          |
| Fiat currency     | A national or regional money currency, such as USD, CDF or KES.                                        |
| Net amount        | The amount remaining or sent after the applicable fee relationship is applied.                         |
| Gross amount      | The net amount plus the operation's consolidated fee.                                                  |
| Settlement        | The financial result established when the payment is reconciled, including the relevant wallet credit. |
| Sandbox           | The testing environment, using virtual money and simulated payments.                                   |
| Live              | The production environment, where real money can move.                                                 |
| Business ID       | The identifier for the Business profile used by an integration.                                        |
| API key           | The secret your server uses to authenticate merchant requests.                                         |
| Webhook           | A notification Fondeka sends to your server about a payment outcome.                                   |
| Signing secret    | A separate secret used to verify webhook authenticity.                                                 |
| Idempotency key   | A label that lets a safe retry refer to the same intended operation.                                   |
| Fondeka reference | The identifier used to retrieve and reconcile a Fondeka payment.                                       |
| Order reference   | Your own reference linking a payment to an order or invoice.                                           |
| KYC               | Identity/account verification, commonly called “Know Your Customer.”                                   |
| MVP               | A first working version of a product used to validate an idea.                                         |

Useful starting points:

- [Open the Fondeka Business portal](https://web.fondeka.com).
- [Explore the public API introduction](https://www.fondeka.com/docs?lang=en).
- [Open the portal's API Guides](https://web.fondeka.com/developers/guides).
- [Read the published quickstart](https://web.fondeka.com/docs/business-api/quickstart.md).
- [Read the payment and wallet concepts](https://web.fondeka.com/docs/business-api/concepts.md).
- [Read the testing guide](https://web.fondeka.com/docs/business-api/testing.md).
- [Read the webhook guide](https://web.fondeka.com/docs/business-api/webhooks.md).
- [Read the go-live guide](https://web.fondeka.com/docs/business-api/go-live.md).
- [Download the OpenAPI reference](https://web.fondeka.com/docs/business-api/openapi.v1.json).
- [Download the Sandbox Postman collection](https://web.fondeka.com/docs/business-api/postman.v1.json).
- [Contact support](https://www.fondeka.com/support?lang=en).
- [Read the End User Agreement](https://www.fondeka.com/end-user-agreement?lang=en).
- [Read the Privacy Policy](https://www.fondeka.com/privacy?lang=en).

Last reviewed: 3 November 2026. Current account offers, enabled routes and the amounts returned for an actual operation determine its applicable conditions.
