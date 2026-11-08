type Definitions = Record<string, readonly [en: string, fr: string]>;

export const priceCapFields: Definitions = {
  maxFee: [
    "Optional maximum fee in currency. A higher actual acceptance fee rejects with 409 PAYMENT_PRICE_LIMIT_EXCEEDED before any debit. Keep this cap unchanged on retries.",
    "Frais maximum facultatifs dans currency. Des frais supérieurs à l’acceptation provoquent 409 PAYMENT_PRICE_LIMIT_EXCEEDED avant tout débit. Conservez cette limite lors des relances.",
  ],
  maxGrossAmount: [
    "Optional maximum gross amount in currency. Copy the reviewed quote’s grossAmount to reject an increase before funding or enqueueing.",
    "Montant brut maximum facultatif dans currency. Copiez grossAmount du devis vérifié pour refuser une hausse avant débit ou mise en file.",
  ],
};
const money: Definitions = {
  amount: [
    "Bill amount in fiat currency. Use the amount from the bill or subscription.",
    "Montant de la facture en devise fiat. Utilisez le montant de la facture ou de l’abonnement.",
  ],
  currency: [
    "Fiat currency of amount, fee and grossAmount and of the wallet funding this bill.",
    "Devise fiat de amount, fee et grossAmount et du portefeuille qui finance cette facture.",
  ],
  fee: [
    "One consolidated fee added to the bill amount. grossAmount equals amount plus fee.",
    "Frais consolidés ajoutés au montant de facture. grossAmount égale amount plus fee.",
  ],
  grossAmount: [
    "Total fiat wallet debit, including the bill and its fee. Acceptance debits it once before provider execution.",
    "Débit fiat total, facture et frais inclus. L’acceptation le débite une fois avant exécution fournisseur.",
  ],
};
const environment = [
  "Environment selected by the authenticated key: real funds in LIVE, virtual funds in SANDBOX.",
  "Environnement choisi par la clé authentifiée : fonds réels en LIVE, virtuels en SANDBOX.",
] as const;
const identity: Definitions = {
  billProductCode: [
    "Product code from the catalog, such as SOCODEE or CANAL_PLUS_DRC.",
    "Code produit du catalogue, comme SOCODEE ou CANAL_PLUS_DRC.",
  ],
  accountNumber: [
    "Meter, water customer, TV subscriber or another supported bill account. Send identifiers as strings and validate with account lookup.",
    "Compteur, client d’eau, abonné TV ou autre compte de facture pris en charge. Envoyez les identifiants en texte et vérifiez-les par recherche.",
  ],
  orderReference: [
    "Optional merchant order or invoice reference for correlation and exact history filtering. It does not replace Idempotency-Key.",
    "Référence marchande facultative de commande ou facture pour le rapprochement et le filtre exact d’historique. Elle ne remplace pas Idempotency-Key.",
  ],
};
const billPayment: Definitions = {
  ...identity,
  ...money,
  environment,
  failureCode: [
    "Optional sanitized processing failure code, separate from an HTTP request error.",
    "Code sûr d’échec de traitement, facultatif et distinct d’une erreur de requête HTTP.",
  ],
  failureMessage: [
    "Optional displayable failure explanation. Branch on failureCode rather than translated text.",
    "Explication affichable facultative de l’échec. Utilisez failureCode plutôt que le texte traduit.",
  ],
  fondekaReference: [
    "Opaque payment reference. Preserve it exactly and poll /bill-payments/{reference} in the same Business and environment.",
    "Référence opaque du paiement. Conservez-la exactement et consultez /bill-payments/{reference} dans le même Business et environnement.",
  ],
  receipt: [
    "Available product-specific delivery data, such as tokens, valueReceived or newSubscription. It may arrive later; not every completed bill produces a token.",
    "Données de livraison propres au produit, comme tokens, valueReceived ou newSubscription. Elles peuvent arriver plus tard ; toute facture terminée ne produit pas de jeton.",
  ],
  refunded: [
    "Whether a refund is recorded. FAILED alone does not prove refund. A refund is never successful bill delivery.",
    "Indique si un remboursement est enregistré. FAILED ne le prouve pas. Un remboursement ne constitue jamais une livraison réussie.",
  ],
  status: [
    "ACCEPTED is queued; PROCESSING is executing or unresolved. Keep the original intent in both states. COMPLETED and FAILED are terminal. Existing TV review policy can retain uncertain purchases without a terminal event.",
    "ACCEPTED est en file ; PROCESSING est en exécution ou indéterminé. Conservez l’intention d’origine dans ces deux états. COMPLETED et FAILED sont finaux. La politique TV peut conserver les achats incertains sans événement final.",
  ],
};
const item: Definitions = {
  code: [
    "Code from the catalog. Use it in product paths and offer or option selections.",
    "Code du catalogue. Utilisez-le dans les chemins produit et les choix d’offre ou d’option.",
  ],
  name: [
    "Product, offer or option name. Use code in requests.",
    "Nom du produit, de l’offre ou de l’option. Utilisez code dans les requêtes.",
  ],
  currency: ["Currency of the offer or option price.", "Devise du prix de l’offre ou de l’option."],
  price: [
    "Package or fixed-denomination price in currency.",
    "Prix du forfait ou de la valeur fixe dans currency.",
  ],
};

