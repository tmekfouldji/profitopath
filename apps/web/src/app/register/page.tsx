import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth-form';
import { authPageHref, safeCallbackUrl } from '@/lib/auth-callback';
import { getSession } from '@/server/auth/session';

export default async function RegisterPage({
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
          <p className="eyebrow">One identity / auditable entries</p>
          <h1>Create your profile</h1>
          <p>
            This creates a competition identity only. Trading balances are
            fictitious and are provisioned separately for each valid weekly
            entry.
          </p>
        </div>
        <AuthForm callbackUrl={destination} mode="register" />
        <p className="form-aside">
          Already registered?{' '}
          <Link href={authPageHref('/login', destination)}>Sign in</Link>
        </p>
      </section>
    </main>
  );
}
