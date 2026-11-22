"use client";
import { useEffect, useRef, useState } from "react";
import { FileDown, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { date } from "@/lib/format";
import { uiText } from "@/lib/ui-copy";
import { request } from "@/lib/data";
import { canUseStore } from "@/lib/commerce";
import {
  confirmedExport,
  hasPosFeature,
  pdfDownloadUrl,
  type SalesExport,
} from "@/lib/pos-management";
import type { SalesReport, Store } from "@/lib/types";
import { Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { usePosCommand } from "./use-pos-command";

export function ReportExportButton({ store, report }: { store: Store; report: SalesReport }) {
  const { t, language } = useI18n();
  const { accountKey } = useWorkspace();
  const path = `/customer-api/commerce/stores/${store.id}/reports/sales/exports`;
  const savedKey = `fondeka-report-job:${accountKey}:${store.id}`;
  const command = usePosCommand(path);
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<SalesExport>();
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [polls, setPolls] = useState(0);
  const [now, setNow] = useState(Date.now());
  const readLock = useRef(false);
  const available = hasPosFeature(store, "reportExports") && canUseStore(store, "REPORTS");
  const active = job?.status === "QUEUED" || job?.status === "PROCESSING";
  useEffect(() => {
    if (!available || !accountKey) return;
    let current = true;
    try {
      const id = sessionStorage.getItem(savedKey);
      if (id && /^[A-Za-z0-9_-]{1,128}$/.test(id)) {
        void request<unknown>(path + "/" + id)
          .then((value) => {
            if (current) setJob(confirmedExport(value, store.id, { id }));
          })
          .catch((failure) => {
            if (current)
              setError(
                failure instanceof Error
                  ? failure.message
                  : t("Unable to recover the report.", "Impossible de récupérer le rapport."),
              );
          });
      }
    } catch {
      /* An export can still be downloaded in the current view. */
    }
    return () => {
      current = false;
    };
  }, [accountKey, available, path, savedKey, store.id, t]);
  useEffect(() => {
    if (!available || !active || !job || polls >= 12 || error) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        void request<unknown>(path + "/" + job.id, { signal: controller.signal })
          .then((value) => {
            if (!controller.signal.aborted) {
              setJob(confirmedExport(value, store.id, { id: job.id }));
              setPolls((n) => n + 1);
            }
          })
          .catch((failure) => {
            if (!controller.signal.aborted)
              setError(
                failure instanceof Error
                  ? failure.message
                  : t("Unable to refresh the report.", "Impossible d’actualiser le rapport."),
              );
          });
      },
      Math.min(2000 * 2 ** polls, 15000),
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, available, error, job, path, polls, store.id, t]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  async function generate() {
    if (!available || active || command.busy) return;
    setError("");
    command.resetCompleted();
    const body = {
      from: report.fromDate,
      to: report.toDate,
      currency: report.currency,
      language,
      timeZone: report.timeZone || "UTC",
      format: "PDF",
      includeDetails: true,
    };
    const expected = command.intent ? JSON.parse(command.intent.body) : body;
    const result = await command.submit(body, (value) =>
      confirmedExport(value, store.id, expected),
    );
    if (result) {
      setJob(result);
      setPolls(0);
      try {
        sessionStorage.setItem(savedKey, result.id);
      } catch {
        /* Keep the live job visible when storage is unavailable. */
      }
    }
  }
  async function check() {
    if (!job || readLock.current || !available) return;
    readLock.current = true;
    setChecking(true);
    setError("");
    try {
      setJob(
        confirmedExport(await request<unknown>(path + "/" + job.id), store.id, { id: job.id }),
      );
      setPolls(0);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t("Unable to refresh the report.", "Impossible d’actualiser le rapport."),
      );
    } finally {
      readLock.current = false;
      setChecking(false);
    }
  }
  const download = job && !command.intent ? pdfDownloadUrl(job, now) : undefined;
  const jobStatus =
    job &&
    {
      QUEUED: t("Preparing PDF…", "Préparation du PDF…"),
      PROCESSING: t("Preparing PDF…", "Préparation du PDF…"),
      COMPLETED: download
        ? t("PDF ready", "PDF prêt")
        : t("Download link expired", "Lien de téléchargement expiré"),
      FAILED: t("Unable to generate the PDF.", "Impossible de générer le PDF."),
      EXPIRED: t("PDF expired", "PDF expiré"),
    }[job.status];
  const differentSelection =
    job &&
    (job.fromDate !== report.fromDate ||
      job.toDate !== report.toDate ||
      job.currency !== report.currency ||
      job.language !== language);
  const needsCheck =
    job &&
    (error ||
      (active && polls >= 12) ||
      (job.status === "COMPLETED" && !download && !command.intent));
  function periodLabel(from: string, to: string, currency: string) {
    return `${date(from, language)}${from === to ? "" : ` – ${date(to, language)}`} · ${currency}`;
  }
  return (
    <>
      <button
        type="button"
        className="button secondary small"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <FileDown size={16} aria-hidden="true" />
        {t("Report PDF", "Rapport PDF")}
      </button>
      {open && (
        <Modal
          title={t("Report PDF", "Rapport PDF")}
          description={periodLabel(report.fromDate, report.toDate, report.currency)}
          onClose={() => setOpen(false)}
          className="report-export-dialog"
        >
          {!available && (
            <p className="muted small">
              {t(
                "PDF export is unavailable for this store.",
                "L’export PDF est indisponible pour cette boutique.",
              )}
            </p>
          )}
          {job && !command.intent && (
            <div className="report-export-status" role="status">
              <p>{jobStatus}</p>
              {differentSelection && (
                <p className="muted small">
                  {t("Last PDF", "Dernier PDF")} :{" "}
                  {periodLabel(job.fromDate, job.toDate, job.currency)}
                </p>
              )}
              {job.errorMessage && <p className="form-error">{job.errorMessage}</p>}
              {active && polls >= 12 && (
                <p className="muted small">
                  {t(
                    "You can close this dialog and return later.",
                    "Vous pouvez fermer cette fenêtre et revenir plus tard.",
                  )}
                </p>
              )}
            </div>
          )}
          {(error || command.error) && (
            <p className="form-error" role="alert">
              {uiText(error || command.error!)}
            </p>
          )}
          <div className="parity-actions">
            {download && (
              <a
                className="button primary"
                href={download}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                {differentSelection
                  ? t("Open last PDF", "Ouvrir le dernier PDF")
                  : t("Open PDF", "Ouvrir le PDF")}
              </a>
            )}
            {(!active || command.intent) && (
              <button
                type="button"
                className={download ? "text-button" : "button primary"}
                disabled={!available || command.busy || active || command.blocked}
                onClick={() => void generate()}
              >
                {command.busy
                  ? t("Requesting…", "Demande en cours…")
                  : command.intent
                    ? t("Recover PDF request", "Récupérer la demande PDF")
                    : download
                      ? t("Generate a new PDF", "Générer un nouveau PDF")
                      : t("Generate PDF", "Générer le PDF")}
              </button>
            )}
            {needsCheck && (
              <button
                type="button"
                className="text-button"
                disabled={checking || !available}
                onClick={() => void check()}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {checking ? t("Refreshing…", "Actualisation…") : t("Refresh", "Actualiser")}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
