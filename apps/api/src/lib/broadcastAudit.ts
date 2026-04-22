import { prisma } from './prisma';

export type BroadcastAuditAction =
  | 'STREAM_CONFIG_VIEWED'
  | 'STREAM_SCHEDULED'
  | 'STREAM_PUBLISHED'
  | 'STREAM_UNPUBLISHED'
  | 'STREAM_ENDED'
  | 'STREAM_RESCHEDULED'
  | 'STREAM_REMINDER_SENT';

type BroadcastAuditRepository = {
  create: (...args: any[]) => Promise<any>;
  findMany: (...args: any[]) => Promise<any>;
};

const broadcastAuditRepo = (prisma as typeof prisma & {
  broadcastAuditLog: BroadcastAuditRepository;
}).broadcastAuditLog;

const isMissingAuditTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  return code === 'P2021' || code === 'P2022';
};

export async function recordBroadcastAuditLog(input: {
  actorId: string;
  action: BroadcastAuditAction;
  summary: string;
  eventId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    return await broadcastAuditRepo.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        summary: input.summary,
        eventId: input.eventId ?? null,
        metadata: input.metadata ?? undefined
      }
    });
  } catch (error) {
    if (isMissingAuditTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function getRecentBroadcastAuditLogs(limit = 12) {
  try {
    return await broadcastAuditRepo.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true
          }
        },
        event: {
          select: {
            id: true,
            title: true,
            startTime: true
          }
        }
      }
    });
  } catch (error) {
    if (isMissingAuditTableError(error)) {
      return [];
    }
    throw error;
  }
}
