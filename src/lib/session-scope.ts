/** Read a token subject only for browser cache isolation. JWT validation remains on the backend. */
export function tokenCustomerScope(token: string) {
  try {
    const encoded = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return typeof payload.sub === "string" && payload.sub ? (payload.sub as string) : undefined;
  } catch {
    return undefined;
  }
}
