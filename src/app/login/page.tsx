"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { confirmSignIn, signIn, signOut } from "aws-amplify/auth";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Brand, SubmitButton } from "@/components/ui";
import { accessToken, authConfigured, demoMode, initializeAuth } from "@/lib/auth";
import { resetDeviceIdentityMemory } from "@/lib/device";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppRegistration } from "@/components/app-registration";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/lib/i18n";
import { PlatformGraphic } from "@/components/platform-graphic";

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();
  useEffect(() => {
    if (demoMode || !authConfigured) return;
    let active = true;
    void accessToken()
      .then((token) => {
        if (active && token) router.replace("/overview");
      })
      .catch(() => {
        // No existing session: keep the normal email → code sign-in form.
      });
    return () => {
      active = false;
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
    if (busy) return;
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
      <div className="auth-theme-toggle">
        <LanguageSwitch />
        <ThemeToggle />
      </div>
      <section className="login-story">
        <Brand />
        <div>
          <span className="welcome-kicker">
            {t("YOUR BUSINESS, CONNECTED", "VOTRE ACTIVITÉ, CONNECTÉE")}
          </span>
          <h2>
            {t("Built for the way", "Conçu pour votre façon")}
            <br />
            <span>{t("you do business.", "de faire des affaires.")}</span>
          </h2>
          <p>
            {t(
              "Your stores, payments, and integrations.",
              "Vos boutiques, paiements et intégrations.",
            )}
            <br />
            {t(
              "Together in one place, ready for what’s next.",
              "Réunis au même endroit, prêts pour la suite.",
            )}
          </p>
          <PlatformGraphic />
        </div>
        <small>
          <ShieldCheck size={15} />
          {t("Built around your business.", "Pensé pour votre activité.")}
        </small>
      </section>
      <section className="login-form-section">
        <div className="login-form-wrap">
          <span className="eyebrow">{t("YOUR NEXT CHAPTER", "VOTRE PROCHAINE ÉTAPE")}</span>
          <h1>
            <span className="desktop-page-title">
              {step === "email"
                ? t("Welcome to your workspace.", "Bienvenue dans votre espace.")
                : t("Check your inbox.", "Consultez vos e-mails.")}
            </span>
            <span className="mobile-page-title">
              {step === "email"
                ? t("Sign in to Fondeka.", "Connectez-vous à Fondeka.")
                : t("Enter your code.", "Saisissez votre code.")}
            </span>
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
                {t("Explore demo workspace", "Explorer la démonstration")} <ArrowRight size={17} />
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
            <form onSubmit={submit} className="form-stack">
              {step === "email" ? (
                <label>
                  {t("Email address", "Adresse e-mail")}
                  <input
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
                </label>
              ) : (
                <label>
                  {t("Verification code", "Code de vérification")}
                  <input
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
                </label>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <SubmitButton busy={busy}>
                {step === "email"
                  ? t("Send verification code", "Envoyer le code de vérification")
                  : t("Open my workspace", "Ouvrir mon espace")}
                <ArrowRight size={16} />
              </SubmitButton>
              {step === "code" && (
                <>
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
                </>
              )}
            </form>
          )}
          {step === "email" && <AppRegistration disabled={busy} />}
          <p className="login-footnote">
            <ShieldCheck size={14} />
            {t(
              "Same Fondeka account. A workspace made for business.",
              "Le même compte Fondeka. Un espace pensé pour votre activité.",
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
