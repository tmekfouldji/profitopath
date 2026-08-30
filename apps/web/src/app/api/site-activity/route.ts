import { randomUUID } from 'node:crypto';

import { createLogger } from '@profitopath/shared';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSession } from '@/server/auth/session';
import {
  recordActiveMember,
  recordDailyWebsiteVisit,
  siteVisitorCookie,
} from '@/server/site-observability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const logger = createLogger({ service: 'web-activity', version: '0.1.0' });

async function activityPath(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    if (typeof body === 'object' && body !== null && 'path' in body) {
      return body.path;
    }
  } catch {
    // Activity telemetry is optional; invalid input is recorded as the home path.
  }
  return '/';
}

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const existingVisitorId = cookieStore.get(siteVisitorCookie)?.value;
  const anonymousVisitorId = existingVisitorId ?? randomUUID();
  const [path, session] = await Promise.all([
    activityPath(request),
    getSession(),
  ]);

  await Promise.all([
    recordDailyWebsiteVisit({ anonymousVisitorId, path }).catch(
      (error: unknown) => {
        logger.warn(
          { error },
          'Unable to record privacy-preserving site visit',
        );
      },
    ),
    session?.user.status === 'ACTIVE'
      ? recordActiveMember(session.user.id)
      : Promise.resolve(),
  ]);

  const response = new NextResponse(null, { status: 204 });
  if (existingVisitorId === undefined) {
    response.cookies.set({
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
      name: siteVisitorCookie,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      value: anonymousVisitorId,
    });
  }
  return response;
}
