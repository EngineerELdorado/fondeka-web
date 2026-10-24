import test from "node:test";
import assert from "node:assert/strict";
import { BrowserDeviceSessions, DeviceError, mayRetryDeviceRead } from "../src/lib/device-session";
import type { BrowserIdentity } from "../src/lib/device-identity";

type Dependencies = ConstructorParameters<typeof BrowserDeviceSessions>[0];
const key = crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  false,
  ["sign", "verify"],
);
async function fixture() {
  let stored: string | null = null;
  let account = "account-a";
  let now = 100_000;
  let status = "TRUSTED";
  let offline = false;
  let challenge = "";
  let proof = 0;
  const calls: { account: string; path: string; body?: object }[] = [];
  const identities: boolean[] = [];
  const locks: string[] = [];
  const pair = await key;
  const identity: BrowserIdentity = {
    deviceId: "persisted-id",
    publicKey: "test public key",
    privateKey: pair.privateKey,
  };
  const deps: Dependencies = {
    account: async () => account,
    identity: async (_account, create) => {
      identities.push(create);
      return identity;
    },
    read: () => stored,
    write: (value) => {
      stored = value;
    },
    clear: () => {
      stored = null;
    },
    now: () => now,
    metadata: () => ({ deviceName: "Test browser", preferredLanguage: "en" }),
    sign: (privateKey, value) =>
      crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(value)),
    lock: async (name, run) => {
      locks.push(name);
      return run();
    },
    call: async <T>(scope: string, path: string, body?: object) => {
      calls.push({ account: scope, path, body });
      if (offline) throw new DeviceError("Offline");
      if (path.startsWith("status?")) return { status } as T;
      if (path === "register" && status !== "TRUSTED")
        return { status, nextAction: "POLL_STATUS" } as T;
      if (status !== "TRUSTED") throw new DeviceError("Approval required", 401, "DEVICE_UNTRUSTED");
      if (path === "challenge" || path === "register") {
        challenge = "challenge-" + calls.length;
        return { challenge, status, nextAction: "VERIFY_DEVICE" } as T;
      }
      assert.equal(path, "verify");
      const request = body as { deviceId: string; algorithm: string; signature: string };
      assert.equal(request.deviceId, identity.deviceId);
      assert.equal(request.algorithm, "SHA256withRSA");
      assert.ok(
        await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          pair.publicKey,
          Uint8Array.from(atob(request.signature), (c) => c.charCodeAt(0)),
          new TextEncoder().encode(challenge),
        ),
      );
      return { deviceSession: "proof-" + ++proof, expiresInSeconds: 3600 } as T;
    },
  };
  const manager = new BrowserDeviceSessions(deps);
  return {
    manager,
    deps,
    calls,
    identities,
    locks,
    identity,
    stored: () => stored,
    setStored: (value: string) => {
      stored = value;
    },
    setAccount: (value: string) => {
      account = value;
    },
    advance: () => {
      now += 3_600_000;
    },
    setStatus: (value: string) => {
      status = value;
    },
    offline: () => {
      offline = true;
    },
  };
}

test("expiry and a new tab renew the existing ID by signed challenge, without registration or approval", async () => {
  const f = await fixture();
  assert.equal(await f.manager.ensure(), true);
  assert.deepEqual(
    f.calls.map((call) => call.path),
    ["challenge", "verify"],
  );
  assert.equal(f.manager.headers("account-a")["X-Device-Id"], "persisted-id");
  const first = f.manager.headers("account-a")["X-Device-Session"];
  assert.equal(await f.manager.ensure(), true);
  assert.equal(f.calls.length, 2);
  f.advance();
  assert.deepEqual(f.manager.headers("account-a"), {});
  assert.equal(await f.manager.ensure(), true);
  assert.notEqual(f.manager.headers("account-a")["X-Device-Session"], first);
  assert.ok(f.identities.every((create) => !create));
  assert.ok(f.calls.every((call) => call.path !== "register"));
  f.manager.reset();
  assert.equal(await f.manager.ensure(), true);
  assert.equal(f.manager.headers("account-a")["X-Device-Id"], "persisted-id");
});

test("concurrent reads share renewal and late expired-token errors reuse the newly verified proof", async () => {
  const f = await fixture();
  assert.ok(
    (await Promise.all(Array.from({ length: 12 }, () => f.manager.ensure()))).every(Boolean),
  );
  assert.equal(f.calls.length, 2);
  const previous = f.manager.headers("account-a")["X-Device-Session"];
  await f.manager.ensure(previous);
  assert.equal(f.calls.length, 4);
  await f.manager.ensure(previous);
  assert.equal(f.calls.length, 4);
  assert.ok(f.locks.every((name) => name === "fondeka-device-proof:account-a:persisted-id"));
});