/** Known extension inputs remain nested in additionalInfo, not new top-level DTO fields. */
export const billAdditionalInfoFields: Definitions = {
  operation: [
    "Biller operation inside additionalInfo. Defaults to PAY; Canal+ subscriptions use TV_RENEW or TV_CHANGE. This selects an existing supported operation, not a new route.",
    "Opération fournisseur dans additionalInfo. PAY par défaut ; les abonnements Canal+ utilisent TV_RENEW ou TV_CHANGE. Elle choisit une opération existante prise en charge, sans nouveau chemin.",
  ],
  subscriptionNumber: [
    "TV subscription identifier selected from account lookup additionalInfo. Required by the existing Canal+ renewal/change flow.",
    "Identifiant d’abonnement TV choisi dans additionalInfo de la recherche. Requis par le parcours Canal+ existant de renouvellement ou changement.",
  ],
  offerCode: [
    "Selected offer code inside additionalInfo. TV_CHANGE requires it together with optionCode; renewal retains its existing optional offer inputs.",
    "Code d’offre choisi dans additionalInfo. TV_CHANGE l’exige avec optionCode ; le renouvellement conserve ses champs d’offre facultatifs existants.",
  ],
  optionCode: [
    "Code from the selected offer’s options. Send it inside additionalInfo with offerCode for TV_CHANGE.",
    "Code des options de l’offre choisie. Envoyez-le dans additionalInfo avec offerCode pour TV_CHANGE.",
  ],
  invoiceId: [
    "Biller invoice identifier inside additionalInfo, when the returned payment requirements require it.",
    "Identifiant de facture fournisseur dans additionalInfo, lorsque les exigences de paiement retournées le demandent.",
  ],
  amountId: [
    "Fixed-denomination selector returned in the offer’s additionalInfo. Keep it inside the purchase additionalInfo.",
    "Sélecteur de valeur fixe retourné dans additionalInfo de l’offre. Conservez-le dans additionalInfo de l’achat.",
  ],
  useLocalAmount: [
    "Biller denomination setting from the selected offer.",
    "Paramètre de valeur du fournisseur issu de l’offre choisie.",
  ],
  inputCurrencyCode: [
    "Input currency setting required by the biller.",
    "Paramètre de devise d’entrée requis par le fournisseur.",
  ],
  serviceId: [
    "Provider service selector from the relevant account lookup. It is not a Fondeka wallet or route ID.",
    "Sélecteur de service fournisseur issu de la recherche du compte. Ce n’est pas un identifiant de portefeuille ni de route Fondeka.",
  ],
  customerId: [
    "Provider customer selector from lookup, not the API owner’s Fondeka account ID.",
    "Sélecteur de client fournisseur issu de la recherche, pas l’identifiant du compte Fondeka propriétaire.",
  ],
  requestedAmount: [
    "Optional original-input amount, paired with requestedCurrency inside additionalInfo for the existing multi-currency flow. Omit both to use amount and currency.",
    "Montant d’entrée initial facultatif, associé à requestedCurrency dans additionalInfo pour le parcours multidevise existant. Omettez les deux pour utiliser amount et currency.",
  ],
  requestedCurrency: [
    "Original-input currency paired with requestedAmount. Keep the pair together inside additionalInfo.",
    "Devise d’entrée initiale associée à requestedAmount. Conservez la paire dans additionalInfo.",
  ],
  metaData: [
    "Existing opaque provider metadata. Preserve string values exactly on retries.",
    "Métadonnées fournisseur opaques existantes. Conservez exactement les valeurs texte lors des relances.",
  ],
  providerFields: [
    "Existing provider inputs as a key/value list or an object keyed by field name. The selected provider must support them; existing validation remains enforced.",
    "Champs fournisseur existants en liste clé/valeur ou objet indexé par nom. Le fournisseur choisi doit les prendre en charge ; les validations existantes restent appliquées.",
  ],
};

