"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { developerHref } from "@/lib/developer-navigation";
import { businessApiDocsRoot, businessApiTopic, businessApiDocLink } from "@/lib/business-api-docs";
import release from "../../public/docs/business-api/release.json";
import { ErrorState, Loading } from "./ui";

// Only public, versioned prose goes here. No account data or credentials enter this cache.
const guides = new Map<string, string>();
function GuideCode({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const code = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="api-docs-code">
      <button
        className="button secondary small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code.current?.textContent || "");
            setCopied(true);
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? t("Copied", "Copié") : t("Copy", "Copier")}
      </button>
      <pre ref={code}>{children}</pre>
      <span className="sr-only" role="status">
        {copied ? t("Code copied", "Code copié") : ""}
      </span>
      {error && (
        <p role="alert">
          {t("Select and copy the code manually.", "Sélectionnez et copiez le code manuellement.")}
        </p>
      )}
    </div>
  );
}

export default function BusinessApiReference() {
  const { t, language } = useI18n();
  const { values, update } = useUrlState();
  const topic = businessApiTopic(values.get("doc"));
  const hash = release.files[topic.file];
  const key = `${topic.file}:${hash}`;
  const [state, setState] = useState<{ key?: string; source?: string; error?: boolean }>({});
  const [retry, setRetry] = useState(0);
  const article = useRef<HTMLElement>(null);
  const previousTopic = useRef<string | undefined>(undefined);
  const source = guides.get(key) ?? (state.key === key ? state.source : undefined);
  const error = state.key === key && state.error;
  useEffect(() => {
    if (guides.has(key)) return;
    const controller = new AbortController();
    void fetch(`${businessApiDocsRoot}/${topic.file}?v=${hash.slice(0, 12)}`, {
      signal: controller.signal,
      cache: "force-cache",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Documentation unavailable");
        const source = await response.text();
        if (controller.signal.aborted) return;
        guides.set(key, source);
        setState({ key, source });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, error: true });
      });
    return () => controller.abort();
  }, [key, topic.file, hash, retry]);
  useEffect(() => {
    if (source) {
      article.current?.focus({ preventScroll: true });
      if (previousTopic.current && previousTopic.current !== key)
        article.current?.scrollIntoView({ block: "start" });
      previousTopic.current = key;
    }
  }, [source, key]);
  const select = (id: string) => update({ doc: businessApiTopic(id).id, lesson: null });
  return (
    <>
      <div className="guide-reference-body">
        <article
          className="api-docs-article"
          ref={article}
          tabIndex={-1}
          aria-label={topic[language]}
          aria-busy={!source && !error}
        >
          <div className="api-docs-article-meta">
            <span>{t("Published guide · English", "Guide publié · Anglais")}</span>
            <span>v{release.version}</span>
          </div>
          {!source ? (
            error ? (
              <ErrorState
                message={t(
                  "Couldn’t load this guide. Please try again.",
                  "Impossible de charger ce guide. Veuillez réessayer.",
                )}
                retry={() => {
                  setState({});
                  setRetry((value) => value + 1);
                }}
              />
            ) : (
              <Loading rows={4} />
            )
          ) : (
            <div lang="en">
              <Markdown
                skipHtml
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h2>{children}</h2>,
                  h2: ({ children }) => <h3>{children}</h3>,
                  h3: ({ children }) => <h4>{children}</h4>,
                  pre: ({ children }) => <GuideCode>{children}</GuideCode>,
                  table: ({ children }) => (
                    <div
                      className="api-docs-table"
                      tabIndex={0}
                      role="region"
                      aria-label={t("Reference table", "Tableau de référence")}
                    >
                      <table>{children}</table>
                    </div>
                  ),
                  a: ({ href, children }) => {
                    const link = href && businessApiDocLink(topic, href);
                    if (!link) return <span>{children}</span>;
                    if (link.kind === "topic")
                      return (
                        <a
                          href={`${developerHref("guides", values)}${developerHref("guides", values).includes("?") ? "&" : "?"}doc=${link.topic.id}${link.hash}`}
                          onClick={(event) => {
                            if (
                              event.button !== 0 ||
                              event.metaKey ||
                              event.ctrlKey ||
                              event.shiftKey ||
                              event.altKey
                            )
                              return;
                            event.preventDefault();
                            select(link.topic.id);
                          }}
                        >
                          {children}
                        </a>
                      );
                    return (
                      <a
                        href={link.href}
                        download={link.kind === "file" || undefined}
                        target={link.kind === "external" ? "_blank" : undefined}
                        rel="noreferrer"
                      >
                        {children}
                        {link.kind === "external" && <ExternalLink size={12} aria-hidden="true" />}
                      </a>
                    );
                  },
                }}
              >
                {source}
              </Markdown>
            </div>
          )}
        </article>
      </div>
    </>
  );
}
