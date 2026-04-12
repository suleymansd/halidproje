# IsuChat Backend Architecture

## 1. Backend Architecture Overview

### 1.1 Architectural Style
IsuChat should be built as a modular monolith organized by domain modules, not by generic technical layers. This gives the MVP a simpler deployment and operational model while preserving clean boundaries for later service extraction.

### 1.2 Core Architecture Goals
- strict tenant isolation using `school_id`
- clear domain boundaries
- production-safe real-time messaging
- horizontal scalability at the API and WebSocket layer
- asynchronous processing for non-blocking workflows
- storage abstraction for object-based file handling

### 1.3 Runtime Components
- REST API application
- WebSocket gateway
- PostgreSQL database
- Object storage client
- Background job workers
- Cache layer
- Internal event bus abstraction

### 1.4 Recommended Architectural Direction
Use a single deployable backend codebase with:
- domain modules
- shared application primitives
- infrastructure adapters
- internal event publishing between modules

This allows:
- transactional consistency inside one process
- lower MVP complexity
- later extraction of modules such as messaging or notifications if scale requires it

## 2. Module Responsibilities

### 2.1 Identity and Access
Responsibilities:
- registration
- login
- JWT issuance and validation
- refresh token rotation
- RBAC enforcement
- session lifecycle management

Owns:
- authentication flows
- role assignment logic
- permission checks
- session revocation

Exports:
- authenticated user context
- authorization guards
- role and permission evaluation services

### 2.2 Tenant Management
Responsibilities:
- school management
- school settings
- departments
- courses
- academic terms

Owns:
- school-scoped metadata
- tenant configuration
- tenant-aware lookup services

Exports:
- school validation services
- department and course lookup APIs
- tenant configuration access

### 2.3 User Profile
Responsibilities:
- profile creation
- profile editing
- privacy settings
- searchable user directory inside a tenant

Owns:
- profile read and write logic
- privacy enforcement rules for discoverability

Exports:
- profile query services
- profile policy checks

### 2.4 Social Graph
Responsibilities:
- friend requests
- friendships
- follows
- blocks

Owns:
- relationship state transitions
- interaction eligibility checks

Exports:
- friend status lookup
- follow status lookup
- block checks for messaging and discovery

### 2.5 Messaging
Responsibilities:
- chat room lifecycle
- room membership
- message creation
- reactions
- replies
- read states
- attachments
- WebSocket event handling

Owns:
- room authorization
- persistent message write path
- message fan-out events

Exports:
- message send service
- room membership validation
- unread/read state services

### 2.6 Groups
Responsibilities:
- group creation
- group membership
- join requests
- group roles

Owns:
- group policy and join rules
- group membership lifecycle
- group to chat room linkage

Exports:
- group membership checks
- group room mapping

### 2.7 Academic Resources
Responsibilities:
- upload flow for materials
- metadata persistence
- tags
- comments
- votes
- bookmarks
- search and filtering

Owns:
- material lifecycle
- academic filtering rules
- material interaction logic

Exports:
- material query services
- upload orchestration

### 2.8 Notifications
Responsibilities:
- in-app notification creation
- notification feed
- read state for notifications
- preferences
- notification event handling

Owns:
- notification persistence
- notification policy rules

Exports:
- notification emitters
- user notification feed queries

### 2.9 Moderation
Responsibilities:
- user reports
- message reports
- material reports
- moderation actions

Owns:
- report intake
- review workflows
- moderation action execution

Exports:
- moderation review services
- moderation action application hooks

### 2.10 Audit and Logging
Responsibilities:
- audit log persistence
- security event logging
- admin action tracking

Owns:
- append-only audit trail
- sensitive action logging

Exports:
- audit recording service
- security logging adapters

## 3. Layered Backend Structure

Each module should use the same internal structure so the codebase stays predictable.

### 3.1 Controller Layer
Responsibilities:
- define REST endpoints
- validate request DTOs
- extract authenticated context
- call application services
- transform results into API responses

Controllers should not:
- contain business rules
- perform direct SQL or persistence logic

### 3.2 Service Layer
Responsibilities:
- implement use cases
- enforce business rules
- coordinate repositories and external adapters
- publish internal domain events
- manage transactional workflows

