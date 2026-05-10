import { getAccessToken } from "./auth";

const API_BASE_URL = "http://localhost:3002/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

type RegisterResponse = {
  accessToken: string;
  refreshToken: string;
};

export type Department = {
  id: string;
  schoolId: string;
  name: string;
  code?: string | null;
  description?: string | null;
};

export type DepartmentDetail = Department & {
  isActive?: boolean;
  materialCount?: number;
  courseCount?: number;
};

export type Course = {
  id: string;
  schoolId: string;
  departmentId?: string | null;
  code?: string | null;
  name: string;
  description?: string | null;
  materialCount?: number;
  department?: {
    id: string;
    name?: string | null;
  } | null;
};

export type ChatRoom = {
  id: string;
  roomType?: string;
  name?: string | null;
  counterpartUser?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
  unreadCount?: number;
  lastMessage?: {
    id: string;
    content: string | null;
    senderId?: string;
    senderName?: string | null;
    createdAt?: string;
  } | null;
};

export type ChatMessage = {
  id: string;
  roomId?: string;
  content: string | null;
  createdAt?: string;
  senderId?: string;
  senderName?: string | null;
  sender?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
    name?: string | null;
  };
  user?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
    name?: string | null;
  };
  author?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
    name?: string | null;
  };
};

type MessagesResponse = {
  items: ChatMessage[];
  nextCursor: string | null;
};

export type MaterialFile = {
  id: string;
  filename?: string | null;
  fileType?: string | null;
  fileSize?: string | number | null;
  storageUrl?: string | null;
  createdAt?: string;
  storageKey?: string | null;
};

export type MaterialComment = {
  id: string;
  materialId: string;
  userId?: string;
  content: string;
  createdAt?: string;
  user?: {
    fullName?: string | null;
    username?: string | null;
  };
};

export type MaterialTag = {
  id?: string;
  name: string;
};

export type AcademicMaterial = {
  id: string;
  title: string;
  description?: string | null;
  schoolId?: string;
  uploaderId?: string;
  departmentId?: string | null;
  courseId?: string | null;
  tags?: MaterialTag[];
  file?: MaterialFile | null;
  files?: MaterialFile[];
  voteCount?: number;
  voteScore?: number;
  isBookmarked?: boolean;
  bookmarkedByMe?: boolean;
  myVote?: number;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
  };
  uploader?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
  };
  department?: {
    id: string;
    name?: string | null;
  } | null;
  course?: {
    id: string;
    name?: string | null;
  } | null;
};

export type MaterialsListResponse = {
  items: AcademicMaterial[];
  nextCursor: string | null;
};

export type SearchResult = {
  entityType: "material" | "user" | "group" | string;
  entityId: string;
  title: string;
  preview?: string;
  metadata?: Record<string, unknown>;
  relevanceScore?: number;
  createdAt?: string;
};

export type SearchResponse = {
  results: SearchResult[];
  nextCursor: string | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  description?: string | null;
  visibility?: "public" | "private" | string;
  memberCount?: number;
  roomId?: string | null;
  createdAt?: string;
  owner?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
};

export type GroupDetail = GroupSummary & {
  members?: Array<{
    id: string;
    fullName?: string | null;
    username?: string | null;
    email?: string | null;
    roomRole?: string | null;
    joinedAt?: string;
  }>;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  username?: string | null;
  bio?: string | null;
  role?: string;
  onboardingCompleted?: boolean;
  school?: {
    id: string;
    name: string;
  } | null;
  department?: {
    id: string;
    name: string;
  } | null;
};

export type UserPresence = {
  userId: string;
  status: "online" | "offline";
  lastSeen: string;
};

export type SocialUserSummary = {
  id: string;
  fullName: string;
  username?: string | null;
  email: string;
  role?: string;
  department?: {
    id: string;
    name?: string | null;
  } | null;
};

