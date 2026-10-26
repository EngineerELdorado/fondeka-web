import { resolveGuideSchema, type ApiSchema, type GuideSpec } from "./api-guide-contract";
import type { GuideExample } from "./api-guide-content";

export type GuideFieldScope = "body" | "header" | "path" | "query" | "response";
export type GuideSchemaField = {
  name: string;
  path: string;
  depth: number;
  schema: ApiSchema;
  required: boolean;
  location: GuideFieldScope;
  component?: string;
};

function componentName(schema?: ApiSchema) {
  const reference = schema?.$ref || schema?.allOf?.find((part) => part.$ref)?.$ref;
  return reference?.startsWith("#/components/schemas/")
    ? reference.slice("#/components/schemas/".length)
    : undefined;
}

type SchemaStructure = string | { [key: string]: SchemaStructure } | SchemaStructure[];

/** Complete schema shape; leaf values are type labels, never fabricated payment data. */
export function guideSchemaStructure(spec: GuideSpec, schema?: ApiSchema): SchemaStructure {
  function shape(
    value: ApiSchema | undefined,
    ancestors: Set<string>,
    depth: number,
  ): SchemaStructure {
    const resolved = resolveGuideSchema(spec, value);
    const component = componentName(value) || componentName(resolved);
    const type = `${resolved.type || "object"}${resolved.nullable ? " | null" : ""}`;
    if (depth > 12 || (component && ancestors.has(component))) return type;
    const next = new Set(ancestors);
    if (component) next.add(component);
    if (resolved.type === "array") return [shape(resolved.items, next, depth + 1)];
    if (resolved.properties)
      return Object.fromEntries(
        Object.entries(resolved.properties).map(([key, property]) => [
          key,
          shape(property, next, depth + 1),
        ]),
      );
    return type;
  }
  return shape(schema, new Set(), 0);
}

/** Enumerate the complete declared shape, including nullable objects and array items. */
export function guideSchemaFields(
  spec: GuideSpec,
  schema: ApiSchema | undefined,
  location: GuideFieldScope,
  prefix = "",
): GuideSchemaField[] {
  function walk(
    value: ApiSchema | undefined,
    path: string,
    depth: number,
    ancestors: Set<string>,
  ): GuideSchemaField[] {
    if (!value || depth > 12) return [];
    const root = resolveGuideSchema(spec, value);
    const component = componentName(value) || componentName(root);
    if (component && ancestors.has(component)) return [];
    const nextAncestors = new Set(ancestors);
    if (component) nextAncestors.add(component);
    if (root.type === "array") return walk(root.items, `${path}[]`, depth, nextAncestors);
    return Object.entries(root.properties || {}).flatMap(([name, property]) => {
      const fieldPath = path ? `${path}.${name}` : name;
      return [
        {
          name,
          path: fieldPath,
          depth,
          component,
          schema: resolveGuideSchema(spec, property),
          required: root.required?.includes(name) || false,
          location,
        },
        ...walk(property, fieldPath, depth + 1, nextAncestors),
      ];
    });
  }
  return walk(schema, prefix, 0, new Set());
}

/** Keep documentation on the current payment page and its published request payload. */
export function guidePageFields(
  fields: GuideSchemaField[],
  example: GuideExample,
  body?: unknown,
): GuideSchemaField[] {
  const bodyPaths = new Set(
    body === undefined ? [] : guideCodePaths(JSON.stringify(body, null, 2)).filter(Boolean),
  );
  const kind =
    example.paymentKind ||
    (example.exampleName === "mobileMoney"
      ? "MOBILE_MONEY"
      : example.exampleName === "crypto" || example.responseFocus === "cryptoDetails"
        ? "CRYPTO"
        : undefined);
  return fields
    .filter((field) => {
      if (
        field.location === "body" &&
        !example.incoming &&
        body !== undefined &&
        !bodyPaths.has(field.path)
      )
        return false;
      if (kind === "MOBILE_MONEY" && /(?:^|\.)cryptoDetails\./.test(field.path)) return false;
      return true;
    })
    .map((field) => {
      if (field.location !== "body" || example.incoming || !kind) return field;
      const requiredForPage =
        field.path === "paymentMethodName" ||
        (field.path === "networkName" && kind === "CRYPTO") ||
        (field.path === "accountRef" &&
          (kind === "MOBILE_MONEY" || example.path.endsWith("/payouts")));
      return requiredForPage ? { ...field, required: true } : field;
    });
}

