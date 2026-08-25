import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth-form';
import { authPageHref, safeCallbackUrl } from '@/lib/auth-callback';
import { getSession } from '@/server/auth/session';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
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
