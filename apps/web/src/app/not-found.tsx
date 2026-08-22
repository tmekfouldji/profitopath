import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="empty-state">
        <span className="data-label">404 / no ledger record</span>
        <h1>That record is not available.</h1>
        <p>
          It may not exist, or your account does not have permission to view it.
        </p>
        <Link className="button button-primary" href="/dashboard">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