const missingContractDescriptions: Record<string, Record<string, string>> = {
  Balance: {
    environment:
      "The credential environment for this wallet: real funds in LIVE or virtual funds in SANDBOX.",
  },
  BusinessApiTransactionResource: {
    action: "Identifies whether this payment is a Business API collection or payout.",
    service:
      "Identifies the Fondeka service that owns this payment; BUSINESS_API for this resource.",
  },
  BusinessApiWebhookEvent: {
    type: "Identifies the collection or payout and its terminal outcome. It must match data.action and data.status.",
  },
  PageMetadata: {
    number: "Zero-based index of the returned page; the first page is 0.",
    size: "Configured number of entries per page, not the number of entries actually returned.",
    totalElements: "Total number of matching entries across every page.",
    totalPages: "Total number of pages available for this result and page size.",
  },
  PagedModelEntry: {
    content: "The sandbox wallet entries in this page, ordered by newest sequence first.",
    page: "Pagination metadata for the returned entries: page index, page size and result totals.",
  },
};

// Localized explanations follow the published schema; constraints and enums remain schema-derived.
const descriptionsFr: Record<string, Record<string, string>> = {
  Balance: {
    balance:
      "Solde disponible dans cet environnement. Les Business d’un même compte partagent les portefeuilles.",
    currency: "Code de la devise fiat du portefeuille, par exemple USD ou CDF.",
    environment: "Environnement de la clé : fonds réels en LIVE, fonds virtuels en SANDBOX.",
  },
  BusinessApiTransactionRequest: {
    accountRef:
      "Téléphone international du payeur pour un encaissement mobile money, ou téléphone/adresse crypto du bénéficiaire pour un décaissement. Facultatif pour un encaissement crypto.",
    amount:
      "Montant fiat dans currency, jamais une quantité de jetons. EXCLUSIVE demande le net ; INCLUSIVE demande le brut. Deux décimales maximum.",
    orderReference:
      "Votre référence de commande ou de facture, renvoyée dans le paiement et le webhook. Ce n’est pas une clé d’idempotence.",
    currency:
      "Code de la devise fiat de règlement ou du portefeuille débité. La disponibilité dépend de la route configurée.",
    feeApplicationMode:
      "EXCLUSIVE ajoute les frais au net demandé ; INCLUSIVE déduit les frais du brut demandé. null utilise la politique de la route, EXCLUSIVE par défaut en sandbox.",
    networkId:
      "Ancien identifiant du réseau crypto. Préférez networkName. Si les deux sont fournis, ils doivent correspondre.",
    networkName:
      "Code stable du réseau crypto. Obligatoire pour la crypto sauf si networkId est fourni. Le réseau doit être compatible avec le moyen de paiement.",
    paymentMethodId:
      "Ancien identifiant du moyen de paiement. Préférez paymentMethodName. Si les deux sont fournis, ils doivent correspondre.",
    paymentMethodName:
      "Code stable du moyen de paiement. Fournissez ce champ ou paymentMethodId. Un code présent dans la liste n’assure pas sa disponibilité sur la route.",
  },
  BusinessApiTransactionResource: {
    action: "Indique si ce paiement est un encaissement ou un décaissement de l’API Business.",
    amount:
      "Montant fiat net après frais. Pour un encaissement terminé, c’est le crédit net réel du portefeuille ; avant confirmation, c’est le devis accepté.",
    orderReference: "Référence de commande ou de facture fournie par votre intégration.",
    cryptoDetails:
      "Instructions de l’encaissement crypto ou destination du décaissement. Ce champ est omis pour le mobile money ou tant que les instructions ne sont pas disponibles.",
    currency: "Devise fiat utilisée pour amount, grossAmount et fee.",
    environment: "Environnement déterminé par la clé API, et non par l’URL.",
    failureCode:
      "Code sûr décrivant un échec de paiement, lorsqu’il est disponible. Ce n’est pas un code d’erreur HTTP.",
    failureMessage:
      "Message d’échec affichable lorsqu’il est fourni. Sa présence n’est pas garantie pour chaque résultat.",
    grossAmount:
      "Montant fiat brut, frais inclus, débité pour un décaissement. Pour un encaissement terminé, c’est le brut réellement reçu.",
    fee: "Frais fiat totaux, toutes composantes incluses. grossAmount = amount + fee.",
    fondekaReference:
      "Référence opaque Fondeka à conserver exactement pour consulter le paiement. Ne déduisez pas l’environnement de son format.",
    service: "Service Fondeka auquel appartient ce paiement : BUSINESS_API pour cette ressource.",
    status:
      "ACCEPTED : en file d’attente d’exécution. PROCESSING : exécution commencée ou résultat fournisseur/rapprochement indéterminé. COMPLETED : succès confirmé. FAILED : échec confirmé, y compris annulation ou expiration. Poursuivez le suivi de la même référence pour ACCEPTED et PROCESSING.",
  },
  BusinessApiWebhookEvent: {
    createdAt:
      "Date de création de l’instantané de l’événement, différente de l’horodatage d’une tentative de livraison.",
    data: "Instantané du paiement au moment de l’événement. Vérifiez l’environnement, fondekaReference, le statut, la devise et les montants. Utilisez le secret webhook de votre Business.",
    environment:
      "Doit correspondre à l’environnement attendu par votre intégration et à data.environment.",
    id: "Identifiant stable de l’événement, également fourni dans X-Fondeka-Event-Id. Dédupliquez cette valeur lors des nouvelles tentatives.",
    type: "Indique l’encaissement ou le décaissement et son résultat final. Doit correspondre à data.action et data.status.",
  },
  CryptoDetails: {
    address:
      "Adresse de paiement crypto pour un encaissement, ou adresse du bénéficiaire pour un décaissement, sur le réseau indiqué.",
    amountInCrypto:
      "Quantité exacte de jetons à payer ou envoyer. Cette valeur est distincte du montant fiat du paiement.",
    cryptoCurrency: "Devise ou jeton crypto, distinct de la devise fiat du paiement.",
    exchangeRate:
      "Taux du devis exprimé en unités exchangeRateCurrency par jeton. Les taux LIVE sont en USD par jeton ; les taux sandbox sont synthétiques.",
    exchangeRateCurrency:
      "Devise de exchangeRate : USD en LIVE, devise fiat du paiement en SANDBOX. Elle est distincte de la devise du portefeuille.",
    expiresAt: "Expiration éventuelle de la facture crypto. Ne payez pas une facture expirée.",
    invoiceUrl: "Lien éventuel vers la facture produite par le fournisseur externe.",
    network: "Code du réseau crypto à utiliser ; il doit correspondre à l’adresse de destination.",
  },
  Conversion: {
    createdAt: "Date de réalisation de la conversion. null pour un simple devis.",
    environment: "Toujours SANDBOX pour cette conversion de fonds virtuels.",
    feeAmount: "Frais dans la devise source, actuellement nuls en sandbox.",
    id: "Identifiant de la conversion réalisée. null tant qu’il s’agit d’un devis.",
    netSourceAmount: "Montant source après déduction des frais de conversion.",
    rate: "Nombre synthétique d’unités cibles par unité source. targetAmount reste la valeur de référence après arrondi.",
    sourceAmount: "Montant débité ou estimé dans la devise source.",
    sourceCurrency: "Devise du portefeuille débité.",
    sourceWallet: "Instantané du portefeuille source renvoyé par le backend.",
    status:
      "QUOTED ne réserve aucun fonds ; COMPLETED indique que les deux écritures ont été enregistrées atomiquement.",
    targetAmount: "Montant crédité dans la devise cible, arrondi à deux décimales.",
    targetCurrency: "Devise du portefeuille crédité.",
    targetWallet: "Instantané du portefeuille cible renvoyé par le backend.",
  },
  ConversionRequest: {
    amount: "Montant à convertir dans la devise source, avec deux décimales maximum.",
    sourceCurrency: "Devise fiat du portefeuille à débiter.",
    targetCurrency:
      "Devise fiat à créditer. Elle doit être différente de la source et disposer d’un taux de test configuré.",
  },
  Entry: {
    amount: "Montant signé de l’écriture : positif pour un crédit, négatif pour un débit.",
    balanceAfter: "Solde du portefeuille immédiatement après cette écriture.",
    businessId: "Business à l’origine de l’opération. Le portefeuille appartient au compte.",
    conversionId:
      "Identifiant commun reliant les écritures de débit et de crédit d’une conversion ; null pour les autres opérations.",
    createdAt: "Date de création de l’écriture.",
    currency: "Devise fiat de cette écriture.",
    environment: "Toujours SANDBOX pour ces écritures de fonds virtuels.",
    id: "Identifiant immuable de l’écriture dans le registre.",
    kind: "Motif du mouvement : financement, encaissement, décaissement, remboursement ou conversion.",
    paymentReference:
      "Référence du paiement sandbox lié. null pour les financements et les conversions.",
    sequence: "Numéro croissant qui détermine l’ordre des écritures.",
  },
  PageMetadata: {
    number: "Index de la page renvoyée, à partir de zéro. La première page est 0.",
    size: "Nombre d’écritures demandé par page, différent du nombre effectivement renvoyé.",
    totalElements: "Nombre total d’écritures correspondantes sur l’ensemble des pages.",
    totalPages: "Nombre total de pages disponibles pour ce résultat et cette taille de page.",
  },
  PagedModelEntry: {
    content: "Écritures sandbox de cette page, de la séquence la plus récente à la plus ancienne.",
    page: "Informations de pagination : index, taille et totaux du résultat.",
  },
  TopUp: {
    amount:
      "Montant de financement virtuel, avec deux décimales maximum. Aucun fonds réel n’est transféré.",
    currency: "Code de la devise fiat du portefeuille virtuel à financer.",
  },
  BusinessApiError: {
    access: "Résumé de l’accès actuel, lorsque le code BUSINESS_TOOLS_ACCESS_REQUIRED est renvoyé.",
    blacklistedReason: "Champ de compatibilité décrivant la restriction d’un compte.",
    code: "Alias de compatibilité réservé aux erreurs d’accès aux outils Business.",
    details:
      "Contexte structuré facultatif. Les erreurs de validation peuvent contenir fieldErrors ; les autres clés dépendent de la réponse du backend.",
    errorCode: "Code stable exploitable par votre programme pour identifier l’erreur de requête.",
    message:
      "Description lisible de l’erreur. Ne l’utilisez pas comme valeur de branchement dans votre code.",
    reason: "Champ de compatibilité décrivant la restriction d’un compte.",
    requestId: "Identifiant de support généré par le serveur, également présent dans X-Request-Id.",
    status: "Statut HTTP de la requête, également fourni dans statusCode.",
    statusCode: "Alias de compatibilité du statut HTTP fourni dans status.",
  },
};

