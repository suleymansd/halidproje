export interface JoinRoomSocketPayload {
  roomId: string;
}

export interface LeaveRoomSocketPayload {
  roomId: string;
}

export interface DeleteMessageSocketPayload {
  messageId: string;
}

export interface TypingSocketPayload {
  roomId: string;
}
