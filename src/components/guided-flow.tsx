"use client";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { OwnerQueriesEnabled } from "@/lib/owner-query-context";
import { useUrlState } from "@/lib/use-url-state";
import {
  flowDraftPrefix,
  readFlowDraft,
  resolveFlowStep,
  validateFlow,
  writeFlowDraft,
  type FlowErrors,
  type FlowStep,
} from "@/lib/guided-flow";
import { uiText } from "@/lib/ui-copy";
import { Loading, ErrorState } from "./ui";
import { useWorkspace } from "./workspace-provider";
export type GuidedStep<T> = FlowStep<T> & {
  title: string;
  helper?: string;
  prepare?: (value: T) => Promise<void>;
  render: (context: {
    value: T;
    set: (patch: Partial<T>) => void;
    go: (id: string) => void;
  }) => ReactNode;
};
const Fields = createContext<{ errors: FlowErrors; prefix: string; title: string }>({
  errors: {},
  prefix: "",
  title: "",
});
export function useFlowDraft<T extends object>(
  id: string,
  initial: T,
  safeFields: (keyof T)[] = [],
) {
  const { accountKey } = useWorkspace();
  const key = flowDraftPrefix + accountKey + ":" + id;
  const dismissed = useRef(false);
  const initialRef = useRef(initial);
  const safeKey = safeFields.join(",");
  const [value, setValue] = useState<T>(initial);
  const [restoredKey, setRestoredKey] = useState("");
  useEffect(() => {
    let restored = initialRef.current;
    if (safeKey)
      try {
        restored = readFlowDraft(
          sessionStorage,
          key,
          initialRef.current,
          safeKey.split(",") as (keyof T)[],
        );
      } catch {
        /* Memory-only fallback. */
      }
    setValue(restored);
    setRestoredKey(key);
    dismissed.current = false;
  }, [key, safeKey]);
  useEffect(() => {
    if (!safeKey || dismissed.current || restoredKey !== key) return;
    try {
      writeFlowDraft(sessionStorage, key, value, safeKey.split(",") as (keyof T)[]);
    } catch {
      /* In-memory navigation remains available when persistence is restricted. */
    }
  }, [key, safeKey, value, restoredKey]);
  function set(patch: Partial<T>) {
    setValue((current) => ({ ...current, ...patch }));
  }
  function clear() {
    dismissed.current = true;
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* No persisted draft. */
    }
  }
  return {
    value,
    set,
    clear,
    restoring: restoredKey !== key,
    dirty: JSON.stringify(value) !== JSON.stringify(initialRef.current),
  };
}
export function GuidedFlow<T extends object>({
  id,
  title,
  steps,
  value,
  set,
  dirty,
  onDiscard,
  onClose,
  onFinish,
  finalLabel,
  busy: externalBusy = false,
  loading = false,
  dependencyError,
  retry,
  compact = false,
  closeRequest,
  finishDisabled = false,
}: {
  id: string;
  title: string;
  steps: GuidedStep<T>[];
  value: T;
  set: (patch: Partial<T>) => void;
  dirty: boolean;
  onDiscard: () => void;
  onClose: () => void;
  onFinish: () => Promise<void>;
  finalLabel: string;
  busy?: boolean;
  loading?: boolean;
  dependencyError?: string;
  retry?: () => void;
  compact?: boolean;
  closeRequest?: { current: (() => void) | null };
  finishDisabled?: boolean;
}) {
  const { t, language } = useI18n();
  const navigation = useUrlState();
  const enabled = useContext(OwnerQueriesEnabled);
  const requested = navigation.values.get("flow") === id ? navigation.values.get("step") : null;
  const index = resolveFlowStep(steps, requested, value);
  const step = steps[index];
  const last = index === steps.length - 1;
  const previousIndex = useRef(index);
  const movingBack = index < previousIndex.current;
  useEffect(() => {
    previousIndex.current = index;
  }, [index]);
  const [attempted, setAttempted] = useState<string>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const locked = useRef(false);
  const leaving = useRef(false);
  const current = useRef({ busy: false, dirty, onDiscard, onClose });
  const root = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const origin = useRef(typeof window === "undefined" ? "" : window.location.pathname);
  const busy = submitting || externalBusy;
  current.current = { busy: busy || !enabled, dirty, onDiscard, onClose };
  const errors = attempted === step.id ? step.validate?.(value) || {} : {};
  useEffect(() => {
    if (!loading && (navigation.values.get("flow") !== id || requested !== step.id))
      navigation.update({ flow: id, step: step.id }, true);
  }, [id, requested, step.id, navigation, loading]);
  useEffect(() => {
    setError("");
    if (!enabled) return;
    const first =
      root.current?.querySelector<HTMLElement>(
        "[data-step-content] input:not([type=hidden]), [data-step-content] textarea, [data-step-content] select",
      ) || root.current?.querySelector<HTMLElement>("[data-step-heading]");
    first?.focus();
  }, [step.id, loading, enabled]);
  useEffect(() => {
    const message = () =>
      t("Discard your unsaved changes?", "Abandonner les modifications non enregistrées ?");
    const unload = (event: BeforeUnloadEvent) => {
      if (!leaving.current && (current.current.dirty || current.current.busy)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (
        !enabled ||
        !anchor ||
        root.current?.contains(anchor) ||
        leaving.current ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.hasAttribute("download") ||
        event.metaKey ||
        event.ctrlKey
      )
        return;
      if (current.current.busy || (current.current.dirty && !window.confirm(message()))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      leaving.current = true;
      current.current.onDiscard();
    };
    const pop = (event: PopStateEvent) => {
      if (!enabled) return;
      const query = new URLSearchParams(window.location.search);
      if (
        !current.current.busy &&
        window.location.pathname === origin.current &&
        query.get("flow") === id
      )
        return;
      if (
        !leaving.current &&
        (current.current.busy || (current.current.dirty && !window.confirm(message())))
      ) {
        event.stopImmediatePropagation();
        window.history.forward();
        return;
      }
      leaving.current = true;
      current.current.onDiscard();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("popstate", pop, true);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("popstate", pop, true);
      document.removeEventListener("click", click, true);
    };
  }, [id, t, enabled]);
  const go = (stepId: string) => {
    if (busy || locked.current || !steps.some((item) => item.id === stepId)) return;
    setAttempted(undefined);
    navigation.update({ flow: id, step: stepId });
  };
  function focusError(found: FlowErrors) {
    const name = Object.keys(found).find((key) => found[key]);
    requestAnimationFrame(() => {
      const field = root.current?.querySelector<HTMLElement>('[data-flow-field="' + name + '"]');
      (field?.querySelector<HTMLElement>("input,textarea,select,button") || field)?.focus();
    });
  }

  function close() {
    if (current.current.busy || locked.current) return;
    if (
      dirty &&
      !window.confirm(
        t("Discard your unsaved changes?", "Abandonner les modifications non enregistrées ?"),
      )
    )
      return;
    leaving.current = true;
    onDiscard();
    navigation.update({ flow: null, step: null }, true);
    onClose();
  }
  useEffect(() => {
    if (!closeRequest) return;
    closeRequest.current = close;
    return () => {
      closeRequest.current = null;
    };
  });
  function back() {
    if (busy || locked.current) return;
    if (index > 0) {
      if (typeof window.history.state?.guidedStep === "string") window.history.back();
      else go(steps[index - 1].id);
    } else close();
  }
  async function next() {
    if (busy || locked.current || !enabled || loading || dependencyError) return;
    setAttempted(step.id);
    const found = step.validate?.(value) || {};
    if (Object.values(found).some(Boolean)) {
      focusError(found);
      return;
    }
    if (last && finishDisabled) return;
    const invalid = last ? validateFlow(steps, value) : undefined;
    if (invalid) {
      navigation.update({ step: steps[invalid.index].id });
      setAttempted(steps[invalid.index].id);
      focusError(invalid.errors);
      return;
    }
    locked.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (last) await onFinish();
      else {
        await step.prepare?.(value);
        navigation.update({ flow: id, step: steps[index + 1].id });
        window.history.replaceState(
          { ...window.history.state, guidedStep: step.id },
          "",
          window.location.href,
        );
        setAttempted(undefined);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? uiText(failure.message, language)
          : t(
              "We couldn’t complete this. Your changes are still here.",
              "Cette action n’a pas pu aboutir. Vos modifications sont conservées.",
            ),
      );
    } finally {
      locked.current = false;
      setSubmitting(false);
    }
  }
  return (
    <div
      ref={root}
      className={"guided-flow" + (compact ? " compact" : "") + (movingBack ? " flow-back" : "")}
      aria-busy={busy}
    >
      <header className="guided-header">
        <button
          type="button"
          className="guided-back"
          disabled={busy}
          onClick={back}
          aria-label={t("Back", "Retour")}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="guided-task">{title}</p>
          <p className="guided-counter" role="status" aria-live="polite">
            <span className="sr-only">{step.title} · </span>
            {t("Step ", "Étape ") + (index + 1) + t(" of ", " sur ") + steps.length}
          </p>
        </div>
        <button type="button" className="text-button" disabled={busy} onClick={close}>
          {t("Close", "Fermer")}
        </button>
        <progress max={steps.length} value={index + 1} aria-label={t("Progress", "Progression")} />
      </header>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!last) void next();
        }}
        onKeyDown={(event) => {
          if (
            last &&
            event.key === "Enter" &&
            !(event.target instanceof HTMLTextAreaElement) &&
            !(event.target instanceof HTMLButtonElement)
          )
            event.preventDefault();
        }}
      >
        {loading ? (
          <Loading rows={3} />
        ) : dependencyError ? (
          <ErrorState message={dependencyError} retry={retry} />
        ) : (
          <Fields.Provider value={{ errors, prefix, title: step.title }}>
            <div className="guided-card" data-step-content key={step.id}>
              <h2 tabIndex={-1} data-step-heading>
                {step.title}
              </h2>
              {step.helper && <p className="guided-helper">{step.helper}</p>}
              <fieldset className="guided-controls" disabled={submitting} aria-label={step.title}>
                {step.render({ value, set, go })}
              </fieldset>
            </div>
          </Fields.Provider>
        )}
        {error && (
          <p className="form-error guided-error" role="alert">
            {error}
          </p>
        )}
        <footer className="guided-footer">
          {index > 0 && (
            <button type="button" className="button secondary" disabled={busy} onClick={back}>
              {t("Back", "Retour")}
            </button>
          )}
          <button
            type="button"
            className="button primary"
            disabled={busy || loading || !!dependencyError || (last && finishDisabled)}
            onClick={() => void next()}
          >
            {busy && <LoaderCircle size={17} className="spin" />}
            {submitting
              ? t("Processing…", "Traitement…")
              : last
                ? finalLabel
                : t("Next", "Suivant")}
          </button>
        </footer>
      </form>
    </div>
  );
}
type FieldProps = {
  id?: string;
  name?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};