const parameterDescriptionsFr: Record<string, string> = {
  "X-API-Key":
    "Clé secrète propre au Business, à conserver sur votre serveur. Elle détermine également l’environnement LIVE ou SANDBOX.",
  "Idempotency-Key":
    "Clé obligatoire par intention logique. Réutilisez-la avec un contenu identique pour les nouvelles tentatives ; un contenu différent provoque un conflit 409.",
  "X-Simulate-Error-Code":
    "Cet en-tête facultatif provoque une erreur de test en SANDBOX pour vérifier comment votre intégration la gère. LIVE ignore cet en-tête.",
  "X-Fondeka-Event-Id":
    "Identifiant stable de l’événement, identique à id dans le corps. Utilisez-le pour dédupliquer les livraisons.",
  "X-Fondeka-Timestamp":
    "Horodatage Unix en secondes de la tentative de livraison actuelle. Vérifiez sa fraîcheur avant de traiter l’événement.",
  "X-Fondeka-Signature":
    "Signature HMAC créée avec le secret webhook de la clé, et non avec la clé API. Vérifiez-la sur les octets bruts exacts.",
  businessId: "Business ID associé à votre clé API. Une clé d’un autre Business est refusée.",
  reference:
    "Valeur fondekaReference renvoyée lors de l’envoi, dans le même Business et le même environnement. Le paramètre de l’URL reste nommé reference.",
  currency:
    "Code de devise fiat, normalisé en majuscules. Pour la liste des portefeuilles, omettez ce filtre pour tous les retourner.",
  page: "Index de page à partir de zéro ; la première page est 0.",
  size: "Nombre d’écritures par page, entre 1 et 100, avec 20 par défaut.",
};

