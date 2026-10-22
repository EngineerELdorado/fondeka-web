"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, AlertCircle, Inbox, X } from "lucide-react";
import { label } from "@/lib/format";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg width="33" height="33" viewBox="0 0 60 60" aria-hidden="true">
        <rect width="60" height="60" rx="14" fill="currentColor" />
        <circle cx="40" cy="20" r="10" fill="white" />
      </svg>
      {!compact && (
        <span>
          Fondeka<span className="brand-business">BUSINESS</span>
        </span>
      )}
    </span>
  );
}
export function Badge({ value }: { value?: string }) {
  const status = value?.toUpperCase() ?? "";
  const tone = [
    "ACTIVE",
    "PAID",
    "SUCCESS",
    "SUCCESSFUL",
    "COMPLETED",
    "APPROVED",
    "ENABLED",
  ].includes(status)
    ? "green"
    : ["PENDING", "PENDING_APPROVAL", "PROCESSING", "PARTIALLY_PAID"].includes(status)
      ? "amber"
      : ["FAILED", "REJECTED", "CANCELLED", "EXPIRED"].includes(status)
        ? "red"
        : "gray";
  return (
    <span className={`badge ${tone}`}>
      <span />
      {label(value)}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="loading-state" aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i} style={{ width: `${100 - (i % 3) * 12}%` }} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>We couldn’t load this information</strong>
        <p>{message}</p>
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} {total === 1 ? "result" : "results"} · Page {page + 1} of {Math.max(1, pages)}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-inner">
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function SubmitButton({
  busy,
  children,
  disabled = false,
}: {
  busy: boolean;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button className="button primary" type="submit" disabled={busy || disabled}>
      {busy ? (
        <>
          <span className="spinner" /> Please wait…
        </>
      ) : (
        children
      )}
    </button>
  );
}
