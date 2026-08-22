import { Prisma, database } from '@profitopath/database';
import { hashPassword, registrationInputSchema } from '@profitopath/shared';

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

  const passwordHash = await hashPassword(parsed.data.password);

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
      await transaction.auditEvent.create({
        data: {
          action: 'REGISTERED',
          actorUserId: created.id,
          after: { status: 'ACTIVE' },
          entityId: created.id,
          entityType: 'User',
        },
      });
      return created;
    });

    return Response.json({ id: user.id }, { status: 201 });
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
