export interface ModerationActionPayload {
  caseId: string;
  targetUserId: string;
  actionType: string;
  reason: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
}
