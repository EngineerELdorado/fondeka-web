"use client";
import { ChevronDown, FlaskConical, ShieldCheck } from "lucide-react";
import { useUiText } from "@/lib/use-ui-text";
import { useUrlState } from "@/lib/use-url-state";
import { apiEnvironmentSelection, resolveApiEnvironment } from "@/lib/api-environment";
import type { ApiEnvironment } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";

export function ApiEnvironmentSwitch() {
  const uiText = useUiText();
  const { values, update } = useUrlState();
  const { apiEnvironment, selectApiEnvironment } = useWorkspace();
  const environment = resolveApiEnvironment(values.get("environment"), apiEnvironment);
  return (
    <label className={`api-environment-switch header-select ${environment.toLowerCase()}`}>
      <span className="sr-only">{uiText("API environment")}</span>
      {environment === "SANDBOX" ? (
        <FlaskConical size={15} aria-hidden="true" />
      ) : (
        <ShieldCheck size={15} aria-hidden="true" />
      )}
      <select
        value={environment}
        title={uiText(
          environment === "SANDBOX" ? "SANDBOX · Simulated payments" : "LIVE · Real payments",
        )}
        onChange={(event) => {
          const next = event.target.value as ApiEnvironment;
          selectApiEnvironment(next);
          update(apiEnvironmentSelection(next));
        }}
      >
        <option value="LIVE">LIVE</option>
        <option value="SANDBOX">SANDBOX</option>
      </select>
      <span className="switch-chevron" aria-hidden="true">
        <ChevronDown size={12} strokeWidth={2.5} />
      </span>
    </label>
  );
}
