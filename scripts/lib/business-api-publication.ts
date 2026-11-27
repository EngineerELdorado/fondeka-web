import ts from "typescript";

/** Keep portal guides self-contained when the source links to backend handoffs. */
export function portalBusinessApiMarkdown(file: string, source: string): string {
  const previewNotice =
    "> Bill payments are available when enabled for your account. Check the API guides in your portal for availability.\n\n";
  return (
    (["README.md", "guides/bill-payments.md"].includes(file) && !source.startsWith(previewNotice)
      ? previewNotice
      : "") +
    source
      .replace(
        /^Fondeka must enable new LIVE API payments before your integration can submit them\.[^\n]+$/m,
        "LIVE API payments are enabled by default. No activation request is needed. If the API returns `403 BUSINESS_API_LIVE_PAYMENTS_DISABLED`, contact Fondeka support to restore LIVE access; you can continue testing in SANDBOX. Existing accepted payments remain readable, replayable and processed while new LIVE payments are blocked.",
      )
      .replace(
        /^New LIVE collections and payouts require Fondeka to enable live API payments\.[^\n]+$/m,
        "LIVE API payments are enabled by default. Use a LIVE key for production; you do not need to request activation. If a request returns HTTP 403 with `errorCode: BUSINESS_API_LIVE_PAYMENTS_DISABLED`, LIVE access is blocked for that Business. Contact Fondeka support to restore it and use SANDBOX for integration testing in the meantime. Previously accepted payments continue processing, and their status reads, idempotent replays and webhooks remain available. The rejection does not consume the idempotency key.",
      )
      .replace(
        /^`403 BUSINESS_API_LIVE_PAYMENTS_DISABLED` means Fondeka has not enabled new LIVE API payments[^\n]+$/m,
        "`403 BUSINESS_API_LIVE_PAYMENTS_DISABLED` means new LIVE payments are blocked for this Business. LIVE payments are enabled by default; if you receive this response, contact Fondeka support to restore access and continue testing in SANDBOX. No payment was accepted and the idempotency key is not consumed by this rejection. Previously accepted payments remain readable/replayable and continue to settle and deliver webhooks. Sandbox can simulate this code through `X-Simulate-Error-Code` on collections and payouts.",
      )
      .replace(
        " Your portal login and its JWT are used to manage your Business and credentials; they are not sent to merchant payment endpoints.",
        "",
      )
      .replace(
        "[web portal catalog](../business-api-web-portal-error-codes.md)",
        "web portal catalog",
      )
      .replace(
        "[the portal status contract](../business-api-web-portal-payment-statuses.md)",
        "[payment states](concepts.md)",
      )
      .replace(
        /\[(?:portal credential contract|credential management)\]\(\.\.\/business-api-credential-management\.md(?:#[^)]*)?\)/g,
        "[credential setup](quickstart.md)",
      )
      .replace(
        "[invoice contract](../mobile-bitcart-invoice-payments.md)",
        "[crypto collections](guides/crypto-collection.md)",
      )
      .replace(" and [admin integration](../admin-mobile-money-api-country-policy.md)", "")
      .replace(" See [compatibility rollout](../business-tools-bundle-compatibility.md).", "")
      .replace(
        " See the [transaction and business correctness audit](../business-api-bill-qa-2026-11-08.md).",
        "",
      )
  );
}

/** Publish the merchant contract, preserving source formatting outside reviewed corrections. */
export function portalBusinessApiContract(source: string): string {
  JSON.parse(source);
  const document = ts.parseJsonText("openapi.v1.json", source);
  const edits: { start: number; end: number }[] = [];
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      node.properties.forEach((property, index, properties) => {
        if (
          property.name &&
          ts.isStringLiteral(property.name) &&
          property.name.text === "transactionId"
        ) {
          const next = properties[index + 1];
          edits.push({
            start: !next && index > 0 ? properties[index - 1].end : property.pos,
            end: next ? next.pos : property.end,
          });
        } else {
          ts.forEachChild(property, visit);
        }
      });
    } else {
      ts.forEachChild(node, visit);
    }
  }
  visit(document);
  let result = source;
  for (const { start, end } of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, start) + result.slice(end);
  JSON.parse(result);
  return result;
}
