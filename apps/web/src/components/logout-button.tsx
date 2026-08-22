'use client';

import { signOut } from 'next-auth/react';

export function LogoutButton() {
  return (
    <button
      className="text-action"
      onClick={() => void signOut({ callbackUrl: '/' })}
      type="button"
    >
      Sign out
    </button>
  );
}
