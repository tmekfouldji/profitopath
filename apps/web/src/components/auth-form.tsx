'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

export function AuthForm({
  callbackUrl,
  mode,
}: {
  callbackUrl: string;
  mode: 'login' | 'register';
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string>();

  async function authenticate(
    email: string,
    password: string,
  ): Promise<boolean> {
    const result = await signIn('credentials', {
      callbackUrl,
      email,
      password,
      redirect: false,
    });
    if (result === undefined || !result.ok || result.error !== null) {
      setError('Email or password was not recognized.');
      return false;
    }
    router.replace(callbackUrl);
    router.refresh();
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    try {
      if (mode === 'register') {
        const response = await fetch('/api/auth/register', {
          body: JSON.stringify({
            displayName: String(form.get('displayName') ?? ''),
            email,
            password,
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
        if (!response.ok) {
          setError(
            response.status === 409
              ? 'An account already uses this email. Sign in instead.'
              : response.status >= 500
                ? 'Registration is temporarily unavailable. Try again.'
                : 'Check your details and use a password of at least 12 characters.',
          );
          return;
        }
        setVerificationEmail(email);
        return;
      }
      await authenticate(email, password);
    } catch {
      setError('Authentication is temporarily unavailable. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      {mode === 'register' ? (
        <label>
          Display name
          <input autoComplete="name" name="displayName" required type="text" />
        </label>
      ) : null}
      <label>
        Email
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        Password
        <input
          autoComplete={
            mode === 'register' ? 'new-password' : 'current-password'
          }
          minLength={mode === 'register' ? 12 : 1}
          name="password"
          required
          type="password"
        />
        {mode === 'register' ? (
          <small className="field-help">Use at least 12 characters.</small>
        ) : null}
      </label>
      {error === undefined ? null : (
        <p aria-live="polite" className="form-error" role="alert">
          {error}
        </p>
      )}
      {verificationEmail === undefined ? null : (
        <p aria-live="polite" className="form-success" role="status">
          Check {verificationEmail} for your confirmation link. You must confirm
          the address before signing in.
        </p>
      )}
      {mode === 'login' ? (
        <p className="field-help">
          Need to confirm your address?{' '}
          <Link href="/verify-email">Send a new confirmation link</Link>
        </p>
      ) : null}
      <button
        className="button button-primary"
        disabled={pending || verificationEmail !== undefined}
        type="submit"
      >
        {pending
          ? 'Working…'
          : mode === 'register'
            ? verificationEmail === undefined
              ? 'Create trading profile'
              : 'Confirmation sent'
            : 'Open dashboard'}
      </button>
    </form>
  );
}
