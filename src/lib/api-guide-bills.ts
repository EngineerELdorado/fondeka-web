import type { GuideExample, GuideLesson, GuideTrack } from "./api-guide-content";

const base = "/business-api/v1/businesses/{businessId}";
const product = `${base}/bill-products/{billProductCode}`;
const flow = [
  ["Your server", "Votre serveur"],
  ["Fondeka", "Fondeka"],
  ["Response", "Réponse"],
] as const;
const example = (method: "GET" | "POST", path: string, exampleName?: string): GuideExample => ({
  method,
  path,
  exampleName,
  completeRequestFields: method === "POST",
  fields: [],
});
const purchase = (
  name: "standard" | "invoice" | "tvRenewal" | "tvChange" = "standard",
): GuideExample => ({
  ...example("POST", `${base}/bill-payments`, name),
  paymentAction: "BUSINESS_API_BILL_PAYMENT",
  paymentKind: "BALANCE",
  completeRequestFields: true,
  fields: [
    {
      key: name === "standard" ? "billProductCode" : "additionalInfo",
      note: [
        "Use the same payment envelope for every supported bill. Extra biller inputs belong inside additionalInfo; no category-specific endpoint is needed.",
        "Utilisez la même enveloppe pour chaque facture prise en charge. Les champs fournisseur supplémentaires vont dans additionalInfo ; aucun endpoint propre à la catégorie n’est nécessaire.",
      ],
    },
    {
      key: "Idempotency-Key",
      in: "header",
      note: [
        "One distinct key per logical payment. Retain the original normalized intent, price caps and sandbox scenario after a timeout. Keys share the Business/environment namespace with collections and payouts.",
        "Une clé distincte par paiement logique. Conservez l’intention normalisée, les limites de prix et le scénario sandbox après un délai dépassé. Les clés partagent le périmètre Business/environnement des encaissements et décaissements.",
      ],
    },
  ],
});
function lesson(
  id: string,
  title: GuideLesson["title"],
  summary: GuideLesson["summary"],
  endpoint: GuideExample,
  tips?: GuideLesson["tips"],
  billCategory?: string,
): GuideLesson {
  return { id, title, summary, flow, example: endpoint, tips, billCategory };
}

const payTvExamples: NonNullable<GuideLesson["exampleVariants"]> = [
  {
    title: ["Renew subscription", "Renouveler l’abonnement"],
    summary: [
      "Choose the subscription from account lookup and send TV_RENEW with subscriptionNumber inside additionalInfo. Use the amount and currency from the subscription; fees are applied automatically.",
      "Choisissez l’abonnement retourné par la recherche et envoyez TV_RENEW avec subscriptionNumber dans additionalInfo. Utilisez son montant et sa devise ; les frais sont appliqués automatiquement.",
    ],
    example: purchase("tvRenewal"),
  },
  {
    title: ["Change subscription", "Changer l’abonnement"],
    summary: [
      "Send TV_CHANGE with subscriptionNumber, offerCode and optionCode inside additionalInfo. The option must belong to the selected offer. Use the selected package’s amount and currency; the backend validates them and applies fees.",
      "Envoyez TV_CHANGE avec subscriptionNumber, offerCode et optionCode dans additionalInfo. L’option doit appartenir à l’offre choisie. Utilisez le montant et la devise du forfait choisi ; le backend les valide et applique les frais.",
    ],
    example: purchase("tvChange"),
  },
];