const catalogFieldDefinitions: Record<string, Record<string, readonly [string, string]>> = {
  BusinessApiErrorCatalogResource: {
    environment: [
      "The Business API environment described by this catalog.",
      "L’environnement API Business décrit par ce catalogue.",
    ],
    simulationHeader: [
      "The exact header name used to select an advertised sandbox error.",
      "Le nom exact de l’en-tête permettant de sélectionner une erreur sandbox annoncée.",
    ],
    simulationEnabled: [
      "Whether sandbox error simulation is enabled. LIVE never enables simulation.",
      "Indique si la simulation d’erreurs sandbox est activée. LIVE ne l’active jamais.",
    ],
    endpoints: [
      "Endpoint-specific availability, immediate request errors and deferred processing failures.",
      "Disponibilité, erreurs de requête immédiates et échecs de traitement différés par endpoint.",
    ],
  },
  Endpoint: {
    operationId: [
      "Stable operation identifier used to select this endpoint’s error definitions.",
      "Identifiant stable de l’opération permettant de sélectionner ses définitions d’erreur.",
    ],
    method: [
      "HTTP method of the documented merchant endpoint.",
      "Méthode HTTP de l’endpoint marchand documenté.",
    ],
    path: [
      "Merchant endpoint path template, including its Business and resource placeholders.",
      "Modèle de chemin marchand, avec ses paramètres Business et ressource.",
    ],
    available: [
      "Whether this endpoint is available in the catalog’s environment.",
      "Indique si cet endpoint est disponible dans l’environnement du catalogue.",
    ],
    additionalRequestErrorsPossible: [
      "LIVE policies or provider routing may produce additional request errors. Retain generic handling.",
      "Les règles LIVE ou le routage fournisseur peuvent produire d’autres erreurs. Conservez une gestion générique.",
    ],
    requestErrors: [
      "Immediate HTTP rejections identified by errorCode, with HTTP status and testing instructions.",
      "Refus HTTP immédiats identifiés par errorCode, avec statut HTTP et indications de test.",
    ],
    processingErrors: [
      "Failures after accepting a collection or payout. Polling and webhooks use the code as failureCode.",
      "Échecs après acceptation d’un encaissement ou décaissement. La consultation et les webhooks utilisent le code comme failureCode.",
    ],
  },
  RequestError: {
    httpStatus: [
      "Numeric HTTP status returned when this request is rejected; not a payment status.",
      "Statut HTTP numérique renvoyé lors du refus de la requête ; ce n’est pas un état de paiement.",
    ],
    errorCode: [
      "Stable business code in the immediate HTTP error envelope.",
      "Code métier stable de l’enveloppe d’erreur HTTP immédiate.",
    ],
    description: [
      "Backend explanation of this request rejection.",
      "Explication du backend concernant ce refus de requête.",
    ],
    howToTest: [
      "Backend instructions for exercising this error without assuming it can be simulated.",
      "Indications du backend pour tester cette erreur, sans présumer qu’elle peut être simulée.",
    ],
    simulatable: [
      "Whether this entry can be selected for simulation when the catalog also enables it.",
      "Indique si cette entrée peut être simulée lorsque le catalogue l’autorise également.",
    ],
    simulationValue: [
      "Exact value to send in simulationHeader for this error; omit the header for normal success.",
      "Valeur exacte à envoyer dans simulationHeader pour cette erreur ; omettez l’en-tête pour un succès normal.",
    ],
  },
  ProcessingError: {
    errorCode: [
      "Code exposed as failureCode in a failed payment and its terminal webhook.",
      "Code exposé comme failureCode dans le paiement échoué et son webhook final.",
    ],
    description: [
      "Backend explanation of the simulated failure after acceptance.",
      "Explication du backend concernant l’échec simulé après acceptation.",
    ],
    resultingStatus: [
      "Terminal payment status produced by this processing fixture, separate from HTTP status.",
      "État final du paiement produit par ce test de traitement, distinct du statut HTTP.",
    ],
    paymentMethodTypes: [
      "Payment-method types supported by this processing failure; do not offer it for other types.",
      "Types de moyens de paiement compatibles avec cet échec ; ne le proposez pas pour d’autres types.",
    ],
    simulatable: [
      "Whether this processing error may be simulated when simulationEnabled is true.",
      "Indique si cette erreur de traitement peut être simulée lorsque simulationEnabled vaut true.",
    ],
    simulationValue: [
      "Exact processing code to send in simulationHeader and retain with the original accepted intent.",
      "Code de traitement exact à envoyer dans simulationHeader et à conserver avec l’intention acceptée d’origine.",
    ],
  },
};