export function FlowField({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const { errors, prefix } = useContext(Fields);
  const id = prefix + "-" + name;
  const error = errors[name];
  return (
    <div className="flow-field" data-flow-field={name} tabIndex={-1}>
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<FieldProps>, {
              id,
              name,
              "aria-invalid": !!error,
              "aria-describedby": error ? id + "-error" : hint ? id + "-hint" : undefined,
            })
          : child,
      )}
      {hint && <small id={id + "-hint"}>{hint}</small>}
      {error && (
        <p className="form-error" id={id + "-error"} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function FlowReview({
  title,
  edit,
  children,
}: {
  title: string;
  edit?: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="flow-review">
      <div>
        <h3>{title}</h3>
        {edit && (
          <button type="button" className="text-button" onClick={edit}>
            {t("Edit", "Modifier")}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
export function FlowSuccess({
  title,
  message,
  action,
  onContinue,
}: {
  title: string;
  message: string;
  action: string;
  onContinue: () => void;
}) {
  return (
    <section className="guided-success" role="status">
      <span>
        <Check size={28} />
      </span>
      <h1 tabIndex={-1} ref={(node) => node?.focus()}>
        {title}
      </h1>
      <p>{message}</p>
      <button className="button primary" onClick={onContinue}>
        {action}
      </button>
    </section>
  );
}
export function FlowChoices({
  name,
  value,
  onChange,
  choices,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  choices: { value: string; title: string; description?: string; icon?: ReactNode }[];
}) {
  const { errors, prefix, title } = useContext(Fields);
  return (
    <div data-flow-field={name} tabIndex={-1}>
      <div
        className="flow-choices"
        role="radiogroup"
        aria-label={title || name}
        aria-describedby={errors[name] ? prefix + "-" + name + "-error" : undefined}
      >
        {choices.map((choice, index) => (
          <button
            type="button"
            role="radio"
            aria-checked={value === choice.value}
            className={"flow-choice" + (value === choice.value ? " selected" : "")}
            key={choice.value}
            onClick={() => onChange(choice.value)}
            onKeyDown={(event) => {
              if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
              event.preventDefault();
              const next =
                (index +
                  (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) +
                  choices.length) %
                choices.length;
              onChange(choices[next].value);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>("button")
                [next]?.focus();
            }}
          >
            {choice.icon && <span className="flow-choice-icon">{choice.icon}</span>}
            <span>
              <strong>{choice.title}</strong>
              {choice.description && <small>{choice.description}</small>}
            </span>
            <span className="flow-choice-check" aria-hidden="true">
              {value === choice.value && <Check size={15} />}
            </span>
          </button>
        ))}
      </div>
      {errors[name] && (
        <p className="form-error" role="alert" id={prefix + "-" + name + "-error"}>
          {errors[name]}
        </p>
      )}
    </div>
  );
}

export function FlowError({ name }: { name: string }) {
  const { errors, prefix } = useContext(Fields);
  return errors[name] ? (
    <p role="alert" className="form-error" id={prefix + "-" + name + "-error"}>
      {errors[name]}
    </p>
  ) : null;
}
