import type { AuditEvent, Prisma } from '@prisma/client';

export interface AuditEventInput {
  action: string;
  actorUserId?: string;
  after?: Prisma.InputJsonValue;
  before?: Prisma.InputJsonValue;
  correlationId?: string;
  entityId: string;
  entityType: string;
  idempotencyKey?: string;
  reason?: string;
}

export async function recordAuditEvent(
  transaction: Prisma.TransactionClient,
  input: AuditEventInput,
): Promise<AuditEvent> {
  const data: Prisma.AuditEventUncheckedCreateInput = {
    action: input.action,
    entityId: input.entityId,
    entityType: input.entityType,
    ...(input.actorUserId === undefined
      ? {}
      : { actorUserId: input.actorUserId }),
    ...(input.after === undefined ? {} : { after: input.after }),
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.correlationId === undefined
      ? {}
      : { correlationId: input.correlationId }),
    ...(input.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: input.idempotencyKey }),
    ...(input.reason === undefined ? {} : { reason: input.reason }),
  };

  return transaction.auditEvent.create({
    data,
  });
}