export function guideFieldDescription(
  field: GuideSchemaField,
  language: string,
  example?: GuideExample,
): { text: string; language: "en" | "fr" } {
  const catalogDefinition =
    field.component && catalogFieldDefinitions[field.component]?.[field.name];
  if (catalogDefinition)
    return {
      text: catalogDefinition[language === "fr" ? 1 : 0],
      language: language === "fr" ? "fr" : "en",
    };
  if (example?.incoming && field.path === "data.status")
    return {
      text:
        language === "fr"
          ? "État final du paiement : COMPLETED pour un succès ou FAILED pour un échec. Il correspond au type de l’événement. ACCEPTED et PROCESSING n’émettent pas d’événement final."
          : "The payment’s terminal status: COMPLETED for success or FAILED for failure, matching the event type. ACCEPTED and PROCESSING do not emit terminal events.",
      language: language === "fr" ? "fr" : "en",
    };
  if (field.location === "header" && field.name === "X-Simulate-Error-Code")
    return {
      text:
        language === "fr"
          ? "Cet en-tête facultatif provoque une erreur de test en SANDBOX pour vérifier comment votre intégration la gère. LIVE ignore cet en-tête."
          : "Use this optional header to make a SANDBOX test return an error, so you can check how your integration handles it. LIVE ignores this header.",
      language: language === "fr" ? "fr" : "en",
    };
  if (example?.paymentKind === "MOBILE_MONEY" && field.name === "cryptoDetails")
    return {
      text:
        language === "fr"
          ? "Ce champ est omis pour les paiements mobile money."
          : "This field is omitted for mobile-money payments.",
      language: language === "fr" ? "fr" : "en",
    };
  if (example && field.location === "body" && field.name === "accountRef") {
    const hint = example.fields.find((item) => item.key === "accountRef" && !item.in);
    if (hint)
      return {
        text: hint.note[language === "fr" ? 1 : 0],
        language: language === "fr" ? "fr" : "en",
      };
    if (example.exampleName === "crypto" && example.path.endsWith("/collections"))
      return {
        text:
          language === "fr"
            ? "Ce champ n’est pas requis pour un encaissement crypto. Fondeka renvoie l’adresse de paiement dans cryptoDetails.address lorsque les instructions de facture sont prêtes."
            : "Not required for a crypto collection. Fondeka returns the payment address in cryptoDetails.address when the invoice instructions are ready.",
        language: language === "fr" ? "fr" : "en",
      };
  }
  const translated = field.component
    ? descriptionsFr[field.component]?.[field.name]
    : parameterDescriptionsFr[field.name];
  if (language === "fr" && translated) return { text: translated, language: "fr" };
  return {
    text:
      field.schema.description ||
      (field.component && missingContractDescriptions[field.component]?.[field.name]) ||
      "",
    language: "en",
  };
}

/** Paths for pretty-printed JSON lines, so nested selections highlight the right property. */
export function guideCodePaths(code: string): string[] {
  try {
    const value = JSON.parse(code);
    if (JSON.stringify(value, null, 2) !== code) return [];
    const paths: string[] = [];
    function visit(current: unknown, path: string, line: number) {
      if (!current || typeof current !== "object") return;
      let cursor = line + 1;
      const entries = Array.isArray(current)
        ? current.map((item) => ["[]", item] as const)
        : Object.entries(current);
      for (const [key, child] of entries) {
        const childPath = key === "[]" ? `${path}[]` : path ? `${path}.${key}` : key;
        paths[cursor] = childPath;
        visit(child, childPath, cursor);
        cursor += JSON.stringify(child, null, 2).split("\n").length;
      }
    }
    visit(value, "", 0);
    return paths;
  } catch {
    return [];
  }
}
