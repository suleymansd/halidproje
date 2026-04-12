# IsuChat Messaging API Contract

## 1. Messaging API Contract Overview

The IsuChat messaging module uses a unified room-based chat model. All room types share the same message engine and differ only in access policy and lifecycle rules.

Room types:
- `general`
- `department`
- `private`
- `group`

Core contract principles:
- every request and socket operation is authenticated
- every operation is tenant-scoped by `school_id`
- room access is validated before exposing room or message data
- private rooms are created through create-or-get semantics
- messages are soft-deleted, never hard-deleted in normal flows
- REST is used for hydration and history
- WebSocket is used for live interaction and real-time delivery

Base REST prefix:
- `/api/messaging`

Base WebSocket namespace:
- `/chat`

## 2. REST Endpoint Contracts

### 2.1 List Current User Rooms

Method:
- `GET`

Path:
- `/api/messaging/rooms`

Purpose:
- list rooms visible to the authenticated user

Auth requirement:
- JWT required

Tenant validation:
- use authenticated user's `school_id`
- only rooms from same school are returned

Query params:
```json
{
  "roomType": "all",
  "limit": 30
}
```

Query fields:
- `roomType`: optional, one of `all | general | department | private | group`
- `limit`: optional, default `30`, max `100`

Success response:
```json
{
  "data": [
    {
      "id": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
      "roomType": "private",
      "name": null,
      "description": null,
      "avatarUrl": null,
      "schoolId": "d78b2139-497f-45cc-8fb2-4bd0c8d8af6a",
      "departmentId": null,
      "groupId": null,
      "membership": {
        "role": "member",
        "isMuted": false,
        "joinedAt": "2026-03-15T09:30:00Z"
      },
      "lastMessage": {
        "id": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
        "senderId": "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
        "contentPreview": "Toplantı notlarını gönderdim.",
        "createdAt": "2026-03-15T09:35:12Z",
        "isDeleted": false
      },
      "unreadCount": 4,
      "updatedAt": "2026-03-15T09:35:12Z"
    }
  ],
  "meta": {
    "limit": 30
  }
}
```

Common error cases:
- `401` unauthorized
- `403` forbidden tenant scope failure
- `422` invalid query params

Authorization rules:
- same school required
- room must be visible to user by room-type policy

### 2.2 Get Room By Id

Method:
- `GET`

Path:
- `/api/messaging/rooms/:roomId`

Purpose:
- fetch room detail for a room the user can access

Auth requirement:
- JWT required

Tenant validation:
- room must belong to authenticated user's `school_id`

Path params:
- `roomId`: UUID

Success response:
```json
{
  "data": {
    "id": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
    "roomType": "department",
    "name": "Computer Engineering",
    "description": "Department-wide discussion room",
    "avatarUrl": null,
    "schoolId": "d78b2139-497f-45cc-8fb2-4bd0c8d8af6a",
    "departmentId": "a7eece6f-a8d0-4b96-8f21-31482d1da7a8",
    "groupId": null,
    "isActive": true,
    "isArchived": false,
    "createdAt": "2026-03-10T08:00:00Z",
    "updatedAt": "2026-03-15T09:35:12Z"
  }
}
```

Common error cases:
- `401` unauthorized
- `403` room access denied
- `404` room not found

Authorization rules:
- same school required
- department match required for department rooms
- active membership required for private and group rooms

### 2.3 Get Room Members

Method:
- `GET`

Path:
- `/api/messaging/rooms/:roomId/members`

Purpose:
- fetch room membership list

Auth requirement:
- JWT required

Tenant validation:
- room must belong to same school

Path params:
- `roomId`: UUID

Success response:
```json
{
  "data": [
    {
      "userId": "2d96539d-b257-4a63-a33f-2af7c46e1c41",
      "role": "member",
      "isActive": true,
      "joinedAt": "2026-03-15T08:00:00Z",
      "muteUntil": null
    }
  ]
}
```

Common error cases:
- `401` unauthorized
- `403` membership required
- `404` room not found

