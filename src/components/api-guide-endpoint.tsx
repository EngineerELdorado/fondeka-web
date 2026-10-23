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
  publishedExample,
  resolveGuideSchema,
  paymentStateGroups,
  type GuideSpec,
  type ApiSchema,
} from "@/lib/api-guide-contract";
import type { GuideExample } from "@/lib/api-guide-content";
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
              (line.includes(`"${selectedKey}":`) || line.startsWith(`${selectedKey}:`));
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

const statusNames: Record<string, readonly [string, string]> = {
  "200": ["OK", "OK"],
  "202": ["Accepted · queued, not completed", "Accepté · en attente, pas terminé"],
  "400": ["Invalid request", "Requête invalide"],
  "401": ["Authentication failed", "Authentification échouée"],
  "403": ["Forbidden", "Accès refusé"],
  "404": ["Not found", "Introuvable"],
  "409": ["Idempotency conflict", "Conflit d’idempotence"],
  "429": ["Rate limited", "Limite atteinte"],
  "500": ["Unexpected error", "Erreur inattendue"],
  "503": ["Temporarily unavailable", "Temporairement indisponible"],
};
type Scope = "body" | "header" | "path" | "query" | "response";
type Field = { name: string; schema: ApiSchema; required: boolean; location: Scope };
function schemaFields(spec: GuideSpec, schema: ApiSchema | undefined, location: Scope): Field[] {
  const root = resolveGuideSchema(spec, schema);
  const object = root.type === "array" ? resolveGuideSchema(spec, root.items) : root;
  return Object.entries(object.properties || {}).map(([name, value]) => ({
    name,
    schema: resolveGuideSchema(spec, value),
    required: object.required?.includes(name) || false,
    location,
  }));
}
function FieldDetail({ spec, field, note }: { spec: GuideSpec; field: Field; note?: string }) {
  const { t } = useI18n();
  const schema = field.schema;
  const nested = schemaFields(spec, schema, field.location);
  return (
    <div className="guide-field-detail" key={`${field.location}:${field.name}`}>
      <div>
        <code>{field.name}</code>
        <span>
          {schema.type || "object"}
          {schema.nullable ? " | null" : ""}
        </span>
        <span className={field.required ? "required" : "optional"}>
          {field.required ? t("Required", "Requis") : t("Optional", "Facultatif")}
        </span>
        {schema.deprecated && <span>{t("Deprecated", "Obsolète")}</span>}
      </div>
      {note && <p>{note}</p>}
      {schema.description && (
        <p className="guide-contract-description" lang="en">
          {schema.description}
        </p>
      )}
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
            {nested.map((child) => (
              <div key={child.name}>
                <dt>
                  <code>{child.name}</code>
                  <small>
                    {child.schema.type || "object"}
                    {child.schema.nullable ? " | null" : ""} ·{" "}
                    {child.required ? t("required", "requis") : t("optional", "facultatif")}
                  </small>
                </dt>
                <dd lang="en">
                  {child.schema.description || "—"}
                  {child.schema.enum && <div>{child.schema.enum.join(" · ")}</div>}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}

export function WebhookEventGuide({ spec, example }: { spec: GuideSpec; example: GuideExample }) {
  const { language, t } = useI18n();
  const operation = guideOperation(spec, example);
  const media = guideMedia(operation.requestBody?.content);
  const event = publishedExample(media);
  const envelope = event as { type?: string; environment?: string } | undefined;
  const fields = schemaFields(spec, media?.schema, "body");
  const [selected, setSelected] = useState(example.fields[0]?.key || fields[0]?.name);
  const active = fields.find((field) => field.name === selected) || fields[0];
  const hint = example.fields.find((field) => field.key === active?.name);
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
        selectedKey={active?.name}
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
          <div
            className="guide-field-options"
            role="group"
            aria-label={t("Choose an event field", "Choisissez un champ de l’événement")}
          >
            {fields.map((field) => (
              <button
                type="button"
                key={field.name}
                aria-pressed={active?.name === field.name}
                onClick={() => setSelected(field.name)}
              >
                <code>{field.name}</code>
                <small>
                  {field.schema.type || "object"}
                  {field.required ? " *" : ""}
                </small>
              </button>
            ))}
          </div>
          {active && (
            <FieldDetail spec={spec} field={active} note={hint?.note[language === "fr" ? 1 : 0]} />
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
}: {
  spec: GuideSpec;
  example: GuideExample;
  hideRoute?: boolean;
}) {
  const { language, t } = useI18n();
  const operation = guideOperation(spec, example);
  const responseCodes = Object.keys(operation.responses).sort();
  const [responseCode, setResponseCode] = useState(
    responseCodes.find((code) => code.startsWith("2")) || responseCodes[0],
  );
  const response = operation.responses[responseCode];
  const requestMedia = guideMedia(operation.requestBody?.content);
  const requestExamples = Object.keys(requestMedia?.examples || {});
  const [exampleName, setExampleName] = useState(example.exampleName || requestExamples[0]);
  const body = publishedExample(requestMedia, exampleName);
  const responseMedia = guideMedia(response?.content);
  const responseBody = publishedExample(responseMedia);
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
  const showCryptoStructure =
    responseCode.startsWith("2") && responseView === "structure" && cryptoFields.length > 0;
  const [view, setView] = useState<"json" | "curl">("json");
  const initialScope = example.fields[0]?.in || (body === undefined ? "header" : "body");
  const [scope, setScope] = useState<Scope>(initialScope);
  const [selected, setSelected] = useState<string | undefined>(example.fields[0]?.key);
  const [stateGroup, setStateGroup] = useState(0);
  const responsePreview = useRef<HTMLDivElement>(null);
  const headers = guideHeaders(operation, example.incoming);
  const parameterFields: Field[] = (operation.parameters || []).map((parameter) => ({
    name: parameter.name,
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
      location: "header",
      required: true,
      schema: {
        type: "string",
        description: spec.components.securitySchemes["Business API Key"].description,
      },
    });
  const fields = [
    ...schemaFields(spec, requestMedia?.schema, "body"),
    ...parameterFields,
    ...schemaFields(spec, responseMedia?.schema, "response"),
  ];
  const fieldsInScope = fields.filter((field) => field.location === scope);
  const activeField = fieldsInScope.find((field) => field.name === selected) || fieldsInScope[0];
  const hint = example.fields.find(
    (field) => field.key === activeField?.name && (field.in || "body") === scope,
  );
  const requestCode =
    view === "curl"
      ? contractCurl(spec, example, body)
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
  const firstRequiredAlternative = resolveGuideSchema(spec, requestMedia?.schema).anyOf;
  const statusLabel = (code: string) => statusNames[code]?.[language === "fr" ? 1 : 0] || code;
  function chooseResponse(code: string, reveal = false) {
    setResponseCode(code);
    setScope("response");
    setSelected(code.startsWith("2") ? "status" : "errorCode");
    if (reveal) responsePreview.current?.scrollIntoView({ block: "start", behavior: "instant" });
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
      <div className="guide-example-provenance">
        <span>{t("No request is sent", "Aucune requête envoyée")}</span>
      </div>
      <div className="guide-http-grid">
        <GuideCodeCard
          title={t("Request", "Requête")}
          code={requestCode}
          selectedKey={scope === "response" ? undefined : activeField?.name}
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
            {requestExamples.length > 1 && (
              <label>
                <span className="sr-only">{t("Request example", "Exemple de requête")}</span>
                <select
                  value={exampleName}
                  onChange={(event) => {
                    setExampleName(event.target.value);
                    setScope("body");
                    setSelected(undefined);
                  }}
                >
                  {requestExamples.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </GuideCodeCard>
        <div ref={responsePreview} className="guide-response-preview">
          <GuideCodeCard
            title={
              showCryptoStructure
                ? t("Response structure · cryptoDetails", "Structure de réponse · cryptoDetails")
                : t("Response", "Réponse")
            }
            code={
              showCryptoStructure
                ? JSON.stringify(
                    {
                      cryptoDetails: Object.fromEntries(
                        cryptoFields.map((field) => [
                          field.name,
                          `${field.schema.type || "object"}${field.schema.nullable ? " | null" : ""}`,
                        ]),
                      ),
                    },
                    null,
                    2,
                  )
                : responseBody === undefined
                  ? t(
                      "No response body is published for this status.",
                      "Aucun corps de réponse n’est publié pour cet état.",
                    )
                  : JSON.stringify(responseBody, null, 2)
            }
            selectedKey={scope === "response" ? activeField?.name : undefined}
            caption={
              showCryptoStructure
                ? t(
                    "OpenAPI field types, not payment values. cryptoDetails may initially be null; refresh the same reference until the backend returns the invoice instructions.",
                    "Types des champs OpenAPI, pas des valeurs de paiement. cryptoDetails peut être null au départ ; actualisez la même référence jusqu’à réception des instructions de facture.",
                  )
                : t(
                    "Contract example, not the result of a request in this browser.",
                    "Exemple du contrat, pas le résultat d’une requête dans ce navigateur.",
                  )
            }
          >
            <div className="guide-code-options">
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
      <details className="guide-request-headers">
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
                </button>
              ))}
          </div>
          {scope === "body" && firstRequiredAlternative && (
            <p className="guide-field-rule">
              {t("Supply at least one:", "Fournissez au moins un champ :")}{" "}
              <code>
                {firstRequiredAlternative.flatMap((part) => part.required || []).join(" / ")}
              </code>
            </p>
          )}
          <div
            className="guide-field-options"
            role="group"
            aria-label={t("Choose a field", "Choisissez un champ")}
          >
            {fieldsInScope.map((field) => (
              <button
                type="button"
                key={field.name}
                aria-pressed={activeField?.name === field.name}
                onClick={() => setSelected(field.name)}
              >
                <code>{field.name}</code>
                <small>
                  {field.schema.type || "object"}
                  {field.required ? " *" : ""}
                </small>
              </button>
            ))}
          </div>
          {activeField && (
            <FieldDetail
              spec={spec}
              field={activeField}
              note={hint?.note[language === "fr" ? 1 : 0]}
            />
          )}
        </section>
        <section
          className="guide-http-statuses"
          aria-label={t("HTTP statuses and error codes", "États HTTP et codes d’erreur")}
        >
          <h4>
            <ArrowRightLeft size={17} />
            {t("HTTP statuses & errors", "États HTTP et erreurs")}
          </h4>
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
                {group.title[language === "fr" ? 1 : 0]}
              </button>
            ))}
          </div>
          <div className={`guide-state-detail ${paymentStateGroups[stateGroup].tone}`}>
            <div>
              {paymentStateGroups[stateGroup].states
                .filter((state) => declaredPaymentStates.includes(state))
                .map((state) => (
                  <code key={state}>{state}</code>
                ))}
            </div>
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
}: {
  example: GuideExample;
  hideRoute?: boolean;
}) {
  const { t } = useI18n();
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
    <EndpointContent spec={spec} example={example} hideRoute={hideRoute} />
  );
}