This is the primary application logic layer.

### 3.3 Repository Layer
Responsibilities:
- encapsulate PostgreSQL reads and writes
- implement query patterns
- keep SQL/data mapping out of services
- expose tenant-safe access methods

Repository rules:
- every tenant-scoped method should accept `school_id`
- avoid hidden global queries

### 3.4 Domain Models
Responsibilities:
- express domain entities and invariants
- define internal business concepts
- centralize enums, states, and rule helpers where useful

These do not need to be heavy DDD aggregates, but they should prevent services from becoming unstructured.

### 3.5 DTOs and Request Schemas
Responsibilities:
- validate incoming payloads
- define response contracts
- support versioned API design

Rules:
- separate input DTOs from persistence models
- never expose raw database records directly

## 4. WebSocket Messaging Architecture

### 4.1 Connection Lifecycle
1. Client authenticates with JWT.
2. WebSocket handshake includes access token.
3. Gateway validates token and resolves user context.
4. Gateway attaches:
   - `user_id`
   - `school_id`
   - `roles`
   - socket session metadata
5. Socket is accepted only if user is active and tenant membership is valid.

### 4.2 Tenant Validation
Every socket connection must be bound to exactly one `school_id`.

Rules:
- user can subscribe only to rooms from their own school
- department room access must match user department or school policy
- private room access requires room membership
- group room access requires active group membership

### 4.3 Room Subscription Model
Recommended subscription namespaces:
- `school:{school_id}:general`
- `school:{school_id}:department:{department_id}`
- `school:{school_id}:private:{chat_room_id}`
- `school:{school_id}:group:{group_id}`

The server should not trust client-provided room identifiers without repository validation.

### 4.4 Message Send Flow
1. Client emits send event.
2. Gateway validates payload schema.
3. Gateway calls messaging application service.
4. Service validates:
   - sender is active
   - sender belongs to `school_id`
   - sender is room member
   - sender is not blocked where applicable
5. Service persists message in PostgreSQL inside a transaction.
6. Attachment metadata is persisted if included.
7. Room last-message pointers are updated.
8. Internal event is published.
9. Gateway broadcasts only after persistence succeeds.

### 4.5 Delivery Events
Recommended socket events:
- `message.created`
- `message.updated`
- `message.deleted`
- `message.reaction_added`
- `message.reaction_removed`
- `message.read`
- `room.read_state.updated`
- `typing.started` and `typing.stopped` as future optional events

### 4.6 Scaling WebSocket Servers
For horizontal scale:
- run multiple WebSocket nodes statelessly
- keep authentication stateless with JWT
- use shared pub/sub between nodes for room fan-out
- keep room membership presence in a shared ephemeral store

Recommended shared components:
- Redis or equivalent for:
  - pub/sub
  - presence tracking
  - socket-to-user lookup

Persistence remains in PostgreSQL. Redis should not be the source of truth for messages.

## 5. File Storage Strategy

### 5.1 Storage Principle
Binary files should live in object storage. PostgreSQL stores only metadata and object keys.

### 5.2 File Categories
- profile images
- message attachments
- academic materials

### 5.3 Upload Pattern
Recommended flow:
1. Client requests upload intent from backend.
2. Backend validates tenant, user, file type, and size.
3. Backend generates a signed upload URL or temporary upload session.
4. Client uploads directly to object storage.
5. Client confirms upload.
6. Backend persists metadata in PostgreSQL.

This avoids routing large files through application nodes.

### 5.4 Object Key Strategy
Use tenant-aware object keys, for example:
- `schools/{school_id}/profiles/{user_id}/{file_name}`
- `schools/{school_id}/messages/{chat_room_id}/{message_id}/{file_name}`
- `schools/{school_id}/materials/{material_id}/{file_name}`

Benefits:
- clearer isolation
- easier lifecycle rules
- easier future per-tenant retention policies

### 5.5 File Safety Rules
- validate mime type and extension
- scan uploaded files asynchronously
- limit max size by file category
- use signed URLs for private access
- do not expose raw bucket paths publicly

## 6. Background Job System

### 6.1 Why Jobs Are Needed
The request-response path should stay fast. Non-critical or heavy tasks should be delegated to workers.

