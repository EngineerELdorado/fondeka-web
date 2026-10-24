import type { Product } from "./types";
import { trainingPayload, type TrainingCurriculum, type TrainingModule } from "./training";
const sampleId = 9101;
const curricula = new Map<number, TrainingCurriculum>();
const completion = new Map<string, boolean>();
const purchased = new Set([sampleId]);
const fail = (message: string, status: number, code = "INVALID_REQUEST"): never => {
  throw Object.assign(new Error(message), { status, code });
};
export function seedDemoTraining(products: Product[]) {
  if (!products.some((item) => item.id === sampleId))
    products.push({
      id: sampleId,
      storeId: 1,
      name: "Build your first online business",
      description: "A fictional training for exploring the creator and learner experience.",
      priceAmount: 25,
      priceCurrency: "USD",
      type: "TRAINING",
      status: "ACTIVE",
      inventoryPolicy: "UNLIMITED",
    });
  if (!curricula.has(sampleId))
    curricula.set(sampleId, {
      productId: sampleId,
      title: "Build your first online business",
      version: 1,
      totalMaterials: 2,
      completedMaterials: 0,
      progressPercentage: 0,
      nextMaterialId: null,
      modules: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Getting started",
          description: "Explore modules, resources and your progress.",
          published: true,
          materials: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              title: "Welcome to your training",
              description:
                "This sample lesson is included with the whole training. Open it when you are ready, then mark it complete yourself.",
              type: "LINK",
              published: true,
              linkUrl: "https://www.fondeka.com",
            },
            {
              id: "33333333-3333-4333-8333-333333333333",
              title: "Plan your next step",
              description:
                "You can open materials in any order. Completion never locks the next lesson.",
              type: "LINK",
              published: true,
              linkUrl: "https://www.fondeka.com",
            },
          ],
        },
      ],
    });
}
function snapshot(curriculum: TrainingCurriculum, learner = false): TrainingCurriculum {
  const modules = curriculum.modules
    .filter((module) => !learner || module.published)
    .map((module) => ({
      ...module,
      materials: module.materials
        .filter((material) => !learner || material.published)
        .map((material) => ({
          ...material,
          ...(learner ? { linkUrl: null, assetKey: null, fileName: null } : {}),
          completed: completion.get(`${curriculum.productId}:${material.id}`) === true,
        })),
    }))
    .filter((module) => !learner || module.materials.length);
  const lessons = modules.flatMap((module) => module.materials);
  const completedMaterials = lessons.filter((material) => material.completed).length;
  return structuredClone({
    ...curriculum,
    modules,
    totalMaterials: lessons.length,
    completedMaterials,
    progressPercentage: lessons.length
      ? Math.floor((completedMaterials * 100) / lessons.length)
      : 0,
    nextMaterialId: lessons.find((material) => !material.completed)?.id || null,
  });
}
export function demoTrainingRequest(
  route: string,
  method: string,
  body: unknown,
  search: URLSearchParams,
  products: Product[],
) {
  if (!/^\/commerce\/(trainings(?:\/|$)|products\/\d+\/training(?:\/|$))/.test(route)) return;
  if (route === "/commerce/trainings") {
    const entries = [...purchased]
      .map((id) => curricula.get(id))
      .filter((item): item is TrainingCurriculum => !!item)
      .map((item) => {
        const view = snapshot(item, true);
        return {
          productId: item.productId,
          title: item.title,
          imageUrl: null,
          storeName: "Atelier Kin",
          totalMaterials: view.totalMaterials,
          completedMaterials: view.completedMaterials,
          progressPercentage: view.progressPercentage,
        };
      });
    const number = Math.max(0, Number(search.get("page")) || 0);
    const size = Math.min(100, Math.max(1, Number(search.get("size")) || 20));
    return {
      handled: true,
      data: {
        content: entries.slice(number * size, (number + 1) * size),
        number,
        size,
        totalElements: entries.length,
        totalPages: Math.ceil(entries.length / size),
      },
    };
  }
  const author = route.startsWith("/commerce/products/");
  const productId = Number(route.split("/")[3]);
  const product = products.find((item) => item.id === productId && item.type === "TRAINING");
  if (!product) return fail("Training not found.", 404, "NO_RESULT");
  if (!author && !purchased.has(productId))
    return fail(
      "Purchase this training to access its curriculum.",
      403,
      "TRAINING_ACCESS_REQUIRED",
    );
  let curriculum = curricula.get(productId) || {
    productId,
    title: product.name,
    version: 0,
    modules: [],
    totalMaterials: 0,
    completedMaterials: 0,
    progressPercentage: 0,
    nextMaterialId: null,
  };
  if (route.endsWith("/presign")) return fail("File uploads require a connected account.", 503);
  const parts = route.split("/");
  const materialAt = parts.indexOf("materials");
  if (materialAt >= 0) {
    const id = parts[materialAt + 1];
    const module = curriculum.modules.find((module) =>
      module.materials.some((material) => material.id === id),
    );
    const material = module?.materials.find((material) => material.id === id);
    if (!material || (!author && (!module?.published || !material.published)))
      return fail("Material not found.", 404, "NO_RESULT");
    if (route.endsWith("/progress")) {
      completion.set(`${productId}:${id}`, (body as { completed?: boolean }).completed === true);
      return { handled: true, data: snapshot(curriculum, true) };
    }
    if (material.type === "FILE")
      return fail("Private file previews require a connected account.", 503);
    return {
      handled: true,
      data: {
        materialId: material.id,
        type: "LINK",
        url: material.linkUrl,
        expiresAt: null,
        fileName: null,
        contentType: null,
      },
    };
  }
  if (method === "PUT") {
    const input = body as { version: number; modules: TrainingModule[] };
    if (input.version !== curriculum.version)
      return fail("The curriculum changed. Reload it before saving.", 409);
    const payload = trainingPayload(input.version, input.modules);
    const moduleIds = new Set(curriculum.modules.map((module) => module.id));
    const materialIds = new Set(
      curriculum.modules.flatMap((module) => module.materials.map((material) => material.id)),
    );
    if (
      payload.modules.some(
        (module) =>
          (module.id && !moduleIds.has(module.id)) ||
          module.materials.some((material) => material.id && !materialIds.has(material.id)),
      )
    )
      return fail("A curriculum ID is no longer available.", 404, "NO_RESULT");
    if (
      product.status === "ACTIVE" &&
      !payload.modules.some(
        (module) => module.published && module.materials.some((material) => material.published),
      )
    )
      return fail("Keep one published material, or move the product to draft first.", 400);
    curriculum = {
      ...curriculum,
      version: curriculum.version + 1,
      modules: payload.modules.map((module) => ({
        ...module,
        id: module.id || crypto.randomUUID(),
        materials: module.materials.map((material) => ({
          ...material,
          id: material.id || crypto.randomUUID(),
        })),
      })),
    };
    curricula.set(productId, curriculum);
  }
  return { handled: true, data: snapshot(curriculum, !author) };
}
export function demoTrainingPublishable(productId: number) {
  return (
    curricula
      .get(productId)
      ?.modules.some(
        (module) => module.published && module.materials.some((material) => material.published),
      ) === true
  );
}
