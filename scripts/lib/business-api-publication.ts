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
