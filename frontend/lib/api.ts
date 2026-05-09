import { getAccessToken } from "./auth";

const API_BASE_URL = "http://localhost:3002/api";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
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
  sender?: {
    fullName?: string | null;
    username?: string | null;
  };
};

type MessagesResponse = {
  items: ChatMessage[];
  nextCursor: string | null;
};

export type MaterialFile = {
  id: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
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
  departmentId?: string | null;
  courseId?: string | null;
  tags?: MaterialTag[];
  files?: MaterialFile[];
  voteCount?: number;
  isBookmarked?: boolean;
  createdAt?: string;
  createdBy?: {
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

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  username?: string | null;
  role?: string;
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
    throw new Error(text || `HTTP_${res.status}`);
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

export async function getRooms(): Promise<ChatRoom[]> {
  return request<ChatRoom[]>("/chat/rooms");
}

export async function getMessages(roomId: string): Promise<MessagesResponse> {
  return request<MessagesResponse>(`/chat/rooms/${roomId}/messages`);
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
  return request<MaterialsListResponse>(`/materials${query ? `?${query}` : ""}`);
}

export async function getMaterialById(materialId: string): Promise<AcademicMaterial> {
  return request<AcademicMaterial>(`/materials/${materialId}`);
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
  return request<AcademicMaterial>("/materials", {
    method: "POST",
    body: JSON.stringify(payload)
  });
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
  return request<AcademicMaterial>(`/materials/${materialId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
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