export const billPaymentsTrack: GuideTrack = {
  id: "bill-payments",
  title: ["Bill payments", "Paiements de factures"],
  summary: [
    "Pay electricity, water and TV bills using product codes and your fiat balance.",
    "Payez les factures d’électricité, d’eau et de TV avec les codes produits et votre solde fiat.",
  ],
  icon: "bills",
  tone: "amber",
  lessons: [
    lesson(
      "discover",
      ["Get bill products", "Obtenir les produits"],
      ["", ""],
      example("GET", `${base}/bill-products`),
      [
        [
          "The current catalog includes non-gift-card electricity, water and TV only, in both environments. Gift cards and other categories are excluded. Product code, name and category are strings so future values need no new client enum or URL. New billers still require backend/provider support and eligibility configuration.",
          "Le catalogue actuel inclut uniquement l’électricité, l’eau et la TV hors cartes cadeaux, dans les deux environnements. Les autres catégories et cartes cadeaux sont exclues. code, name et category sont des chaînes : les futures valeurs ne nécessitent ni nouvelle énumération ni URL. Tout nouveau fournisseur exige encore une prise en charge backend/fournisseur et une configuration d’éligibilité.",
        ],
      ],
    ),
    lesson(
      "product",
      ["Get a bill product", "Obtenir un produit"],
      [
        "Returns code, name, displayName and category. Use the product code for your selected market, such as SOCODEE, VIRUNGA or SNEL.",
        "Retourne code, name, displayName et category. Utilisez le code produit du marché choisi, comme SOCODEE, VIRUNGA ou SNEL.",
      ],
      example("GET", product),
      [
        [
          "Use the returned code in product paths and billProductCode in payments. Product names and codes may differ. Numeric product IDs are not accepted.",
          "Utilisez le code retourné dans les chemins produit et billProductCode dans les paiements. Les noms et codes produits peuvent différer. Les identifiants produits numériques ne sont pas acceptés.",
        ],
      ],
    ),
    lesson(
      "offers",
      ["Get product offers", "Obtenir les offres du produit"],
      [
        "Returns code, name, price and currency, with a note or additionalInfo when needed. displayCurrency is optional. The backend applies current pricing when you pay.",
        "Retourne code, name, price et currency, avec une note ou additionalInfo si nécessaire. displayCurrency est facultatif. Le backend applique les tarifs actuels au paiement.",
      ],
      example("GET", `${product}/offers`),
      [
        [
          "Put required offer inputs, such as amountId or useLocalAmount, inside the payment’s additionalInfo. amountId is a biller selector, not a Fondeka database ID.",
          "Placez les champs d’offre requis, comme amountId ou useLocalAmount, dans additionalInfo du paiement. amountId est un sélecteur fournisseur, pas un identifiant de base de données Fondeka.",
        ],
      ],
    ),
    lesson(
      "options",
      ["Get offer's options", "Obtenir les options de l’offre"],
      [
        "Options belong to the selected product’s offer. For TV_CHANGE, choose both offerCode and optionCode from the matching discovery results and send them inside additionalInfo.",
        "Les options appartiennent à l’offre du produit choisi. Pour TV_CHANGE, choisissez offerCode et optionCode dans les résultats correspondants et envoyez-les dans additionalInfo.",
      ],
      example("GET", `${product}/offers/{offerCode}/options`),
    ),
    lesson(
      "account-lookup",
      ["Get Account details", "Obtenir les détails du compte"],
      [
        "Send accountNumber with optional displayCurrency and additionalInfo. Lookup starts no payment. The response contains accountNumber, name when available and relevant additionalInfo, such as address, subscriptions or payment requirements.",
        "Envoyez accountNumber avec displayCurrency et additionalInfo facultatifs. La recherche ne démarre aucun paiement. La réponse contient accountNumber, name si disponible et additionalInfo pertinent : adresse, abonnements ou exigences de paiement.",
      ],
      example("POST", `${product}/account-lookup`, "account"),
      [
        [
          "Select the needed subscription, offer and payment requirements. Do not blindly copy lookup display data into a purchase. Subscription identifiers, prices, expiry, renewal availability and notes are retained; internal costs, FX rates and provider configuration are excluded.",
          "Sélectionnez l’abonnement, l’offre et les exigences de paiement utiles. Ne recopiez pas aveuglément les données d’affichage dans un achat. Identifiants, prix, expiration, disponibilité de renouvellement et notes sont conservés ; coûts internes, taux FX et configuration fournisseur sont exclus.",
        ],
      ],
    ),
    lesson(
      "electricity-estimate",
      ["Estimate electricity (kWh)", "Estimer l’électricité (kWh)"],
      [
        "Check the estimated kWh for an electricity product before paying. Send the bill amount, excluding fees, and its fiat currency. No account number, Idempotency-Key or funded wallet is required.",
        "Consultez les kWh estimés d’un produit d’électricité avant de payer. Envoyez le montant de la facture, hors frais, et sa devise fiat. Aucun numéro de compte, Idempotency-Key ou portefeuille alimenté n’est requis.",
      ],
      example("POST", `${product}/electricity-estimate`, "electricity"),
      [
        [
          "estimatedKwh uses the current bill route’s configured rate, currency conversion and provider rounding. If it is null, show “Estimate unavailable”, never zero. Only electricity products are supported; use a product code from the catalog.",
          "estimatedKwh utilise le taux configuré de la route de facturation, la conversion de devise et l’arrondi fournisseur actuels. Si sa valeur est null, affichez « Estimation indisponible », jamais zéro. Seuls les produits d’électricité sont pris en charge ; utilisez un code du catalogue.",
        ],
        [
          "binding is false. This read creates no payment, token or wallet movement and reserves no price or energy. Actual delivered kWh can differ; use the completed payment receipt for confirmation.",
          "binding vaut false. Cette consultation ne crée aucun paiement, jeton ou mouvement de portefeuille et ne réserve ni prix ni énergie. Les kWh réellement livrés peuvent différer ; confirmez-les avec le reçu du paiement terminé.",
        ],
        [
          "SANDBOX uses a synthetic fixture of 5 kWh per requested fiat unit, regardless of currency: 10 USD returns 50 kWh. It does not use live tariffs, FX or providers. Debounce estimates and honor Retry-After when rate limited.",
          "SANDBOX utilise une valeur fictive de 5 kWh par unité fiat demandée, quelle que soit la devise : 10 USD retourne 50 kWh. Aucun tarif, taux de change ou fournisseur réel n’est utilisé. Espacez les estimations et respectez Retry-After en cas de limitation.",
        ],
      ],
      "ELECTRICITY",
    ),
    lesson(
      "additional-info",
      ["Supply biller-specific information", "Fournir les informations du fournisseur"],
      [
        "Only billProductCode, accountNumber, amount and currency are required for the common request. Omit additionalInfo when no extra input is needed. An invoice requirement, for example, uses additionalInfo.invoiceId on the same payment URL.",
        "Seuls billProductCode, accountNumber, amount et currency sont requis par la requête commune. Omettez additionalInfo si aucun champ supplémentaire n’est nécessaire. Une exigence de facture utilise par exemple additionalInfo.invoiceId sur la même URL de paiement.",
      ],
      purchase("invoice"),
      [
        [
          "Supported selectors include invoiceId, amountId, useLocalAmount, inputCurrencyCode, serviceId, customerId, subscriptionNumber, offerCode, optionCode and operation. Original-input requestedAmount/requestedCurrency stay paired. Existing opaque metaData strings and providerFields remain available; providerFields accepts a key/value list or keyed object.",
          "Les sélecteurs pris en charge incluent invoiceId, amountId, useLocalAmount, inputCurrencyCode, serviceId, customerId, subscriptionNumber, offerCode, optionCode et operation. requestedAmount/requestedCurrency restent appariés. Les chaînes metaData opaques et providerFields restent disponibles ; providerFields accepte une liste clé/valeur ou un objet indexé.",
        ],
        [
          "Other biller inputs use the existing provider-fields channel. Scalars remain field values; objects and arrays become stable JSON values. The chosen backend/provider must support the input. additionalInfo cannot override core amount, currency, identity, wallet, provider routes or price caps; conflicting flat/nested selectors reject.",
          "Les autres champs fournisseur utilisent le canal provider-fields existant. Les scalaires restent des valeurs ; objets et tableaux deviennent du JSON stable. Le backend/fournisseur choisi doit prendre le champ en charge. additionalInfo ne peut remplacer montant, devise, identité, portefeuille, routes ou limites de prix ; les sélecteurs plats/imbriqués contradictoires sont refusés.",
        ],
      ],
    ),
    lesson(
      "request",
      ["Pay Electricity bill", "Payer une facture d’électricité"],
      [
        "Submit the bill directly with a unique Idempotency-Key. The backend validates it, calculates fees and debits the total automatically. No review or confirmation step is needed. HTTP 202 means accepted, not completed.",
        "Envoyez directement la facture avec une Idempotency-Key unique. Le backend la valide, calcule les frais et débite le total automatiquement. Aucune étape de vérification ou confirmation n’est nécessaire. HTTP 202 signifie accepté, pas terminé.",
      ],
      purchase(),
      [
        [
          "maxFee and maxGrossAmount are optional automated spend limits. Exceeding a limit rejects the payment before any debit. Responses include amount, fee, grossAmount and currency for reconciliation.",
          "maxFee et maxGrossAmount sont des limites de dépense automatisées facultatives. Tout dépassement refuse le paiement avant débit. La réponse contient amount, fee, grossAmount et currency pour le rapprochement.",
        ],
        [
          "After a timeout, repeat the same key and equivalent normalized input, including caps and the sandbox scenario. Equivalent old flat fields and new additionalInfo selectors map to the same intent; regrouping them does not cause another debit. Preserve opaque strings exactly. Changed intent returns 409 IDEMPOTENCY_CONFLICT. orderReference is for correlation, not idempotency.",
          "Après un délai dépassé, répétez la même clé et les mêmes données normalisées, limites et scénario sandbox compris. Les anciens champs plats et les sélecteurs additionalInfo équivalents correspondent à la même intention ; leur regroupement ne provoque aucun second débit. Conservez exactement les chaînes opaques. Une intention différente retourne 409 IDEMPOTENCY_CONFLICT. orderReference sert au rapprochement, pas à l’idempotence.",
        ],
        [
          "Keep ACCEPTED and PROCESSING under the original reference. An equivalent generic bill already processing may return 409 INVALID_REQUEST; investigate it before any replacement. Historical reads and matching retries remain available after product removal or new-LIVE-payment disabling, with a valid non-revoked key.",
          "Conservez la référence d’origine pour ACCEPTED et PROCESSING. Une facture générique équivalente en cours peut retourner 409 INVALID_REQUEST ; examinez-la avant tout remplacement. L’historique et les relances identiques restent disponibles après retrait du produit ou désactivation des nouveaux paiements LIVE, avec une clé valide non révoquée.",
        ],
      ],
      "ELECTRICITY",
    ),
    {
      ...lesson(
        "television",
        ["Pay TV", "Payer la TV"],
        [
          "Renew or change a TV subscription using the product code returned by the catalog. The examples use CANAL_PLUS_DRC for Canal+ in DRC.",
          "Renouvelez ou changez un abonnement TV avec le code produit retourné par le catalogue. Les exemples utilisent CANAL_PLUS_DRC pour Canal+ en RDC.",
        ],
        payTvExamples[0].example,
      ),
      exampleVariants: payTvExamples,
      billCategory: "TELEVISION",
    },
    lesson(
      "confirmation",
      ["Follow status and webhooks", "Suivre les états et webhooks"],
      [
        "Poll fondekaReference or receive the signed terminal webhook. Bill HTTP responses use BillPayment without service/action. Webhooks retain their signing and event names, with billProductCode identifying the product and BUSINESS_API_BILL_PAYMENT in data.action.",
        "Consultez fondekaReference ou recevez le webhook final signé. Les réponses HTTP utilisent BillPayment sans service/action. Les webhooks conservent leurs signatures et noms, avec billProductCode pour le produit et BUSINESS_API_BILL_PAYMENT dans data.action.",
      ],
      example("GET", `${base}/bill-payments/{reference}`),
      [
        [
          "Verify raw-byte HMAC, timestamp, event ID, environments, reference, amounts and saved order mapping. ACCEPTED and PROCESSING are unresolved; never submit a replacement. Existing TV review/refund policy can retain rejected or uncertain purchases without a terminal webhook. FAILED does not imply refund: inspect refunded. A refund is never successful delivery.",
          "Vérifiez le HMAC sur les octets bruts, l’horodatage, l’identifiant, les environnements, la référence, les montants et la commande enregistrée. ACCEPTED et PROCESSING sont indéterminés ; ne créez aucun remplacement. La politique TV peut conserver les achats refusés ou incertains sans webhook final. FAILED n’implique pas un remboursement : vérifiez refunded. Un remboursement n’est jamais une livraison réussie.",
        ],
      ],
    ),
    lesson(
      "receipt",
      ["Read the receipt or electricity token", "Lire le reçu ou jeton d’électricité"],
      [
        "The receipt endpoint returns current status, refunded and available details. Delivery data depends on the product and may arrive later. Tokens appear only when supplied; nested TV data excludes internal costs and provider configuration.",
        "L’endpoint de reçu retourne l’état actuel, refunded et les details disponibles. La livraison dépend du produit et peut arriver plus tard. Les jetons figurent uniquement s’ils sont fournis ; les données TV imbriquées excluent les coûts internes et la configuration fournisseur.",
      ],
      example("GET", `${base}/bill-payments/{reference}/receipt`),
    ),
  ],
};