export type FriendListItem = {
  requestId: string;
  createdAt?: string;
  user: SocialUserSummary;
};

export type FriendsResponse = {
  friends: FriendListItem[];
  incomingRequests: FriendListItem[];
  outgoingRequests: FriendListItem[];
};

export type FollowsResponse = {
  following: Array<{ createdAt?: string; user: SocialUserSummary }>;
  followers: Array<{ createdAt?: string; user: SocialUserSummary }>;
};

export type BlocksResponse = {
  items: Array<{ createdAt?: string; user: SocialUserSummary }>;
};

export type RelationshipState = {
  targetUserId: string;
  isSelf: boolean;
  friendshipStatus: "none" | "incoming_request" | "outgoing_request" | "friends" | string;
  friendRequestId?: string | null;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
  followersCount: number;
  followingCount: number;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  relatedId?: string | null;
  referenceType?: string | null;
};

export type NotificationPreferences = {
  schoolId?: string;
  userId?: string;
  messageNotificationsEnabled: boolean;
  socialNotificationsEnabled: boolean;
  materialNotificationsEnabled: boolean;
  systemNotificationsEnabled: boolean;
  updatedAt?: string;
};

export type ModerationReport = {
  id: string;
  schoolId?: string;
  referenceType: "message" | "material" | "user" | string;
  referenceId: string;
  reporterId: string;
  status: "open" | "under_review" | "resolved" | "dismissed" | string;
  reason: string;
  description?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  subjectPreview?: string | null;
  reporter?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
  reviewer?: {
    id?: string;
    fullName?: string | null;
  } | null;
  targetUser?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
  } | null;
};

export type AuditLogEvent = {
  actionType: string;
  occurredAt: string;
  userId?: string;
  actorName?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
};

export type AdminToolsOverview = {
  recentRegistrations: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    createdAt: string;
  }>;
  recentReports: Array<{
    id: string;
    referenceType: string;
    status: string;
    createdAt: string;
  }>;
  recentMaterialUploads: Array<{
    id: string;
    title: string;
    createdAt: string;
    uploaderId: string;
    uploaderName: string;
  }>;
};

function normalizeMaterialTag(raw: unknown): MaterialTag | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const tag = raw as Record<string, unknown>;
  if (typeof tag.name !== "string" || !tag.name.trim()) {
    return null;
  }

  return {
    id: typeof tag.id === "string" ? tag.id : undefined,
    name: tag.name
  };
}

function normalizeMaterialFile(raw: unknown): MaterialFile | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const file = raw as Record<string, unknown>;
  if (typeof file.id !== "string") {
    return null;
  }

  return {
    id: file.id,
    filename:
      typeof file.filename === "string"
        ? file.filename
        : typeof file.fileName === "string"
          ? file.fileName
          : null,
    fileType:
      typeof file.fileType === "string"
        ? file.fileType
        : typeof file.mimeType === "string"
          ? file.mimeType
          : null,
    fileSize:
      typeof file.fileSize === "string" || typeof file.fileSize === "number"
        ? file.fileSize
        : typeof file.sizeBytes === "number"
          ? file.sizeBytes
          : null,
    storageUrl:
      typeof file.storageUrl === "string"
        ? file.storageUrl
        : typeof file.storageKey === "string"
          ? file.storageKey
          : null,
    createdAt: typeof file.createdAt === "string" ? file.createdAt : undefined,
    storageKey: typeof file.storageKey === "string" ? file.storageKey : null
  };
}

