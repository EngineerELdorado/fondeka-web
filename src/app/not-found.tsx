import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="full-loading">
      <h1>A little off the beaten path.</h1>
      <p>This page doesn’t exist.</p>
      <Link className="button primary" href="/overview">
        Back to your workspace
      </Link>
    </main>
  );
}
