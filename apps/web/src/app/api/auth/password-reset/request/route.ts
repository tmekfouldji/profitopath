import { database } from '@profitopath/database';
import {
  createLogger,
  verificationEmailInputSchema,
} from '@profitopath/shared';

import {
  isSmtpEmailDeliveryConfigured,
  sendPasswordReset,
} from '@/server/email-delivery';
import { reservePasswordResetRequest } from '@/server/auth/password-reset-rate-limit';
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  passwordResetExpiry,
} from '@/server/password-reset';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const logger = createLogger({ service: 'web-auth', version: '0.1.0' });
const acceptedResponse = () =>
  Response.json({ status: 'accepted' }, { status: 202 });

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = verificationEmailInputSchema.safeParse(body);
  if (!parsed.success || !isSmtpEmailDeliveryConfigured()) {
    return acceptedResponse();
  }
  if (!(await reservePasswordResetRequest(parsed.data.email))) {
    return acceptedResponse();
  }

  const token = createPasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const expires = passwordResetExpiry();
  const user = await database.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({
      include: { credential: { select: { userId: true } } },
      where: { email: parsed.data.email },
    });
    if (
      existing === null ||
      existing.credential === null ||
      existing.emailVerified === null ||
      existing.status !== 'ACTIVE'
    ) {
      return null;
    }

    await transaction.passwordResetToken.deleteMany({
      where: { userId: existing.id },
    });
    await transaction.passwordResetToken.create({
      data: { expires, token: tokenHash, userId: existing.id },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'PASSWORD_RESET_ISSUED',
        actorUserId: existing.id,
        entityId: existing.id,
        entityType: 'User',
      },
    });
    return { email: existing.email };
  });

  if (user !== null) {
    await sendPasswordReset({ recipient: user.email, token }).catch(
      (error: unknown) => {
        logger.error(
          { error },
          'Password-reset delivery failed after reset token issuance',
        );
      },
    );
  }
  return acceptedResponse();
}
