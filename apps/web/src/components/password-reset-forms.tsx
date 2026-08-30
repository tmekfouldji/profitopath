'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

export function RequestPasswordResetForm() {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const email = String(new FormData(event.currentTarget).get('email') ?? '');
    try {
      await fetch('/api/auth/password-reset/request', {
        body: JSON.stringify({ email }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      setMessage(
        'If an active, confirmed Profitopath profile uses that address, a reset link is on its way.',
      );
    } catch {
      setMessage(
        'Unable to request a reset link right now. Try again shortly.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <label>
        Email
        <input autoComplete="email" name="email" required type="email" />
      </label>
      {message === undefined ? null : (
        <p aria-live="polite" className="form-success" role="status">
          {message}
        </p>
      )}
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}

export function ConfirmPasswordResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        body: JSON.stringify({ password, token }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        setError(
          'This reset link is invalid or has expired. Request a new one.',
        );
        return;
      }
      router.replace('/login?notice=password-reset');
      router.refresh();
    } catch {
      setError('Password reset is temporarily unavailable. Try again shortly.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <label>
        New password
        <input
          autoComplete="new-password"
          minLength={12}
          name="password"
          required
          type="password"
        />
        <small className="field-help">Use at least 12 characters.</small>
      </label>
      <label>
        Confirm new password
        <input
          autoComplete="new-password"
          minLength={12}
          name="confirmation"
          required
          type="password"
        />
      </label>
      {error === undefined ? null : (
        <p aria-live="polite" className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Updating…' : 'Set new password'}
      </button>
      <p className="field-help">
        Need a fresh link? <Link href="/reset-password">Request one</Link>.
      </p>
    </form>
  );
}