function normalizeMaterial(raw: unknown): AcademicMaterial {
  const material = (raw ?? {}) as Record<string, unknown>;
  const uploaderSource =
    typeof material.uploader === "object" && material.uploader
      ? (material.uploader as Record<string, unknown>)
      : typeof material.createdBy === "object" && material.createdBy
        ? (material.createdBy as Record<string, unknown>)
        : {};

  const tags = Array.isArray(material.tags)
    ? material.tags.map(normalizeMaterialTag).filter((tag): tag is MaterialTag => Boolean(tag))
    : [];
  const files = Array.isArray(material.files)
    ? material.files.map(normalizeMaterialFile).filter((file): file is MaterialFile => Boolean(file))
    : [];
  const file = normalizeMaterialFile(material.file);
  const voteScore =
    typeof material.voteScore === "number"
      ? material.voteScore
      : typeof material.vote_score === "number"
        ? material.vote_score
        : typeof material.voteCount === "number"
          ? material.voteCount
          : 0;
  const bookmarkedByMe =
    typeof material.bookmarkedByMe === "boolean"
      ? material.bookmarkedByMe
      : Boolean(material.bookmarked_by_me ?? material.isBookmarked);
  const myVote =
    typeof material.myVote === "number"
      ? material.myVote
      : typeof material.my_vote === "number"
        ? material.my_vote
        : 0;

  return {
    id: typeof material.id === "string" ? material.id : "",
    title: typeof material.title === "string" ? material.title : "",
    description: typeof material.description === "string" ? material.description : null,
    schoolId: typeof material.schoolId === "string" ? material.schoolId : typeof material.school_id === "string" ? material.school_id : undefined,
    uploaderId:
      typeof material.uploaderId === "string"
        ? material.uploaderId
        : typeof material.uploader_id === "string"
          ? material.uploader_id
          : typeof uploaderSource.id === "string"
            ? uploaderSource.id
            : undefined,
    departmentId:
      typeof material.departmentId === "string"
        ? material.departmentId
        : typeof material.department_id === "string"
          ? material.department_id
          : null,
    courseId:
      typeof material.courseId === "string"
        ? material.courseId
        : typeof material.course_id === "string"
          ? material.course_id
          : null,
    tags,
    file,
    files,
    voteCount: voteScore,
    voteScore,
    isBookmarked: bookmarkedByMe,
    bookmarkedByMe,
    myVote,
    deletedAt:
      typeof material.deletedAt === "string"
        ? material.deletedAt
        : typeof material.deleted_at === "string"
          ? material.deleted_at
          : null,
    createdAt: typeof material.createdAt === "string" ? material.createdAt : undefined,
    updatedAt: typeof material.updatedAt === "string" ? material.updatedAt : undefined,
    createdBy:
      typeof uploaderSource.id === "string" ||
      typeof uploaderSource.fullName === "string" ||
      typeof uploaderSource.username === "string"
        ? {
            id: typeof uploaderSource.id === "string" ? uploaderSource.id : undefined,
            fullName:
              typeof uploaderSource.fullName === "string"
                ? uploaderSource.fullName
                : typeof uploaderSource.full_name === "string"
                  ? uploaderSource.full_name
                  : null,
            username: typeof uploaderSource.username === "string" ? uploaderSource.username : null
          }
        : undefined,
    uploader:
      typeof uploaderSource.id === "string" ||
      typeof uploaderSource.fullName === "string" ||
      typeof uploaderSource.username === "string"
        ? {
            id: typeof uploaderSource.id === "string" ? uploaderSource.id : undefined,
            fullName:
              typeof uploaderSource.fullName === "string"
                ? uploaderSource.fullName
                : typeof uploaderSource.full_name === "string"
                  ? uploaderSource.full_name
                  : null,
            username: typeof uploaderSource.username === "string" ? uploaderSource.username : null
          }
        : undefined,
    department:
      material.department && typeof material.department === "object"
        ? {
            id:
              typeof (material.department as Record<string, unknown>).id === "string"
                ? ((material.department as Record<string, unknown>).id as string)
                : "",
            name:
              typeof (material.department as Record<string, unknown>).name === "string"
                ? ((material.department as Record<string, unknown>).name as string)
                : null
          }
        : null,
    course:
      material.course && typeof material.course === "object"
        ? {
            id:
              typeof (material.course as Record<string, unknown>).id === "string"
                ? ((material.course as Record<string, unknown>).id as string)
                : "",
            name:
              typeof (material.course as Record<string, unknown>).name === "string"
                ? ((material.course as Record<string, unknown>).name as string)
                : null
          }
        : null
  };
}

