import { test } from "node:test";
import assert from "node:assert/strict";
import {
  businessDetailsDraft,
  businessDetailsErrors,
  businessDetailsPatch,
  businessDetailsPath,
  businessDisplayName,
  parseBusinessDetails,
  rebaseBusinessDetails,
  replaceBusinessDetails,
} from "../src/lib/business-profile";
import {
  cacheQuery,
  cachedQuery,
  clearQueryCache,
  fetchQuery,
  queryCacheGeneration,
} from "../src/lib/query-cache";
import { demoRequest, resetDemo } from "../src/lib/demo";
import type { Business, Page } from "../src/lib/types";

const business: Business = {
  id: 42,
  name: "Atelier Kin",
  legalName: "Atelier Kin SARL",
  countryCode: "CD",
  registrationNumber: "REG-001",
  status: "ACTIVE",
  kybStatus: "APPROVED",
  defaultBusiness: true,
};

test("Business updates contain only changed editable fields, normalize text and clear optional fields explicitly", () => {
  assert.equal(businessDetailsPath(42), "/customer-api/businesses/42");
  for (const id of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => businessDetailsPath(id));
  const draft = businessDetailsDraft(business);
  assert.deepEqual(businessDetailsPatch(business, draft), {});
  assert.deepEqual(
    businessDetailsPatch(business, { ...draft, name: "  New name  ", countryCode: "cd" }),
    { name: "New name" },
  );
  assert.deepEqual(
    businessDetailsPatch(business, {
      ...draft,
      legalName: "  ",
      registrationNumber: "",
      countryCode: " ",
    }),
    {
      legalName: null,
      countryCode: null,
      registrationNumber: null,
    },
  );
  assert.deepEqual(businessDetailsPatch(business, { ...draft, countryCode: " ke " }), {
    countryCode: "KE",
  });
  assert.deepEqual(
    businessDetailsErrors({
      ...draft,
      name: " ",
      legalName: "x".repeat(255),
      countryCode: "ZZ",
      registrationNumber: "x".repeat(129),
    }),
    {
      name: "required",
      legalName: "tooLong",
      registrationNumber: "tooLong",
      countryCode: "country",
    },
  );
  for (const code of ["USA", "1A", "XK", "éé"])
    assert.equal(businessDetailsErrors({ ...draft, countryCode: code }).countryCode, "country");
  assert.deepEqual(
    businessDetailsErrors({
      ...draft,
      name: "x".repeat(180),
      legalName: "x".repeat(254),
      registrationNumber: "x".repeat(128),
    }),
    {},
  );
  assert.throws(() => businessDetailsPatch(business, { ...draft, name: " " }));
  assert.deepEqual(
    businessDetailsPatch(business, {
      ...draft,
      name: "New name",
      status: "BLOCKED",
      id: 8,
    } as typeof draft),
    { name: "New name" },
  );
});

test("conflict review preserves intentional edits while adopting concurrent changes to untouched fields", () => {
  const draft = { ...businessDetailsDraft(business), name: "My new name", legalName: "" };
  const latest = {
    ...business,
    registrationNumber: "REG-NEW",
    countryCode: "KE",
    legalName: "Concurrent legal name",
  };
  const reviewed = rebaseBusinessDetails(business, draft, latest);
  assert.deepEqual(reviewed, {
    name: "My new name",
    legalName: "",
    countryCode: "KE",
    registrationNumber: "REG-NEW",
  });
  assert.deepEqual(businessDetailsPatch(latest, reviewed), {
    name: "My new name",
    legalName: null,
  });
  assert.equal(draft.name, "My new name");
});