Authorization rules:
- same school required
- active room access required
- for private rooms, only the two participants may view members

### 2.4 Get Room Messages

Method:
- `GET`

Path:
- `/api/messaging/rooms/:roomId/messages`

Purpose:
- load message history for a room

Auth requirement:
- JWT required

Tenant validation:
- room and messages must belong to same school

Path params:
- `roomId`: UUID

Query params:
```json
{
  "cursor": "2026-03-15T09:35:12.000Z_430a1570-649e-42dc-9f38-2d4d4780e8e1",
  "limit": 30,
  "direction": "older"
}
```

Success response:
```json
{
  "data": [
    {
      "id": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
      "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
      "senderId": "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
      "messageType": "text",
      "content": "Toplantı notlarını gönderdim.",
      "replyToMessageId": null,
      "isEdited": false,
      "editedAt": null,
      "isDeleted": false,
      "deletedAt": null,
      "attachments": [],
      "reactions": [
        {
          "reactionType": "👍",
          "count": 2,
          "reactedByMe": true
        }
      ],
      "createdAt": "2026-03-15T09:35:12Z",
      "updatedAt": "2026-03-15T09:35:12Z"
    }
  ],
  "meta": {
    "limit": 30,
    "direction": "older",
    "nextCursor": "2026-03-15T09:20:00.000Z_16617afa-5f5e-4829-bf4d-61a7a7354519",
    "hasMore": true
  }
}
```

Common error cases:
- `401` unauthorized
- `403` membership required
- `404` room not found
- `422` invalid cursor

Authorization rules:
- same school required
- room access policy enforced by room type

### 2.5 Create Or Get Private Room

Method:
- `POST`

Path:
- `/api/messaging/private-rooms`

Purpose:
- create or return an existing private room between current user and target user

Auth requirement:
- JWT required

Tenant validation:
- both users must belong to same school

Request body:
```json
{
  "targetUserId": "2d96539d-b257-4a63-a33f-2af7c46e1c41"
}
```

Success response:
```json
{
  "data": {
    "id": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
    "roomType": "private",
    "schoolId": "d78b2139-497f-45cc-8fb2-4bd0c8d8af6a",
    "participants": [
      "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
      "2d96539d-b257-4a63-a33f-2af7c46e1c41"
    ],
    "created": false
  }
}
```

Common error cases:
- `401` unauthorized
- `403` cross-tenant target or DM blocked
- `404` target user not found
- `409` duplicate room creation race resolved by existing room lookup

Authorization rules:
- same school required
- target user must be eligible for DM by policy

### 2.6 Mark Room As Read

Method:
- `PATCH`

Path:
- `/api/messaging/rooms/:roomId/read`

Purpose:
- update read checkpoint for current user in a room

Auth requirement:
- JWT required

Tenant validation:
- room must belong to same school

Request body:
```json
{
  "lastReadMessageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1"
}
```

Success response:
```json
{
  "data": {
    "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
    "userId": "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
    "lastReadMessageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
    "lastReadAt": "2026-03-15T09:40:00Z"
  }
}
```

Common error cases:
- `401` unauthorized
- `403` membership required
- `404` room or message not found
- `422` message does not belong to room

Authorization rules:
- same school required
- active room access required

### 2.7 Report Message

Method:
- `POST`

Path:
- `/api/messaging/messages/:messageId/report`

Purpose:
- submit a moderation report for a message

Auth requirement:
- JWT required

Tenant validation:
- reported message must belong to same school

Request body:
```json
{
  "reason": "harassment",
  "description": "Repeated abusive language in this thread."
}
```

Success response:
```json
{
  "data": {
    "reportId": "3d0bd099-68a1-49a3-ab0e-f4f0b2ab8fdf",
    "messageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
    "status": "open",
    "createdAt": "2026-03-15T09:45:00Z"
  }
}
```

Common error cases:
- `401` unauthorized
- `403` room visibility denied
- `404` message not found
- `409` duplicate report by same user

Authorization rules:
- same school required
- reporter must be able to access the room containing the message

### 2.8 Message Actions That Remain WebSocket-Primary

