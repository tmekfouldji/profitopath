import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth-form';
import { authPageHref, safeCallbackUrl } from '@/lib/auth-callback';
import { getSession } from '@/server/auth/session';

const notices: Record<string, string> = {
  'email-already-verified':
    'This email address is already confirmed. Sign in to continue.',
  'email-verified': 'Email confirmed. You can now sign in.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; notice?: string }>;
}) {
  const { callbackUrl, notice } = await searchParams;
  const destination = safeCallbackUrl(callbackUrl);
  const session = await getSession();
  if (session?.user !== undefined) {
    redirect(destination);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Return to the desk</p>
          <h1>Sign in</h1>
          <p>
            Open your competition accounts and resume from authoritative server
            state.
          </p>
        </div>
        {notice === undefined || notices[notice] === undefined ? null : (
          <p className="form-success" role="status">
            {notices[notice]}
          </p>
        )}
        <AuthForm callbackUrl={destination} mode="login" />
        <p className="form-aside">
          New here?{' '}
          <Link href={authPageHref('/register', destination)}>
            Create a trading profile
          </Link>
        </p>
      </section>
    </main>
  );
}
