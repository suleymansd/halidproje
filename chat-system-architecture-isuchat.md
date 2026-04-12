# IsuChat Real-Time Chat System Design

## 1. Chat Architecture Overview

### 1.1 Core Model
IsuChat should use a single unified room-based chat architecture for all messaging use cases. All communication flows through the same core engine built on:

- `chat_rooms`
- `chat_room_members`
- `messages`
- `message_attachments`
- `message_reactions`
- `message_read_states`
- `message_reports`

This is the correct architecture because:
- it avoids maintaining multiple message systems for similar behavior
- it keeps authorization, storage, moderation, and delivery logic consistent
- it supports general chat, department chat, direct messages, and groups through one message pipeline
- it makes future room types easy to add without redesigning the core

### 1.2 Room Types
The room model is differentiated only by `room_type`:

- `general`
- `department`
- `private`
- `group`

Mapping:
- university general chat -> `general`
- department chat -> `department`
- direct message -> `private`
- student-created group chat -> `group`

### 1.3 System Design Principle
The messaging engine should treat room type as a policy dimension, not a storage dimension. Storage, delivery, reactions, reads, reporting, and soft deletion remain identical across all room types. Access rules and lifecycle differ by room type, but message handling stays unified.

## 2. Core Chat Entities

### 2.1 `chat_rooms`
Purpose:
- defines the conversation container
- identifies the tenant via `school_id`
- determines room behavior through `room_type`
- links optional ownership context such as `department_id` or `group_id`

Key responsibilities:
- room metadata
- room scope
- room lifecycle status
- last message pointers for efficient chat list loading

### 2.2 `chat_room_members`
Purpose:
- tracks which users belong to which rooms
- stores room-specific membership state
- stores read checkpoint metadata like `last_read_message_id`

Key responsibilities:
- membership validation
- join/leave lifecycle
- mute state
- room-scoped unread support

### 2.3 `messages`
Purpose:
- stores all message records for all room types
- preserves sender, room, tenant, reply chain, and deletion state

Key responsibilities:
- text content
- message ordering
- reply linkage
- edit state
- soft deletion state

### 2.4 `message_attachments`
Purpose:
- stores metadata for files attached to messages
- links message records to object storage keys

Key responsibilities:
- file metadata
- mime type
- storage key
- file size and original file name

### 2.5 `message_reactions`
Purpose:
- stores per-user reactions on a message

Key responsibilities:
- reaction uniqueness per user and emoji
- efficient aggregation for UI rendering

### 2.6 `message_read_states`
Purpose:
- stores message-level read tracking where needed
- supports richer read-state auditability

Key responsibilities:
- explicit read events
- support for read receipts if exposed later

Practical note:
- for room-level unread logic, `chat_room_members.last_read_message_id` is the primary fast path
- `message_read_states` is useful for normalized detail and future richer receipts

### 2.7 `message_reports`
Purpose:
- stores abuse reports attached to specific messages
- exposes reported content to moderation workflows

Key responsibilities:
- report reason and description
- report review state
- moderator review linkage

## 3. Room Type Logic

### 3.1 General Rooms
Rules:
- one active general room per school
- available to all active users in that school
- typically system-managed

Behavior:
- users may be auto-enrolled logically or physically represented in `chat_room_members`
- suitable for university-wide announcements and open discussion

### 3.2 Department Rooms
Rules:
- one active room per department
- only users whose `department_id` matches may access
- system-managed

Behavior:
- can be auto-created when a department is created
- membership may be materialized in `chat_room_members` or derived and synchronized during onboarding

### 3.3 Private Rooms
Rules:
- exactly two active members
- both users must belong to the same `school_id`
- no duplicate private room for the same user pair within a school

Behavior:
- create-on-demand
- must be reused if the pair already has a room
- never separate DM infrastructure; still uses `chat_rooms`

Recommended implementation detail:
- store a deterministic `private_room_key` such as `min_user_id:max_user_id`
- unique index on (`school_id`, `private_room_key`) for `room_type = 'private'`

### 3.4 Group Rooms
Rules:
- linked to a group entity
- accessible only to approved group members
- lifecycle tied to group lifecycle

Behavior:
- created at group creation time
- membership syncs with group membership
- join and leave rules follow group policies

## 4. Room Lifecycle Rules

### 4.1 Creation Rules

System-managed rooms:
- `general` room is created when a school is provisioned
- `department` room is created when a department is provisioned

User-managed rooms:
- `private` room is created on first DM attempt if none exists
- `group` room is created when the group is created

### 4.2 Reuse Rules
- `general` and `department` rooms are always reused
- `private` rooms must be reused for the same user pair
- `group` rooms persist for the lifetime of the group

### 4.3 Join Rules
- `general`: any active student in the same school
- `department`: active student in same school and matching department
- `private`: only the two room members
- `group`: only approved group members