These actions should be WebSocket-primary and should not be forced into REST for the MVP live experience:
- send message
- edit message
- delete message
- react to message
- unreact message
- typing state

Optional REST fallbacks can exist later, but the canonical live contract should be WebSocket-driven.

## 3. WebSocket Event Contracts

### 3.1 Common Socket Rules

Namespace:
- `/chat`

Authentication:
- JWT required during handshake

Tenant validation:
- socket context must carry `schoolId`
- every room operation validates same-school access

Ack style:
- client -> server commands should return either ack payload or `chat.error`

### 3.2 `room.join`

Direction:
- client -> server

Purpose:
- subscribe authenticated socket to a room channel

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a"
}
```

Auth requirement:
- required

Room membership requirement:
- yes, except system-managed membership resolution may auto-validate for general or department rooms

Ack behavior:
```json
{
  "ok": true,
  "event": "room.join",
  "data": {
    "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
    "joinedAt": "2026-03-15T09:45:00Z"
  }
}
```

Broadcast target:
- no room-wide broadcast required by default

### 3.3 `room.leave`

Direction:
- client -> server

Purpose:
- unsubscribe socket from live room events

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a"
}
```

Auth requirement:
- required

Room membership requirement:
- active access required

Ack behavior:
```json
{
  "ok": true,
  "event": "room.leave",
  "data": {
    "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a"
  }
}
```

Broadcast target:
- none

### 3.4 `message.send`

Direction:
- client -> server

Purpose:
- create and persist a new message

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "content": "Bugünkü ödev çözümlerini attım.",
  "replyToMessageId": null,
  "attachmentIds": []
}
```

Auth requirement:
- required

Room membership requirement:
- yes

Ack behavior:
```json
{
  "ok": true,
  "event": "message.send",
  "data": {
    "messageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1"
  }
}
```

Broadcast target:
- all subscribed sockets in `room:{roomId}`

### 3.5 `message.created`

Direction:
- server -> client

Purpose:
- notify room members of a newly persisted message

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "message": {
    "id": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
    "senderId": "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
    "messageType": "text",
    "content": "Bugünkü ödev çözümlerini attım.",
    "replyToMessageId": null,
    "attachments": [],
    "reactions": [],
    "isEdited": false,
    "isDeleted": false,
    "createdAt": "2026-03-15T09:50:00Z",
    "updatedAt": "2026-03-15T09:50:00Z"
  }
}
```

Auth requirement:
- socket must be authenticated

Room membership requirement:
- yes

Broadcast target:
- room subscribers only

### 3.6 `message.edit`

Direction:
- client -> server

Purpose:
- request message edit

Payload:
```json
{
  "messageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
  "content": "Bugünkü ödev çözümlerini tekrar güncelledim."
}
```

Auth requirement:
- required

Room membership requirement:
- yes

Ack behavior:
- success ack or `chat.error`

Broadcast target:
- none directly; successful edit emits `message.updated`

### 3.7 `message.updated`

Direction:
- server -> client

Purpose:
- notify room of edited message

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "message": {
    "id": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
    "content": "Bugünkü ödev çözümlerini tekrar güncelledim.",
    "isEdited": true,
    "editedAt": "2026-03-15T09:52:00Z",
    "updatedAt": "2026-03-15T09:52:00Z"
  }
}
```

Broadcast target:
- room subscribers only

### 3.8 `message.delete`

Direction:
- client -> server

Purpose:
- request soft deletion of a message

Payload:
```json
{
  "messageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1"
}
```

Auth requirement:
- required

Room membership requirement:
- yes

Ack behavior:
- success ack or `chat.error`

Broadcast target:
- none directly; successful delete emits `message.deleted`

### 3.9 `message.deleted`

Direction:
- server -> client

Purpose:
- notify room that a message was soft-deleted

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "message": {
    "id": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
    "isDeleted": true,
    "deletedAt": "2026-03-15T09:53:00Z"
  }
}
```

Broadcast target:
- room subscribers only

### 3.10 `message.react`

Direction:
- client -> server

