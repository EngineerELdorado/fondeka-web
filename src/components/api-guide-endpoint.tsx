"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FileJson,
  Braces,
  ArrowRightLeft,
  AlertCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { businessApiDocsRoot } from "@/lib/business-api-docs";
import {
  contractCurl,
  guideHeaders,
  guideMedia,
  guideOperation,
  guideRequestBody,
  publishedExample,
  resolveGuideSchema,
  paymentStateGroups,
  type GuideSpec,
} from "@/lib/api-guide-contract";
import type { GuideExample } from "@/lib/api-guide-content";
import type { ApiGuideSetup } from "@/lib/api-guide-setup";
import { ApiGuideCatalog } from "./api-guide-catalog";
import { ApiGuideErrors } from "./api-guide-errors";
import { useApiErrorCatalog } from "@/lib/use-api-error-catalog";
import {
  processingErrorsFor,
  simulationHeaders,
  type ErrorSimulation,
} from "@/lib/api-error-catalog";
import { useWorkspace } from "./workspace-provider";
import {
  guideSchemaFields as schemaFields,
  guideSchemaStructure,
  guidePageFields,
  guideFieldDescription,
  guideCodePaths,
  type GuideFieldScope as Scope,
  type GuideSchemaField as Field,
} from "@/lib/api-guide-fields";
import release from "../../public/docs/business-api/release.json";
import { ErrorState, Loading } from "./ui";

