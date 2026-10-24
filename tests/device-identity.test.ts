import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { browserIdentity, deviceBase64 } from "../src/lib/device-identity";

test("a persisted non-exportable browser identity survives reloads and remains account scoped", async () => {
  const factory = new IDBFactory();
  assert.equal(await browserIdentity("account-a", false, factory), undefined);
  const first = (await browserIdentity("account-a", true, factory))!;
  const restored = (await browserIdentity("account-a", true, factory))!;
  assert.equal(restored.deviceId, first.deviceId);
  assert.equal(restored.publicKey, first.publicKey);
  assert.equal(restored.privateKey.extractable, false);
  await assert.rejects(crypto.subtle.exportKey("pkcs8", restored.privateKey));
  const other = (await browserIdentity("account-b", true, factory))!;
  assert.notEqual(other.deviceId, first.deviceId);
  assert.equal((await browserIdentity("account-a", false, factory))?.deviceId, first.deviceId);
});

test("two tabs creating their first identity atomically agree on one ID and signing key", async () => {
  const factory = new IDBFactory();
  let started = 0;
  let release!: () => void;
  const ready = new Promise<void>((done) => {
    release = done;
  });
  const subtle = new Proxy(crypto.subtle, {
    get(target, property) {
      if (property === "generateKey")
        return async (...args: Parameters<SubtleCrypto["generateKey"]>) => {
          if (++started === 2) release();
          await ready;
          return target.generateKey(...args);
        };
      const method = Reflect.get(target, property);
      return typeof method === "function" ? method.bind(target) : method;
    },
  });
  const [tabA, tabB] = await Promise.all([
    browserIdentity("same-account", true, factory, subtle),
    browserIdentity("same-account", true, factory, subtle),
  ]);
  assert.equal(started, 2);
  assert.equal(tabA?.deviceId, tabB?.deviceId);
  assert.equal(tabA?.publicKey, tabB?.publicKey);
  const persisted = (await browserIdentity("same-account", false, factory))!;
  const spki = Uint8Array.from(
    atob(persisted.publicKey.replace(/-----(?:BEGIN|END) PUBLIC KEY-----|\s/g, "")),
    (c) => c.charCodeAt(0),
  );
  const publicKey = await crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"],
  );
  const challenge = new TextEncoder().encode("same persisted key in both tabs");
  for (const identity of [tabA!, tabB!]) {
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", identity.privateKey, challenge);
    assert.ok(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, challenge));
  }
  assert.equal(deviceBase64(new Uint8Array([1, 2, 3]).buffer), "AQID");
});

test("corrupt identities and blocked storage fail without silently replacing an approved ID", async () => {
  const factory = new IDBFactory();
  const db = await new Promise<IDBDatabase>((resolve) => {
    const request = factory.open("fondeka-device-keys", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("identities");
    request.onsuccess = () => resolve(request.result);
  });
  await new Promise<void>((resolve) => {
    const tx = db.transaction("identities", "readwrite");
    tx.objectStore("identities").put(
      { deviceId: "existing-approved-id", privateKey: null },
      "account-a",
    );
    tx.oncomplete = () => resolve();
  });
  db.close();
  await assert.rejects(browserIdentity("account-a", true, factory), /saved browser identity/);
  await assert.rejects(browserIdentity("account-a", false, factory), /saved browser identity/);
  const blocked = {
    open() {
      throw new DOMException("Storage blocked", "SecurityError");
    },
  } as unknown as IDBFactory;
  await assert.rejects(browserIdentity("account-a", true, blocked), { name: "SecurityError" });
});
