import ts from "typescript";

/** Omit the internal payment ID from portal downloads without reformatting the release. */
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
