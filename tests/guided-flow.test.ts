import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFlowDraft,
  writeFlowDraft,
  resolveFlowStep,
  validateFlow,
  type FlowStep,
} from "../src/lib/guided-flow";
import { credentialCreationNeedsReview } from "../src/lib/credential-form";
import { businessDestination } from "../src/lib/business-tools";

type Draft = { name: string; description: string; type: string; stock: string; access: string };
const initial: Draft = { name: "", description: "", type: "PHYSICAL", stock: "", access: "" };
function steps(type: string): FlowStep<Draft>[] {
  return [
    { id: "name", validate: (v) => (!v.name.trim() ? { name: "Required" } : {}) },
    {
      id: "description",
      validate: (v) => (!v.description.trim() ? { description: "Required" } : {}),
    },
    { id: "type" },
    type === "PHYSICAL"
      ? { id: "stock", validate: (v) => (!v.stock.trim() ? { stock: "Required" } : {}) }
      : { id: "fulfillment" },
    { id: "review" },
  ];
}
test("bookmark and browser Forward cannot skip an unfinished required decision", () => {
  assert.equal(resolveFlowStep(steps("PHYSICAL"), "review", initial), 0);
  const named = { ...initial, name: "Product" };
  assert.equal(resolveFlowStep(steps("PHYSICAL"), "review", named), 1);
  const described = { ...named, description: "Description" };
  assert.equal(resolveFlowStep(steps("PHYSICAL"), "review", described), 3);
  const valid = { ...described, stock: "0" };
  assert.equal(resolveFlowStep(steps("PHYSICAL"), "review", valid), 4);
  assert.equal(resolveFlowStep(steps("PHYSICAL"), "//external.example", valid), 0);
});
test("changing branch discards an unavailable URL step without requiring unrelated inputs", () => {
  const digital = { ...initial, name: "Guide", description: "Digital guide", type: "DIGITAL" };
  assert.equal(resolveFlowStep(steps("DIGITAL"), "stock", digital), 0);
  assert.equal(resolveFlowStep(steps("DIGITAL"), "review", digital), 4);
  assert.equal(validateFlow(steps("DIGITAL"), digital), undefined);
  assert.deepEqual(validateFlow(steps("PHYSICAL"), digital), {
    index: 3,
    errors: { stock: "Required" },
  });
});
test("final validation catches a previously completed field that was cleared", () => {
  const state = { ...initial, name: "Product", description: "", stock: "4" };
  assert.deepEqual(validateFlow(steps("PHYSICAL"), state), {
    index: 1,
    errors: { description: "Required" },
  });
  assert.equal(
    validateFlow([{ id: "optional", validate: () => ({ optional: undefined }) }], state),
    undefined,
  );
});
function storage() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => entries.get(key) || null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}
test("draft persistence and recovery use an explicit allowlist and account scope", () => {
  const store = storage();
  const form = {
    name: "Guide",
    price: "10.00",
    images: ["public-image", "", "", ""],
    apiKey: "secret",
    phone: "private",
    settlement: { accountRef: "private" },
  };
  const defaults = {
    ...form,
    name: "",
    price: "",
    images: ["", "", "", ""],
    apiKey: "",
    phone: "",
    settlement: null as null | { accountRef: string },
  };
  writeFlowDraft(store, "fondeka-flow:account-a:product", form, ["name", "price", "images"]);
  assert.doesNotMatch(
    store.getItem("fondeka-flow:account-a:product")!,
    /secret|private|apiKey|phone|settlement/,
  );
  const restored = readFlowDraft(store, "fondeka-flow:account-a:product", defaults, [
    "name",
    "price",
    "images",
  ]);
  assert.equal(restored.name, "Guide");
  assert.equal(restored.apiKey, "");
  assert.equal(restored.phone, "");
  assert.equal(restored.settlement, null);
  assert.deepEqual(
    readFlowDraft(store, "fondeka-flow:account-b:product", defaults, ["name", "price", "images"]),
    defaults,
  );
  // Even a manually changed envelope cannot restore non-allowlisted values.
  store.setItem("tampered", JSON.stringify({ version: 1, at: Date.now(), value: form }));
  assert.equal(readFlowDraft(store, "tampered", defaults, ["name"]).apiKey, "");
});
test("invalid, oversized, expired and malformed stored values cannot break a flow", () => {
  const store = storage();
  const now = Date.now();
  const defaults = { name: "", images: ["", "", "", ""], duration: 0 };
  for (const envelope of [
    "{",
    JSON.stringify({ version: 2, at: now, value: { name: "Wrong version" } }),
    JSON.stringify({ version: 1, at: now - 86400001, value: { name: "Old" } }),
    JSON.stringify({ version: 1, at: now + 1, value: { name: "Future" } }),
    "x".repeat(100001),
  ]) {
    store.setItem("draft", envelope);
    assert.deepEqual(
      readFlowDraft(store, "draft", defaults, ["name", "images", "duration"], now),
      defaults,
    );
  }
  store.setItem(
    "draft",
    JSON.stringify({
      version: 1,
      at: now,
      value: { name: [], images: [{ url: "bad" }], duration: null },
    }),
  );
  assert.deepEqual(
    readFlowDraft(store, "draft", defaults, ["name", "images", "duration"], now),
    defaults,
  );
  const unavailable = {
    getItem: () => {
      throw new Error("Storage denied");
    },
  };
  assert.deepEqual(readFlowDraft(unavailable, "draft", defaults, ["name"]), defaults);
});
test("guard recovery retains only known internal guided destinations", () => {
  assert.equal(
    businessDestination(
      "/stores/42?tab=products&newProduct=1&flow=product&step=media&return=https://evil.example",
    ),
    "/stores/42?tab=products&flow=product&step=media&newProduct=1",
  );
  assert.equal(
    businessDestination("/developers?createKey=1&flow=api-key&step=webhook&apiKey=secret"),
    "/developers?flow=api-key&step=webhook&createKey=1",
  );
  assert.equal(businessDestination("https://evil.example/stores?new=1"), undefined);
});

test("credential validation/access denials keep the form while uncertain issuance blocks another POST", () => {
  for (const status of [400, 401, 403, 404, 409, 429])
    assert.equal(credentialCreationNeedsReview({ status }), false);
  assert.equal(credentialCreationNeedsReview({ status: 503, code: "SERVICE_UNAVAILABLE" }), false);
  for (const error of [
    new Error("Malformed successful response"),
    { status: 0 },
    { status: 408 },
    { status: 500 },
    { status: 502 },
    { status: 504 },
    { status: 503 },
  ])
    assert.equal(credentialCreationNeedsReview(error), true);
});
