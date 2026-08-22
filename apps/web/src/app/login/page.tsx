import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth-form';
import { getSession } from '@/server/auth/session';

function safeCallback(value: string | undefined): string {
  return value?.startsWith('/') === true && !value.startsWith('//')
    ? value
    : '/dashboard';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getSession();
  if (session?.user !== undefined) {
    redirect('/dashboard');
  }
  const { callbackUrl } = await searchParams;

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
        <AuthForm callbackUrl={safeCallback(callbackUrl)} mode="login" />
        <p className="form-aside">
          New here? <Link href="/register">Create a trading profile</Link>
        </p>
      </section>
    </main>
  );
}