Purpose:
- add a reaction to a message

Payload:
```json
{
  "messageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
  "reactionType": "👍"
}
```

Auth requirement:
- required

Room membership requirement:
- yes

Ack behavior:
- success ack or `chat.error`

Broadcast target:
- none directly; successful reaction emits `message.reacted`

### 3.11 `message.reacted`

Direction:
- server -> client

Purpose:
- notify room that a message reaction set changed

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "messageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
  "reaction": {
    "reactionType": "👍",
    "userId": "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
    "count": 3
  }
}
```

Broadcast target:
- room subscribers only

### 3.12 `message.unreact`

Direction:
- client -> server

Purpose:
- remove a reaction from a message

Payload:
```json
{
  "messageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
  "reactionType": "👍"
}
```

Auth requirement:
- required

Room membership requirement:
- yes

Ack behavior:
- success ack or `chat.error`

### 3.13 `message.unreacted`

Direction:
- server -> client

Purpose:
- notify room that a reaction was removed

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "messageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
  "reaction": {
    "reactionType": "👍",
    "userId": "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
    "count": 2
  }
}
```

Broadcast target:
- room subscribers only

### 3.14 `room.read`

Direction:
- client -> server

Purpose:
- update user's read checkpoint for a room

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "lastReadMessageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1"
}
```

Auth requirement:
- required

Room membership requirement:
- yes

Ack behavior:
- success ack or `chat.error`

### 3.15 `room.read.updated`

Direction:
- server -> client

Purpose:
- notify room participants of read-state change when product exposes read indicators

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "userId": "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
  "lastReadMessageId": "430a1570-649e-42dc-9f38-2d4d4780e8e1",
  "lastReadAt": "2026-03-15T09:55:00Z"
}
```

Broadcast target:
- room subscribers only

### 3.16 `typing.start`

Direction:
- client -> server

Purpose:
- signal ephemeral typing started

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a"
}
```

Auth requirement:
- required

Room membership requirement:
- yes

Ack behavior:
- optional no-content ack

Broadcast target:
- room subscribers except sender

### 3.17 `typing.stop`

Direction:
- client -> server

Purpose:
- signal ephemeral typing stopped

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a"
}
```

### 3.18 `typing.updated`

Direction:
- server -> client

Purpose:
- notify room about typing state changes

Payload:
```json
{
  "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
  "userId": "f6f34831-660f-4ad0-a6cb-bf0f8ad9721f",
  "state": "started",
  "expiresAt": "2026-03-15T09:56:05Z"
}
```

Broadcast target:
- room subscribers except sender

### 3.19 `chat.error`

Direction:
- server -> client

Purpose:
- return structured real-time errors for failed commands

Payload:
```json
{
  "code": "MEMBERSHIP_REQUIRED",
  "message": "Active room membership is required.",
  "details": {
    "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a",
    "event": "message.send"
  },
  "timestamp": "2026-03-15T09:56:00Z",
  "correlationId": "9af66ca7-c746-4cca-8510-f854b671db1f"
}
```

## 4. Error Contract Standard

### 4.1 REST Error Shape

```json
{
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Requested room was not found.",
    "details": {
      "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a"
    },
    "timestamp": "2026-03-15T10:00:00Z",
    "requestId": "d977ca02-3f12-4a0a-bbe6-862e7d2ddc48"
  }
}
```

Fields:
- `code`: machine-readable application code
- `message`: safe user-facing message
- `details`: optional structured context
- `timestamp`: ISO-8601 timestamp
- `requestId`: request correlation identifier

### 4.2 WebSocket Error Shape

```json
{
  "code": "CROSS_TENANT_ACCESS",
  "message": "Cross-tenant access is not allowed.",
  "details": {
    "event": "room.join",
    "roomId": "ef2e26c0-65c8-4ec9-8fe7-d8e8d8125d0a"
  },
  "timestamp": "2026-03-15T10:00:00Z",
  "correlationId": "67bc37f4-fccf-4c47-b469-54bfed4b9423"
}
```

### 4.3 Standard Error Codes

