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
import { PlatformGraphic } from "@/components/platform-graphic";

export default function Login() {
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
        "This account requires a different authentication step. Please contact Fondeka support.",
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
            "That code is incorrect or expired. Check your email for the latest code and try again.",
          );
        setCode("");
        router.replace("/overview");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "We couldn’t sign you in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="login-screen">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <section className="login-story">
        <Brand />
        <div>
          <span className="welcome-kicker">YOUR BUSINESS, CONNECTED</span>
          <h1>
            Built for the way
            <br />
            <span>you do business.</span>
          </h1>
          <p>
            Your stores, payments, and integrations.
            <br />
            Together in one place, ready for what’s next.
          </p>
          <PlatformGraphic />
        </div>
        <small>
          <ShieldCheck size={15} />
          Built around your business.
        </small>
      </section>
      <section className="login-form-section">
        <div className="login-form-wrap">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h2>{step === "email" ? "Welcome to your workspace." : "Check your inbox."}</h2>
          <p className="muted">
            {step === "email"
              ? "Sign in with the email you use in the Fondeka app."
              : `We’ve sent a verification code to ${email}.`}
          </p>
          {demoMode ? (
            <>
              <div className="info-box">
                This app is currently running in demo mode. Explore the business tools with sample
                data.
              </div>
              <Link className="button primary full-width" href="/overview">
                Explore demo workspace <ArrowRight size={17} />
              </Link>
            </>
          ) : !authConfigured ? (
            <div className="info-box">
              Live sign-in needs your customer Cognito app client. Add the public user pool and
              client identifiers to the app’s environment, then restart the server.
            </div>
          ) : (
            <form onSubmit={submit} className="form-stack">
              {step === "email" ? (
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@yourbusiness.com"
                    autoFocus
                  />
                </label>
              ) : (
                <label>
                  Verification code
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    autoComplete="one-time-code"
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
                {step === "email" ? "Send verification code" : "Open my workspace"}
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
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend verification code"}
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
                    Use a different email
                  </button>
                </>
              )}
            </form>
          )}
          <p className="login-footnote">
            <ShieldCheck size={14} />
            Same Fondeka account. A workspace made for business.
          </p>
        </div>
      </section>
    </main>
  );
}
