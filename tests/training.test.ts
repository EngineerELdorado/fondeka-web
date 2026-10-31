import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  demoTrainingRequest,
  demoTrainingPublishable,
  seedDemoTraining,
} from "../src/lib/demo-training";
import type { Product } from "../src/lib/types";
import { GET, PUT, POST } from "../src/app/api/backend/[...path]/route";
import { allowedProxyRoute, proxyBodyLimit } from "../src/lib/proxy-policy";
import { businessDestination, needsBusinessToolsRecovery } from "../src/lib/business-tools";
import {
  cacheQuery,
  cachedQuery,
  clearQueryCache,
  queryCacheGeneration,
} from "../src/lib/query-cache";
import {
  hasTrainingAccessUrls,
  isTrainingContentPath,
  parseMaterialAccess,
  parseTrainingCurriculum,
  trainingHttpsUrl,
  trainingMaterialPath,
  trainingPath,
  trainingPayload,
  trainingPreviewCurriculum,
  type TrainingCurriculum,
  type TrainingModule,
} from "../src/lib/training";
const moduleId = "11111111-1111-4111-8111-111111111111";
const lessonId = "22222222-2222-4222-8222-222222222222";
const secondId = "33333333-3333-4333-8333-333333333333";
const key = `commerce-training-assets/7/${lessonId}.pdf`;
const module = (): TrainingModule => ({
  id: moduleId,
  title: " Getting started ",
  description: "Overview",
  published: true,
  materials: [
    {
      id: lessonId,
      title: "Introduction",
      description: "Learner notes",
      type: "LINK",
      published: true,
      linkUrl: "https://example.com/watch?lesson=1#start",
      completed: true,
    },
  ],
});
test("owner learner preview hides unpublished content, strips author sources and isolates completion", () => {
  const visible = module();
  visible.materials.push({ ...visible.materials[0], id: secondId, published: false });
  const source: TrainingCurriculum = {
    productId: 42,
    title: "Training",
    version: 4,
    modules: [
      visible,
      { ...module(), id: secondId, published: false },
      {
        id: "44444444-4444-4444-8444-444444444444",
        title: "Empty",
        published: true,
        materials: [],
      },
    ],
    totalMaterials: 3,
    completedMaterials: 3,
    progressPercentage: 100,
    nextMaterialId: null,
  };
  const before = structuredClone(source);
  const fresh = trainingPreviewCurriculum(source);
  assert.deepEqual(
    fresh.modules.map((item) => item.id),
    [moduleId],
  );
  assert.deepEqual(
    fresh.modules[0].materials.map((item) => item.id),
    [lessonId],
  );
  assert.equal(fresh.modules[0].materials[0].linkUrl, null);
  assert.equal(fresh.modules[0].materials[0].assetKey, null);
  assert.equal(fresh.modules[0].materials[0].completed, false);
  assert.equal(fresh.modules[0].materials[0].completedAt, null);
  assert.equal(fresh.totalMaterials, 1);
  assert.equal(fresh.completedMaterials, 0);
  assert.equal(fresh.progressPercentage, 0);
  assert.equal(fresh.nextMaterialId, lessonId);
  const completed = trainingPreviewCurriculum(source, new Set([lessonId, secondId]));
  assert.equal(completed.completedMaterials, 1);
  assert.equal(completed.progressPercentage, 100);
  assert.equal(completed.nextMaterialId, null);
  assert.deepEqual(source, before);
  assert.equal(trainingPreviewCurriculum(source).completedMaterials, 0);
  const empty = trainingPreviewCurriculum({ ...source, modules: [] });
  assert.equal(empty.progressPercentage, 0);
  assert.equal(empty.nextMaterialId, null);
});
test("preview preserves lesson order and uses the learner percentage and next-material rules", () => {
  const source: TrainingCurriculum = {
    productId: 42,
    title: "Training",
    version: 1,
    modules: [
      {
        ...module(),
        materials: [lessonId, secondId, moduleId].map((id) => ({
          id,
          title: id,
          type: "FILE",
          published: true,
          assetKey: key,
        })),
      },
    ],
    totalMaterials: 3,
    completedMaterials: 0,
    progressPercentage: 0,
    nextMaterialId: lessonId,
  };
  const preview = trainingPreviewCurriculum(source, new Set([secondId]));
  assert.equal(preview.progressPercentage, 33);
  assert.equal(preview.nextMaterialId, lessonId);
  assert.deepEqual(
    preview.modules[0].materials.map((item) => item.id),
    [lessonId, secondId, moduleId],
  );
  assert.ok(preview.modules[0].materials.every((item) => item.assetKey === null));
});
test("training demo exercises draft saves, version conflicts, ID-preserving moves and unrestricted learner progress", () => {
  const products: Product[] = [
    {
      id: 99001,
      storeId: 1,
      name: "Draft training",
      type: "TRAINING",
      status: "DRAFT",
      priceAmount: 25,
      priceCurrency: "USD",
    },
  ];
  seedDemoTraining(products);
  const read = (path: string, method = "GET", body?: unknown) =>
    demoTrainingRequest(path, method, body, new URLSearchParams(), products)
      ?.data as TrainingCurriculum;
  const author = "/commerce/products/99001/training";
  const empty = read(author);
  assert.equal(empty.version, 0);
  assert.equal(demoTrainingPublishable(99001), false);
  assert.throws(
    () => read("/commerce/trainings/99001"),
    (error: unknown) => (error as { code: string }).code === "TRAINING_ACCESS_REQUIRED",
  );
  const first = read(author, "PUT", {
    version: 0,
    modules: [
      { ...module(), id: undefined, materials: [{ ...module().materials[0], id: undefined }] },
    ],
  });
  const savedId = first.modules[0].materials[0].id;
  assert.ok(savedId);
  assert.equal(first.version, 1);
  assert.equal(demoTrainingPublishable(99001), true);
  const preview = trainingPreviewCurriculum(first);
  const authorAccess = demoTrainingRequest(
    `${author}/materials/${preview.nextMaterialId}/access`,
    "GET",
    undefined,
    new URLSearchParams(),
    products,
  )?.data as { url: string };
  assert.equal(authorAccess.url, "https://example.com/watch?lesson=1#start");
  // Preview does not grant enrollment or write any learner progress.
  assert.throws(
    () => read("/commerce/trainings/99001"),
    (error: unknown) => (error as { code: string }).code === "TRAINING_ACCESS_REQUIRED",
  );
  assert.equal(read(author).completedMaterials, 0);
  assert.throws(
    () => read(author, "PUT", { version: 0, modules: first.modules }),
    (error: unknown) => (error as { status: number }).status === 409,
  );
  const moved = read(author, "PUT", {
    version: first.version,
    modules: [
      { ...first.modules[0], materials: [] },
      { title: "Next module", published: true, materials: first.modules[0].materials },
    ],
  });
  assert.equal(moved.modules[1].materials[0].id, savedId);
  const course = read("/commerce/trainings/9101");
  const laterLesson = course.modules[0].materials[1];
  assert.equal(laterLesson.linkUrl, null);
  const progress = read(`/commerce/trainings/9101/materials/${laterLesson.id}/progress`, "PATCH", {
    completed: true,
  });
  assert.equal(progress.completedMaterials, 1);
  assert.equal(progress.progressPercentage, 50);
  assert.equal(progress.nextMaterialId, course.modules[0].materials[0].id);
  const repeated = read(`/commerce/trainings/9101/materials/${laterLesson.id}/progress`, "PATCH", {
    completed: true,
  });
  assert.equal(repeated.completedMaterials, 1);
  const updated = read("/commerce/products/9101/training", "PUT", {
    version: course.version,
    modules: [
      ...course.modules.map((item) => ({
        ...item,
        materials: item.materials.map((material) => ({
          ...material,
          linkUrl: "https://example.com/lesson",
        })),
      })),
      {
        title: "New module",
        published: true,
        materials: [
          {
            title: "New lesson",
            type: "LINK",
            published: true,
            linkUrl: "https://example.com/new",
          },
        ],
      },
    ],
  });
  assert.equal(updated.version, course.version + 1);
  const expanded = read("/commerce/trainings/9101");
  assert.equal(expanded.totalMaterials, 3);
  assert.equal(expanded.completedMaterials, 1);
  assert.equal(expanded.progressPercentage, 33);
  assert.throws(() =>
    read("/commerce/products/9101/training", "PUT", { version: updated.version, modules: [] }),
  );
});
test("training routes and methods are exact, separate authoring from learning, and expose no arbitrary storage proxy", () => {
  const entries: [string, string[]][] = [
    ["customer-api/commerce/products/42/training", ["GET", "PUT"]],
    ["customer-api/commerce/products/42/training/assets/presign", ["POST"]],
    [`customer-api/commerce/products/42/training/materials/${lessonId}/access`, ["GET"]],
    ["customer-api/commerce/trainings", ["GET"]],
    ["customer-api/commerce/trainings/42", ["GET"]],
    [`customer-api/commerce/trainings/42/materials/${lessonId}/access`, ["GET"]],
    [`customer-api/commerce/trainings/42/materials/${lessonId}/progress`, ["PATCH"]],
  ];
  for (const [path, methods] of entries)
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"])
      assert.equal(allowedProxyRoute(path, method), methods.includes(method), `${method} ${path}`);
  for (const path of [
    "customer-api/commerce/products/42/training/anything",
    `customer-api/commerce/products/42/training/materials/${lessonId}/progress`,
    "customer-api/commerce/trainings/42/materials/not-an-id/access",
    "public/commerce/orders/REF/items/1/training",
    "admin-api/commerce/trainings",
    "https://storage.example/object",
    "customer-api/commerce/products/42/training/assets/put",
  ])
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"])
      assert.equal(allowedProxyRoute(path, method), false, path);
  assert.equal(trainingPath(42, true), "/customer-api/commerce/products/42/training");
  assert.equal(
    trainingMaterialPath(42, lessonId, "progress"),
    `/customer-api/commerce/trainings/42/materials/${lessonId}/progress`,
  );
  assert.throws(() => trainingMaterialPath(42, lessonId, "progress", true));
  assert.throws(() => trainingPath(-1));
  assert.throws(() => trainingMaterialPath(42, "../../x", "access"));
});
test("only full curriculum PUTs gain enough JSON capacity for the documented curriculum limits", () => {
  assert.equal(
    proxyBodyLimit("customer-api/commerce/products/42/training", "PUT"),
    64 * 1024 * 1024,
  );
  assert.equal(proxyBodyLimit("customer-api/commerce/products/42/training", "POST"), 64_000);
  assert.equal(
    proxyBodyLimit("customer-api/commerce/products/42/training/assets/presign", "POST"),
    64_000,
  );
  assert.equal(proxyBodyLimit("customer-api/commerce/products/42", "PATCH"), 64_000);
});
test("curriculum writes retain server IDs and ordered arrays while omitting UI/read-only/progress fields", () => {
  const source = module();
  source.materials.push({
    title: "New lesson",
    type: "FILE",
    published: false,
    assetKey: key,
    fileName: "worksheet.pdf",
    contentType: "application/pdf",
  });
  const payload = trainingPayload(3, [source]);
  assert.equal(payload.version, 3);
  assert.equal(payload.modules[0].id, moduleId);
  assert.equal(payload.modules[0].title, "Getting started");
  assert.equal(payload.modules[0].materials[0].id, lessonId);
  assert.equal(payload.modules[0].materials[0].linkUrl, "https://example.com/watch?lesson=1#start");
  assert.equal(payload.modules[0].materials[1].id, undefined);
  assert.equal(payload.modules[0].materials[1].assetKey, key);
  assert.equal(payload.modules[0].materials[1].fileName, "worksheet.pdf");
  assert.equal(payload.modules[0].materials[1].linkUrl, undefined);
  assert.doesNotMatch(
    JSON.stringify(payload),
    /completed|position|contentType|fileSize|price|purchase|clientKey/,
  );
  const moved = trainingPayload(3, [
    { ...source, materials: [] },
    { id: secondId, title: "Next", published: false, materials: [source.materials[0]] },
  ]);
  assert.equal(moved.modules[1].materials[0].id, lessonId);
  assert.equal(moved.modules[0].materials.length, 0);
});
test("invalid source combinations, insecure URLs, reused IDs and excessive curriculum input fail before saving", () => {
  for (const link of [
    "http://example.com",
    "javascript:alert(1)",
    "https://user:password@example.com",
    "/local-path",
  ]) {
    assert.equal(trainingHttpsUrl(link), undefined);
    const source = module();
    source.materials[0].linkUrl = link;
    assert.throws(() => trainingPayload(0, [source]));
  }
  const both = module();
  both.materials[0].assetKey = key;
  assert.throws(() => trainingPayload(0, [both]));
  const file = module();
  file.materials[0] = {
    ...file.materials[0],
    type: "FILE",
    assetKey: "commerce-digital-assets/public.pdf",
    linkUrl: null,
  };
  assert.throws(() => trainingPayload(0, [file]));
  assert.throws(() => trainingPayload(0, [module(), module()]));
  assert.throws(() => trainingPayload(-1, [module()]));
  assert.throws(() =>
    trainingPayload(
      0,
      Array.from({ length: 101 }, () => ({ ...module(), id: undefined })),
    ),
  );
  const tooMany = module();
  tooMany.materials = Array.from({ length: 201 }, () => ({
    ...module().materials[0],
    id: undefined,
  }));
  assert.throws(() => trainingPayload(0, [tooMany]));
  assert.throws(() => trainingPayload(0, [{ ...module(), title: " " }]));
  assert.throws(() => trainingPayload(0, [{ ...module(), description: "x".repeat(4001) }]));
});
test("paid content and bearer fulfillment links never enter the shared account query cache", () => {
  clearQueryCache();
  const privatePaths = [
    trainingPath(42),
    trainingPath(42, true),
    trainingMaterialPath(42, lessonId, "access"),
  ];
  for (const path of privatePaths) {
    assert.equal(isTrainingContentPath(path), true);
    cacheQuery(path, { title: "Paid notes" }, Date.now(), queryCacheGeneration(), path);
    assert.equal(cachedQuery(path), undefined);
  }
  const item = { trainingPlayerUrl: "https://example.com/player?accessToken=fixture-only" };
  for (const data of [{ items: [item] }, { content: [{ items: [item] }] }, [item]]) {
    assert.equal(hasTrainingAccessUrls(data), true);
    cacheQuery(
      "owner-orders",
      data,
      Date.now(),
      queryCacheGeneration(),
      "/customer-api/commerce/orders/REF",
    );
    assert.equal(cachedQuery("owner-orders"), undefined);
  }
  const publicPath = "/customer-api/commerce/products/42";
  cacheQuery(
    publicPath,
    { image1: "https://example.com/public-image.jpg" },
    Date.now(),
    queryCacheGeneration(),
    publicPath,
  );
  assert.ok(cachedQuery(publicPath));
});
test("fresh material access retains exact signed URLs, rejects expiry or another material, and does not invent IDs", () => {
  const data = {
    materialId: lessonId,
    type: "FILE",
    url: "https://storage.example.com/private?X-Amz-Signature=fixture-only",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  };
  assert.equal(parseMaterialAccess(data, lessonId).url, data.url);
  assert.throws(() => parseMaterialAccess(data, secondId));
  assert.throws(() =>
    parseMaterialAccess({ ...data, expiresAt: new Date(Date.now() - 1).toISOString() }, lessonId),
  );
  assert.throws(() => parseMaterialAccess({ ...data, expiresAt: null }, lessonId));
  assert.equal(
    parseMaterialAccess({ ...data, type: "LINK", expiresAt: null }, lessonId).expiresAt,
    null,
  );
  const curriculum = {
    productId: 42,
    title: "Training",
    version: 1,
    modules: [module()],
    totalMaterials: 1,
    completedMaterials: 0,
    progressPercentage: 0,
    nextMaterialId: lessonId,
  };
  assert.equal(parseTrainingCurriculum(curriculum).nextMaterialId, lessonId);
  assert.throws(() => parseTrainingCurriculum({ ...curriculum, progressPercentage: 101 }));
});
test("learning and its payment denials are independent of the owner Business Tools gate", () => {
  assert.equal(businessDestination("/trainings"), undefined);
  assert.equal(businessDestination("/trainings/42"), undefined);
  assert.equal(
    needsBusinessToolsRecovery(403, "TRAINING_ACCESS_REQUIRED", trainingPath(42)),
    false,
  );
  assert.equal(
    needsBusinessToolsRecovery(403, "BUSINESS_TOOLS_ACCESS_REQUIRED", trainingPath(42, true)),
    true,
  );
  assert.equal(
    businessDestination("/stores/7?training=42&returnTo=https://foreign.example"),
    "/stores/7?training=42",
  );
});
test("training proxy forwards only customer proof and exact JSON with no-store/no-referrer, including large replacements", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };
  try {
    const body = JSON.stringify({ version: 1, modules: [{ description: "x".repeat(80_000) }] });
    const path = ["customer-api", "commerce", "products", "42", "training"];
    const headers = {
      Authorization: "Bearer customer.jwt",
      Origin: "http://localhost:4200",
      "X-Device-Id": "browser",
      "X-Device-Session": "trusted-proof",
      "Accept-Language": "fr",
      "X-API-Key": "must-not-forward",
    };
    const response = await PUT(
      new NextRequest(`http://localhost:4200/api/backend/${path.join("/")}`, {
        method: "PUT",
        headers,
        body,
      }),
      { params: Promise.resolve({ path }) },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(
      calls[0].url,
      "https://backend.example/customer-api/commerce/products/42/training",
    );
    assert.equal(calls[0].init?.body, body);
    assert.equal(calls[0].init?.cache, "no-store");
    const forwarded = new Headers(calls[0].init?.headers);
    assert.equal(forwarded.get("X-Device-Session"), "trusted-proof");
    assert.equal(forwarded.get("Accept-Language"), "fr");
    assert.equal(forwarded.get("X-API-Key"), null);
    const invalid = await POST(
      new NextRequest(`http://localhost:4200/api/backend/${path.join("/")}`, {
        method: "POST",
        headers,
        body: "{}",
      }),
      { params: Promise.resolve({ path }) },
    );
    assert.equal(invalid.status, 404);
    const learnerPath = ["customer-api", "commerce", "trainings", "42"];
    const deniedOrigin = await GET(
      new NextRequest(`http://localhost:4200/api/backend/${learnerPath.join("/")}`, {
        headers: { ...headers, Origin: "https://foreign.example" },
      }),
      { params: Promise.resolve({ path: learnerPath }) },
    );
    assert.equal(deniedOrigin.status, 403);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});
