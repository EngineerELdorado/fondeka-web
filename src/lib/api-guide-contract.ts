import type { GuideExample, GuideCopy } from "./api-guide-content";

export type ApiSchema = {
  $ref?: string;
  type?: string;
  description?: string;
  properties?: Record<string, ApiSchema>;
  additionalProperties?: boolean | ApiSchema;
  required?: string[];
  items?: ApiSchema;
  allOf?: ApiSchema[];
  oneOf?: ApiSchema[];
  anyOf?: ApiSchema[];
  enum?: string[];
  nullable?: boolean;
  deprecated?: boolean;
  example?: unknown;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
};
type ApiMedia = {
  schema?: ApiSchema;
  examples?: Record<string, { summary?: string; value: unknown }>;
};
export type ApiResponse = {
  description: string;
  content?: Record<string, ApiMedia>;
  headers?: Record<string, { $ref?: string; description?: string }>;
};
export type ApiParameter = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  example?: unknown;
  schema: ApiSchema;
};
export type ApiOperation = {
  operationId?: string;
  deprecated?: boolean;
  summary?: string;
  description?: string;
  parameters?: ApiParameter[];
  requestBody?: { content: Record<string, ApiMedia> };
  responses: Record<string, ApiResponse>;
};
export type GuideSpec = {
  openapi: string;
  info: { version: string };
  servers: { url: string }[];
  paths: Record<string, Partial<Record<"get" | "post", ApiOperation>>>;
  components: {
    schemas: Record<string, ApiSchema>;
    securitySchemes: Record<string, { description: string }>;
    callbacks: { TerminalPaymentEvent: Record<string, { post: ApiOperation }> };
  };
};
export function guideOperation(spec: GuideSpec, example: GuideExample): ApiOperation {
  const operation = example.incoming
    ? Object.values(spec.components.callbacks.TerminalPaymentEvent)[0]?.post
    : spec.paths[example.path]?.[example.method.toLowerCase() as "get" | "post"];
  if (!operation) throw new Error("This endpoint is not in the published contract.");
  if (example.incoming && operation.requestBody) {
    // The shared callback has collection/payout and bill variants. These guides use
    // the published collection event; keep its field explorer on that variant.
    return {
      ...operation,
      requestBody: {
        ...operation.requestBody,
        content: Object.fromEntries(
          Object.entries(operation.requestBody.content).map(([type, media]) => [
            type,
            {
              ...media,
              schema:
                media.schema?.oneOf?.find(
                  (schema) => schema.$ref === "#/components/schemas/BusinessApiWebhookEvent",
                ) || media.schema,
            },
          ]),
        ),
      },
    };
  }
  return operation;
}
export function resolveGuideSchema(spec: GuideSpec, value?: ApiSchema, depth = 0): ApiSchema {
  if (!value || depth > 8) return {};
  if (value.$ref) {
    const target = value.$ref.startsWith("#/components/schemas/")
      ? spec.components.schemas[value.$ref.slice("#/components/schemas/".length)]
      : undefined;
    return { ...resolveGuideSchema(spec, target, depth + 1), ...value };
  }
  const parts = (value.allOf || []).map((part) => resolveGuideSchema(spec, part, depth + 1));
  return {
    ...Object.assign({}, ...parts),
    ...value,
    ...(parts.length
      ? {
          properties: Object.assign({}, ...parts.map((part) => part.properties), value.properties),
          required: [
            ...new Set([
              ...parts.flatMap((part) => part.required || []),
              ...(value.required || []),
            ]),
          ],
        }
      : {}),
  };
}
export function guideMedia(content?: Record<string, ApiMedia>) {
  return content?.["application/json"] || Object.values(content || {})[0];
}
export function publishedExample(media?: ApiMedia, name?: string): unknown {
  const examples = media?.examples || {};
  return (name && examples[name] ? examples[name] : Object.values(examples)[0])?.value;
}
const paymentSnippetFieldOrder = [
  "environment",
  "service",
  "action",
  "orderReference",
  "fondekaReference",
  "amount",
  "fee",
  "grossAmount",
  "currency",
  "status",
];
/** Format guide examples with an illustrative reference, without changing source payloads. */
export function guidePaymentSnippet(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  if ("fondekaReference" in value) {
    const fields = { ...(value as Record<string, unknown>) };
    if (fields.service === "BUSINESS_API" && typeof fields.fondekaReference === "string")
      fields.fondekaReference = "TX683195274026";
    return Object.fromEntries([
      ...paymentSnippetFieldOrder
        .filter((key) => Object.hasOwn(fields, key))
        .map((key) => [key, fields[key]]),
      ...Object.entries(fields).filter(([key]) => !paymentSnippetFieldOrder.includes(key)),
    ]);
  }
  if ("data" in value) return { ...value, data: guidePaymentSnippet(value.data) };
  return value;
}
/** Use the DRC mobile-money example throughout the portal's JSON and cURL snippets. */
export function guideRequestBody(spec: GuideSpec, example: GuideExample): unknown {
  const body = publishedExample(
    guideMedia(guideOperation(spec, example).requestBody?.content),
    example.exampleName,
  );
  if (
    !example.incoming &&
    example.paymentKind === "MOBILE_MONEY" &&
    body &&
    typeof body === "object" &&
    !Array.isArray(body)
  )
    return { ...body, paymentMethodName: "MPESA_DRC", accountRef: "+243810000000" };
  return body;
}
export function guideHeaders(
  operation: ApiOperation,
  incoming = false,
  overrides: Record<string, string> = {},
) {
  const headers: Record<string, string> = incoming ? {} : { "X-API-Key": "$FONDEKA_API_KEY" };
  for (const parameter of operation.parameters || []) {
    if (parameter.in !== "header") continue;
    // Simulation is opt-in through the current Business/environment error catalog.
    if (["X-Simulate-Error-Code", "X-Fondeka-Test-Scenario"].includes(parameter.name)) continue;
    // A signature is not fabricated: use the documented format when no example is published.
    headers[parameter.name] = String(parameter.example ?? `<${parameter.name}>`);
    if (parameter.name === "Idempotency-Key" && operation.operationId === "createBillPayment")
      headers[parameter.name] = "bill-order-1-purchase";
  }
  if (operation.requestBody) headers["Content-Type"] = "application/json";
  return { ...headers, ...overrides };
}
export function contractCurl(
  spec: GuideSpec,
  example: GuideExample,
  body: unknown,
  headers: Record<string, string> = {},
) {
  if (example.incoming) return "";
  const operation = guideOperation(spec, example);
  const path = example.path
    .replace("{businessId}", "$FONDEKA_BUSINESS_ID")
    .replace("{reference}", "$FONDEKA_REFERENCE")
    .replace("{billProductCode}", "$FONDEKA_BILL_PRODUCT_CODE")
    .replace("{offerCode}", "$FONDEKA_OFFER_CODE")
    .replace("{currency}", "USD");
  return [
    `curl --fail-with-body -X ${example.method} "${spec.servers[0].url}${path}"`,
    ...Object.entries(guideHeaders(operation, false, headers)).map(
      ([key, value]) => `  -H "${key}: ${value}"`,
    ),
    ...(body === undefined ? [] : [`  --data '${JSON.stringify(body, null, 2)}'`]),
  ].join(" \\\n");
}
export const verifiedWebhookCompatibilityExample = [
  "// Only after raw-body signature verification and envelope validation.",
  "const fondekaReference = event.data.fondekaReference ?? event.data.reference;",
  "const orderReference = event.data.orderReference ?? event.data.clientReference;",
  "const fee = event.data.fee ?? event.data.allFees;",
].join("\n");

