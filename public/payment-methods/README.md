Crypto SVGs are reused from `fondeka-expo/src/assets/cryptos` so the portal matches the Fondeka mobile app.

`src/lib/crypto-method-logo.ts` maps exact configured method names to local assets. General categories such as `OTHER_CRYPTOS` and `STABLECOINS` use a generic coin icon rather than another token's logo. These local fallbacks require no extra API requests. Configured mobile-money and crypto logos use the catalog’s optional `logoUrl`; loading an image never re-fetches the catalog.
