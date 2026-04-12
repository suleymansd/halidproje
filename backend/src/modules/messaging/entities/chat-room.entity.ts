export class ChatRoomEntity {
  id!: string;
  schoolId!: string;
  roomType!: 'general' | 'department' | 'private' | 'group';
  name?: string;
}
