import { NextResponse } from 'next/server';

import { getSession } from '@/server/auth/session';
import { getOwnedTerminalState } from '@/server/terminal-read-model';

export async function GET(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  const session = await getSession();
  if (session?.user === undefined || session.user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { accountId } = await context.params;
  const state = await getOwnedTerminalState(accountId, session.user.id);
  if (state === null) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ kind: 'snapshot', state, version: state.version });
}
