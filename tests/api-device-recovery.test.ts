import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { DeviceError, isDeviceError, mayRetryDeviceRead } from "../src/lib/device-session";
import { storeOwnerAccessRequired } from "../src/lib/shared-stores";
import { isBusinessTool, needsBusinessToolsRecovery } from "../src/lib/business-tools";

const source = ts.transpileModule(readFileSync("src/lib/api.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function client(responses: Response[], ensureResult = true) {
  let proof = "existing-session";
  let clearedSessions = 0;
  let clearedQueries = 0;
  const events: string[] = [];
  const eventDetails: { type: string; detail: unknown }[] = [];
  const renewals: (string | undefined)[] = [];
  const calls: { path: string; method: string; headers: Headers; body: unknown }[] = [];
  const dependencies: Record<string, unknown> = {
    "./shared-stores": { storeOwnerAccessRequired },
    "./auth": { accessToken: async () => "customer-token", customerScope: async () => "owner" },
    "./session-scope": { tokenCustomerScope: () => "owner" },
    "./device-session": { DeviceError, mayRetryDeviceRead },
    "./device": {
      isDeviceError,
      deviceHeaders: () => ({ "X-Device-Id": "browser", "X-Device-Session": proof }),
      ensureDeviceSession: async (failedToken?: string) => {
        renewals.push(failedToken);
        if (failedToken) proof = "renewed-session";
        return ensureResult;
      },
      clearDeviceSession: () => {
        clearedSessions++;
        proof = "";
      },
    },
    "./business-tools": {
      isBusinessTool,
      needsBusinessToolsRecovery,
    },
    "./query-cache": {
      clearQueryCache: () => clearedQueries++,
      invalidateQueryPaths: () => {},
      forgetCommerceQueries: () => {},
    },
  };
  const exports: {
    api?: <T>(path: string, init?: RequestInit) => Promise<T>;
    resetDeviceRecovery?: () => void;
  } = {};
  runInNewContext(source, {
    exports,
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), name);
      return dependencies[name];
    },
    Event,
    CustomEvent: class extends Event {
      constructor(
        type: string,
        public options?: { detail: unknown },
      ) {
        super(type);
      }
    },
    AbortSignal,
    document: { documentElement: { lang: "en" } },
    window: {
      dispatchEvent: (event: Event & { options?: { detail: unknown } }) => {
        events.push(event.type);
        if (event.options) eventDetails.push({ type: event.type, detail: event.options.detail });
      },
    },
    fetch: async (path: string, init: RequestInit) => {
      calls.push({
        path,
        method: init.method || "GET",
        headers: new Headers(init.headers),
        body: init.body,
      });
      assert.ok(responses.length, "Unexpected automatic request");
      return responses.shift()!;
    },
  });
  return {
    api: exports.api!,
    resetDeviceRecovery: exports.resetDeviceRecovery!,
    verified: () => (proof = "verified-session"),
    calls,
    events,
    eventDetails,
    renewals,
    clearedSessions: () => clearedSessions,
    clearedQueries: () => clearedQueries,
  };
}

const path = "/customer-api/commerce/products/42/training";
const rejection = (code: string, status = 401) =>
  Response.json({ errorCode: code, message: "Device session rejected" }, { status });

test("a curriculum read rejected after session renewal surfaces its error without remounting verification or clearing owner queries", async () => {
  for (const status of [401, 403])
    for (const code of ["DEVICE_SESSION_REQUIRED", "DEVICE_SESSION_EXPIRED"]) {
      const browser = client([rejection(code, status), rejection(code, status)]);
      await assert.rejects(browser.api(path), { status, code });
      assert.equal(browser.calls.length, 2);
      assert.deepEqual(browser.renewals, [undefined, "existing-session"]);
      assert.deepEqual(
        browser.calls.map((call) => call.headers.get("X-Device-Session")),
        ["existing-session", "renewed-session"],
      );
      assert.equal(browser.clearedSessions(), 0);
      assert.equal(browser.clearedQueries(), 0);
      assert.deepEqual(browser.events, []);
    }
});

test("an expired curriculum read resumes once with renewed proof when the backend accepts it", async () => {
  const curriculum = { productId: 42, version: 0, modules: [] };
  const browser = client([rejection("DEVICE_SESSION_EXPIRED"), Response.json(curriculum)]);
  assert.deepEqual(await browser.api(path), curriculum);
  assert.equal(browser.calls.length, 2);
  assert.deepEqual(browser.events, []);
  assert.equal(browser.clearedQueries(), 0);
});

test("an untrusted browser still enters verification without automatically replaying its read", async () => {
  const browser = client([rejection("DEVICE_UNTRUSTED")]);
  await assert.rejects(browser.api(path), { code: "DEVICE_UNTRUSTED" });
  assert.equal(browser.calls.length, 1);
  assert.equal(browser.clearedSessions(), 1);
  assert.equal(browser.clearedQueries(), 1);
  assert.deepEqual(browser.events, ["fondeka:device-required"]);
});