### 4.4 Leave Rules
- `general`: normally not truly leaveable, only mute/hide at client preference level
- `department`: normally system-managed, leave may depend on department change
- `private`: membership is persistent; users may archive or mute instead of leaving
- `group`: leave is allowed according to group rules

### 4.5 Membership Representation
Recommended approach:
- keep `chat_room_members` for all room types for consistent authorization and chat list queries
- for system-managed rooms, membership can be created automatically during onboarding and department changes

## 5. Message Lifecycle

### 5.1 Create
Flow:
1. client sends message request
2. service validates tenant and room membership
3. service validates message payload
4. message row is inserted
5. attachment metadata is linked if present
6. room summary fields are updated
7. internal event is published

### 5.2 Persist Before Broadcast
Messages must always be persisted before being broadcast. This guarantees:
- stable message ids
- reliable ordering
- replayability for reconnecting clients
- moderation traceability

### 5.3 Broadcast
After persistence:
- emit `message.created` to all subscribed sockets in that room
- enqueue async notification fan-out for offline or background users

### 5.4 Edit
Rules:
- only sender may edit, unless moderator override exists
- edits should update `edited_at`
- original row remains the same message id
- editing deleted messages should be rejected

### 5.5 Delete
Rules:
- soft delete only
- set `deleted_at`
- replace visible body with a deleted marker in application response if desired
- keep message row for reply-chain integrity, moderation, and auditability

### 5.6 React
Rules:
- only active room members may react
- unique by (`message_id`, `user_id`, `emoji`)
- add and remove reactions should emit separate room events

### 5.7 Read
Recommended behavior:
- mark room read using latest visible message id
- update `chat_room_members.last_read_message_id`
- optionally insert/update `message_read_states`
- emit lightweight `room.read_state.updated` event

### 5.8 Report
Rules:
- any eligible member can report a message
- report creates `message_reports` row
- does not remove message automatically
- moderation module decides follow-up actions

## 6. WebSocket Architecture

### 6.1 Gateway Responsibilities
The NestJS gateway should handle:
- socket authentication at connection time
- validated room subscription requests
- incoming real-time chat commands
- room-scoped event broadcast
- ephemeral presence and typing coordination

The gateway should not:
- hold business rules directly
- execute raw SQL
- bypass service-layer authorization

### 6.2 Socket Authentication Flow
Recommended flow:
1. client connects with JWT in handshake auth
2. gateway verifies token
3. token payload resolves `user_id`, `school_id`, roles, and session state
4. connection is accepted only for active sessions
5. socket context stores immutable auth data

Socket context should include:
- `userId`
- `schoolId`
- `roles`
- `sessionId`

### 6.3 Tenant Validation
Every gateway action must validate:
- the socket user belongs to the same `school_id` as the room
- the room is accessible for the user according to room type

This validation should live in messaging policies or service methods, not only in the gateway.

### 6.4 Room Subscription Strategy
Recommended server-side subscription keys:
- `room:{chat_room_id}`
- `user:{user_id}` for direct personal events

Optional tenant namespace:
- `school:{school_id}:room:{chat_room_id}`

Do not trust raw room ids from client requests without membership validation.

### 6.5 Broadcasting Strategy
Recommended events:
- `room.joined`
- `message.created`
- `message.edited`
- `message.deleted`
- `message.reaction_added`
- `message.reaction_removed`
- `room.read_state.updated`
- `typing.started`
- `typing.stopped`

Broadcast rules:
- room events go only to members of that room
- personal events go to `user:{user_id}` channels
- moderation visibility is separate and not broadcast into user rooms

### 6.6 Connection Lifecycle
On connect:
- authenticate
- register socket presence
- optionally restore previous active room subscriptions

On disconnect:
- clear ephemeral socket presence
- stop typing state
- remove socket from in-memory or Redis-backed presence maps

### 6.7 Scaling Recommendations
To scale WebSocket horizontally:
- keep gateway stateless
- use JWT, not in-memory session auth
- use Redis pub/sub for cross-node room fan-out
- use Redis for presence and typing state
- keep PostgreSQL as source of truth for messages and memberships

Recommended separation:
- PostgreSQL for durable state
- Redis for ephemeral real-time coordination

## 7. REST + WebSocket Responsibility Split

### 7.1 REST Responsibilities
Use REST for:
- fetching room list
- fetching room details
- fetching message history
- loading latest messages
- loading older messages
- creating or resolving private room
- reporting messages
- marking room as read if you want a durable API fallback
- attachment upload initialization

REST is better for:
- deterministic pagination
- cacheable or retryable reads
- initial state hydration

### 7.2 WebSocket Responsibilities
Use WebSocket for:
- sending live messages
- receiving new message events
- receiving message edit/delete events
- receiving reaction events
- receiving read-state events
- typing indicators
- room presence changes if added later