test("saved Business resources replace only the current account's list/detail caches and suppress stale reads", async () => {
  clearQueryCache();
  const generation = queryCacheGeneration();
  const path = businessDetailsPath(42);
  const listPath = "/customer-api/businesses?page=0&size=20";
  const page = {
    content: [business, { ...business, id: 43 }],
    totalElements: 2,
    totalPages: 1,
    number: 0,
    size: 20,
  };
  for (const account of ["account-a", "account-b"]) {
    cacheQuery(`${account}:list`, page, Date.now(), generation, listPath, "v1");
    cacheQuery(`${account}:detail`, business, Date.now(), generation, path, "v1");
  }
  cacheQuery("account-a:wallets", ["USD"], Date.now(), generation, path + "/api-wallets", "v1");
  let reject!: (error: Error) => void;
  const previous = fetchQuery(
    "account-a:detail",
    "v1",
    path,
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
    true,
  );
  const rejected = assert.rejects(previous, { name: "AbortError" });
  await Promise.resolve();
  const saved = parseBusinessDetails(
    { ...business, name: "Server-normalized name", legalName: null },
    42,
  );
  replaceBusinessDetails("account-a", saved, generation);
  reject(new Error("An aborted fetch reported a network error"));
  await rejected;
  assert.equal(cachedQuery<Business>("account-a:detail")?.name, "Server-normalized name");
  assert.deepEqual(cachedQuery<Page<Business>>("account-a:list")?.content, [
    saved,
    page.content[1],
  ]);
  assert.deepEqual(cachedQuery("account-a:wallets"), ["USD"]);
  assert.deepEqual(cachedQuery("account-b:list"), page);
  assert.deepEqual(cachedQuery("account-b:detail"), business);
  clearQueryCache();
  cacheQuery("account-a:detail", business, Date.now(), queryCacheGeneration(), path, "v1");
  replaceBusinessDetails("account-a", saved, generation);
  assert.deepEqual(cachedQuery("account-a:detail"), business);
  assert.throws(() => parseBusinessDetails(saved, 43));
  assert.throws(() => parseBusinessDetails({ ...saved, name: "" }, 42));
  assert.throws(() => parseBusinessDetails({ ...saved, status: undefined }, 42));
  clearQueryCache();
});

test("demo Business PATCH is scoped, partial and rejects empty/read-only updates without creating a Business", async () => {
  resetDemo();
  const path = businessDetailsPath(1);
  const before = await demoRequest<Business>(path);
  const saved = await demoRequest<Business>(path, {
    method: "PATCH",
    body: JSON.stringify({ name: " Updated demo ", legalName: null }),
  });
  assert.equal(saved.name, "Updated demo");
  assert.equal(saved.legalName, null);
  for (const key of ["id", "status", "kybStatus", "defaultBusiness", "countryCode"] as const)
    assert.equal(saved[key], before[key]);
  const page = await demoRequest<Page<Business>>("/customer-api/businesses?page=0&size=20");
  assert.equal(page.totalElements, 1);
  assert.equal(page.content[0].name, saved.name);
  for (const body of [{}, { status: "BLOCKED" }, { name: null }, { countryCode: "ZZ" }])
    await assert.rejects(demoRequest(path, { method: "PATCH", body: JSON.stringify(body) }), {
      status: 400,
    });
  await assert.rejects(
    demoRequest(businessDetailsPath(2), {
      method: "PATCH",
      body: JSON.stringify({ name: "Foreign" }),
    }),
    { status: 404 },
  );
  resetDemo();
});

test("Business identity omits missing names and generated account-reference placeholders", () => {
  assert.equal(businessDisplayName(), undefined);
  assert.equal(businessDisplayName({ name: "  ", legalName: " " }), undefined);
  for (const name of ["Business FDK096503424", "FDK096503424", "Business 42", "42"])
    assert.equal(businessDisplayName({ name }), undefined);
});

test("Business identity uses a real display or legal name without the generic prefix", () => {
  assert.equal(
    businessDisplayName({ name: " Atelier Kin ", legalName: "Atelier Kin SARL" }),
    "Atelier Kin",
  );
  assert.equal(
    businessDisplayName({ name: "Business FDK096503424", legalName: "Atelier Kin SARL" }),
    "Atelier Kin SARL",
  );
  assert.equal(businessDisplayName({ name: "Business Atelier Kin" }), "Atelier Kin");
});