export const billPaymentMainLinks = [
  { id: "request", category: "ELECTRICITY", title: ["Pay Electricity", "Payer l’électricité"] },
  { id: "television", category: "TELEVISION", title: ["Pay TV", "Payer la TV"] },
] as const;

export const billPaymentReferenceLessons = billPaymentsTrack.lessons.filter(
  (lesson) =>
    !["offers", "options", "additional-info"].includes(lesson.id) &&
    !billPaymentMainLinks.some((item) => item.id === lesson.id),
);

export const paymentQuotesTrack: GuideTrack = {
  id: "payment-quotes",
  title: ["Quotes and price limits", "Devis et limites de prix"],
  summary: [
    "Preview collection and payout pricing for the exact destination. Review the fee and wallet total before accepting.",
    "Prévisualisez le prix des encaissements et décaissements pour la destination exacte. Vérifiez les frais et le total avant l’acceptation.",
  ],
  icon: "states",
  tone: "teal",
  lessons: [false, true].map((payout) =>
    lesson(
      payout ? "payout-quote" : "collection-quote",
      payout
        ? ["Quote a payout", "Devis de décaissement"]
        : ["Quote a collection", "Devis d’encaissement"],
      [
        "Quotes need no Idempotency-Key or funded wallet. They calculate current route, destination and fee rules without reserving funds, price, FX or provider availability. binding is false.",
        "Les devis n’exigent ni Idempotency-Key ni portefeuille alimenté. Ils calculent les règles actuelles de route, destination et frais sans réserver de fonds, prix, taux ou disponibilité fournisseur. binding vaut false.",
      ],
      {
        ...example("POST", `${base}/${payout ? "payouts" : "collections"}/quote`, "mobileMoney"),
        paymentKind: "MOBILE_MONEY",
      },
      [
        [
          "Copy fee and grossAmount into optional maxFee and maxGrossAmount on creation. A higher acceptance price returns 409 PAYMENT_PRICE_LIMIT_EXCEEDED without accepting or debiting. For INCLUSIVE, maxFee also protects the recipient’s net. Review a new quote before increasing caps; keep the original caps on accepted retries.",
          "Copiez fee et grossAmount dans maxFee et maxGrossAmount à la création. Un prix supérieur retourne 409 PAYMENT_PRICE_LIMIT_EXCEEDED sans acceptation ni débit. En INCLUSIVE, maxFee protège aussi le net reçu. Vérifiez un nouveau devis avant d’augmenter les limites et conservez les limites d’origine sur les relances acceptées.",
        ],
      ],
    ),
  ),
};
