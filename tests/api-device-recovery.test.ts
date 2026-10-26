import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { DeviceError, isDeviceError, mayRetryDeviceRead } from "../src/lib/device-session";

const source = ts.transpileModule(readFileSync("src/lib/api.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function client(responses: Response[]) {
  let proof = "existing-session";
  let clearedSessions = 0;
  let clearedQueries = 0;
  const events: string[] = [];
  const renewals: (string | undefined)[] = [];
  const calls: { path: string; method: string; headers: Headers; body: unknown }[] = [];
  const dependencies: Record<string, unknown> = {
    "./auth": { accessToken: async () => "customer-token", customerScope: async () => "owner" },
    "./session-scope": { tokenCustomerScope: () => "owner" },
    "./device-session": { DeviceError, mayRetryDeviceRead },
    "./device": {
      isDeviceError,
      deviceHeaders: () => ({ "X-Device-Id": "browser", "X-Device-Session": proof }),
      ensureDeviceSession: async (failedToken?: string) => {
        renewals.push(failedToken);
        if (failedToken) proof = "renewed-session";
        return true;
      },
      clearDeviceSession: () => {
        clearedSessions++;
        proof = "";
      },
    },
    "./business-tools": {
      isBusinessTool: () => false,
      needsBusinessToolsRecovery: () => false,
    },
    "./query-cache": {
      clearQueryCache: () => clearedQueries++,
      invalidateQueryPaths: () => {},
    },
  };
  const exports: { api?: <T>(path: string, init?: RequestInit) => Promise<T> } = {};
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
    window: { dispatchEvent: (event: Event) => events.push(event.type) },
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
    calls,
    events,
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