let publishedSpec: GuideSpec | undefined;
let pendingSpec: Promise<GuideSpec> | undefined;
function loadSpec() {
  if (publishedSpec) return Promise.resolve(publishedSpec);
  if (!pendingSpec)
    pendingSpec = fetch(
      `${businessApiDocsRoot}/openapi.v1.json?v=${release.files["openapi.v1.json"].slice(0, 12)}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Contract unavailable");
        const spec = (await response.json()) as GuideSpec;
        if (
          spec.openapi !== "3.0.3" ||
          spec.info.version !== release.version ||
          spec.servers[0]?.url !== release.baseUrl ||
          !spec.components?.schemas
        )
          throw new Error("Unexpected contract");
        publishedSpec = spec;
        return spec;
      })
      .catch((error) => {
        pendingSpec = undefined;
        throw error;
      });
  return pendingSpec;
}

export function GuideCodeCard({
  title,
  code,
  children,
  selectedKey,
  caption,
}: {
  title: string;
  code: string;
  children?: ReactNode;
  selectedKey?: string;
  caption?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string>();
  const [failed, setFailed] = useState(false);
  const linePaths = guideCodePaths(code);
  return (
    <section className="guide-code-card" aria-label={title}>
      <header>
        <span>
          <FileJson size={15} aria-hidden="true" />
          {title}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(code);
              setFailed(false);
            } catch {
              setFailed(true);
            }
          }}
          aria-label={`${t("Copy", "Copier")} · ${title}`}
        >
          {copied === code ? <Check size={14} /> : <Copy size={14} />}
          {copied === code ? t("Copied", "Copié") : t("Copy", "Copier")}
        </button>
      </header>
      {children}
      <pre tabIndex={0} aria-label={title}>
        <code>
          {code.split("\n").map((line, index) => {
            const active =
              selectedKey &&
              (linePaths.length
                ? linePaths[index] === selectedKey
                : line.includes(`"${selectedKey}":`) || line.startsWith(`${selectedKey}:`));
            return (
              <span className={`guide-code-line ${active ? "highlighted" : ""}`} key={index}>
                <span className="guide-line-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  {line
                    .split(
                      /("(?:[^"\\]|\\.)*"(?=\s*:)|"(?:[^"\\]|\\.)*"|\b(?:true|false|null|\d+(?:\.\d+)?)\b)/g,
                    )
                    .map((token, i) => (
                      <span
                        key={i}
                        className={
                          token.startsWith('"')
                            ? /^".*":?\s*$/.test(token) && line.includes(`${token}:`)
                              ? "code-key"
                              : "code-string"
                            : /^(true|false|null|\d)/.test(token)
                              ? "code-value"
                              : undefined
                        }
                      >
                        {token}
                      </span>
                    ))}
                  {"\n"}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
      {caption && <p className="guide-code-caption">{caption}</p>}
      <span className="sr-only" role="status">
        {copied === code ? t("Code copied", "Code copié") : ""}
      </span>
      {failed && (
        <p className="guide-copy-error" role="alert">
          {t(
            "Select and copy the example manually.",
            "Sélectionnez et copiez l’exemple manuellement.",
          )}
        </p>
      )}
    </section>
  );
}

function SimulationHeaderHelp({
  example,
  setup,
  data,
  onViewErrors,
}: {
  example: GuideExample;
  setup?: ApiGuideSetup;
  data: ReturnType<typeof useApiErrorCatalog>;
  onViewErrors: () => void;
}) {
  const { t } = useI18n();
  const businessId = setup?.business?.id ?? "$FONDEKA_BUSINESS_ID";
  const catalogUrl = `https://api.fondeka.com/business-api/v1/businesses/${businessId}/error-codes`;
  const curl = [`curl "${catalogUrl}" \\`, '  -H "X-API-Key: $FONDEKA_SANDBOX_API_KEY"'].join("\n");
  const endpoint = data.endpoint;
  const immediate = endpoint?.requestErrors.find(
    (entry) => entry.errorCode === "RATE_LIMITED" && entry.simulatable,
  );
  const processing =
    endpoint &&
    processingErrorsFor(endpoint, example.paymentKind).find(
      (entry) =>
        entry.simulatable &&
        entry.errorCode ===
          (example.paymentKind === "MOBILE_MONEY" && example.path.endsWith("/collections")
            ? "PAYMENT_NOT_APPROVED"
            : "PROVIDER_UNAVAILABLE"),
    );
  const canShowExamples =
    !data.error &&
    !data.refreshError &&
    data.catalog?.environment === "SANDBOX" &&
    data.catalog.simulationEnabled &&
    endpoint?.available;
  return (
    <div className="guide-simulation-help">
      <h5>{t("Find the errors you can test", "Trouvez les erreurs à tester")}</h5>
      <p>
        {t(
          "Call this URL from your server with a SANDBOX API key. It returns the supported errors for each endpoint.",
          "Appelez cette URL depuis votre serveur avec une clé API SANDBOX. Elle renvoie les erreurs prises en charge par chaque endpoint.",
        )}
      </p>
      <GuideCodeCard
        title={t("Get available test errors", "Obtenir les erreurs de test disponibles")}
        code={curl}
      />
      <p>
        {t("In the response, find this endpoint:", "Dans la réponse, recherchez cet endpoint :")}
      </p>
      <code className="guide-simulation-endpoint">
        {example.method} {example.path}
      </code>
      <p>
        {t(
          "Each error marked simulatable: true can be tested. Copy its simulationValue into the X-Simulate-Error-Code header. This tells SANDBOX which test error to produce.",
          "Chaque erreur marquée simulatable: true peut être testée. Copiez sa simulationValue dans l’en-tête X-Simulate-Error-Code pour indiquer à SANDBOX quelle erreur de test produire.",
        )}
      </p>
      <button type="button" className="text-button" onClick={onViewErrors}>
        {t(
          "View this endpoint’s errors in the portal",
          "Voir les erreurs de cet endpoint dans le portail",
        )}
      </button>
      {canShowExamples && (
        <div className="guide-simulation-examples">
          {immediate?.simulationValue && (
            <section>
              <h5>
                {t(
                  "Example: the request is refused immediately",
                  "Exemple : la requête est refusée immédiatement",
                )}
              </h5>
              <code>X-Simulate-Error-Code: {immediate.simulationValue}</code>
              <p>
                {t(
                  `The API returns HTTP ${immediate.httpStatus} with errorCode: ${immediate.errorCode}. The request stops here; no payment is created.`,
                  `L’API renvoie HTTP ${immediate.httpStatus} avec errorCode : ${immediate.errorCode}. La requête s’arrête ici ; aucun paiement n’est créé.`,
                )}
              </p>
            </section>
          )}
          {processing?.simulationValue && (
            <section>
              <h5>
                {t("Example: the payment fails later", "Exemple : le paiement échoue plus tard")}
              </h5>
              <code>X-Simulate-Error-Code: {processing.simulationValue}</code>
              <p>
                {processing.errorCode === "PAYMENT_NOT_APPROVED"
                  ? t(
                      "This tests a customer who does not approve the mobile-money prompt on their phone.",
                      "Ce test simule un client qui ne valide pas la demande mobile money sur son téléphone.",
                    )
                  : t(
                      "This tests a payment that the provider cannot process.",
                      "Ce test simule un paiement que le fournisseur ne peut pas traiter.",
                    )}
              </p>
              <ol>
                <li>
                  {t(
                    "First, HTTP 202 confirms acceptance of the new request. The payment status is ACCEPTED: it is queued.",
                    "D’abord, HTTP 202 confirme l’acceptation de la nouvelle requête. L’état du paiement est ACCEPTED : il est en file d’attente.",
                  )}
                </li>
                <li>
                  {t(
                    "When the worker starts execution, the payment status becomes PROCESSING. Keep checking the same reference.",
                    "Quand le traitement commence, l’état du paiement devient PROCESSING. Poursuivez le suivi de la même référence.",
                  )}
                </li>
                <li>
                  {t(
                    `Later, the payment status becomes FAILED with failureCode: ${processing.errorCode}.`,
                    `Plus tard, l’état du paiement devient FAILED avec failureCode : ${processing.errorCode}.`,
                  )}
                </li>
              </ol>
              <p>
                {t(
                  "Read the result with the transaction lookup below, or receive it in the signed failed-payment webhook. No real provider is contacted.",
                  "Consultez le résultat via l’endpoint de suivi ci-dessous, ou recevez-le dans le webhook signé d’échec de paiement. Aucun fournisseur réel n’est contacté.",
                )}
              </p>
              <code className="guide-simulation-endpoint">
                GET /business-api/v1/businesses/{businessId}/transactions/{"{reference}"}
              </code>
            </section>
          )}
        </div>
      )}
      {setup?.environment !== "SANDBOX" && (
        <p>
          {t(
            "Select SANDBOX in the portal header to explore test errors here. Use a SANDBOX API key in your server requests.",
            "Sélectionnez SANDBOX dans l’en-tête du portail pour explorer les erreurs de test ici. Utilisez une clé API SANDBOX dans vos requêtes serveur.",
          )}
        </p>
      )}
      <p>
        {t(
          "For a normal payment test, leave this header out. Do not send SUCCESS or PENDING: they are not error codes. Blank or unsupported values return HTTP 400 with INVALID_TEST_ERROR_CODE. LIVE ignores the header.",
          "Pour un test de paiement normal, omettez cet en-tête. N’envoyez pas SUCCESS ou PENDING : ce ne sont pas des codes d’erreur. Une valeur vide ou non prise en charge renvoie HTTP 400 avec INVALID_TEST_ERROR_CODE. LIVE ignore l’en-tête.",
        )}
      </p>
    </div>
  );
}

const statusNames: Record<string, readonly [string, string]> = {
  "200": ["OK", "OK"],
  "202": ["Accepted · inspect payment status", "Accepté · consultez l’état du paiement"],
  "400": ["Invalid request", "Requête invalide"],
  "401": ["Authentication failed", "Authentification échouée"],
  "403": ["Forbidden", "Accès refusé"],
  "404": ["Not found", "Introuvable"],
  "409": ["Idempotency conflict", "Conflit d’idempotence"],
  "429": ["Rate limited", "Limite atteinte"],
  "500": ["Unexpected error", "Erreur inattendue"],
  "503": ["Temporarily unavailable", "Temporairement indisponible"],
};
function FieldDetail({
  spec,
  field,
  note,
  example,
  children,
}: {
  spec: GuideSpec;
  field: Field;
  note?: string;
  example?: GuideExample;
  children?: ReactNode;
}) {
  const { t, language } = useI18n();
  const schema = field.schema;
  const nestedFields = schemaFields(spec, schema, field.location, field.path);
  const nested = example ? guidePageFields(nestedFields, example) : nestedFields;
  const description = guideFieldDescription(field, language, example);
  return (
    <div className="guide-field-detail" key={`${field.location}:${field.name}`}>
      <div>
        <code>{field.path}</code>
        <span>
          {schema.type || "object"}
          {schema.nullable ? " | null" : ""}
        </span>
        <span className={field.required ? "required" : "optional"}>
          {field.required
            ? field.depth > 0 || field.path.startsWith("[]")
              ? t("Required within this object", "Requis dans cet objet")
              : t("Required", "Requis")
            : t("Optional", "Facultatif")}
        </span>
        {schema.deprecated && <span>{t("Deprecated", "Obsolète")}</span>}
      </div>
      {note && note !== description.text && <p>{note}</p>}
      {description.text && (
        <p className="guide-contract-description" lang={description.language}>
          {description.text}
        </p>
      )}
      {children}
      <div className="guide-constraints">
        {schema.minimum !== undefined && <span>min {schema.minimum}</span>}
        {schema.maximum !== undefined && <span>max {schema.maximum}</span>}
        {schema.multipleOf !== undefined && (
          <span>
            {t("Multiple of", "Multiple de")} {schema.multipleOf}
          </span>
        )}
        {schema.minLength !== undefined && (
          <span>
            min {schema.minLength} {t("characters", "caractères")}
          </span>
        )}
        {schema.maxLength !== undefined && (
          <span>
            max {schema.maxLength} {t("characters", "caractères")}
          </span>
        )}
        {schema.format && <span>{schema.format}</span>}
      </div>
      {schema.pattern && (
        <p>
          <code>{schema.pattern}</code>
        </p>
      )}
      {schema.enum && (
        <details className="guide-enum" open={schema.enum.length <= 12}>
          <summary>
            {t("Allowed values", "Valeurs autorisées")} · {schema.enum.length}
            <ChevronDown size={14} />
          </summary>
          <div>
            {schema.enum.map((value) => (
              <code key={value}>{value}</code>
            ))}
          </div>
        </details>
      )}
      {nested.length > 0 && (
        <details className="guide-nested-fields" open={field.name === "cryptoDetails"}>
          <summary>
            {t("Nested fields", "Champs imbriqués")} · {nested.length}
            <ChevronDown size={14} />
          </summary>
          <dl>
            {nested.map((child) => {
              const definition = guideFieldDescription(child, language, example);
              return (
                <div key={child.path}>
                  <dt>
                    <code>{child.path}</code>
                    <small>
                      {child.schema.type || "object"}
                      {child.schema.nullable ? " | null" : ""} ·{" "}
                      {child.required ? t("required", "requis") : t("optional", "facultatif")}
                    </small>
                  </dt>
                  <dd lang={definition.language}>
                    {definition.text}
                    {child.schema.enum && <div>{child.schema.enum.join(" · ")}</div>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </details>
      )}
    </div>
  );
}

function FieldPicker({
  fields,
  active,
  onSelect,
  event = false,
  example,
}: {
  fields: Field[];
  active?: Field;
  onSelect: (path: string) => void;
  event?: boolean;
  example: GuideExample;
}) {
  const { t, language } = useI18n();
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase(language);
  const matches = fields.filter((field) =>
    `${field.path} ${guideFieldDescription(field, language, example).text}`
      .toLocaleLowerCase(language)
      .includes(term),
  );
  return (
    <>
      <div className="guide-field-search">
        <label>
          <span className="sr-only">{t("Search fields", "Rechercher des champs")}</span>
          <input
            type="search"
            value={search}
            onChange={(change) => setSearch(change.target.value)}
            placeholder={t("Search fields…", "Rechercher des champs…")}
          />
        </label>
        <span role="status">
          {term ? `${matches.length} / ${fields.length}` : fields.length} {t("fields", "champs")}
        </span>
      </div>
      <div
        className="guide-field-options"
        role="group"
        aria-label={
          event
            ? t("Choose an event field", "Choisissez un champ de l’événement")
            : t("Choose a field", "Choisissez un champ")
        }
      >
        {matches.map((field) => {
          const description = guideFieldDescription(field, language, example);
          return (
            <button
              type="button"
              key={field.path}
              aria-pressed={active?.path === field.path}
              onClick={() => onSelect(field.path)}
              style={{ paddingInlineStart: `${8 + Math.min(field.depth, 3) * 10}px` }}
            >
              <span>
                <code>{field.path}</code>
                <span className="guide-field-preview" lang={description.language}>
                  {description.text}
                </span>
              </span>
              <small>
                {field.schema.type || "object"}
                {field.schema.nullable ? " | null" : ""}
                {field.required ? " *" : ""}
              </small>
            </button>
          );
        })}
        {!matches.length && (
          <p className="guide-field-no-results">
            {t(
              "No matching fields. Try another search.",
              "Aucun champ correspondant. Essayez une autre recherche.",
            )}
          </p>
        )}
      </div>
    </>
  );
}

export function WebhookEventGuide({ spec, example }: { spec: GuideSpec; example: GuideExample }) {
  const { language, t } = useI18n();
  const operation = guideOperation(spec, example);
  const media = guideMedia(operation.requestBody?.content);
  const event = publishedExample(media);
  const envelope = event as { type?: string; environment?: string } | undefined;
  const fields = guidePageFields(schemaFields(spec, media?.schema, "body"), example);
  const [selected, setSelected] = useState(example.fields[0]?.key || fields[0]?.name);
  const active = fields.find((field) => field.path === selected) || fields[0];
  const hint = example.fields.find((field) => field.key === active?.path);
  const handling = [
    {
      title: t("Verify the signature", "Vérifiez la signature"),
      description: t(
        "Use the signing secret with HMAC-SHA256 over timestamp + '.' + exact raw bytes. Check freshness (±300s) and compare in constant time.",
        "Utilisez le secret de signature avec HMAC-SHA256 sur timestamp + '.' + les octets bruts exacts. Vérifiez la fraîcheur (±300 s) et comparez en temps constant.",
      ),
    },
    {
      title: t("Validate the event", "Validez l’événement"),
      description: t(
        "Match the header/body event ID, Business, both environments, reference, status, currency and settlement.",
        "Comparez l’identifiant d’événement en-tête/corps, le Business, les deux environnements, la référence, l’état, la devise et le règlement.",
      ),
    },
    {
      title: t("Store, then acknowledge", "Stockez, puis acquittez"),
      description: t(
        "Deduplicate the event ID in a durable inbox. Return any 2xx only after committing it.",
        "Dédupliquez l’identifiant dans une boîte durable. Répondez avec un code 2xx après validation du stockage.",
      ),
    },
    {
      title: t("Process once", "Traitez une seule fois"),
      description: t(
        "Process asynchronously and make fulfillment idempotent by payment reference. Delivery can repeat and arrive out of order.",
        "Traitez de façon asynchrone, avec une livraison idempotente par référence de paiement. Les événements peuvent être répétés et arriver dans le désordre.",
      ),
    },
  ];
  return (
    <div className="guide-webhook-event">
      <p className="guide-webhook-intro">
        {t(
          "Fondeka sends this event to the webhook URL configured on your API key.",
          "Fondeka envoie cet événement à l’URL webhook configurée sur votre clé API.",
        )}
      </p>
      <GuideCodeCard
        title={t("Webhook event body", "Corps de l’événement webhook")}
        code={JSON.stringify(event, null, 2)}
        selectedKey={active?.path}
        caption={t("Published OpenAPI event example", "Exemple d’événement OpenAPI publié")}
      >
        <div className="guide-webhook-event-meta">
          <code>{envelope?.type}</code>
          <span>{envelope?.environment}</span>
        </div>
      </GuideCodeCard>
      <section
        className="guide-webhook-signature-headers"
        aria-label={t("Webhook signature headers", "En-têtes de signature webhook")}
      >
        <h4>{t("Signature headers", "En-têtes de signature")}</h4>
        <dl>
          {(operation.parameters || []).map((parameter) => (
            <div key={parameter.name}>
              <dt>
                <code>{parameter.name}</code>
                <small>
                  {parameter.schema.format || parameter.schema.pattern || parameter.schema.type}
                </small>
              </dt>
              <dd lang="en">{parameter.description}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="guide-inspect-grid">
        <section
          className="guide-field-inspector"
          aria-label={t("Event fields", "Champs de l’événement")}
        >
          <h4>{t("Event fields", "Champs de l’événement")}</h4>
          <FieldPicker
            fields={fields}
            active={active}
            onSelect={setSelected}
            example={example}
            event
          />
          {active && (
            <FieldDetail
              spec={spec}
              field={active}
              note={hint?.note[language === "fr" ? 1 : 0]}
              example={example}
            />
          )}
        </section>
        <section
          className="guide-webhook-handling"
          aria-label={t("Handle the webhook", "Traitez le webhook")}
        >
          <h4>{t("Handle the webhook", "Traitez le webhook")}</h4>
          <ol>
            {handling.map((step, i) => (
              <li key={step.title}>
                <span>{i + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function EndpointContent({
  spec,
  example,
  hideRoute = false,
  setup,
}: {
  spec: GuideSpec;
  example: GuideExample;
  hideRoute?: boolean;
  setup?: ApiGuideSetup;
}) {
  const { language, t } = useI18n();
  const operation = guideOperation(spec, example);
  const responseCodes = Object.keys(operation.responses).sort();
  const [responseCode, setResponseCode] = useState(
    responseCodes.find((code) => code.startsWith("2")) || responseCodes[0],
  );
  const response = operation.responses[responseCode];
  const [responseExampleName, setResponseExampleName] = useState<string>();
  const requestMedia = guideMedia(operation.requestBody?.content);
  const body = guideRequestBody(spec, example);
  const errorData = useApiErrorCatalog(setup, example.method, example.path, operation.operationId);
  const [simulation, setSimulation] = useState<ErrorSimulation>();
  const [intentKey, setIntentKey] = useState<string>();
  const simulatedHeaders =
    errorData.error || errorData.refreshError
      ? {}
      : simulationHeaders(errorData.catalog, errorData.endpoint, simulation, example.paymentKind);
  const headerOverrides = {
    ...simulatedHeaders,
    ...(intentKey ? { "Idempotency-Key": intentKey } : {}),
  };
  const preferredMethod =
    body &&
    typeof body === "object" &&
    "paymentMethodName" in body &&
    typeof body.paymentMethodName === "string"
      ? body.paymentMethodName
      : undefined;
  const catalogProps =
    setup && example.method === "POST" && example.paymentKind
      ? {
          setup,
          kind: example.paymentKind,
          payout: example.paymentAction === "BUSINESS_API_PAYOUT",
          preferredMethod,
        }
      : undefined;
  const responseMedia = guideMedia(response?.content);
  const responseBody = publishedExample(responseMedia, responseExampleName);
  const simulatedRejection =
    Object.keys(simulatedHeaders).length > 0 &&
    simulation?.stage === "request" &&
    errorData.endpoint?.requestErrors.find(
      (entry) =>
        entry.errorCode === simulation.errorCode &&
        String(entry.httpStatus) === responseCode &&
        entry.errorCode === responseExampleName,
    );
  const displayedResponse =
    simulatedRejection &&
    responseBody &&
    typeof responseBody === "object" &&
    !Array.isArray(responseBody)
      ? {
          ...responseBody,
          details: {
            ...("details" in responseBody &&
            responseBody.details &&
            typeof responseBody.details === "object"
              ? responseBody.details
              : {}),
            simulated: true,
          },
        }
      : responseBody;
  const [responseView, setResponseView] = useState<"example" | "structure">(
    example.responseFocus === "cryptoDetails" ? "structure" : "example",
  );
  const cryptoFields =
    example.responseFocus === "cryptoDetails"
      ? schemaFields(
          spec,
          resolveGuideSchema(spec, responseMedia?.schema).properties?.cryptoDetails,
          "response",
        )
      : [];
  const showResponseStructure =
    responseCode.startsWith("2") && responseView === "structure" && cryptoFields.length > 0;
  const [view, setView] = useState<"json" | "curl">("json");
  const initialScope = example.fields[0]?.in || (body === undefined ? "header" : "body");
  const [scope, setScope] = useState<Scope>(initialScope);
  const [selected, setSelected] = useState<string | undefined>(example.fields[0]?.key);
  const [stateGroup, setStateGroup] = useState(0);
  const responsePreview = useRef<HTMLDivElement>(null);
  const errorPanel = useRef<HTMLElement>(null);
  const headers = guideHeaders(operation, example.incoming, headerOverrides);
  const parameterFields: Field[] = (operation.parameters || []).map((parameter) => ({
    name: parameter.name,
    path: parameter.name,
    depth: 0,
    location: parameter.in as Scope,
    required: parameter.required || false,
    schema: {
      ...parameter.schema,
      description: parameter.description || parameter.schema.description,
    },
  }));
  if (!example.incoming)
    parameterFields.unshift({
      name: "X-API-Key",
      path: "X-API-Key",
      depth: 0,
      location: "header",
      required: true,
      schema: {
        type: "string",
        description: spec.components.securitySchemes["Business API Key"].description,
      },
    });
  const fields = guidePageFields(
    [
      ...schemaFields(spec, requestMedia?.schema, "body"),
      ...parameterFields,
      ...schemaFields(spec, responseMedia?.schema, "response"),
    ],
    example,
    body,
  );
  const fieldsInScope = fields.filter((field) => field.location === scope);
  const activeField = fieldsInScope.find((field) => field.path === selected) || fieldsInScope[0];
  const hint = example.fields.find(
    (field) => field.key === activeField?.path && (field.in || "body") === scope,
  );
  const requestCode =
    view === "curl"
      ? contractCurl(spec, example, body, headerOverrides)
      : body === undefined
        ? Object.entries(headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n")
        : JSON.stringify(body, null, 2);
  const declaredPaymentStates =
    resolveGuideSchema(
      spec,
      spec.components.schemas.BusinessApiTransactionResource?.properties?.status,
    ).enum || [];
  const paymentResource = ["collections", "payouts", "transactions/{reference}"].some((end) =>
    example.path.endsWith(`/${end}`),
  );
  const scopeLabels: Record<Scope, string> = {
    body: t("Body", "Corps"),
    header: t("Headers", "En-têtes"),
    path: t("Path", "Chemin"),
    query: t("Query", "Paramètres"),
    response: t("Response", "Réponse"),
  };
  const requiredAlternatives = (resolveGuideSchema(spec, requestMedia?.schema).anyOf || [])
    .flatMap((part) => part.required || [])
    .filter((name) => fields.some((field) => field.location === "body" && field.path === name));
  const statusLabel = (code: string) => statusNames[code]?.[language === "fr" ? 1 : 0] || code;
  function chooseResponse(code: string, reveal = false, errorCode?: string) {
    setResponseCode(code);
    setResponseExampleName(errorCode);
    setScope("response");
    setSelected(code.startsWith("2") ? "status" : "errorCode");
    if (reveal) responsePreview.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  function chooseSimulation(value?: ErrorSimulation) {
    if (value?.stage !== simulation?.stage || value?.errorCode !== simulation?.errorCode) {
      setSimulation(value);
      if (
        operation.parameters?.some(
          (parameter) => parameter.in === "header" && parameter.name === "Idempotency-Key",
        )
      )
        setIntentKey(`guide_${crypto.randomUUID()}`);
    }
    if (value?.stage === "request") {
      const entry = errorData.endpoint?.requestErrors.find(
        (entry) => entry.errorCode === value.errorCode,
      );
      if (
        entry &&
        guideMedia(operation.responses[String(entry.httpStatus)]?.content)?.examples?.[
          entry.errorCode
        ]
      )
        chooseResponse(String(entry.httpStatus), false, entry.errorCode);
    } else chooseResponse(responseCodes.find((code) => code.startsWith("2")) || responseCodes[0]);
    setView("curl");
  }
  return (
    <div className="guide-endpoint-explorer">
      {!hideRoute && (
        <div className="guide-endpoint-bar">
          <span className={`guide-http-method ${example.method.toLowerCase()}`}>
            {example.method}
          </span>
          <code>{example.path}</code>
          <span>{example.incoming ? t("Incoming webhook", "Webhook entrant") : "v1"}</span>
        </div>
      )}
      <div className="guide-http-grid">
        <GuideCodeCard
          title={t("Request", "Requête")}
          code={requestCode}
          selectedKey={scope === "response" ? undefined : activeField?.path}
          caption={
            example.incoming
              ? t(
                  "The destination is a placeholder, not a Fondeka endpoint.",
                  "La destination est un exemple, pas un endpoint Fondeka.",
                )
              : t(
                  "Keep credentials on your server. Use a new idempotency key for each new intent; preserve it on retries.",
                  "Gardez les clés sur votre serveur. Une clé d’idempotence par intention ; conservez-la lors des relances.",
                )
          }
        >
          <div className="guide-code-options">
            <div role="group" aria-label={t("Request format", "Format de requête")}>
              <button type="button" aria-pressed={view === "json"} onClick={() => setView("json")}>
                {body === undefined ? "HTTP" : "JSON"}
              </button>
              {!example.incoming && (
                <button
                  type="button"
                  aria-pressed={view === "curl"}
                  onClick={() => setView("curl")}
                >
                  cURL
                </button>
              )}
            </div>
            {catalogProps && (
              <div className="guide-catalog-actions">
                <ApiGuideCatalog {...catalogProps} />
                {catalogProps.kind === "CRYPTO" && (
                  <ApiGuideCatalog {...catalogProps} target="networks" />
                )}
              </div>
            )}
          </div>
          {Object.keys(simulatedHeaders).length > 0 && (
            <p className="guide-code-caption">
              <code>
                {Object.entries(simulatedHeaders)
                  .map(([name, value]) => `${name}: ${value}`)
                  .join("\n")}
              </code>
            </p>
          )}
        </GuideCodeCard>
        <div ref={responsePreview} className="guide-response-preview">
          <GuideCodeCard
            title={
              showResponseStructure
                ? t("Response structure", "Structure de la réponse")
                : t("Response", "Réponse")
            }
            code={
              showResponseStructure
                ? JSON.stringify(guideSchemaStructure(spec, responseMedia?.schema), null, 2)
                : responseBody === undefined
                  ? t(
                      "No response body is published for this status.",
                      "Aucun corps de réponse n’est publié pour cet état.",
                    )
                  : JSON.stringify(displayedResponse, null, 2)
            }
            selectedKey={scope === "response" ? activeField?.path : undefined}
            caption={
              showResponseStructure
                ? t(
                    "Full response structure with field types, not payment values. cryptoDetails may initially be null; refresh the same reference until invoice instructions are available.",
                    "Structure complète avec les types des champs, pas des valeurs de paiement. cryptoDetails peut être null au départ ; actualisez la même référence jusqu’à réception des instructions de facture.",
                  )
                : simulatedRejection
                  ? t(
                      "Simulated rejection example: details.simulated is true. This page does not send the payment request.",
                      "Exemple de refus simulé : details.simulated vaut true. Cette page n’envoie pas la demande de paiement.",
                    )
                  : t(
                      "Contract example, not the result of a request in this browser.",
                      "Exemple du contrat, pas le résultat d’une requête dans ce navigateur.",
                    )
            }
          >
            <div className="guide-code-options">
              {responseMedia?.examples && Object.keys(responseMedia.examples).length > 1 && (
                <label>
                  {t("Response example", "Exemple de réponse")}
                  <select
                    aria-label={t("Response error code", "Code d’erreur de la réponse")}
                    value={
                      responseExampleName && responseMedia.examples[responseExampleName]
                        ? responseExampleName
                        : Object.keys(responseMedia.examples)[0]
                    }
                    onChange={(event) => setResponseExampleName(event.target.value)}
                  >
                    {Object.keys(responseMedia.examples).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {cryptoFields.length > 0 && (
                <div role="group" aria-label={t("Response view", "Vue de la réponse")}>
                  <button
                    type="button"
                    aria-pressed={responseView === "structure"}
                    onClick={() => {
                      setResponseView("structure");
                      setScope("response");
                      setSelected("cryptoDetails");
                    }}
                  >
                    {t("Fields", "Champs")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={responseView === "example"}
                    onClick={() => setResponseView("example")}
                  >
                    {t("Example", "Exemple")}
                  </button>
                </div>
              )}
              <label>
                <span className="sr-only">{t("HTTP response status", "État HTTP de réponse")}</span>
                <select
                  value={responseCode}
                  onChange={(event) => chooseResponse(event.target.value)}
                >
                  {responseCodes.map((code) => (
                    <option key={code} value={code}>
                      {code} · {statusLabel(code)}
                    </option>
                  ))}
                </select>
              </label>
              <span
                className={`guide-response-light ${responseCode.startsWith("2") ? "success" : "failure"}`}
                aria-hidden="true"
              />
            </div>
          </GuideCodeCard>
        </div>
      </div>
      <details className="guide-request-headers" open={Object.keys(simulatedHeaders).length > 0}>
        <summary>
          {t("Request headers", "En-têtes de requête")} · {Object.keys(headers).length}
          <ChevronDown size={14} />
        </summary>
        <dl>
          {Object.entries(headers).map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>
                <code>{value}</code>
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="guide-inspect-grid">
        <section
          className="guide-field-inspector"
          aria-label={t("Field explorer", "Explorateur de champs")}
        >
          <h4>
            <Braces size={17} />
            {t("Explore the fields", "Explorez les champs")}
          </h4>
          <div
            className="guide-scope-options"
            role="group"
            aria-label={t("Field location", "Emplacement des champs")}
          >
            {(["body", "header", "path", "query", "response"] as Scope[])
              .filter((location) => fields.some((field) => field.location === location))
              .map((location) => (
                <button
                  type="button"
                  key={location}
                  aria-pressed={scope === location}
                  onClick={() => {
                    setScope(location);
                    setSelected(undefined);
                  }}
                >
                  {scopeLabels[location]}
                  <span className="guide-field-count">
                    {fields.filter((field) => field.location === location).length}
                  </span>
                </button>
              ))}
          </div>
          {scope === "body" && requiredAlternatives.length > 1 && (
            <p className="guide-field-rule">
              {t("Supply at least one:", "Fournissez au moins un champ :")}{" "}
              <code>{requiredAlternatives.join(" / ")}</code>
            </p>
          )}
          <FieldPicker
            key={`${scope}:${responseCode}`}
            fields={fieldsInScope}
            active={activeField}
            onSelect={setSelected}
            example={example}
          />
          {activeField && (
            <FieldDetail
              spec={spec}
              field={activeField}
              note={hint?.note[language === "fr" ? 1 : 0]}
              example={example}
            >
              {scope === "header" && activeField.path === "X-Simulate-Error-Code" && (
                <SimulationHeaderHelp
                  example={example}
                  setup={setup}
                  data={errorData}
                  onViewErrors={() => {
                    errorPanel.current?.scrollIntoView({ block: "start", behavior: "instant" });
                    errorPanel.current?.querySelector("h4")?.focus({ preventScroll: true });
                  }}
                />
              )}
              {catalogProps &&
                scope === "body" &&
                ["paymentMethodName", "networkName"].includes(activeField.path) && (
                  <div className="guide-field-catalog">
                    <ApiGuideCatalog
                      {...catalogProps}
                      target={activeField.path === "networkName" ? "networks" : "methods"}
                    />
                  </div>
                )}
            </FieldDetail>
          )}
        </section>
        <section
          className="guide-http-statuses"
          ref={errorPanel}
          aria-label={t("HTTP statuses and error codes", "États HTTP et codes d’erreur")}
        >
          <h4 tabIndex={-1}>
            <ArrowRightLeft size={17} />
            {t("HTTP statuses & errors", "États HTTP et erreurs")}
          </h4>
          <ApiGuideErrors
            data={errorData}
            setup={setup}
            kind={example.paymentKind}
            simulation={Object.keys(simulatedHeaders).length ? simulation : undefined}
            onSimulation={chooseSimulation}
            onInspect={(entry) => {
              const status = String(entry.httpStatus);
              if (guideMedia(operation.responses[status]?.content)?.examples?.[entry.errorCode])
                chooseResponse(status, false, entry.errorCode);
            }}
          />
          <details className="guide-published-http-responses">
            <summary>{t("Published HTTP responses", "Réponses HTTP publiées")}</summary>
            <div className="guide-status-list">
              {responseCodes.map((code) => {
                const value = publishedExample(guideMedia(operation.responses[code].content)) as
                  { errorCode?: string } | undefined;
                return (
                  <button
                    type="button"
                    key={code}
                    aria-pressed={code === responseCode}
                    onClick={() => chooseResponse(code, true)}
                  >
                    <span className={code.startsWith("2") ? "success" : "failure"}>{code}</span>
                    <span>
                      <strong>{statusLabel(code)}</strong>
                      {value?.errorCode && <code>{value.errorCode}</code>}
                    </span>
                    <ChevronDown size={14} />
                  </button>
                );
              })}
            </div>
            <div className="guide-response-description">
              <strong>
                {responseCode} · {statusLabel(responseCode)}
              </strong>
              <p lang="en">{response.description}</p>
              <small>
                {t(
                  "Select a status to inspect its published response. Error codes shown above are documented examples, not an exhaustive enum.",
                  "Sélectionnez un état pour voir sa réponse publiée. Les codes ci-dessus sont les exemples documentés, pas une liste exhaustive.",
                )}
              </small>
            </div>
            {response.headers?.["X-Request-Id"] && !example.incoming && (
              <p className="guide-response-header">
                <code>X-Request-Id</code>
                {t(
                  "Fresh for each HTTP attempt; include it in support requests.",
                  "Renouvelé à chaque tentative HTTP ; communiquez-le au support.",
                )}
              </p>
            )}
          </details>
        </section>
      </div>
      {paymentResource && (
        <section
          className="guide-payment-states"
          aria-label={t("Payment states", "États du paiement")}
        >
          <h4>
            <AlertCircle size={17} />
            {t("Payment status ≠ HTTP status", "État du paiement ≠ état HTTP")}
          </h4>
          <div
            className="guide-state-options"
            role="group"
            aria-label={t("Payment outcome", "Résultat du paiement")}
          >
            {paymentStateGroups.map((group, index) => (
              <button
                type="button"
                key={group.tone}
                className={group.tone}
                aria-pressed={stateGroup === index}
                onClick={() => setStateGroup(index)}
              >
                {group.states
                  .filter((state) => declaredPaymentStates.includes(state))
                  .map((state) => (
                    <code key={state}>{state}</code>
                  ))}
              </button>
            ))}
          </div>
          <div className={`guide-state-detail ${paymentStateGroups[stateGroup].tone}`}>
            <p>{paymentStateGroups[stateGroup].note[language === "fr" ? 1 : 0]}</p>
          </div>
        </section>
      )}
    </div>
  );
}
export function ApiGuideEndpoint({
  example,
  hideRoute = false,
  setup,
}: {
  example: GuideExample;
  hideRoute?: boolean;
  setup?: ApiGuideSetup;
}) {
  const { t } = useI18n();
  const { accountKey } = useWorkspace();
  const [spec, setSpec] = useState(publishedSpec);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    loadSpec().then(
      (value) => {
        if (active) setSpec(value);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [retry]);
  if (!spec)
    return failed ? (
      <ErrorState
        message={t(
          "Couldn’t load the published API contract.",
          "Impossible de charger le contrat API publié.",
        )}
        retry={() => {
          setFailed(false);
          setRetry((value) => value + 1);
        }}
      />
    ) : (
      <Loading rows={5} />
    );
  return example.incoming ? (
    <WebhookEventGuide spec={spec} example={example} />
  ) : (
    <EndpointContent
      key={`${accountKey}:${setup?.business?.id}:${setup?.environment}:${example.method}:${example.path}:${example.paymentKind}`}
      spec={spec}
      example={example}
      hideRoute={hideRoute}
      setup={setup}
    />
  );
}
