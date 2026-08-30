import Link from 'next/link';

import { ResendVerificationForm } from '@/components/resend-verification-form';
import { verificationTokenPattern } from '@/server/email-verification';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; token?: string | string[] }>;
}) {
  const { status, token } = await searchParams;
  const verificationToken =
    typeof token === 'string' && verificationTokenPattern.test(token)
      ? token
      : undefined;

  if (verificationToken === undefined) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div>
            <p className="eyebrow">Email confirmation</p>
            <h1>Send a new link</h1>
            <p>
              {status === 'invalid'
                ? 'That confirmation link is invalid or has expired.'
                : 'Enter the address used for your Profitopath profile.'}
            </p>
          </div>
          <ResendVerificationForm />
          <p className="form-aside">
            Already confirmed? <Link href="/login">Sign in</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Email confirmation</p>
          <h1>Confirm your address</h1>
          <p>
            Confirming activates credential sign-in. This button keeps mail
            scanners from consuming your one-time link automatically.
          </p>
        </div>
        <form
          action="/api/auth/verify-email"
          className="auth-form"
          method="post"
        >
          <input name="token" type="hidden" value={verificationToken} />
          <button className="button button-primary" type="submit">
            Confirm email address
          </button>
        </form>
      </section>
    </main>
  );
}