test("a shared-store rejection after successful browser verification stays on the error instead of remounting verification", async () => {
  const shared = "/customer-api/commerce/stores/shared?page=0&size=20";
  const browser = client([rejection("DEVICE_UNTRUSTED"), rejection("DEVICE_UNTRUSTED")]);
  await assert.rejects(browser.api(shared), { code: "DEVICE_UNTRUSTED" });
  browser.verified();
  await assert.rejects(browser.api(shared), { code: "DEVICE_UNTRUSTED" });
  assert.equal(browser.calls.length, 2);
  assert.equal(browser.clearedSessions(), 1);
  assert.equal(browser.clearedQueries(), 1);
  assert.deepEqual(browser.events, ["fondeka:device-required"]);
});

test("repeated failed device checks do not keep clearing queries or reopening verification", async () => {
  const browser = client([], false);
  for (let attempt = 0; attempt < 3; attempt++)
    await assert.rejects(browser.api(path), { code: "DEVICE_SESSION_REQUIRED" });
  assert.equal(browser.calls.length, 0);
  assert.equal(browser.clearedSessions(), 1);
  assert.equal(browser.clearedQueries(), 1);
  assert.deepEqual(browser.events, ["fondeka:device-required"]);
});

test("a successful read or a new login allows device recovery again", async () => {
  for (const recover of ["read", "login"]) {
    const browser = client([
      rejection("DEVICE_UNTRUSTED"),
      ...(recover === "read" ? [Response.json({ restored: true })] : []),
      rejection("DEVICE_UNTRUSTED"),
    ]);
    await assert.rejects(browser.api(path), { code: "DEVICE_UNTRUSTED" });
    browser.verified();
    if (recover === "read") assert.deepEqual(await browser.api(path), { restored: true });
    else browser.resetDeviceRecovery();
    await assert.rejects(browser.api(path), { code: "DEVICE_UNTRUSTED" });
    assert.equal(browser.clearedSessions(), 2);
    assert.deepEqual(browser.events, ["fondeka:device-required", "fondeka:device-required"]);
  }
});

test("device rejection never automatically replays a mutation", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const browser = client([rejection("DEVICE_SESSION_EXPIRED")]);
    const body = JSON.stringify({ version: 0, modules: [] });
    await assert.rejects(browser.api(path, { method, body }), {
      code: "DEVICE_SESSION_EXPIRED",
    });
    assert.equal(browser.calls.length, 1);
    assert.equal(browser.calls[0].method, method);
    assert.equal(browser.calls[0].body, body);
    assert.deepEqual(browser.renewals, [undefined]);
    assert.deepEqual(browser.events, ["fondeka:device-required"]);
  }
});

test("an expired customer login still clears private queries and returns to sign-in", async () => {
  const browser = client([rejection("AUTHENTICATION_FAILED")]);
  await assert.rejects(browser.api(path), { status: 401, code: "AUTHENTICATION_FAILED" });
  assert.equal(browser.calls.length, 1);
  assert.equal(browser.clearedQueries(), 1);
  assert.deepEqual(browser.events, ["fondeka:session-expired"]);
});

test("a staff member is told to contact the owner without opening a personal purchase", async () => {
  for (const envelope of ["access", "details"] as const) {
    const access = {
      paymentResponsibility: "STORE_OWNER",
      staffPaymentRequired: false,
      accessType: "STAFF",
      storeId: 74,
      ownerAccountId: 100,
      requestedTool: "POS",
    };
    const browser = client([
      Response.json(
        {
          errorCode: "BUSINESS_TOOLS_ACCESS_REQUIRED",
          message: "Owner subscription inactive",
          ...(envelope === "access" ? { access } : { details: { access } }),
        },
        { status: 403 },
      ),
    ]);
    await assert.rejects(
      browser.api("/customer-api/commerce/stores/74/pos/orders/quote", {
        method: "POST",
        body: "{}",
      }),
      (error: unknown) => {
        assert.match((error as Error).message, /store owner needs to activate access/);
        assert.match((error as Error).message, /do not need a personal purchase/);
        return true;
      },
    );
    assert.deepEqual(browser.events, ["fondeka:store-access-changed"]);
    const detail = browser.eventDetails[0].detail as { storeId: number; message: string };
    assert.equal(detail.storeId, 74);
    assert.match(detail.message, /store owner needs to activate access/);
    assert.equal(browser.calls.length, 1);
  }
});
test("personal entitlement denials retain the normal purchase recovery while removed store permissions do not", async () => {
  const owner = client([rejection("BUSINESS_TOOLS_ACCESS_REQUIRED", 403)]);
  await assert.rejects(owner.api("/customer-api/commerce/stores/74/products"), { status: 403 });
  assert.ok(owner.events.includes("fondeka:business-tools-required"));
  for (const status of [403, 404]) {
    const staff = client([rejection(status === 403 ? "PERMISSION_DENIED" : "NO_RESULT", status)]);
    await assert.rejects(staff.api("/customer-api/commerce/stores/74/products"), { status });
    assert.deepEqual(staff.events, ["fondeka:store-access-changed"]);
    assert.equal(staff.calls.length, 1);
  }
});
