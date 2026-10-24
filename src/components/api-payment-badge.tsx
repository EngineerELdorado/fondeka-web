"use client";
import type { BusinessApiPaymentStatus } from "@/lib/types";
import { useUiText } from "@/lib/use-ui-text";

const presentation = {
  ACCEPTED: { tone: "blue", description: "Queued for execution" },
  PROCESSING: { tone: "amber", description: "Execution started or awaiting confirmation" },
  COMPLETED: { tone: "green", description: "Confirmed success" },
  FAILED: { tone: "red", description: "Confirmed failure" },
} satisfies Record<BusinessApiPaymentStatus, { tone: string; description: string }>;

export function ApiPaymentBadge({ status }: { status: BusinessApiPaymentStatus }) {
  const uiText = useUiText();
  const { tone, description } = presentation[status];
  return (
    <span
      className={`badge ${tone}`}
      title={uiText(description)}
      aria-label={`${status} · ${uiText(description)}`}
    >
      <span aria-hidden="true" />
      {status}
    </span>
  );
}