### 7.3 Recommended Split
- room list: REST
- room history: REST
- message send: WebSocket primary, REST optional fallback
- reaction add/remove: WebSocket or REST; if both exist, route both to same service method
- room read state: REST or WebSocket command, same service path

## 8. Recommended NestJS Module Structure

```text
src/modules/messaging/
  messaging.module.ts
  messaging.controller.ts
  messaging.service.ts
  messaging.repository.ts
  gateways/
    chat.gateway.ts
    chat-presence.gateway.ts
  dto/
    create-message.dto.ts
    edit-message.dto.ts
    delete-message.dto.ts
    react-message.dto.ts
    mark-room-read.dto.ts
    list-room-messages.dto.ts
    create-private-room.dto.ts
    join-room.dto.ts
    leave-room.dto.ts
    report-message.dto.ts
    typing-event.dto.ts
  entities/
    chat-room.entity.ts
    chat-room-member.entity.ts
    message.entity.ts
    message-attachment.entity.ts
    message-reaction.entity.ts
    message-read-state.entity.ts
    message-report.entity.ts
  interfaces/
    socket-auth-user.interface.ts
    socket-event.interface.ts
    paginated-messages.interface.ts
    room-membership-context.interface.ts
  policies/
    messaging-access.policy.ts
    room-membership.policy.ts
    message-ownership.policy.ts
  mappers/
    message-response.mapper.ts
  events/
    message-created.event.ts
    message-edited.event.ts
    message-deleted.event.ts
    message-reacted.event.ts
    room-read.event.ts
```

### 8.1 File Responsibilities

`messaging.module.ts`
- wires controller, service, repository, policies, and gateways

`messaging.controller.ts`
- exposes REST endpoints for room list, history, reports, and room resolution

`messaging.service.ts`
- contains chat use cases and orchestration logic

`messaging.repository.ts`
- contains tenant-safe PostgreSQL access methods

`gateways/chat.gateway.ts`
- handles message, reaction, read, and subscription events

`policies/*`
- centralizes room access and message ownership rules

## 9. DTO / Contract Plan

### 9.1 REST DTOs
- `create-message.dto`
  - `roomId`
  - `body`
  - `replyToMessageId?`
  - `attachmentIds?`

- `edit-message.dto`
  - `messageId`
  - `body`

- `delete-message.dto`
  - `messageId`

- `react-message.dto`
  - `messageId`
  - `emoji`

- `mark-room-read.dto`
  - `roomId`
  - `lastReadMessageId`

- `list-room-messages.dto`
  - `cursor?`
  - `limit`
  - `direction?`

- `create-private-room.dto`
  - `targetUserId`

- `join-room.dto`
  - `roomId`

- `leave-room.dto`
  - `roomId`

- `report-message.dto`
  - `messageId`
  - `reason`
  - `description?`

### 9.2 WebSocket Event Payloads

Client -> server:
- `room.join`
  - `roomId`

- `room.leave`
  - `roomId`

- `message.send`
  - `roomId`
  - `body`
  - `replyToMessageId?`
  - `attachmentIds?`

- `message.edit`
  - `messageId`
  - `body`

- `message.delete`
  - `messageId`

- `message.react.add`
  - `messageId`
  - `emoji`

- `message.react.remove`
  - `messageId`
  - `emoji`

- `room.read`
  - `roomId`
  - `lastReadMessageId`

- `typing.start`
  - `roomId`

- `typing.stop`
  - `roomId`

Server -> client:
- `message.created`
- `message.edited`
- `message.deleted`
- `message.reaction_added`
- `message.reaction_removed`
- `room.read_state.updated`
- `typing.started`
- `typing.stopped`
- `room.subscription.confirmed`

## 10. Authorization / Policy Rules

### 10.1 Sending Messages
Required checks:
- authenticated user
- active user status
- room belongs to same `school_id`
- sender is an active member of the room
- sender not blocked from interaction where applicable

### 10.2 Reading Room History
Required checks:
- room belongs to same tenant
- user has access according to room type
- department match for department rooms
- approved group membership for group rooms
- exact membership for private rooms

### 10.3 Reacting
Required checks:
- same checks as message read access
- message is not permanently inaccessible
- duplicate reaction prevented

### 10.4 Editing
Required checks:
- same tenant
- sender owns the message or moderator override exists
- message not soft-deleted
- edit window rule if product wants one later

### 10.5 Deleting
Required checks:
- sender owns the message or moderator override exists
- soft delete only
- repeated delete should be idempotent

### 10.6 Joining a Room
Required checks:
- same tenant
- valid eligibility by room type
- membership record exists or may be created according to lifecycle policy

### 10.7 Creating Private Rooms
Required checks:
- both users in same school
- requester is not blocked by target if policy forbids DM
- existing private room lookup must happen first
- if none exists, create room and exactly two memberships transactionally

