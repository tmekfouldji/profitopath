'use client';

import { type FormEvent, useState } from 'react';

export function ResendVerificationForm() {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const email = String(new FormData(event.currentTarget).get('email') ?? '');
    try {
      await fetch('/api/auth/verify-email/resend', {
        body: JSON.stringify({ email }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      setMessage(
        'If an unconfirmed Profitopath profile uses that address, a new link is on its way.',
      );
    } catch {
      setMessage('Unable to request a link right now. Try again shortly.');
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
        {pending ? 'Sending…' : 'Send confirmation link'}
      </button>
    </form>
  );
}