export const billFieldDefinitions: Record<string, Definitions> = {
  BusinessApiBillRequest: {
    ...identity,
    amount: money.amount,
    currency: money.currency,
    maxFee: [
      "Optional maximum bill fee. A higher fee rejects the payment before any debit.",
      "Frais de facture maximum facultatifs. Des frais supérieurs refusent le paiement avant débit.",
    ],
    maxGrossAmount: [
      "Optional maximum total debit, including fees. Omit to use current bill pricing.",
      "Débit total maximum facultatif, frais inclus. Omettez-le pour utiliser les tarifs actuels.",
    ],
    additionalInfo: [
      "Optional biller inputs and selectors, such as invoiceId or TV operation/subscription. Omit when unnecessary. It cannot override core amount, currency, owner identity, wallet, provider routes or price limits. Conflicting flat and nested selectors are rejected.",
      "Champs et sélecteurs fournisseur facultatifs, comme invoiceId ou l’opération/l’abonnement TV. Omettez-les si inutiles. Ils ne peuvent remplacer montant, devise, identité propriétaire, portefeuille, routes ou limites de prix. Les sélecteurs plats et imbriqués contradictoires sont refusés.",
    ],
  },
  BillPayment: billPayment,
  Account: {
    accountNumber: identity.accountNumber,
    name: [
      "Customer name when returned by lookup. Some providers return minimal information.",
      "Nom du client si retourné par la recherche. Certains fournisseurs donnent peu d’informations.",
    ],
    additionalInfo: [
      "Relevant lookup data such as address, subscriptions or payment requirements. Select the needed values; do not copy display data blindly into a purchase. Internal costs and provider configuration are excluded.",
      "Données pertinentes de recherche : adresse, abonnements ou exigences de paiement. Sélectionnez les valeurs utiles sans recopier aveuglément les données d’affichage dans un achat. Coûts internes et configuration fournisseur sont exclus.",
    ],
  },
  Lookup: {
    accountNumber: identity.accountNumber,
    displayCurrency: [
      "Optional fiat display currency for lookup prices.",
      "Devise fiat facultative d’affichage des prix de la recherche.",
    ],
    additionalInfo: [
      "Optional lookup-specific information, such as invoiceId. It reaches the existing opaque metadata input and starts no payment.",
      "Informations de recherche facultatives, comme invoiceId. Elles alimentent les métadonnées opaques existantes sans démarrer de paiement.",
    ],
  },
  ProductSummary: {
    code: item.code,
    name: item.name,
    displayName: ["Product label shown to customers.", "Libellé du produit affiché aux clients."],
    category: [
      "Product category, such as electricity, water or TV.",
      "Catégorie du produit, par exemple électricité, eau ou TV.",
    ],
  },
  Offer: {
    ...item,
    note: [
      "Optional customer-facing note returned only when relevant.",
      "Note destinée au client, retournée uniquement si pertinente.",
    ],
    additionalInfo: [
      "Extra offer requirements, such as amountId, requiresInvoice or useLocalAmount.",
      "Exigences supplémentaires de l’offre, comme amountId, requiresInvoice ou useLocalAmount.",
    ],
  },
  Option: item,
  BillAction: {
    action: [
      "Follow-up action on an existing payment. REACTIVATE currently refreshes a completed, owned TV subscription using its captured details. Unsupported actions reject without side effects.",
      "Action de suivi sur un paiement existant. REACTIVATE rafraîchit actuellement un abonnement TV terminé et détenu, avec ses détails enregistrés. Les actions non prises en charge sont refusées sans effet.",
    ],
    additionalInfo: [
      "Optional action information reserved for supported follow-up behavior. It cannot replace the captured subscriber or subscription used by REACTIVATE.",
      "Informations d’action facultatives réservées aux comportements de suivi pris en charge. Elles ne peuvent remplacer l’abonné ou l’abonnement enregistré utilisé par REACTIVATE.",
    ],
  },
  PagedModelBillPayment: {
    content: [
      "Compact bill payments in this page, scoped to the authenticated Business and environment.",
      "Factures compactes de cette page, limitées au Business et à l’environnement authentifiés.",
    ],
    page: [
      "Zero-based page number, page size and result totals for bill history.",
      "Numéro de page à partir de zéro, taille et totaux de l’historique de factures.",
    ],
  },
  Payment: {
    ...billPayment,
    action: [
      "Business API action included in the bill webhook payload. Bills use BUSINESS_API_BILL_PAYMENT; the compact bill HTTP resource omits this field.",
      "Action de l’API Business dans le webhook de facture. Les factures utilisent BUSINESS_API_BILL_PAYMENT ; la ressource HTTP compacte omet ce champ.",
    ],
    service: [
      "Fondeka service in the bill webhook payload: BUSINESS_API. It is omitted from compact bill HTTP responses.",
      "Service Fondeka dans le webhook de facture : BUSINESS_API. Il est omis des réponses HTTP compactes de factures.",
    ],
    cryptoDetails: [
      "Optional crypto details in the shared webhook schema. Bill purchases use the fiat wallet and do not consume a crypto balance.",
      "Détails crypto facultatifs du schéma webhook partagé. Les factures utilisent le portefeuille fiat, sans consommer de solde crypto.",
    ],
  },
  BusinessApiBillWebhookEvent: {
    createdAt: [
      "Time the immutable terminal event snapshot was created, separate from delivery-attempt timestamps.",
      "Date de création de l’instantané final immuable, distincte des horodatages de tentative de livraison.",
    ],
    data: [
      "Bill webhook data includes service, action and billProductCode. HTTP responses use the smaller BillPayment resource. Verify the signature before fulfillment.",
      "Les données webhook incluent service, action et billProductCode. Les réponses HTTP utilisent BillPayment, plus compact. Vérifiez la signature avant livraison.",
    ],
    environment,
    id: [
      "Stable event UUID, also in X-Fondeka-Event-Id. Deduplicate before fulfillment.",
      "UUID stable de l’événement, aussi dans X-Fondeka-Event-Id. Dédupliquez-le avant livraison.",
    ],
    type: [
      "business_api.bill_payment.completed or business_api.bill_payment.failed. Unresolved or provider-review purchases emit no terminal event.",
      "business_api.bill_payment.completed ou business_api.bill_payment.failed. Les achats indéterminés ou en revue fournisseur n’émettent aucun événement final.",
    ],
  },
  BusinessApiPaymentQuoteResource: {
    ...money,
    environment,
    action: [
      "Collection or payout being priced with the same route and destination rules as acceptance.",
      "Encaissement ou décaissement tarifé selon les mêmes règles de route et destination qu’à l’acceptation.",
    ],
    amount: [
      "Net fiat amount after the quoted collection or payout fee, in currency.",
      "Montant fiat net après les frais du devis d’encaissement ou décaissement, dans currency.",
    ],
    fee: [
      "One consolidated fiat collection or payout fee.",
      "Frais fiat consolidés d’encaissement ou décaissement.",
    ],
    grossAmount: [
      "Quoted gross fiat amount including fees; the payout wallet debit. A quote reserves nothing.",
      "Montant fiat brut du devis, frais inclus ; débit du portefeuille pour un décaissement. Le devis ne réserve rien.",
    ],
    binding: [
      "Always false. The quote reserves neither a price nor funds.",
      "Toujours false. Le devis ne réserve ni prix ni fonds.",
    ],
    calculatedAt: [
      "Time the current-price calculation finished; no validity period is guaranteed.",
      "Date de fin du calcul du prix actuel ; aucune période de validité n’est garantie.",
    ],
    currency: [
      "Fiat denomination of the quoted collection or payout amounts.",
      "Devise fiat des montants du devis d’encaissement ou décaissement.",
    ],
    feeApplicationMode: [
      "EXCLUSIVE adds fees to the requested net; INCLUSIVE deducts fees from the requested gross.",
      "EXCLUSIVE ajoute les frais au net demandé ; INCLUSIVE les déduit du brut demandé.",
    ],
    service: [
      "Fondeka service owning the quoted collection or payout: BUSINESS_API.",
      "Service Fondeka auquel appartient le devis d’encaissement ou décaissement : BUSINESS_API.",
    ],
  },
};
