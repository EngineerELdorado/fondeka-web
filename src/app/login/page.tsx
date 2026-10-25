"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { confirmSignIn, signIn, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Brand, SubmitButton } from "@/components/ui";
import { accessToken, authConfigured, demoMode, initializeAuth } from "@/lib/auth";
import { resetDeviceIdentityMemory } from "@/lib/device";
import { AppRegistration } from "@/components/app-registration";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/lib/i18n";
import { LoginToolkit } from "@/components/login-toolkit";

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sessionState, setSessionState] = useState<"checking" | "guest" | "authenticated">(
    demoMode || !authConfigured ? "guest" : "checking",
  );
  const confirming = step === "code";
  const showSteps = !demoMode && authConfigured;
  const router = useRouter();
  useEffect(() => {
    if (demoMode || !authConfigured) return;
    let active = true;
    let revision = 0;
    const check = async () => {
      const current = ++revision;
      setSessionState("checking");
      try {
        const token = await accessToken();
        if (!active || current !== revision) return;
        setSessionState(token ? "authenticated" : "guest");
        if (token) router.replace("/overview");
      } catch {
        if (active && current === revision) setSessionState("guest");
      }
    };
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedIn") void check();
      else if (payload.event === "signedOut") {
        revision++;
        setSessionState("guest");
      }
    });
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };
    window.addEventListener("pageshow", restored);
    void check();
    return () => {
      active = false;
      stop();
      window.removeEventListener("pageshow", restored);
    };
  }, [router]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function sendCode() {
    initializeAuth();
    try {
      await signOut();
    } catch {
      // An absent/expired browser session should not prevent a new sign-in.
    }
    resetDeviceIdentityMemory();
    const result = await signIn({
      username: email.trim().toLowerCase(),
      options: { authFlowType: "CUSTOM_WITHOUT_SRP" },
    });
    if (result.isSignedIn) {
      router.replace("/overview");
      return;
    }
    if (result.nextStep.signInStep !== "CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE")
      throw new Error(
        t(
          "This account requires a different authentication step. Please contact Fondeka support.",
          "Ce compte nécessite une autre étape d’authentification. Contactez l’assistance Fondeka.",
        ),
      );
    setStep("code");
    setCooldown(180);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || sessionState !== "guest") return;
    setBusy(true);
    setError("");
    try {
      if (step === "email") await sendCode();
      else {
        const result = await confirmSignIn({ challengeResponse: code });
        if (!result.isSignedIn)
          throw new Error(
            t(
              "That code is incorrect or expired. Check your email for the latest code and try again.",
              "Ce code est incorrect ou a expiré. Utilisez le dernier code reçu par e-mail et réessayez.",
            ),
          );
        setCode("");
        router.replace("/overview");
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t(
              "We couldn’t sign you in. Please try again.",
              "Connexion impossible. Veuillez réessayer.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="login-screen">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="welcome-kicker">
            <Sparkles size={13} aria-hidden="true" />
            {t("MAKE YOUR NEXT MOVE", "PASSEZ À LA SUITE")}
          </span>
          <h2>
            {t("Business tools", "Des outils Business")}
            <br />
            <span>{t("for everyone", "pour tous")}</span>
          </h2>
          <div className="login-story-message">
            <p>
              {t(
                "Built for students, startups that don't yet have documents, or anyone with an idea to build and launch fast.",
                "Conçus pour les étudiants, les startups encore sans documents, ou toute personne souhaitant concrétiser une idée et se lancer vite.",
              )}
            </p>
            <span className="login-message-sparkles" aria-hidden="true">
              <Sparkles className="login-message-sparkle sparkle-lead" size={18} />
              <span className="login-message-sparkle sparkle-top" />
              <span className="login-message-sparkle sparkle-bottom" />
            </span>
          </div>
          <LoginToolkit />
        </div>
        <small>
          <ShieldCheck size={15} />
          {t(
            "Your Fondeka account. More possibilities.",
            "Votre compte Fondeka. Plus de possibilités.",
          )}
        </small>
      </section>
      <section className="login-form-section">
        {sessionState !== "guest" ? (
          <div className="login-session-loading" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            {t("Opening your workspace…", "Ouverture de votre espace…")}
          </div>
        ) : (
          <div className="login-form-wrap">
            <div className="login-form-header">
              {showSteps && (
                <p className="login-step-label" role="status">
                  {t(`Step ${confirming ? 2 : 1} of 2`, `Étape ${confirming ? 2 : 1} sur 2`)}
                </p>
              )}
              <LanguageSwitch />
            </div>
            <h1>
              {confirming
                ? t("Enter your code", "Saisissez votre code")
                : t("Sign in", "Connexion")}
            </h1>
            <p className="muted">
              {step === "email"
                ? t(
                    "Sign in with the email you use in the Fondeka app.",
                    "Connectez-vous avec l’e-mail utilisé dans l’application Fondeka.",
                  )
                : t(
                    `We’ve sent a verification code to ${email}.`,
                    `Un code de vérification a été envoyé à ${email}.`,
                  )}
            </p>
            {demoMode ? (
              <>
                <div className="info-box">
                  {t(
                    "This app is currently running in demo mode. Explore the business tools with sample data.",
                    "Cette application est en mode démonstration. Explorez les outils Business avec des données fictives.",
                  )}
                </div>
                <Link className="button primary full-width" href="/overview">
                  {t("Explore demo workspace", "Explorer la démonstration")}{" "}
                  <ArrowRight size={17} />
                </Link>
              </>
            ) : !authConfigured ? (
              <div className="info-box">
                {t(
                  "Sign-in is temporarily unavailable. Please try again later.",
                  "La connexion est temporairement indisponible. Veuillez réessayer plus tard.",
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="form-stack login-auth-form">
                {step === "email" ? (
                  <label className="login-auth-field">
                    {t("Email address", "Adresse e-mail")}
                    <span className="login-field-shell">
                      <Mail size={18} aria-hidden="true" />
                      <input
                        key="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="go"
                        placeholder="you@yourbusiness.com"
                        autoFocus
                      />
                    </span>
                  </label>
                ) : (
                  <label className="login-auth-field">
                    {t("Verification code", "Code de vérification")}
                    <span className="login-field-shell login-code-field">
                      <input
                        key="code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        pattern="[0-9]{6}"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        enterKeyHint="done"
                        autoFocus
                        placeholder="000000"
                        className="otp-input"
                      />
                    </span>
                  </label>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <SubmitButton busy={busy}>
                  {step === "email"
                    ? t("Send code", "Envoyer le code")
                    : t("Sign in", "Se connecter")}
                </SubmitButton>
                {step === "code" && (
                  <div className="login-code-actions">
                    <button
                      className="text-button"
                      type="button"
                      disabled={cooldown > 0 || busy}
                      onClick={() => {
                        setBusy(true);
                        setError("");
                        void sendCode()
                          .catch((error) => setError(error.message))
                          .finally(() => setBusy(false));
                      }}
                    >
                      {cooldown > 0
                        ? t(`Resend code in ${cooldown}s`, `Renvoyer le code dans ${cooldown}s`)
                        : t("Resend verification code", "Renvoyer le code de vérification")}
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setStep("email");
                        setCode("");
                        setError("");
                      }}
                    >
                      <ArrowLeft size={14} />
                      {t("Use a different email", "Utiliser un autre e-mail")}
                    </button>
                  </div>
                )}
              </form>
            )}
            {step === "email" && <AppRegistration disabled={busy} />}
          </div>
        )}
      </section>
    </main>
  );
}
