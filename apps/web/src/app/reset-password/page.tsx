import Link from 'next/link';

import {
  ConfirmPasswordResetForm,
  RequestPasswordResetForm,
} from '@/components/password-reset-forms';
import { passwordResetTokenPattern } from '@/server/password-reset';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const resetToken =
    typeof token === 'string' && passwordResetTokenPattern.test(token)
      ? token
      : undefined;

  if (resetToken === undefined) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div>
            <p className="eyebrow">Password recovery</p>
            <h1>Reset your password</h1>
            <p>
              Enter your confirmed Profitopath email address and we&apos;ll send
              a one-time reset link.
            </p>
          </div>
          <RequestPasswordResetForm />
          <p className="form-aside">
            Remembered it? <Link href="/login">Sign in</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div>
          <p className="eyebrow">Password recovery</p>
          <h1>Choose a new password</h1>
          <p>
            This one-time link will be consumed when your new password is
            accepted.
          </p>
        </div>
        <ConfirmPasswordResetForm token={resetToken} />
      </section>
    </main>
  );
}
