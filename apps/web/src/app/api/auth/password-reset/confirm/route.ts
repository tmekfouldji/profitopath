import { hashPassword, passwordResetInputSchema } from '@profitopath/shared';

import { consumePasswordResetToken } from '@/server/password-reset';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = passwordResetInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_reset' }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const result = await consumePasswordResetToken(
    parsed.data.token,
    passwordHash,
  );
  if (result !== 'reset') {
    return Response.json({ error: 'invalid_reset' }, { status: 400 });
  }
  return Response.json({ status: 'password_reset' });
}