### 6.2 Job Categories

Notification jobs:
- create fan-out notifications
- send push or email later if added

File jobs:
- virus scanning
- thumbnail generation for images
- metadata extraction

Moderation jobs:
- automated content scanning
- flagged content review enrichment

Maintenance jobs:
- expired session cleanup
- notification cleanup
- orphaned upload cleanup
- future story expiration

### 6.3 Queue Integration Model
Recommended model:
- application services publish internal events
- event handlers enqueue jobs
- worker processes execute jobs
- worker writes results back to database or emits follow-up events

Examples:
- `friend_request.created` -> enqueue notification job
- `message.created` -> enqueue notification fan-out
- `material.uploaded` -> enqueue scan and metadata extraction

### 6.4 Queue Design Principles
- idempotent job handlers
- retry with dead-letter handling
- explicit job payload schema
- tenant context included in every job payload
- observability for failures and latency

## 7. Tenant Security Model

### 7.1 Tenant Resolution
Tenant context should be resolved from the authenticated user session, not trusted from raw client input.

Recommended request context:
- `user_id`
- `school_id`
- `roles`
- `permissions`

### 7.2 Tenant Enforcement Strategy
Apply tenant checks at multiple layers:

HTTP/API layer:
- auth middleware extracts JWT
- tenant guard binds request to `school_id`

Service layer:
- use cases validate that accessed entities belong to the same school

Repository layer:
- all tenant-scoped queries filter on `school_id`

Database layer:
- schema includes `school_id`
- indexes and unique constraints support scoped access

### 7.3 Guard and Middleware Recommendations

Authentication middleware:
- validates access token
- builds request user context

Tenant context guard:
- ensures authenticated user has active tenant membership
- rejects inconsistent path/body tenant values

Authorization guard:
- checks RBAC permissions

Resource access policies:
- used for room membership, group access, moderator actions, and privacy checks

### 7.4 WebSocket Tenant Safety
- token validated during handshake
- socket context includes immutable `school_id`
- room join handlers verify membership using tenant-scoped repositories
- cross-tenant room IDs must always be rejected

### 7.5 Security-Sensitive Rules
- never allow arbitrary `school_id` override from client payload
- never execute tenant-scoped repository queries without tenant context
- audit privileged actions
- log suspicious cross-tenant access attempts

## 8. API Structure

The API should be grouped by domain modules.

### 8.1 Auth
- `/auth/register`
- `/auth/login`
- `/auth/refresh`
- `/auth/logout`
- `/auth/me`
- `/auth/sessions`

### 8.2 Users and Profiles
- `/users/me`
- `/users/me/privacy`
- `/users/search`
- `/users/{user_id}`
- `/users/{user_id}/profile`

### 8.3 Schools and Academic Structure
- `/schools`
- `/schools/{school_id}`
- `/schools/{school_id}/settings`
- `/departments`
- `/departments/{department_id}`
- `/courses`
- `/courses/{course_id}`
- `/academic-terms`

### 8.4 Social Graph
- `/friends/requests`
- `/friends/requests/{request_id}`
- `/friends`
- `/follows`
- `/blocks`

### 8.5 Messaging
- `/chat-rooms`
- `/chat-rooms/{room_id}`
- `/chat-rooms/{room_id}/members`
- `/chat-rooms/{room_id}/messages`
- `/chat-rooms/{room_id}/read-state`
- `/messages/{message_id}`
- `/messages/{message_id}/reactions`
- `/messages/{message_id}/attachments`
- `/messages/{message_id}/reports`

### 8.6 Groups
- `/groups`
- `/groups/{group_id}`
- `/groups/{group_id}/members`
- `/groups/{group_id}/join-requests`
- `/groups/{group_id}/chat-room`

### 8.7 Academic Materials
- `/materials`
- `/materials/{material_id}`
- `/materials/{material_id}/comments`
- `/materials/{material_id}/votes`
- `/materials/{material_id}/bookmarks`
- `/materials/{material_id}/reports`
- `/material-tags`

### 8.8 Notifications
- `/notifications`
- `/notifications/{notification_id}/read`
- `/notifications/preferences`

### 8.9 Moderation
- `/reports/users`
- `/reports/messages`
- `/reports/materials`
- `/moderation/actions`

