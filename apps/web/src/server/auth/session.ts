import 'server-only';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { canAccessAdmin, canAccessSuperadmin } from './authorization';
import { authOptions } from './options';

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireUser(callbackUrl: string) {
  const session = await getSession();
  if (session?.user === undefined || session.user.status !== 'ACTIVE') {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser('/admin');
  if (!canAccessAdmin(user)) {
    redirect('/dashboard?notice=admin-required');
  }
  return user;
}

export async function requireSuperadmin() {
  const user = await requireUser('/superadmin');
  if (!canAccessSuperadmin(user)) {
    redirect('/dashboard?notice=superadmin-required');
  }
  return user;
}