export const paymentStateGroups: {
  states: string[];
  note: GuideCopy;
  tone: string;
}[] = [
  {
    states: ["ACCEPTED"],
    note: [
      "ACCEPTED means the payment is queued for execution. Keep its reference and original idempotency key, and poll with backoff. Payout funds are reserved or debited at acceptance; bills debit the gross fiat amount once. An idempotent replay returns the current status, which may already have changed.",
      "ACCEPTED signifie que le paiement est en file d’attente d’exécution. Conservez sa référence et la clé d’idempotence d’origine, puis espacez les appels de suivi. Les fonds d’un décaissement sont réservés ou débités dès l’acceptation ; une facture débite une fois le brut fiat. Une relance idempotente retourne l’état actuel, qui peut déjà avoir changé.",
    ],
    tone: "queued",
  },
  {
    states: ["PROCESSING"],
    note: [
      "PROCESSING means execution has started or a provider/reconciliation result is unresolved. Keep polling the same reference with backoff. Retrying a previously started job does not return it to ACCEPTED; a timeout is not proof of failure.",
      "PROCESSING signifie que l’exécution a commencé ou que le résultat du fournisseur ou du rapprochement reste indéterminé. Continuez le suivi de la même référence en espaçant les appels. Relancer un traitement déjà commencé ne le remet pas à ACCEPTED ; un délai dépassé ne prouve pas un échec.",
    ],
    tone: "pending",
  },
  {
    states: ["COMPLETED"],
    note: [
      "Reconcile Business, environment, currency and settlement. Collections credit net once; payouts and bills never debit twice. Bill receipt fields can arrive later.",
      "Rapprochez Business, environnement, devise et règlement. Encaissements crédités une fois ; décaissements et factures jamais débités deux fois. Les reçus de factures peuvent arriver plus tard.",
    ],
    tone: "success",
  },
  {
    states: ["FAILED"],
    note: [
      "Confirmed failure includes cancellation and expiry. Read failureMessage/failureCode for details. Failure does not guarantee a refund: inspect refunded for bills, and wallet records or support for payouts.",
      "L’échec confirmé inclut annulation et expiration. Consultez failureMessage/failureCode. L’échec ne garantit pas un remboursement : vérifiez refunded pour les factures, et les écritures ou le support pour les décaissements.",
    ],
    tone: "failure",
  },
];
