import type { BusinessApiTopic } from "./business-api-docs";
export type GuideCopy = readonly [en: string, fr: string];
export type GuideField = {
  key: string;
  note: GuideCopy;
  in?: "header" | "response";
};
export type GuideExample = {
  method: "GET" | "POST";
  path: string;
  fields: GuideField[];
  exampleName?: string;
  incoming?: boolean;
  paymentAction?: "BUSINESS_API_COLLECTION" | "BUSINESS_API_PAYOUT";
  responseFocus?: "cryptoDetails";
  paymentKind?: "MOBILE_MONEY" | "CRYPTO";
};
export type GuideLesson = {
  id: string;
  title: GuideCopy;
  summary: GuideCopy;
  flow: readonly [GuideCopy, GuideCopy, GuideCopy];
  presentation?: "payload";
  example?: GuideExample;
  confirmation?: {
    lookup: GuideExample;
    webhook: GuideExample;
  };
  tips?: GuideCopy[];
  resources?: {
    file: string;
    label: GuideCopy;
  }[];
  check?: {
    question: GuideCopy;
    answers: GuideCopy[];
    correct: number;
    explanation: GuideCopy;
  };
};
export type GuideTrack = {
  id: BusinessApiTopic["id"];
  title: GuideCopy;
  summary: GuideCopy;
  tone: "green" | "blue" | "violet" | "amber" | "teal" | "rose";
  icon:
    | "map"
    | "rocket"
    | "collect"
    | "send"
    | "crypto-collect"
    | "crypto-send"
    | "states"
    | "webhook"
    | "test"
    | "live"
    | "history";
  lessons: GuideLesson[];
};
const base = "/business-api/v1/businesses/{businessId}";
const field = (key: string, en: string, fr: string, location?: GuideField["in"]): GuideField => ({
  key,
  note: [en, fr],
  in: location,
});
const amount = field(
  "amount",
  "Normal fiat units, with at most two decimals. 10 means 10 USD, never 10 cents or 10 tokens.",
  "Unités fiat normales, avec deux décimales maximum. 10 signifie 10 USD, jamais 10 centimes ou 10 jetons.",
);
const currency = field(
  "currency",
  "The fiat wallet currency. It stays fiat even when the customer pays with crypto.",
  "La devise du portefeuille fiat, même lorsque le client paie en crypto.",
);
const method = field(
  "paymentMethodName",
  "The stable method code, not a translated name. LIVE availability depends on the configured route.",
  "Le code stable du moyen de paiement, pas son nom traduit. La disponibilité LIVE dépend de la route configurée.",
);
const fees = field(
  "feeApplicationMode",
  "EXCLUSIVE adds fees to the requested net. INCLUSIVE deducts fees from the requested gross.",
  "EXCLUSIVE ajoute les frais au montant net demandé. INCLUSIVE déduit les frais du montant brut demandé.",
);
const intent = field(
  "Idempotency-Key",
  "One key per logical payment. After a timeout, retry the identical body with this same key.",
  "Une clé par intention de paiement. Après un délai dépassé, renvoyez le même corps avec cette même clé.",
  "header",
);
const network = field(
  "networkName",
  "Choose a supported method/network pair. Use the exact network returned in the payment instructions.",
  "Choisissez une paire moyen/réseau prise en charge. Utilisez le réseau exact des instructions de paiement.",
);
function paymentExample(payout = false, crypto = false): GuideExample {
  return {
    method: "POST",
    path: `${base}/${payout ? "payouts" : "collections"}`,
    exampleName: crypto ? "crypto" : "mobileMoney",
    paymentKind: crypto ? "CRYPTO" : "MOBILE_MONEY",
    responseFocus: crypto ? "cryptoDetails" : undefined,
    fields: [
      amount,
      currency,
      method,
      ...(crypto ? [network] : []),
      ...(!crypto || payout
        ? [
            field(
              "accountRef",
              payout
                ? crypto
                  ? "The recipient’s crypto address on networkName. Use the exact address on the selected network."
                  : "The recipient’s international mobile-money phone number."
                : "The payer’s international phone number. The customer may need to approve a prompt on this phone.",
              payout
                ? crypto
                  ? "L’adresse crypto du bénéficiaire sur networkName. Utilisez l’adresse exacte sur le réseau choisi."
                  : "Le numéro mobile money international du bénéficiaire."
                : "Le numéro international du payeur. Le client peut devoir approuver une demande sur ce téléphone.",
            ),
          ]
        : []),
      fees,
      intent,
    ],
  };
}
const lookup: GuideExample = {
  method: "GET",
  path: `${base}/transactions/{reference}`,
  fields: [
    field(
      "fondekaReference",
      "Save fondekaReference exactly and use it in /transactions/{reference}. The URL parameter name is unchanged.",
      "Conservez fondekaReference telle quelle et utilisez-la dans /transactions/{reference}. Le nom du paramètre de l’URL reste inchangé.",
      "response",
    ),
    field(
      "status",
      "ACCEPTED is queued; PROCESSING means execution has started or its outcome is unresolved. Keep polling both states. Only confirmed COMPLETED can support fulfillment after reconciliation.",
      "ACCEPTED est en file d’attente ; PROCESSING signifie que l’exécution a commencé ou que le résultat reste indéterminé. Poursuivez le suivi dans ces deux états. Seul COMPLETED confirmé permet la livraison après rapprochement.",
      "response",
    ),
  ],
};
const collectionEvent: GuideExample = {
  method: "POST",
  path: "https://merchant.example/fondeka/webhooks",
  incoming: true,
  fields: [
    field(
      "id",
      "Deduplicate this stable event ID and check it matches X-Fondeka-Event-Id. Delivery is at least once.",
      "Dédupliquez cet identifiant stable et comparez-le à X-Fondeka-Event-Id. La livraison est au moins une fois.",
    ),
    field(
      "data",
      "Use your Business webhook secret. Check both environments, fondekaReference, status, currency and amount before fulfillment.",
      "Utilisez le secret webhook de votre Business. Vérifiez les deux environnements, fondekaReference, le statut, la devise et amount avant livraison.",
    ),
  ],
};
function confirmationExamples(
  payout = false,
  crypto = false,
): NonNullable<GuideLesson["confirmation"]> {
  const paymentAction = payout ? "BUSINESS_API_PAYOUT" : "BUSINESS_API_COLLECTION";
  return {
    lookup: {
      ...lookup,
      paymentAction,
      paymentKind: crypto ? "CRYPTO" : "MOBILE_MONEY",
      responseFocus: crypto ? "cryptoDetails" : undefined,
    },
    webhook: { ...collectionEvent, paymentAction, paymentKind: crypto ? "CRYPTO" : "MOBILE_MONEY" },
  };
}
const completionCheck: GuideLesson["check"] = {
  question: [
    "A 202 response arrives. Can you fulfill the order?",
    "Vous recevez une réponse 202. Pouvez-vous livrer la commande ?",
  ],
  answers: [
    ["Yes, the request was accepted", "Oui, la demande a été acceptée"],
    [
      "Wait for confirmed completion and reconcile",
      "Attendre la confirmation et rapprocher le paiement",
    ],
  ],
  correct: 1,
  explanation: [
    "202 accepts queued work. Match Business, environment, currency and settlement before fulfillment.",
    "202 accepte le traitement. Vérifiez le Business, l’environnement, la devise et le règlement avant de livrer.",
  ],
};
const paidFlow = [
  ["Your server", "Votre serveur"],
  ["Fondeka", "Fondeka"],
  ["Fiat wallet", "Portefeuille fiat"],
] as const;
const deliveryFlow = [
  ["Signed event", "Événement signé"],
  ["Verify + store", "Vérifier + stocker"],
  ["Fulfill once", "Livrer une fois"],
] as const;
export const apiGuideTracks: GuideTrack[] = [
  {
    id: "overview",
    title: ["Payments for your business", "Les paiements pour votre activité"],
    summary: [
      "Collect and send mobile-money and crypto payments from your application, with settlement in your account’s fiat wallets.",
      "Encaissez et envoyez des paiements mobile money et crypto depuis votre application, avec règlement dans les portefeuilles fiat de votre compte.",
    ],
    icon: "map",
    tone: "blue",
    lessons: [
      {
        id: "map",
        title: ["What the API does", "Ce que fait l’API"],
        summary: [
          "Mobile money and crypto are available today. Bill payments and other services may be added in future releases.",
          "Le mobile money et la crypto sont disponibles aujourd’hui. Le paiement de factures et d’autres services pourront être ajoutés dans de futures versions.",
        ],
        flow: paidFlow,
      },
    ],
  },
  {
    id: "quickstart",
    title: ["Get ready to integrate", "Préparez votre intégration"],
    summary: [
      "Your Business ID, API key and webhook signing secret. Everything you need to get started.",
      "Votre Business ID, votre clé API et votre secret de signature webhook. L’essentiel pour commencer.",
    ],
    icon: "rocket",
    tone: "rose",
    lessons: [
      {
        id: "setup",
        title: ["Integration essentials", "Les essentiels de l’intégration"],
        summary: [
          "Find your Business ID and create your sandbox credentials.",
          "Retrouvez votre Business ID et créez vos identifiants sandbox.",
        ],
        flow: [
          ["Business ID", "Business ID"],
          ["API key", "Clé API"],
          ["Ready to integrate", "Prêt à intégrer"],
        ],
      },
    ],
  },
  {
    id: "mobile-money-collection",
    title: ["Mobile-money collections", "Encaissements mobile money"],
    summary: [
      "The customer approves. Your fiat wallet receives confirmed net funds.",
      "Le client approuve. Votre portefeuille fiat reçoit le net confirmé.",
    ],
    icon: "collect",
    tone: "green",
    lessons: [
      {
        id: "request",
        title: ["Collection request", "Requête d’encaissement"],
        summary: [
          "A collection identifies the payer by their international phone number and a configured method/currency pair.",
          "Un encaissement identifie le payeur par son numéro international et une paire moyen/devise configurée.",
        ],
        flow: [
          ["Customer phone", "Téléphone client"],
          ["Approval", "Approbation"],
          ["Fiat wallet", "Portefeuille fiat"],
        ],
        example: paymentExample(),
        tips: [
          [
            "These examples use SANDBOX credentials. LIVE ignores the X-Simulate-Error-Code header and processes a real payment; availability and limits depend on the route.",
            "Ces exemples utilisent des clés SANDBOX. LIVE ignore l’en-tête X-Simulate-Error-Code et traite un paiement réel ; disponibilité et limites dépendent de la route.",
          ],
        ],
      },
      {
        id: "confirmation",
        title: ["Two ways to check the payment", "Deux façons de vérifier le paiement"],
        summary: [
          "Look up the current transaction or receive a signed webhook. Both report the outcome of the same payment.",
          "Consultez la transaction actuelle ou recevez un webhook signé. Les deux indiquent le résultat du même paiement.",
        ],
        flow: [
          ["Payment reference", "Référence du paiement"],
          ["Lookup or webhook", "Consultation ou webhook"],
          ["Confirmed outcome", "Résultat confirmé"],
        ],
        confirmation: confirmationExamples(),
        check: completionCheck,
      },
    ],
  },
  {
    id: "mobile-money-payout",
    title: ["Mobile-money payouts", "Décaissements mobile money"],
    summary: [
      "A payout reserves the gross fiat amount once and reports the recipient’s payment outcome.",
      "Un décaissement réserve le montant fiat brut une fois et indique le résultat du paiement au bénéficiaire.",
    ],
    icon: "send",
    tone: "blue",
    lessons: [
      {
        id: "request",
        title: ["Payout request", "Requête de décaissement"],
        summary: [
          "The account wallet covers the gross amount. accountRef is the recipient’s mobile-money phone number.",
          "Le portefeuille du compte couvre le montant brut. accountRef est le numéro mobile money du bénéficiaire.",
        ],
        flow: [
          ["Fiat wallet", "Portefeuille fiat"],
          ["Gross reserved", "Brut réservé"],
          ["Recipient phone", "Téléphone bénéficiaire"],
        ],
        example: paymentExample(true),
      },
      {
        id: "refund",
        title: ["Two ways to check the payout", "Deux façons de vérifier le décaissement"],
        summary: [
          "Completion never debits twice. A failed payout does not automatically mean refunded.",
          "La confirmation ne débite jamais deux fois. Un échec ne signifie pas automatiquement un remboursement.",
        ],
        flow: [
          ["Accepted", "Accepté"],
          ["Track reference", "Suivre la référence"],
          ["Reconcile", "Rapprocher"],
        ],
        confirmation: confirmationExamples(true),
        check: {
          question: [
            "A payout is FAILED. Is its wallet refund confirmed?",
            "Un décaissement est FAILED. Son remboursement est-il confirmé ?",
          ],
          answers: [
            ["The wallet has been refunded", "Le portefeuille a été remboursé"],
            [
              "Reconcile; no refund is confirmed",
              "Rapprocher ; aucun remboursement n’est confirmé",
            ],
          ],
          correct: 1,
          explanation: [
            "Check wallet records or contact support to confirm the refund. Failure status alone cannot.",
            "Consultez les écritures du portefeuille ou l’assistance pour confirmer le remboursement. L’état d’échec ne suffit pas.",
          ],
        },
      },
    ],
  },
  {
    id: "crypto-collection",
    title: ["Crypto collections", "Encaissements crypto"],
    summary: [
      "A crypto collection creates a fiat-priced external invoice and returns exact token payment instructions.",
      "Un encaissement crypto crée une facture externe en fiat et retourne les instructions exactes de paiement en crypto.",
    ],
    icon: "crypto-collect",
    tone: "violet",
    lessons: [
      {
        id: "invoice",
        title: ["Crypto collection request", "Requête d’encaissement crypto"],
        summary: [
          "USDT is the payment method. USD is the fiat price. No payer address is required.",
          "USDT est le moyen de paiement. USD est le prix fiat. Aucune adresse payeur n’est requise.",
        ],
        flow: [
          ["Fiat amount", "Montant fiat"],
          ["Crypto invoice", "Facture crypto"],
          ["Fiat settlement", "Règlement fiat"],
        ],
        example: paymentExample(false, true),
        tips: [
          [
            "An external invoice never spends the merchant’s own crypto balance.",
            "Une facture externe ne consomme jamais le solde crypto du marchand.",
          ],
        ],
      },
      {
        id: "instructions",
        title: ["Invoice instructions", "Instructions de facture"],
        summary: [
          "cryptoDetails is omitted until instructions are ready. Refresh the existing fondekaReference; do not create a second invoice.",
          "cryptoDetails est omis tant que les instructions ne sont pas prêtes. Actualisez fondekaReference ; ne créez pas une seconde facture.",
        ],
        flow: [
          ["Reference", "Référence"],
          ["Invoice ready", "Facture prête"],
          ["Exact instructions", "Instructions exactes"],
        ],
        example: {
          ...lookup,
          responseFocus: "cryptoDetails",
          fields: [
            field(
              "cryptoDetails",
              "Omitted while invoice creation is queued. Once available, use the exact returned address, network, token amount and expiry.",
              "Omis pendant la création de facture. Utilisez ensuite l’adresse, le réseau, le montant crypto et l’expiration exacts retournés.",
              "response",
            ),
            field(
              "amount",
              "Reconcile actual confirmed net settlement. Underpayments and overpayments can change this amount.",
              "Rapprochez le règlement net réel confirmé. Un paiement insuffisant ou excédentaire peut modifier ce montant.",
              "response",
            ),
          ],
        },
        check: {
          question: [
            "Does amount:10 with currency:USD mean 10 USDT?",
            "amount:10 avec currency:USD signifie-t-il 10 USDT ?",
          ],
          answers: [
            ["Yes, it is the token quantity", "Oui, c’est la quantité de jetons"],
            ["No, use cryptoDetails.amountInCrypto", "Non, utilisez cryptoDetails.amountInCrypto"],
          ],
          correct: 1,
          explanation: [
            "Request amounts are always fiat. Token instructions come from the provider quote; never pay an expired invoice.",
            "Les montants demandés sont toujours fiat. Les instructions crypto viennent du devis fournisseur ; ne payez jamais une facture expirée.",
          ],
        },
      },
      {
        id: "confirmation",
        title: ["Two ways to confirm settlement", "Deux façons de confirmer le règlement"],
        summary: [
          "Look up the existing transaction or verify its signed webhook, then reconcile the actual fiat settlement.",
          "Consultez la transaction existante ou vérifiez son webhook signé, puis rapprochez le règlement fiat réel.",
        ],
        flow: [
          ["Payment reference", "Référence du paiement"],
          ["Lookup or webhook", "Consultation ou webhook"],
          ["Fiat settlement", "Règlement fiat"],
        ],
        confirmation: confirmationExamples(false, true),
        tips: [
          [
            "Use amount in the confirmed currency for the completed collection’s net credit. Compare it with the original order amount; crypto underpayments or overpayments can differ from the quote.",
            "Utilisez amount dans la devise confirmée pour le crédit net de l’encaissement terminé. Comparez-le au montant de commande initial ; un paiement crypto insuffisant ou excédentaire peut différer du devis.",
          ],
        ],
        check: completionCheck,
      },
    ],
  },
  {
    id: "crypto-payout",
    title: ["Crypto payouts", "Décaissements crypto"],
    summary: [
      "A crypto payout debits a fiat wallet and sends the quoted token amount on the selected network.",
      "Un décaissement crypto débite un portefeuille fiat et envoie le montant crypto coté sur le réseau choisi.",
    ],
    icon: "crypto-send",
    tone: "teal",
    lessons: [
      {
        id: "destination",
        title: ["Crypto payout request", "Requête de décaissement crypto"],
        summary: [
          "accountRef is the recipient’s crypto address. networkName identifies the network for that address.",
          "accountRef est l’adresse crypto du bénéficiaire. networkName identifie le réseau de cette adresse.",
        ],
        flow: [
          ["Fiat gross", "Brut fiat"],
          ["Token quote", "Devis crypto"],
          ["Crypto address", "Adresse crypto"],
        ],
        example: paymentExample(true, true),
        tips: [
          [
            "Wrong-network transfers can be unrecoverable. LIVE method/network availability and payout eligibility must be confirmed.",
            "Les transferts sur un mauvais réseau peuvent être irrécupérables. Confirmez la disponibilité LIVE et l’éligibilité au décaissement.",
          ],
        ],
      },
      {
        id: "reconcile",
        title: ["Two ways to check the payout", "Deux façons de vérifier le décaissement"],
        summary: [
          "Track the existing payment through unknown outcomes. The wallet debit remains fiat-denominated.",
          "Suivez le paiement existant lorsque le résultat est inconnu. Le débit du portefeuille reste en fiat.",
        ],
        flow: [
          ["Reference", "Référence"],
          ["Confirmation", "Confirmation"],
          ["Reconciliation", "Rapprochement"],
        ],
        confirmation: confirmationExamples(true, true),
        check: {
          question: [
            "A payout times out. Which retry is safe?",
            "Un décaissement dépasse le délai. Quelle relance est correcte ?",
          ],
          answers: [
            [
              "Same key, identical body, reconcile the reference",
              "Même clé, corps identique, rapprochement de la référence",
            ],
            ["A new key for a replacement payout", "Une nouvelle clé pour un autre décaissement"],
          ],
          correct: 0,
          explanation: [
            "A timeout does not prove failure. Preserve the accepted intent and investigate unresolved outcomes.",
            "Un délai dépassé ne prouve pas un échec. Conservez l’intention acceptée et examinez les résultats non résolus.",
          ],
        },
      },
    ],
  },
  {
    id: "concepts",
    title: ["Follow the money", "Suivez les fonds"],
    summary: [
      "Net, fees, gross and actual settlement each have a different job.",
      "Net, frais, brut et règlement réel jouent chacun un rôle précis.",
    ],
    icon: "states",
    tone: "blue",
    lessons: [
      {
        id: "wallets",
        title: ["Read your account wallets", "Consultez vos portefeuilles"],
        summary: [
          "LIVE credentials read real fiat balances. SANDBOX credentials read virtual balances, shared across the account’s Businesses.",
          "Les clés LIVE consultent les soldes fiat réels. Les clés SANDBOX consultent les soldes virtuels, partagés entre les Business du compte.",
        ],
        flow: paidFlow,
        example: {
          method: "GET",
          path: base + "/wallets",
          fields: [
            field(
              "balance",
              "The available account balance in this currency and environment.",
              "Le solde disponible du compte dans cette devise et cet environnement.",
              "response",
            ),
            field(
              "environment",
              "Determined by the API key. The portal environment switch does not change a credential’s environment.",
              "Déterminé par la clé API. Le sélecteur du portail ne change pas l’environnement d’une clé.",
              "response",
            ),
          ],
        },
      },
      {
        id: "amounts",
        title: ["Read an amount breakdown", "Lisez le détail des montants"],
        summary: [
          "Illustrative sandbox fees: 10 USD net + 0.30 USD fees = 10.30 USD gross.",
          "Frais sandbox illustratifs : 10 USD nets + 0,30 USD de frais = 10,30 USD bruts.",
        ],
        flow: [
          ["10 USD net", "10 USD nets"],
          ["+ 0.30 USD fees", "+ 0,30 USD de frais"],
          ["10.30 USD gross", "10,30 USD bruts"],
        ],
        example: {
          ...lookup,
          fields: [
            field(
              "amount",
              "Net fiat amount after fees. A completed collection shows the actual wallet credit; before completion, this is the accepted quote.",
              "Montant fiat net après frais. Pour un encaissement terminé, c’est le crédit réel du portefeuille ; avant confirmation, c’est le devis accepté.",
              "response",
            ),
            field(
              "fee",
              "One combined fee in the payment’s fiat currency. grossAmount = amount + fee.",
              "Les frais totaux dans la devise fiat du paiement. grossAmount = amount + fee.",
              "response",
            ),
            field(
              "grossAmount",
              "Net amount plus fee. Accepted payouts reserve/debit this amount once; completed collections show the reconciled gross.",
              "Montant net plus frais. Les décaissements acceptés réservent/débitent ce montant une fois ; les encaissements terminés indiquent le brut réel.",
              "response",
            ),
          ],
        },
      },
      {
        id: "states",
        title: ["Separate acceptance from completion", "Distinguez acceptation et confirmation"],
        summary: [
          "ACCEPTED is queued. PROCESSING is executing or unresolved. COMPLETED and FAILED are final.",
          "ACCEPTED est en file d’attente. PROCESSING est en cours d’exécution ou indéterminé. COMPLETED et FAILED sont finaux.",
        ],
        flow: [
          ["ACCEPTED", "ACCEPTED"],
          ["PROCESSING", "PROCESSING"],
          ["COMPLETED / FAILED", "COMPLETED / FAILED"],
        ],
        tips: [
          [
            "Collections credit only after confirmation. Payouts debit/reserve gross at acceptance and never debit again on completion.",
            "Les encaissements créditent après confirmation. Les décaissements réservent/débitent le brut à l’acceptation, jamais une seconde fois à la confirmation.",
          ],
          [
            "FAILED includes cancellation/expiry; check wallet records or support for refunds. PROCESSING includes unresolved provider/manual review: keep fondekaReference and do not automatically replace.",
            "FAILED inclut annulation/expiration ; vérifiez les écritures du portefeuille ou contactez l’assistance pour les remboursements. PROCESSING inclut les rapprochements fournisseur/manuels non résolus : conservez fondekaReference, sans remplacement automatique.",
          ],
        ],
        check: completionCheck,
      },
    ],
  },
  {
    id: "webhooks",
    title: [
      "Turn events into trusted updates",
      "Transformez les événements en mises à jour fiables",
    ],
    summary: [
      "Verify. Store. Acknowledge. Fulfill once.",
      "Vérifiez. Stockez. Acquittez. Livrez une fois.",
    ],
    icon: "webhook",
    tone: "violet",
    lessons: [
      {
        id: "envelope",
        title: ["Inspect the event envelope", "Examinez l’enveloppe de l’événement"],
        summary: [
          "A terminal event contains a complete payment snapshot, not just a status.",
          "Un événement final contient un instantané complet du paiement, pas seulement un état.",
        ],
        flow: deliveryFlow,
        example: collectionEvent,
      },
      {
        id: "verify",
        title: ["Verify the exact bytes", "Vérifiez les octets exacts"],
        summary: [
          "HMAC-SHA256(signing secret, timestamp + '.' + raw body). Compare in constant time.",
          "HMAC-SHA256(secret de signature, timestamp + '.' + corps brut). Comparez en temps constant.",
        ],
        flow: [
          ["Raw bytes", "Octets bruts"],
          ["HMAC + ±300s", "HMAC + ±300 s"],
          ["Durable inbox", "Boîte durable"],
        ],
        resources: [
          {
            file: "examples/node/webhook.mjs",
            label: ["Node.js verification example", "Exemple de vérification Node.js"],
          },
          {
            file: "examples/python/webhook.py",
            label: ["Python verification example", "Exemple de vérification Python"],
          },
        ],
        tips: [
          [
            "Read X-Fondeka-Timestamp and X-Fondeka-Signature (v1=lowercase hex). Use the webhook secret, not the API key. Parse JSON only after verification.",
            "Lisez X-Fondeka-Timestamp et X-Fondeka-Signature (v1=hex minuscule). Utilisez le secret webhook, pas la clé API. Analysez le JSON après vérification.",
          ],
          [
            "Commit the verified event before 2xx. Retries: up to 10 attempts; event ID/body stay fixed, timestamp/signature change. No ordering guarantee.",
            "Validez le stockage avant 2xx. Jusqu’à 10 tentatives ; identifiant/corps fixes, timestamp/signature renouvelés. Aucun ordre garanti.",
          ],
        ],
        check: {
          question: [
            "Which secret verifies the webhook signature?",
            "Quel secret vérifie la signature webhook ?",
          ],
          answers: [
            ["The API key", "La clé API"],
            ["The separate webhook signing secret", "Le secret de signature webhook distinct"],
          ],
          correct: 1,
          explanation: [
            "Keep the last configured receiver and original signing secret for accepted payments, even after key revocation. During a URL change, keep the previous receiver available for attempts already in flight.",
            "Gardez le dernier récepteur configuré et le secret de signature d’origine pour les paiements acceptés, même après révocation. Lors d’un changement d’URL, gardez l’ancien récepteur disponible pour les tentatives déjà en cours.",
          ],
        },
      },
    ],
  },
  {
    id: "testing",
    title: ["Practice the difficult outcomes", "Entraînez-vous aux cas difficiles"],
    summary: [
      "Test failures and retries with virtual funds before going live.",
      "Testez échecs et relances avec des fonds virtuels avant la production.",
    ],
    icon: "test",
    tone: "amber",
    lessons: [
      {
        id: "error-codes",
        title: ["Discover endpoint errors", "Découvrez les erreurs par endpoint"],
        summary: [
          "Read the catalog before choosing a simulation.",
          "Consultez le catalogue avant de choisir une simulation.",
        ],
        flow: [
          ["Endpoint", "Endpoint"],
          ["Request or processing", "Requête ou traitement"],
          ["Supported code", "Code pris en charge"],
        ],
        example: { method: "GET", path: `${base}/error-codes`, fields: [] },
      },
      {
        id: "scenarios",
        title: ["Choose an endpoint error", "Choisissez une erreur de l’endpoint"],
        summary: [
          "Use a new logical intent when changing a processing failure. Accepted retries preserve the original code.",
          "Créez une nouvelle intention pour changer d’échec de traitement. Les relances acceptées conservent le code d’origine.",
        ],
        flow: [
          ["Error code", "Code d’erreur"],
          ["Sandbox worker", "Traitement sandbox"],
          ["Expected state", "État attendu"],
        ],
        example: {
          ...paymentExample(),
          fields: [
            field(
              "X-Simulate-Error-Code",
              "Test how your integration handles an error without contacting a real payment provider.",
              "Testez la gestion d’une erreur par votre intégration sans contacter de fournisseur de paiement réel.",
              "header",
            ),
            intent,
          ],
        },
      },
      {
        id: "fund",
        title: ["Add virtual funds", "Ajoutez des fonds virtuels"],
        summary: [
          "Funding is synchronous, account-scoped and isolated from real wallets.",
          "L’approvisionnement est synchrone, au niveau du compte et isolé des portefeuilles réels.",
        ],
        flow: [
          ["Virtual top-up", "Approvisionnement virtuel"],
          ["Sandbox wallet", "Portefeuille sandbox"],
          ["Test payout", "Décaissement de test"],
        ],
        example: {
          method: "POST",
          path: `${base}/sandbox-wallets/top-ups`,
          fields: [
            field(
              "amount",
              "From 0.01 to 1,000,000 units per top-up. Maximum 100 new top-ups per account/currency wallet per UTC day; identical replay uses no extra quota slot.",
              "De 0,01 à 1 000 000 d’unités par apport. Maximum 100 nouveaux apports par portefeuille de compte et de devise, par jour UTC ; une relance identique ne consomme pas de quota.",
            ),
            currency,
            intent,
          ],
        },
        tips: [
          [
            "Read /wallets and /sandbox-wallets/USD/entries?page=0&size=20. History totals live in the response’s page object.",
            "Consultez /wallets et /sandbox-wallets/USD/entries?page=0&size=20. Les totaux de l’historique sont dans l’objet page.",
          ],
        ],
      },
      {
        id: "convert",
        title: ["Quote, then convert", "Obtenez un devis, puis convertissez"],
        summary: [
          "A quote reserves nothing. Execute separately with an idempotency key and current synthetic rates.",
          "Un devis ne réserve rien. Exécutez séparément avec une clé d’idempotence et les taux synthétiques actuels.",
        ],
        flow: [
          ["USD quote", "Devis USD"],
          ["Confirm conversion", "Confirmer la conversion"],
          ["EUR wallet", "Portefeuille EUR"],
        ],
        example: {
          method: "POST",
          path: `${base}/sandbox-wallets/convert/quote`,
          fields: [
            amount,
            field(
              "sourceCurrency",
              "The fiat wallet to debit. Source and target must differ and have configured fixture rates.",
              "Le portefeuille fiat à débiter. Source et cible doivent différer et disposer de taux de test configurés.",
            ),
            field(
              "targetCurrency",
              "The fiat wallet to credit. POST /sandbox-wallets/convert executes with the same fields plus an Idempotency-Key header.",
              "Le portefeuille fiat à créditer. POST /sandbox-wallets/convert exécute avec les mêmes champs et un en-tête Idempotency-Key.",
            ),
          ],
        },
        check: {
          question: [
            "A request times out. Should you generate a new key?",
            "Une requête dépasse le délai. Faut-il créer une nouvelle clé ?",
          ],
          answers: [
            [
              "No, recover using the same key and body",
              "Non, récupérez le résultat avec la même clé et le même corps",
            ],
            ["Yes, to start over", "Oui, pour recommencer"],
          ],
          correct: 0,
          explanation: [
            "Reconcile the original intent. HTTP 409 means a key was reused with different content; 429 requires backoff.",
            "Rapprochez l’intention d’origine. HTTP 409 indique une clé réutilisée avec un contenu différent ; 429 demande d’espacer les requêtes.",
          ],
        },
      },
      {
        id: "execute-conversion",
        title: ["Execute the conversion", "Exécutez la conversion"],
        summary: [
          "Confirm once with a stable idempotency key. The returned conversion links the debit and credit.",
          "Confirmez une fois avec une clé d’idempotence stable. La conversion retournée relie débit et crédit.",
        ],
        flow: [
          ["USD debit", "Débit USD"],
          ["Conversion", "Conversion"],
          ["EUR credit", "Crédit EUR"],
        ],
        example: {
          method: "POST",
          path: base + "/sandbox-wallets/convert",
          fields: [
            intent,
            field(
              "targetAmount",
              "The authoritative target amount from the backend, not a locally rounded estimate.",
              "Le montant cible de référence fourni par le backend, pas une estimation arrondie localement.",
              "response",
            ),
          ],
        },
      },
      {
        id: "history",
        title: ["Read the wallet ledger", "Lisez le registre du portefeuille"],
        summary: [
          "Entries are immutable and ordered by newest sequence. Read zero-based pagination totals from page.",
          "Les écritures sont immuables, classées par séquence décroissante. Les totaux de pagination, à partir de zéro, se trouvent dans page.",
        ],
        flow: [
          ["Wallet", "Portefeuille"],
          ["Ledger entries", "Écritures"],
          ["Reconcile", "Rapprocher"],
        ],
        example: {
          method: "GET",
          path: base + "/sandbox-wallets/{currency}/entries",
          fields: [
            field(
              "page",
              "Zero-based page number. The response page object contains size, number, totalElements and totalPages.",
              "Numéro de page à partir de zéro. L’objet page de la réponse contient size, number, totalElements et totalPages.",
              "response",
            ),
          ],
        },
      },
    ],
  },
  {
    id: "go-live",
    title: ["Ready for your first live payment?", "Prêt pour votre premier paiement réel ?"],
    summary: [
      "Bring the same integration to production with separate LIVE credentials.",
      "Passez la même intégration en production avec des clés LIVE distinctes.",
    ],
    icon: "live",
    tone: "green",
    lessons: [
      {
        id: "prepare",
        title: ["Review production readiness", "Vérifiez votre préparation"],
        summary: [
          "Confirm route availability, fees, limits, account eligibility and payout funding.",
          "Confirmez routes, frais, limites, éligibilité du compte et fonds pour les décaissements.",
        ],
        flow: [
          ["Sandbox tested", "Sandbox testé"],
          ["LIVE key", "Clé LIVE"],
          ["Reconcile first payment", "Rapprocher le premier paiement"],
        ],
        tips: [
          [
            "Test duplicates, timeouts and failed payments. Deploy raw-byte webhook verification, durable storage and monitoring for unresolved outcomes.",
            "Testez doublons, délais dépassés et échecs. Déployez vérification webhook sur octets bruts, stockage durable et suivi des résultats non résolus.",
          ],
          [
            "Issue a separate LIVE key with your production HTTPS webhook URL. LIVE ignores the X-Simulate-Error-Code header. The base URL and v1 routes stay the same.",
            "Émettez une clé LIVE distincte avec l’URL webhook HTTPS de production. LIVE ignore l’en-tête X-Simulate-Error-Code. URL de base et routes v1 restent identiques.",
          ],
          [
            "Keep secrets server-side. Sandbox clients deliberately reject LIVE keys; deploy your reviewed production integration explicitly.",
            "Gardez les secrets côté serveur. Les clients sandbox refusent les clés LIVE ; déployez explicitement votre intégration de production validée.",
          ],
        ],
        check: {
          question: [
            "Does switching the portal header make a sandbox key LIVE?",
            "Changer l’en-tête du portail transforme-t-il une clé sandbox en LIVE ?",
          ],
          answers: [
            ["Yes", "Oui"],
            ["No, issue a separate LIVE credential", "Non, émettez une clé LIVE distincte"],
          ],
          correct: 1,
          explanation: [
            "The key selects the environment. First confirm a small valid live payment against its webhook, amounts and wallet movement.",
            "La clé sélectionne l’environnement. Vérifiez d’abord un petit paiement réel valide avec son webhook, ses montants et son mouvement de portefeuille.",
          ],
        },
      },
    ],
  },
  {
    id: "changelog",
    title: ["What’s in v1", "Ce que contient v1"],
    summary: [
      "Documentation contract 1.0.0 · 23 October 2026",
      "Contrat documentaire 1.0.0 · 23 octobre 2026",
    ],
    icon: "history",
    tone: "blue",
    lessons: [
      {
        id: "release",
        title: ["Meet the published contract", "Découvrez le contrat publié"],
        summary: [
          "Mobile money, crypto, wallet reads, sandbox funding/conversions and signed terminal events.",
          "Mobile money, crypto, lecture des portefeuilles, fonds/conversions sandbox et événements finaux signés.",
        ],
        flow: [
          ["Collect + send", "Encaisser + envoyer"],
          ["Track + verify", "Suivre + vérifier"],
          ["Reconcile", "Rapprocher"],
        ],
        tips: [
          [
            "Every merchant HTTP attempt returns a new X-Request-Id. Payment references and webhook event IDs serve different purposes.",
            "Chaque tentative HTTP marchande retourne un nouveau X-Request-Id. Les références de paiement et identifiants webhook ont des rôles distincts.",
          ],
          [
            "The /v1 path is the API major version; the OpenAPI info.version identifies the documentation release.",
            "Le chemin /v1 est la version majeure de l’API ; info.version d’OpenAPI identifie la version documentaire.",
          ],
        ],
      },
    ],
  },
];
type GuideMenuLink = { kind: "guide"; id: BusinessApiTopic["id"] };
type GuideCatalogLink = {
  kind: "catalog";
  id: "payment-methods";
  title: GuideCopy;
};
type UpcomingGuide = {
  kind: "upcoming";
  id: "electricity" | "tv";
  title: GuideCopy;
  icon: "electricity" | "tv";
  tone: GuideTrack["tone"];
};
export type GuideMenuGroup = {
  kind: "group";
  id: "payments" | "bills";
  title: GuideCopy;
  tone: GuideTrack["tone"];
  children: (GuideMenuLink | UpcomingGuide)[];
};
export const apiGuideMenuItems: (GuideMenuLink | GuideMenuGroup | GuideCatalogLink)[] = [
  { kind: "guide", id: "overview" },
  { kind: "guide", id: "quickstart" },
  {
    kind: "group",
    id: "payments",
    title: ["Payments", "Paiements"],
    tone: "green",
    children: [
      { kind: "guide", id: "mobile-money-collection" },
      { kind: "guide", id: "mobile-money-payout" },
      { kind: "guide", id: "crypto-collection" },
      { kind: "guide", id: "crypto-payout" },
    ],
  },
  {
    kind: "group",
    id: "bills",
    title: ["Pay Bills", "Payer des factures"],
    tone: "amber",
    children: [
      {
        kind: "upcoming",
        id: "electricity",
        title: ["Electricity", "Électricité"],
        icon: "electricity",
        tone: "amber",
      },
      {
        kind: "upcoming",
        id: "tv",
        title: ["TV subscription", "Abonnement TV"],
        icon: "tv",
        tone: "violet",
      },
    ],
  },
  { kind: "guide", id: "webhooks" },
  {
    kind: "catalog",
    id: "payment-methods",
    title: ["Available payment methods", "Moyens de paiement disponibles"],
  },
  { kind: "guide", id: "go-live" },
];
export const apiGuideMenuTracks = apiGuideMenuItems
  .flatMap((item) => (item.kind === "group" ? item.children : item.kind === "guide" ? [item] : []))
  .filter((item) => item.kind === "guide")
  .map((item) => guideTrack(item.id));
export function guideTrack(id: string) {
  return apiGuideTracks.find((track) => track.id === id) ?? apiGuideTracks[0];
}
export function guideLesson(track: GuideTrack, id?: string | null) {
  return track.lessons.find((lesson) => lesson.id === id) ?? track.lessons[0];
}
export const guideMilestoneIds = apiGuideTracks.flatMap((track) =>
  track.lessons.map((lesson) => `${track.id}:${lesson.id}`),
);
export function parseGuideProgress(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (id): id is string => typeof id === "string" && guideMilestoneIds.includes(id),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
