import { Prisma, database } from '@profitopath/database';
import {
  createLogger,
  hashPassword,
  registrationInputSchema,
} from '@profitopath/shared';

import {
  isSmtpEmailDeliveryConfigured,
  sendEmailVerification,
} from '@/server/email-delivery';
import {
  createEmailVerificationToken,
  emailVerificationExpiry,
  hashEmailVerificationToken,
} from '@/server/email-verification';

const logger = createLogger({ service: 'web-auth', version: '0.1.0' });

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = registrationInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: 'invalid_registration',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (!isSmtpEmailDeliveryConfigured()) {
    return Response.json(
      { error: 'email_delivery_unavailable' },
      { status: 503 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const verificationToken = createEmailVerificationToken();
  const verificationTokenHash = hashEmailVerificationToken(verificationToken);
  const verificationExpiresAt = emailVerificationExpiry();

  try {
    const user = await database.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          credential: { create: { passwordHash } },
          displayName: parsed.data.displayName,
          email: parsed.data.email,
          name: parsed.data.displayName,
          profile: { create: { timezone: 'UTC' } },
        },
        select: { email: true, id: true },
      });
      await transaction.verificationToken.create({
        data: {
          expires: verificationExpiresAt,
          identifier: created.email,
          token: verificationTokenHash,
        },
      });
      await transaction.auditEvent.create({
        data: {
          action: 'REGISTERED',
          actorUserId: created.id,
          after: { emailVerified: false, status: 'ACTIVE' },
          entityId: created.id,
          entityType: 'User',
        },
      });
      await transaction.auditEvent.create({
        data: {
          action: 'EMAIL_VERIFICATION_ISSUED',
          actorUserId: created.id,
          entityId: created.id,
          entityType: 'User',
        },
      });
      return created;
    });

    try {
      await sendEmailVerification({
        recipient: user.email,
        token: verificationToken,
      });
    } catch (error) {
      logger.error(
        { error },
        'Email verification delivery failed during registration',
      );
      return Response.json(
        { error: 'email_delivery_unavailable' },
        { status: 503 },
      );
    }

    return Response.json({ status: 'verification_required' }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return Response.json({ error: 'account_exists' }, { status: 409 });
    }
    throw error;
  }
}