async function request<T>(
  path: string,
  init?: RequestInit,
  withAuth = true
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && init?.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  if (withAuth) {
    const token = getAccessToken();
    if (!token) {
      throw new Error("NO_TOKEN");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || `HTTP_${res.status}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password })
    },
    false
  );
}

export async function register(payload: {
  full_name: string;
  email: string;
  password: string;
  department_id: string;
  username?: string;
}): Promise<RegisterResponse> {
  return request<RegisterResponse>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    false
  );
}

export async function getDepartments(): Promise<Department[]> {
  return request<Department[]>("/departments", undefined, false);
}

export async function getDepartmentById(departmentId: string): Promise<DepartmentDetail> {
  return request<DepartmentDetail>(`/departments/${departmentId}`, undefined, false);
}

export async function getCourses(): Promise<Course[]> {
  return request<Course[]>("/courses", undefined, false);
}

export async function getCourseById(courseId: string): Promise<Course> {
  return request<Course>(`/courses/${courseId}`, undefined, false);
}

export async function getCurrentUser(): Promise<UserProfile> {
  return request<UserProfile>("/auth/me");
}

export async function updateCurrentUser(payload: {
  full_name?: string;
  username?: string;
  bio?: string;
  department_id?: string;
}): Promise<UserProfile> {
  return request<UserProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function completeOnboarding(payload: {
  full_name: string;
  department_id: string;
  username: string;
  bio?: string;
}): Promise<UserProfile> {
  return request<UserProfile>("/auth/onboarding", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function getRooms(): Promise<ChatRoom[]> {
  return request<ChatRoom[]>("/chat/rooms");
}

export async function getMessages(
  roomId: string,
  params?: { cursor?: string; limit?: number; direction?: "older" | "newer" }
): Promise<MessagesResponse> {
  const search = new URLSearchParams();
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.direction) search.set("direction", params.direction);
  const query = search.toString();
  return request<MessagesResponse>(`/chat/rooms/${roomId}/messages${query ? `?${query}` : ""}`);
}

export async function sendMessage(payload: {
  roomId: string;
  content: string;
  replyToMessageId?: string;
  attachmentIds?: string[];
}): Promise<unknown> {
  return request("/chat/messages", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function reportChatMessage(
  messageId: string,
  payload: {
    reason:
      | "spam"
      | "harassment"
      | "hate_speech"
      | "inappropriate_content"
      | "copyright"
      | "misinformation"
      | "other";
    description?: string;
  }
): Promise<unknown> {
  return request(`/chat/messages/${messageId}/report`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function markRoomAsRead(
  roomId: string,
  lastReadMessageId: string
): Promise<unknown> {
  return request(`/chat/rooms/${roomId}/read`, {
    method: "PATCH",
    body: JSON.stringify({ roomId, lastReadMessageId })
  });
}

export async function getMaterials(params?: {
  departmentId?: string;
  courseId?: string;
  tags?: string[];
  cursor?: string;
}): Promise<MaterialsListResponse> {
  const search = new URLSearchParams();
  if (params?.departmentId) search.set("departmentId", params.departmentId);
  if (params?.courseId) search.set("courseId", params.courseId);
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.tags?.length) {
    for (const tag of params.tags) {
      if (tag.trim()) search.append("tags", tag.trim());
    }
  }
  const query = search.toString();
  const response = await request<MaterialsListResponse>(`/materials${query ? `?${query}` : ""}`);
  return {
    items: Array.isArray(response.items) ? response.items.map(normalizeMaterial) : [],
    nextCursor: response.nextCursor ?? null
  };
}

export async function getMaterialById(materialId: string): Promise<AcademicMaterial> {
  const response = await request<AcademicMaterial>(`/materials/${materialId}`);
  return normalizeMaterial(response);
}

export async function createMaterial(payload: {
  title: string;
  description?: string;
  departmentId?: string;
  courseId?: string;
  tags?: string[];
  materialType: string;
  storageUrl: string;
  filename: string;
  fileType: string;
  fileSize: string;
}): Promise<AcademicMaterial> {
  const response = await request<AcademicMaterial>("/materials", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return normalizeMaterial(response);
}

export async function updateMaterial(
  materialId: string,
  payload: {
    title?: string;
    description?: string;
    departmentId?: string;
    courseId?: string;
    tags?: string[];
  }
): Promise<AcademicMaterial> {
  const response = await request<AcademicMaterial>(`/materials/${materialId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  return normalizeMaterial(response);
}

export async function deleteMaterial(materialId: string): Promise<{ removed: boolean; id: string }> {
  return request<{ removed: boolean; id: string }>(`/materials/${materialId}`, {
    method: "DELETE"
  });
}

export async function getMaterialComments(materialId: string): Promise<{
  items: MaterialComment[];
  nextCursor: string | null;
}> {
  return request<{ items: MaterialComment[]; nextCursor: string | null }>(
    `/materials/${materialId}/comments`
  );
}

export async function addMaterialComment(
  materialId: string,
  content: string
): Promise<MaterialComment> {
  return request<MaterialComment>(`/materials/${materialId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
}

export async function voteMaterial(
  materialId: string,
  vote: 1 | -1 = 1
): Promise<unknown> {
  return request(`/materials/${materialId}/vote`, {
    method: "POST",
    body: JSON.stringify({ vote })
  });
}

export async function removeMaterialVote(materialId: string): Promise<unknown> {
  return request(`/materials/${materialId}/vote`, {
    method: "DELETE"
  });
}

export async function bookmarkMaterial(materialId: string): Promise<unknown> {
  return request(`/materials/${materialId}/bookmark`, {
    method: "POST"
  });
}

export async function removeMaterialBookmark(materialId: string): Promise<unknown> {
  return request(`/materials/${materialId}/bookmark`, {
    method: "DELETE"
  });
}

export async function reportMaterial(
  materialId: string,
  reason:
    | "spam"
    | "harassment"
    | "hate_speech"
    | "inappropriate_content"
    | "copyright"
    | "misinformation"
    | "other" = "inappropriate_content",
  description = "Reported from frontend test"
): Promise<unknown> {
  return request(`/materials/${materialId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, description })
  });
}

function makeSearchQuery(query: string): string {
  const search = new URLSearchParams();
  search.set("query", query);
  return search.toString();
}

export async function searchAll(query: string): Promise<SearchResponse> {
  const params = makeSearchQuery(query);
  return request<SearchResponse>(`/search?${params}`);
}

export async function searchMaterials(query: string): Promise<SearchResponse> {
  const params = makeSearchQuery(query);
  return request<SearchResponse>(`/search/materials?${params}`);
}

export async function searchUsers(query: string): Promise<SearchResponse> {
  const params = makeSearchQuery(query);
  return request<SearchResponse>(`/search/users?${params}`);
}

export async function searchGroups(query: string): Promise<SearchResponse> {
  const params = makeSearchQuery(query);
  return request<SearchResponse>(`/search/groups?${params}`);
}

export async function getGroups(): Promise<GroupSummary[]> {
  return request<GroupSummary[]>("/groups");
}

export async function getGroupById(groupId: string): Promise<GroupDetail> {
  return request<GroupDetail>(`/groups/${groupId}`);
}

export async function createGroup(payload: {
  name: string;
  description?: string;
  visibility: "public" | "private";
}): Promise<GroupDetail> {
  return request<GroupDetail>("/groups", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getUserById(userId: string): Promise<UserProfile> {
  return request<UserProfile>(`/users/${userId}`);
}

export async function startDirectMessage(targetUserId: string): Promise<{
  roomId: string;
  roomType: string;
}> {
  return request<{ roomId: string; roomType: string }>("/chat/dm/start", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}

export async function getUserPresence(userId: string): Promise<UserPresence> {
  return request<UserPresence>(`/users/${userId}/presence`);
}

export async function getFriends(): Promise<FriendsResponse> {
  return request<FriendsResponse>("/friends");
}

export async function sendFriendRequest(recipientId: string): Promise<{
  status: string;
  requestId?: string;
}> {
  return request("/friends/requests", {
    method: "POST",
    body: JSON.stringify({ recipientId })
  });
}

export async function respondToFriendRequest(
  requestId: string,
  action: "accept" | "reject"
): Promise<{ requestId: string; status: string }> {
  return request(`/friends/requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({ action })
  });
}

export async function getFollows(): Promise<FollowsResponse> {
  return request<FollowsResponse>("/follows");
}

export async function followUser(targetUserId: string): Promise<{ created: boolean }> {
  return request(`/follows/${targetUserId}`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function unfollowUser(targetUserId: string): Promise<{ removed: boolean }> {
  return request(`/follows/${targetUserId}`, {
    method: "DELETE"
  });
}

export async function getBlocks(): Promise<BlocksResponse> {
  return request<BlocksResponse>("/blocks");
}

export async function blockUser(targetUserId: string): Promise<{ blocked: boolean }> {
  return request(`/blocks/${targetUserId}`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function unblockUser(targetUserId: string): Promise<{ removed: boolean }> {
  return request(`/blocks/${targetUserId}`, {
    method: "DELETE"
  });
}

export async function getRelationshipState(targetUserId: string): Promise<RelationshipState> {
  return request<RelationshipState>(`/social/users/${targetUserId}/state`);
}

export async function getNotifications(): Promise<{
  items: NotificationItem[];
  nextCursor: string | null;
}> {
  return request<{ items: NotificationItem[]; nextCursor: string | null }>(
    "/notifications?limit=20"
  );
}

export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  return request<{ count: number }>("/notifications/unread-count");
}

export async function markNotificationRead(notificationId: string): Promise<unknown> {
  return request(`/notifications/${notificationId}/read`, {
    method: "PATCH",
    body: JSON.stringify({})
  });
}

export async function markAllNotificationsRead(): Promise<unknown> {
  return request("/notifications/read-all", {
    method: "PATCH",
    body: JSON.stringify({})
  });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/notifications/preferences");
}

export async function updateNotificationPreferences(payload: {
  messageNotificationsEnabled?: boolean;
  socialNotificationsEnabled?: boolean;
  materialNotificationsEnabled?: boolean;
  systemNotificationsEnabled?: boolean;
}): Promise<NotificationPreferences> {
  return request<NotificationPreferences>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function getModerationReports(params?: {
  referenceType?: "message" | "material" | "user";
  status?: "open" | "under_review" | "linked" | "resolved" | "dismissed";
  limit?: number;
}): Promise<ModerationReport[]> {
  const search = new URLSearchParams();
  if (params?.referenceType) search.set("referenceType", params.referenceType);
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return request<ModerationReport[]>(`/moderation/reports${query ? `?${query}` : ""}`);
}

export async function reviewModerationReport(
  reportId: string,
  payload: { status: "resolved" | "dismissed"; note?: string }
): Promise<ModerationReport> {
  return request<ModerationReport>(`/moderation/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function getAuditLogs(limit = 30): Promise<AuditLogEvent[]> {
  return request<AuditLogEvent[]>(`/audit-logs?limit=${limit}`);
}

export async function getAdminToolsOverview(): Promise<AdminToolsOverview> {
  return request<AdminToolsOverview>("/audit-logs/admin-tools");
}
