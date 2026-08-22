import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/auth-form';
import { getSession } from '@/server/auth/session';

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user !== undefined) {
    redirect('/dashboard');
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
        <AuthForm callbackUrl="/dashboard" mode="register" />
        <p className="form-aside">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
