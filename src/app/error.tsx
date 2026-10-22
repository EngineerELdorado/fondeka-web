"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="full-loading">
      <h1>Let’s give that another try.</h1>
      <p>We couldn’t open this page.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