test("tab locks keep each challenge/signature/verification sequence together across tabs", async () => {
  const f = await fixture();
  let queue = Promise.resolve();
  const lock: Dependencies["lock"] = async (_name, run) => {
    const next = queue.then(run);
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  let tabB: string | null = null;
  const first = new BrowserDeviceSessions({ ...f.deps, lock });
  const second = new BrowserDeviceSessions({
    ...f.deps,
    lock,
    read: () => tabB,
    write: (value) => {
      tabB = value;
    },
  });
  assert.deepEqual(await Promise.all([first.ensure(), second.ensure()]), [true, true]);
  assert.deepEqual(
    f.calls.map((call) => call.path),
    ["challenge", "verify", "challenge", "verify"],
  );
  assert.equal(
    first.headers("account-a")["X-Device-Id"],
    second.headers("account-a")["X-Device-Id"],
  );
  assert.notEqual(
    first.headers("account-a")["X-Device-Session"],
    second.headers("account-a")["X-Device-Session"],
  );
});

test("missing identity, unapproved/revoked devices and temporary failures never silently create or trust a replacement", async () => {
  const missing = await fixture();
  missing.deps.identity = async (_account, create) => {
    assert.equal(create, false);
    return undefined;
  };
  assert.equal(await missing.manager.ensure(), false);
  assert.equal(missing.calls.length, 0);
  for (const status of ["PENDING", "REVOKED", "BLOCKED", "REJECTED"]) {
    const f = await fixture();
    f.setStatus(status);
    assert.equal(await f.manager.ensure(), false);
    assert.equal(f.stored(), null);
    assert.deepEqual(
      f.calls.map((call) => call.path),
      ["challenge"],
    );
  }
  const offline = await fixture();
  offline.offline();
  await assert.rejects(offline.manager.ensure(), /Offline/);
  assert.deepEqual(offline.identities, [false]);
  assert.equal(offline.stored(), null);
  const pending = await fixture();
  pending.setStatus("PENDING");
  assert.equal((await pending.manager.register()).verified, false);
  assert.equal(await pending.manager.approved(), false);
  assert.deepEqual(pending.manager.headers("account-a"), {});
});

test("proof is account bound; legacy proof renews without rotating identity and logout discards late verification", async () => {
  const f = await fixture();
  f.setStored(
    JSON.stringify({ deviceId: "persisted-id", token: "legacy", expiresAt: 999_999_999 }),
  );
  assert.deepEqual(f.manager.headers("account-a"), {});
  await f.manager.ensure();
  assert.equal(JSON.parse(f.stored()!).accountKey, "account-a");
  assert.deepEqual(f.manager.headers("account-b"), {});
  const originalCall = f.deps.call;
  let finish!: (value: unknown) => void;
  let entered!: () => void;
  const started = new Promise<void>((done) => {
    entered = done;
  });
  f.deps.call = async <T>(account: string, path: string, body?: object) => {
    if (path === "verify") {
      entered();
      return new Promise<T>((done) => {
        finish = done as (value: unknown) => void;
      });
    }
    return originalCall<T>(account, path, body);
  };
  const pending = f.manager.ensure(f.manager.headers("account-a")["X-Device-Session"]);
  const rejected = assert.rejects(pending, /account changed/);
  await started;
  f.manager.reset();
  f.setAccount("account-b");
  finish({ deviceSession: "late-proof", expiresInSeconds: 3600 });
  await rejected;
  assert.equal(f.stored(), null);
  assert.deepEqual(f.manager.headers("account-b"), {});
});

test("malformed successful proof responses cannot be treated as verification", async () => {
  for (const response of [
    {},
    { deviceSession: "test", expiresInSeconds: 0 },
    { deviceSession: "", expiresInSeconds: 3600 },
  ]) {
    const f = await fixture();
    const original = f.deps.call;
    f.deps.call = async <T>(account: string, path: string, body?: object) =>
      path === "verify" ? (response as T) : original<T>(account, path, body);
    await assert.rejects(f.manager.ensure(), /valid device session/);
    assert.equal(f.stored(), null);
  }
});

test("only safe GETs with expired/missing session errors may retry after renewal", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
    for (const code of ["DEVICE_SESSION_EXPIRED", "DEVICE_SESSION_REQUIRED"])
      assert.equal(mayRetryDeviceRead(method, code), false);
  assert.equal(mayRetryDeviceRead("GET", "DEVICE_SESSION_EXPIRED"), true);
  assert.equal(mayRetryDeviceRead("get", "DEVICE_SESSION_REQUIRED"), true);
  for (const code of [
    undefined,
    "DEVICE_UNTRUSTED",
    "DEVICE_REPLACEMENT_PENDING",
    "BUSINESS_TOOLS_ACCESS_REQUIRED",
  ])
    assert.equal(mayRetryDeviceRead("GET", code), false);
});
