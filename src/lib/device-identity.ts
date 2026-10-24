export interface BrowserIdentity {
  deviceId: string;
  privateKey: CryptoKey;
  publicKey: string;
}
export function deviceBase64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function validIdentity(value: unknown): value is BrowserIdentity {
  const identity = value as BrowserIdentity;
  return (
    !!identity &&
    typeof identity.deviceId === "string" &&
    !!identity.deviceId &&
    typeof identity.publicKey === "string" &&
    identity.publicKey.includes("BEGIN PUBLIC KEY") &&
    identity.privateKey?.type === "private" &&
    identity.privateKey.extractable === false &&
    identity.privateKey.algorithm.name === "RSASSA-PKCS1-v1_5" &&
    identity.privateKey.usages.includes("sign")
  );
}
/** Keep the original database/key format so an existing approval never needs a new identity. */
export async function browserIdentity(
  accountKey: string,
  create: boolean,
  factory: IDBFactory = indexedDB,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<BrowserIdentity | undefined> {
  if (!accountKey) throw new Error("Sign in before verifying this browser.");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const operation = factory.open("fondeka-device-keys", 1);
    operation.onupgradeneeded = () => operation.result.createObjectStore("identities");
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(new Error("Allow browser storage to verify this device."));
  });
  db.onversionchange = () => db.close();
  try {
    const existing = await new Promise<unknown>((resolve, reject) => {
      const operation = db.transaction("identities").objectStore("identities").get(accountKey);
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error);
    });
    if (existing !== undefined) {
      if (!validIdentity(existing))
        throw new Error(
          "The saved browser identity could not be read. Contact Fondeka support for device recovery.",
        );
      return existing;
    }
    if (!create) return;
    const keys = await subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"],
    );
    const publicKey = deviceBase64(await subtle.exportKey("spki", keys.publicKey));
    const candidate: BrowserIdentity = {
      deviceId: crypto.randomUUID(),
      privateKey: keys.privateKey,
      publicKey: `-----BEGIN PUBLIC KEY-----\n${publicKey.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`,
    };
    // Recheck under an exclusive transaction after asynchronous key generation.
    // Another tab may have already saved and registered its identity.
    return await new Promise<BrowserIdentity>((resolve, reject) => {
      const tx = db.transaction("identities", "readwrite");
      const store = tx.objectStore("identities");
      const operation = store.get(accountKey);
      let chosen: BrowserIdentity;
      let invalid = false;
      operation.onsuccess = () => {
        if (operation.result !== undefined) {
          if (!validIdentity(operation.result)) {
            invalid = true;
            tx.abort();
            return;
          }
          chosen = operation.result;
        } else {
          chosen = candidate;
          store.add(candidate, accountKey);
        }
      };
      tx.oncomplete = () => resolve(chosen);
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(
            invalid
              ? "The saved browser identity could not be read. Contact Fondeka support for device recovery."
              : "The browser identity could not be saved. Allow browser storage and retry.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