### 8.10 Audit and Admin
- `/audit-logs`
- `/admin/users`
- `/admin/schools`
- `/admin/moderation`

## 9. Backend Folder Structure

Recommended conceptual structure:

```text
backend/
  src/
    app/
      app.module.ts
      bootstrap/
      config/
    modules/
      identity-access/
        controllers/
        services/
        repositories/
        domain/
        dtos/
        guards/
        events/
      tenant-management/
        controllers/
        services/
        repositories/
        domain/
        dtos/
      user-profile/
        controllers/
        services/
        repositories/
        domain/
        dtos/
      social-graph/
        controllers/
        services/
        repositories/
        domain/
        dtos/
      messaging/
        controllers/
        gateways/
        services/
        repositories/
        domain/
        dtos/
        events/
      groups/
        controllers/
        services/
        repositories/
        domain/
        dtos/
      academic-resources/
        controllers/
        services/
        repositories/
        domain/
        dtos/
        events/
      notifications/
        controllers/
        services/
        repositories/
        domain/
        dtos/
        handlers/
      moderation/
        controllers/
        services/
        repositories/
        domain/
        dtos/
      audit/
        services/
        repositories/
        domain/
    shared/
      auth/
      database/
      cache/
      events/
      jobs/
      storage/
      logging/
      validation/
      utils/
      types/
    infrastructure/
      persistence/
      websocket/
      queue/
      object-storage/
      observability/
    tests/
      integration/
      e2e/
```

### 9.1 Folder Roles

`app/`
- application bootstrap
- environment config
- dependency wiring

`modules/`
- feature-based domain modules
- each module owns its controllers, services, repositories, DTOs, and domain rules

`shared/`
- reusable cross-cutting building blocks
- no business-specific logic

`infrastructure/`
- adapters for PostgreSQL, cache, queue, storage, WebSocket transport, and monitoring

`tests/`
- integration and end-to-end verification

## 10. Scalability Strategy

### 10.1 Horizontal Scaling
Application nodes should be stateless.

Scale independently:
- REST API nodes
- WebSocket gateway nodes
- worker nodes

Requirements:
- JWT-based auth
- shared cache and pub/sub
- external object storage
- PostgreSQL connection pooling

### 10.2 Caching Strategy
Cache suitable data only.

Good cache candidates:
- school settings
- department and course lists
- permission maps
- user profile summaries
- hot chat room metadata

Do not treat cache as the source of truth for messages or permissions.

### 10.3 Messaging-Heavy Optimizations
- append-focused message writes
- room timeline pagination by cursor
- indexed room membership checks
- async notification fan-out
- shared pub/sub for socket broadcast

If traffic grows:
- partition messages
- offload search to specialized indexing
- reduce per-message expensive joins in hot paths

### 10.4 Read-Heavy Optimizations
- denormalized counters where justified
- material search indexes
- cached unread counts
- precomputed room summaries for chat list views

### 10.5 Storage Growth Handling
- direct-to-object-storage uploads
- lifecycle policies for old attachments if product rules allow
- CDN in front of object storage for download-heavy material access

## 11. Future Extensibility Notes

### 11.1 Stories
Can be added as a new module reusing:
- object storage
- notifications
- moderation
- background expiration jobs

### 11.2 Shared Memories
Can be modeled as a media content module linked to groups, friendships, or events without changing the messaging core.

### 11.3 Nearby Students
Should be implemented as an opt-in module with separate location services and privacy policies, not by expanding the core user profile module excessively.

### 11.4 Course Hub Communities
Can be introduced as a new module anchored to `courses`, with optional integration into messaging and materials.

### 11.5 Extraction Path to Services
If later decomposition is needed, the most likely extraction candidates are:
- messaging
- notifications
- academic resources

This is why module boundaries, repository ownership, and event contracts should remain explicit from the beginning.

## Final Recommendation

Build IsuChat as a tenant-aware modular monolith with explicit domain modules, tenant-safe repositories, event-driven background processing, and a stateless REST plus WebSocket runtime. The most important architectural rule is that `school_id` must flow through every access path consistently, because tenant isolation is more important than any individual feature in a multi-university SaaS platform.
