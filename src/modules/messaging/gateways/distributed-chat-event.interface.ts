export interface DistributedChatEvent<TPayload = unknown> {
  eventName: string;
  schoolId: string;
  roomId?: string;
  userId?: string;
  payload: TPayload;
  emittedAt: string;
  correlationId: string;
  sourceInstanceId: string;
}
