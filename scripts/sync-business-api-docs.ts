import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  businessApiFiles,
  businessApiTopics,
  businessApiDocLink,
} from "../src/lib/business-api-docs";

const root = resolve(process.cwd());
const output = resolve(root, "public/docs/business-api");
const source = resolve(
  process.argv.find((value) => value.startsWith("--source="))?.slice(9) ||
    resolve(root, "../../backend/docs/business-api"),
);
const check = process.argv.includes("--check");
const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");
async function publicationFile(directory: string, file: string, portalCopy = false) {
  const bytes = await readFile(resolve(directory, file));
  if (!portalCopy) return bytes;
  // Keep the portal introduction short and omit a link to the backend-only implementation handoff.
  return Buffer.from(
    bytes
      .toString("utf8")
      .replace(
        " Your portal login and its JWT are used to manage your Business and credentials; they are not sent to merchant payment endpoints.",
        "",
      )
      .replace(
        "[web portal catalog](../business-api-web-portal-error-codes.md)",
        "web portal catalog",
      )
      .replace(
        "[the portal status contract](../business-api-web-portal-payment-statuses.md)",
        "[payment states](concepts.md)",
      ),
  );
}
type Release = {
  version: string;
  baseUrl: string;
  apiMajor: string;
  files: Record<string, string>;
};

async function validate(directory: string, portalCopy = false) {
  const files: Record<string, string> = {};
  for (const file of businessApiFiles)
    files[file] = sha256(await publicationFile(directory, file, portalCopy));
  const spec = JSON.parse(await readFile(resolve(directory, "openapi.v1.json"), "utf8"));
  if (
    spec.openapi !== "3.0.3" ||
    !spec.info?.version ||
    spec.servers?.[0]?.url !== "https://api.fondeka.com" ||
    Object.keys(spec.paths).some(
      (path) => !path.startsWith("/business-api/v1/businesses/{businessId}/"),
    )
  )
    throw new Error("Expected the published merchant-only Business API v1 contract.");
  for (const topic of businessApiTopics) {
    const markdown = (await publicationFile(directory, topic.file, portalCopy)).toString("utf8");
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g))
      if (!businessApiDocLink(topic, match[1]))
        throw new Error(`Broken or unsupported link in ${topic.file}: ${match[1]}`);
  }
  return {
    version: spec.info.version,
    baseUrl: spec.servers[0].url,
    apiMajor: "/business-api/v1",
    files,
  } satisfies Release;
}
async function main() {
  if (check) {
    const expected = JSON.parse(await readFile(resolve(output, "release.json"), "utf8")) as Release;
    const actual = await validate(output);
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(
        "Documentation bundle changed. Sync the reviewed backend release instead of editing published files.",
      );
    console.log(
      `Business API ${actual.version}: all ${businessApiFiles.length} published files and relative links verified.`,
    );
  } else {
    const release = await validate(source, true);
    for (const file of businessApiFiles) {
      const destination = resolve(output, file);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, await publicationFile(source, file, true));
    }
    await writeFile(resolve(output, "release.json"), JSON.stringify(release, null, 2) + "\n");
    console.log(
      `Synced reviewed Business API ${release.version} documentation (${businessApiFiles.length} files).`,
    );
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Documentation sync failed.");
  process.exitCode = 1;
});
