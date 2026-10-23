export const businessApiDocsRoot = "/docs/business-api";
export const businessApiTopics = [
  { id: "overview", file: "README.md", en: "Overview", fr: "Vue d’ensemble" },
  { id: "quickstart", file: "quickstart.md", en: "Quickstart", fr: "Démarrage rapide" },
  {
    id: "mobile-money-collection",
    file: "guides/mobile-money-collection.md",
    en: "Mobile-money collections",
    fr: "Encaissements mobile money",
  },
  {
    id: "mobile-money-payout",
    file: "guides/mobile-money-payout.md",
    en: "Mobile-money payouts",
    fr: "Décaissements mobile money",
  },
  {
    id: "crypto-collection",
    file: "guides/crypto-collection.md",
    en: "Crypto collections",
    fr: "Encaissements crypto",
  },
  {
    id: "crypto-payout",
    file: "guides/crypto-payout.md",
    en: "Crypto payouts",
    fr: "Décaissements crypto",
  },
  {
    id: "concepts",
    file: "concepts.md",
    en: "Amounts and payment states",
    fr: "Montants et états des paiements",
  },
  { id: "webhooks", file: "webhooks.md", en: "Webhooks", fr: "Webhooks" },
  {
    id: "testing",
    file: "testing.md",
    en: "Testing and troubleshooting",
    fr: "Tests et dépannage",
  },
  { id: "go-live", file: "go-live.md", en: "Go live", fr: "Mise en production" },
  { id: "changelog", file: "changelog.md", en: "Changelog", fr: "Historique des versions" },
] as const;
export type BusinessApiTopic = (typeof businessApiTopics)[number];
export function businessApiTopic(id?: string | null): BusinessApiTopic {
  return businessApiTopics.find((topic) => topic.id === id) ?? businessApiTopics[0];
}
export const businessApiFiles = [
  ...businessApiTopics.map((topic) => topic.file),
  "openapi.v1.json",
  "postman.v1.json",
  "examples/curl/quickstart.sh",
  "examples/node/client.mjs",
  "examples/node/webhook.mjs",
  "examples/node/webhook.test.mjs",
  "examples/python/client.py",
  "examples/python/webhook.py",
  "examples/python/test_examples.py",
  "examples/php/client.php",
];

/** Resolve only the reviewed bundle. Relative guide/example links never escape this directory. */
export function businessApiDocLink(
  topic: BusinessApiTopic,
  href: string,
):
  | { kind: "topic"; topic: BusinessApiTopic; hash: string }
  | { kind: "file" | "external"; href: string }
  | undefined {
  try {
    const url = new URL(href, `https://docs.invalid/${topic.file}`);
    if (url.username || url.password) return;
    if (url.origin !== "https://docs.invalid")
      return url.protocol === "https:" ? { kind: "external", href: url.href } : undefined;
    if (url.search) return;
    const file = decodeURIComponent(url.pathname.slice(1));
    if (!businessApiFiles.includes(file)) return;
    const destination = businessApiTopics.find((entry) => entry.file === file);
    return destination
      ? { kind: "topic", topic: destination, hash: url.hash }
      : { kind: "file", href: `${businessApiDocsRoot}/${file}${url.hash}` };
  } catch {
    return;
  }
}