### 10.8 Central Policy Recommendation
Keep these rules in dedicated policy classes:
- `MessagingAccessPolicy`
- `RoomMembershipPolicy`
- `MessageOwnershipPolicy`

This avoids duplicating rules across REST controllers and WebSocket handlers.

## 11. Pagination and Message History Strategy

### 11.1 Recommended Approach
Use cursor-based pagination, not offset pagination.

Reason:
- stable under high write volume
- avoids missing or duplicated rows during active conversations
- better performance on large message tables

### 11.2 Cursor Design
Recommended cursor basis:
- primary cursor by `created_at desc, id desc`
- use `id` as deterministic tie-breaker

Query pattern:
- load latest messages by room ordered descending
- reverse in application layer for UI if needed
- for older messages, request rows strictly older than `(created_at, id)` cursor

### 11.3 Latest Message Load
For initial room open:
- request latest N messages
- return next cursor for older history

### 11.4 Older Message Load
For infinite scroll upward:
- pass cursor of oldest loaded message
- fetch previous page ordered by `created_at desc, id desc`

### 11.5 Unread Logic
Use:
- `chat_room_members.last_read_message_id`
- room last message pointer

Unread count can be derived by:
- counting messages newer than `last_read_message_id`
- or using precomputed counters later if needed for scale

## 12. Performance and Scaling Notes

### 12.1 Indexing Needs
Critical indexes:
- `messages (school_id, chat_room_id, created_at desc, id desc)`
- `chat_room_members (chat_room_id, user_id)`
- `chat_room_members (school_id, user_id, left_at)`
- `message_reactions (message_id, user_id, emoji)` unique
- `message_reports (school_id, status, created_at)`
- partial indexes for non-deleted messages where useful

Private room uniqueness:
- unique partial index on (`school_id`, `private_room_key`) where `room_type = 'private'`

General and department uniqueness:
- one active general room per school
- one active department room per department

### 12.2 Redis Usage
Use Redis for:
- socket presence
- typing indicators
- cross-node pub/sub
- short-lived room subscription coordination

Do not use Redis as durable message storage.

### 12.3 Fan-Out Strategy
Flow:
1. persist message in PostgreSQL
2. publish internal event
3. gateway or event consumer emits to subscribed sockets
4. enqueue notification jobs for offline users

For large rooms:
- rely on room broadcast, not per-user duplicate emits
- keep payload compact

### 12.4 Horizontal Scaling
Scale independently:
- REST API instances
- WebSocket gateway instances
- worker instances

Requirements:
- stateless app instances
- shared Redis pub/sub
- pooled PostgreSQL connections
- object storage externalized

## 13. Error Handling Strategy

### 13.1 Unauthorized Room Access
Return or emit forbidden error when:
- user is not a room member
- user tries to access a department room outside their department
- user attempts group room access without approved membership

### 13.2 Cross-Tenant Access Attempt
Treat as security-sensitive.

Behavior:
- reject with forbidden
- log attempt with `school_id`, `user_id`, target room id
- optionally write security audit event

### 13.3 Duplicate Private Room Creation
Behavior:
- if room already exists, return existing room instead of error for normal create flow
- if race condition occurs, rely on unique constraint and resolve by re-querying

### 13.4 Invalid Room Membership
Examples:
- trying to send after leaving a group
- trying to react in a room not joined

Behavior:
- reject operation
- do not broadcast anything

### 13.5 Deleted Message Operations
Rules:
- editing deleted message -> reject
- reacting to deleted message -> either reject or allow only if product explicitly wants it; recommended reject
- replying to deleted message -> allow reply link if row exists, but response should indicate parent is deleted

### 13.6 Invalid Reaction Requests
Examples:
- duplicate add
- remove missing reaction
- unsupported emoji format if validated

Behavior:
- duplicate add can be idempotent or conflict
- remove missing reaction should be idempotent

## 14. Future-Proofing

This architecture can support new room types without redesigning the message engine.

Examples:
- course chat rooms
- club chat rooms
- event chat rooms
- temporary live rooms

How:
- add new `room_type` values
- add room-specific authorization policy
- optionally add new foreign key context fields or a generic room metadata strategy
- reuse the same tables, gateway flow, pagination model, reactions, reporting, and read-state logic

Recommended extension principle:
- keep message engine generic
- keep room access rules modular and policy-driven
- avoid encoding business-specific room assumptions into message persistence logic

## Final Recommendation

The correct implementation for IsuChat is a unified room-based messaging engine with policy-driven room access and a strict `school_id` tenant boundary. All chat types should share the same persistence, delivery, reaction, read-state, and moderation pipeline. The most important engineering rule is that every read, write, subscription, and broadcast path must be both tenant-safe and membership-safe before any message data is exposed.
