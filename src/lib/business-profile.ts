import type { Business } from "./types";

/** Provisioned account references are placeholders, not business display names. */
export function businessDisplayName(business?: Pick<Business, "name" | "legalName">) {
  return [business?.name, business?.legalName]
    .map((value) => value?.trim())
    .find((value) => value && !/^(?:Business\s+)?(?:FDK\d+|\d+)$/i.test(value))
    ?.replace(/^Business\s+/i, "");
}
