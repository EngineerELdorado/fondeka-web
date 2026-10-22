const routes: [RegExp, string[]][] = [
  [/^customer-api\/devices\/(register|challenge|verify)$/, ["POST"]],
  [/^customer-api\/devices\/status$/, ["GET"]],
  [/^customer-api\/fees$/, ["GET"]],
  [/^customer-api\/payment_methods$/, ["GET"]],
  [/^customer-api\/commerce\/stores$/, ["GET", "POST"]],
  [/^customer-api\/commerce\/stores\/\d+$/, ["GET", "PATCH"]],
  [/^customer-api\/commerce\/stores\/\d+\/products$/, ["GET", "POST"]],
  [/^customer-api\/commerce\/products\/\d+$/, ["GET", "PATCH"]],
  [/^customer-api\/commerce\/stores\/\d+\/orders$/, ["GET"]],
  [/^customer-api\/commerce\/stores\/\d+\/pos\/orders(?:\/quote)?$/, ["POST"]],
  [/^customer-api\/payment_requests$/, ["GET", "POST"]],
  [/^customer-api\/payment_requests\/\d+$/, ["GET", "PUT"]],
  [/^customer-api\/payment_requests\/\d+\/cancel$/, ["PATCH"]],
  [/^customer-api\/businesses(?:\/\d+)?$/, ["GET"]],
  [/^customer-api\/businesses\/\d+\/api-keys$/, ["GET", "POST"]],
  [/^customer-api\/businesses\/\d+\/api-keys\/\d+$/, ["DELETE"]],
  [/^customer-api\/businesses\/\d+\/api-transactions(?:\/[A-Za-z0-9_-]+)?$/, ["GET"]],
];
export function allowedProxyRoute(path: string, method: string) {
  return routes.some(([pattern, methods]) => pattern.test(path) && methods.includes(method));
}
