export const trainingUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const trainingAssetKey =
  /^commerce-training-assets\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;
export type TrainingMaterial = {
  id?: string;
  title: string;
  description?: string | null;
  type: "FILE" | "LINK";
  published: boolean;
  assetKey?: string | null;
  linkUrl?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  completed?: boolean;
  completedAt?: string | null;
};
export type TrainingModule = {
  id?: string;
  title: string;
  description?: string | null;
  published: boolean;
  materials: TrainingMaterial[];
};
export type TrainingCurriculum = {
  productId: number;
  title: string;
  version: number;
  modules: TrainingModule[];
  totalMaterials: number;
  completedMaterials: number;
  progressPercentage: number;
  nextMaterialId: string | null;
};
export type TrainingSummary = {
  productId: number;
  title: string;
  imageUrl?: string | null;
  storeName: string;
  totalMaterials: number;
  completedMaterials: number;
  progressPercentage: number;
};
export type TrainingMaterialAccess = {
  materialId: string;
  type: "FILE" | "LINK";
  url: string;
  expiresAt: string | null;
  fileName?: string | null;
  contentType?: string | null;
};
export function trainingPath(productId: number, author = false) {
  if (!Number.isSafeInteger(productId) || productId <= 0) throw new Error("Invalid training.");
  return author
    ? `/customer-api/commerce/products/${productId}/training`
    : `/customer-api/commerce/trainings/${productId}`;
}
export function trainingMaterialPath(
  productId: number,
  materialId: string,
  operation: "access" | "progress",
  author = false,
) {
  if (!trainingUuid.test(materialId) || (author && operation === "progress"))
    throw new Error("Invalid training material.");
  return `${trainingPath(productId, author)}/materials/${materialId}/${operation}`;
}
export function trainingHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return;
  }
}
/** Whitelist the author write contract; order comes only from arrays, never positions. */
export type TrainingCurriculumInput = {
  version: number;
  modules: (Pick<TrainingModule, "id" | "title" | "description" | "published"> & {
    materials: Pick<
      TrainingMaterial,
      "id" | "title" | "description" | "type" | "published" | "assetKey" | "linkUrl" | "fileName"
    >[];
  })[];
};
export function trainingPayload(
  version: number,
  modules: TrainingModule[],
): TrainingCurriculumInput {
  if (
    !Number.isSafeInteger(version) ||
    version < 0 ||
    modules.length > 100 ||
    modules.reduce((n, m) => n + m.materials.length, 0) > 2000
  )
    throw new Error("The curriculum exceeds its limits.");
  const ids = new Set<string>();
  const identity = (id?: string) => {
    if (id === undefined) return {};
    if (!trainingUuid.test(id) || ids.has(id))
      throw new Error("Invalid or duplicate curriculum ID.");
    ids.add(id);
    return { id };
  };
  const title = (value: string) => {
    if (!value.trim() || value.length > 180)
      throw new Error("Titles are required and must be at most 180 characters.");
    return value.trim();
  };
  const description = (value?: string | null) => {
    if ((value?.length || 0) > 4000)
      throw new Error("Descriptions must be at most 4,000 characters.");
    return value?.trim() || null;
  };
  return {
    version,
    modules: modules.map((module) => {
      if (module.materials.length > 200)
        throw new Error("A module supports at most 200 materials.");
      return {
        ...identity(module.id),
        title: title(module.title),
        description: description(module.description),
        published: module.published === true,
        materials: module.materials.map((material) => {
          const common = {
            ...identity(material.id),
            title: title(material.title),
            description: description(material.description),
            type: material.type,
            published: material.published === true,
          };
          if (material.type === "LINK") {
            if (
              !material.linkUrl ||
              material.linkUrl.length > 2048 ||
              !trainingHttpsUrl(material.linkUrl.trim()) ||
              material.assetKey
            )
              throw new Error("A link material requires an HTTPS link and no file.");
            return { ...common, linkUrl: material.linkUrl.trim() };
          }
          if (
            material.type !== "FILE" ||
            !trainingAssetKey.test(material.assetKey || "") ||
            material.linkUrl ||
            (material.fileName?.length || 0) > 255
          )
            throw new Error("A file material requires an uploaded training file and no link.");
          return { ...common, assetKey: material.assetKey!, fileName: material.fileName || null };
        }),
      };
    }),
  };
}
export function parseTrainingCurriculum(value: unknown): TrainingCurriculum {
  const data = value as TrainingCurriculum;
  if (
    !data ||
    !Number.isSafeInteger(data.productId) ||
    data.productId <= 0 ||
    !Number.isSafeInteger(data.version) ||
    data.version < 0 ||
    typeof data.title !== "string" ||
    !Array.isArray(data.modules) ||
    !data.modules.every(
      (m) =>
        m &&
        trainingUuid.test(m.id || "") &&
        typeof m.title === "string" &&
        (m.description == null || typeof m.description === "string") &&
        typeof m.published === "boolean" &&
        Array.isArray(m.materials) &&
        m.materials.every(
          (item) =>
            item &&
            trainingUuid.test(item.id || "") &&
            typeof item.title === "string" &&
            (item.description == null || typeof item.description === "string") &&
            typeof item.published === "boolean" &&
            ["FILE", "LINK"].includes(item.type),
        ),
    ) ||
    !Number.isSafeInteger(data.totalMaterials) ||
    data.totalMaterials < 0 ||
    !Number.isSafeInteger(data.completedMaterials) ||
    data.completedMaterials < 0 ||
    data.completedMaterials > data.totalMaterials ||
    (data.nextMaterialId !== null && !trainingUuid.test(data.nextMaterialId || "")) ||
    !Number.isInteger(data.progressPercentage) ||
    data.progressPercentage < 0 ||
    data.progressPercentage > 100
  )
    throw new Error("Unable to read the training curriculum.");
  return data;
}
export function parseMaterialAccess(value: unknown, materialId: string): TrainingMaterialAccess {
  const data = value as TrainingMaterialAccess;
  if (
    !data ||
    data.materialId !== materialId ||
    !["FILE", "LINK"].includes(data.type) ||
    typeof data.url !== "string" ||
    !trainingHttpsUrl(data.url) ||
    (data.type === "FILE" &&
      (!data.expiresAt ||
        !Number.isFinite(Date.parse(data.expiresAt)) ||
        Date.parse(data.expiresAt) <= Date.now()))
  )
    throw new Error("Material access is unavailable. Please try again.");
  return data;
}
export function isTrainingContentPath(path?: string | null) {
  return (
    !!path &&
    /^\/customer-api\/commerce\/(?:trainings(?:[/?]|$)|products\/\d+\/training(?:[/?]|$))/.test(
      path,
    )
  );
}
/** Order fulfillment may carry guest bearer URLs; never put those responses in shared caches. */
export function hasTrainingAccessUrls(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasTrainingAccessUrls);
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    (typeof row.trainingAccessUrl === "string" && !!row.trainingAccessUrl) ||
    (typeof row.trainingPlayerUrl === "string" && !!row.trainingPlayerUrl) ||
    (Array.isArray(row.items) && row.items.some(hasTrainingAccessUrls)) ||
    (Array.isArray(row.content) && row.content.some(hasTrainingAccessUrls))
  );
}
