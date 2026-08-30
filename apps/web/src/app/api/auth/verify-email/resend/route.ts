import { database } from '@profitopath/database';
import { verificationEmailInputSchema } from '@profitopath/shared';

import {
  isSmtpEmailDeliveryConfigured,
  sendEmailVerification,
} from '@/server/email-delivery';
import {
  createEmailVerificationToken,
  emailVerificationExpiry,
  hashEmailVerificationToken,
} from '@/server/email-verification';
import { reserveVerificationEmailResend } from '@/server/auth/email-verification-rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const acceptedResponse = () =>
  Response.json({ status: 'accepted' }, { status: 202 });

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = verificationEmailInputSchema.safeParse(body);
  if (!parsed.success || !isSmtpEmailDeliveryConfigured()) {
    return acceptedResponse();
  }
  if (!(await reserveVerificationEmailResend(parsed.data.email))) {
    return acceptedResponse();
  }

  const verificationToken = createEmailVerificationToken();
  const verificationExpiresAt = emailVerificationExpiry();
  const verificationTokenHash = hashEmailVerificationToken(verificationToken);
  const user = await database.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({
      select: { email: true, emailVerified: true, id: true },
      where: { email: parsed.data.email },
    });
    if (existing === null || existing.emailVerified !== null) {
      return null;
    }
    await transaction.verificationToken.deleteMany({
      where: { identifier: existing.email },
    });
    await transaction.verificationToken.create({
      data: {
        expires: verificationExpiresAt,
        identifier: existing.email,
        token: verificationTokenHash,
      },
    });
    await transaction.auditEvent.create({
      data: {
        action: 'EMAIL_VERIFICATION_REISSUED',
        actorUserId: existing.id,
        entityId: existing.id,
        entityType: 'User',
      },
    });
    return existing;
  });

  if (user !== null) {
    await sendEmailVerification({
      recipient: user.email,
      token: verificationToken,
    }).catch(() => undefined);
  }
  return acceptedResponse();
}