- `UNAUTHORIZED`
- `FORBIDDEN`
- `CROSS_TENANT_ACCESS`
- `ROOM_NOT_FOUND`
- `MESSAGE_NOT_FOUND`
- `USER_NOT_FOUND`
- `MEMBERSHIP_REQUIRED`
- `DEPARTMENT_ACCESS_DENIED`
- `GROUP_ACCESS_DENIED`
- `PRIVATE_ROOM_ACCESS_DENIED`
- `INVALID_CURSOR`
- `INVALID_REACTION`
- `DUPLICATE_PRIVATE_ROOM`
- `MESSAGE_ALREADY_DELETED`
- `MESSAGE_EDIT_NOT_ALLOWED`
- `MESSAGE_DELETE_NOT_ALLOWED`
- `DM_TARGET_BLOCKED`
- `VALIDATION_ERROR`

## 5. Pagination Contract

### 5.1 Strategy

Use cursor-based pagination for room messages.

Cursor format:
- opaque string generated from `(created_at, id)`
- recommended internal basis: `timestamp_uuid`

### 5.2 Request Parameters

Endpoint:
- `GET /api/messaging/rooms/:roomId/messages`

Params:
- `cursor`: optional
- `limit`: optional, default `30`, max `100`
- `direction`: optional, one of `older | newer`, default `older`

### 5.3 Response Fields

```json
{
  "data": [],
  "meta": {
    "limit": 30,
    "direction": "older",
    "nextCursor": "2026-03-15T09:20:00.000Z_16617afa-5f5e-4829-bf4d-61a7a7354519",
    "hasMore": true
  }
}
```

Behavior:
- initial load without cursor returns latest messages
- older history uses the oldest loaded message as next cursor
- server orders by `created_at DESC, id DESC`
- client may reverse results for ascending visual render

## 6. Authorization Matrix

| Operation | Same School | Room Membership | Department Match | Group Membership | Message Ownership | Moderator Override |
|---|---|---|---|---|---|---|
| list rooms | yes | filtered by visibility | if department room | if group room | no | no |
| get room detail | yes | yes for private/group | yes for department | yes for group | no | no |
| get room members | yes | yes | yes for department | yes for group | no | no |
| get messages | yes | yes | yes for department | yes for group | no | no |
| create/get private room | yes | no | no | no | no | no |
| join room | yes | yes or eligible auto-membership | yes for department | yes for group | no | no |
| send message | yes | yes | yes for department | yes for group | no | no |
| edit message | yes | yes | yes for department | yes for group | yes | yes |
| delete message | yes | yes | yes for department | yes for group | yes | yes |
| react to message | yes | yes | yes for department | yes for group | no | no |
| mark room as read | yes | yes | yes for department | yes for group | no | no |
| report message | yes | yes | yes for department | yes for group | no | yes for review only |

Private room rules:
- exactly two participants
- create-or-get only
- no duplicate room for same pair in same school

General room rules:
- same school required
- no special membership restriction beyond school scope

## 7. Implementation Notes for NestJS

Controller responsibilities:
- expose room list, room detail, member list, history, private room creation, read state, and reporting endpoints
- validate DTOs
- extract authenticated user context
- delegate authorization-sensitive logic to service and policy layers

Gateway responsibilities:
- authenticate socket on connection
- resolve socket user context
- validate room membership before subscription or mutation
- call service methods for send/edit/delete/react/read operations
- emit ack payloads for commands and broadcast server events after successful persistence

DTO alignment:
- REST and WebSocket payloads should reuse shared DTO classes where fields overlap
- message send, edit, react, read, and private-room DTOs should map directly to service methods

Ack vs broadcast conventions:
- client command receives immediate ack with minimal confirmation payload
- successful state changes emit server broadcast events such as `message.created`, `message.updated`, `message.deleted`, `message.reacted`, `room.read.updated`
- failures emit `chat.error`

Validation expectations:
- UUID validation for room, message, and user identifiers
- max length constraints for message content and report description
- enum validation for room type filters and report status values
- cursor validation at transport boundary before service execution
