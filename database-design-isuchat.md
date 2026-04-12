# IsuChat PostgreSQL Database Design

## 1. Schema Design Principles

### 1.1 Tenant Isolation
- `school_id` is the tenant isolation key for all university-scoped data.
- Every university-scoped table includes `school_id` unless the table is globally shared by the platform, such as `roles` or `permissions`.
- Foreign keys and composite uniqueness rules should prevent cross-tenant inconsistencies.
- Application queries must always be tenant-scoped, and the schema should reinforce this through indexes and unique constraints.

### 1.2 MVP-First, Extension-Ready
- The schema covers all required MVP modules.
- The design intentionally leaves room for future modules such as stories, location-aware features, and course hubs without forcing major core-table rewrites.
- Chat, moderation, and academic content are modeled in a reusable way.

### 1.3 Practical Production Modeling
- PostgreSQL-native types should be used where appropriate: `uuid`, `text`, `boolean`, `jsonb`, `timestamptz`.
- All primary keys should use `uuid`.
- Timestamps should use `timestamptz`.
- High-write tables such as `messages`, `notifications`, and read-state tables should be indexed for tenant and access patterns.

### 1.4 Modular Monolith Alignment
- Tables are organized by domain module:
  - tenant structure
  - identity and access
  - social graph
  - messaging
  - groups
  - academic materials
  - notifications
  - moderation and audit

### 1.5 Consistency Rules
- Strong foreign keys for structural integrity
- Unique constraints for relationship correctness
- Check constraints for allowed room associations and moderation semantics
- Soft delete where user-facing recovery or auditability matters

## 2. Table List by Module

### 2.1 Tenant Structure
- `schools`
- `school_settings`
- `departments`
- `courses`
- `academic_terms`

### 2.2 Identity and Access
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `user_sessions`

### 2.3 Social Graph
- `user_privacy_settings`
- `friend_requests`
- `friendships`
- `follows`
- `blocks`

### 2.4 Messaging
- `chat_rooms`
- `chat_room_members`
- `messages`
- `message_attachments`
- `message_reactions`
- `message_read_states`
- `message_reports`

### 2.5 Groups
- `groups`
- `group_members`
- `group_join_requests`

### 2.6 Academic Materials
- `academic_materials`
- `material_tags`
- `academic_material_tag_map`
- `material_comments`
- `material_votes`
- `material_bookmarks`
- `material_reports`

### 2.7 Notifications
- `notifications`
- `notification_preferences`

### 2.8 Moderation and Audit
- `user_reports`
- `moderation_actions`
- `audit_logs`

## 3. Detailed Table Definitions

### 3.1 `schools`
Purpose: tenant root table.

Columns:
- `id uuid primary key`
- `name varchar(200) not null`
- `slug varchar(120) not null unique`
- `domain varchar(255)`
- `status school_status not null default 'active'`
- `timezone varchar(64) not null default 'UTC'`
- `country_code char(2)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

### 3.2 `school_settings`
Purpose: tenant configuration.

Columns:
- `school_id uuid primary key references schools(id) on delete cascade`
- `allow_self_signup boolean not null default true`
- `require_email_verification boolean not null default true`
- `default_profile_visibility profile_visibility not null default 'school_only'`
- `allow_department_auto_join boolean not null default true`
- `max_upload_size_mb integer not null default 50`
- `settings_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 3.3 `departments`
Purpose: school-scoped academic structure.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `name varchar(200) not null`
- `code varchar(50)`
- `description text`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Constraints:
- unique (`school_id`, `name`)
- unique (`school_id`, `code`) where `code` is not null

### 3.4 `courses`
Purpose: department course catalog.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `department_id uuid not null references departments(id) on delete restrict`
- `code varchar(50) not null`
- `name varchar(200) not null`
- `description text`
- `credit numeric(4,1)`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Constraints:
- unique (`school_id`, `department_id`, `code`)

### 3.5 `academic_terms`
Purpose: school-specific academic period definitions.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `name varchar(120) not null`
- `term_type academic_term_type not null`
- `start_date date not null`
- `end_date date not null`
- `is_current boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- check (`end_date >= start_date`)
- unique (`school_id`, `name`)

### 3.6 `users`
Purpose: user identity and account table.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete restrict`
- `department_id uuid references departments(id) on delete set null`
- `email varchar(255) not null`
- `email_normalized varchar(255) not null`
- `password_hash text not null`
- `username varchar(50) not null`
- `full_name varchar(150) not null`
- `bio text`
- `profile_image_url text`
- `status user_status not null default 'active'`
- `is_verified boolean not null default false`
- `last_seen_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Constraints:
- unique (`school_id`, `email_normalized`)
- unique (`school_id`, `username`)

### 3.7 `roles`
Purpose: role catalog.

Columns:
- `id uuid primary key`
- `name varchar(80) not null unique`
- `scope role_scope not null`
- `description text`
- `created_at timestamptz not null default now()`

### 3.8 `permissions`
Purpose: permission catalog.

Columns:
- `id uuid primary key`
- `key varchar(120) not null unique`
- `description text`
- `created_at timestamptz not null default now()`

### 3.9 `role_permissions`
Purpose: role to permission mapping.

Columns:
- `role_id uuid not null references roles(id) on delete cascade`
- `permission_id uuid not null references permissions(id) on delete cascade`
- `created_at timestamptz not null default now()`

Primary key:
- (`role_id`, `permission_id`)

### 3.10 `user_roles`
Purpose: assign roles to users.

Columns:
- `id uuid primary key`
- `user_id uuid not null references users(id) on delete cascade`
- `school_id uuid references schools(id) on delete cascade`
- `role_id uuid not null references roles(id) on delete cascade`
- `assigned_by uuid references users(id) on delete set null`
- `created_at timestamptz not null default now()`

Constraints:
- unique (`user_id`, `role_id`, `school_id`)

### 3.11 `user_sessions`
Purpose: manage authenticated device sessions.

Columns:
- `id uuid primary key`
- `user_id uuid not null references users(id) on delete cascade`
- `school_id uuid not null references schools(id) on delete cascade`
- `refresh_token_hash text not null`
- `device_name varchar(120)`
- `ip_address inet`
- `user_agent text`
- `last_used_at timestamptz not null default now()`
- `expires_at timestamptz not null`
- `revoked_at timestamptz`
- `created_at timestamptz not null default now()`

### 3.12 `user_privacy_settings`
Purpose: privacy and discovery controls.

Columns:
- `user_id uuid primary key references users(id) on delete cascade`
- `school_id uuid not null references schools(id) on delete cascade`
- `profile_visibility profile_visibility not null default 'school_only'`
- `allow_direct_messages_from dm_permission not null default 'school_members'`
- `allow_followers boolean not null default true`
- `allow_friend_requests boolean not null default true`
- `show_online_status boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 3.13 `friend_requests`
Purpose: pending friendship workflow.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `requester_id uuid not null references users(id) on delete cascade`
- `recipient_id uuid not null references users(id) on delete cascade`
- `status friend_request_status not null default 'pending'`
- `responded_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- check (`requester_id <> recipient_id`)
- unique (`school_id`, `requester_id`, `recipient_id`)

### 3.14 `friendships`
Purpose: accepted two-way friendship relation.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `user_one_id uuid not null references users(id) on delete cascade`
- `user_two_id uuid not null references users(id) on delete cascade`
- `created_from_request_id uuid references friend_requests(id) on delete set null`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz`

Constraints:
- check (`user_one_id <> user_two_id`)
- check (`user_one_id < user_two_id`)
- unique (`school_id`, `user_one_id`, `user_two_id`)

### 3.15 `follows`
Purpose: one-way follow relation.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `follower_id uuid not null references users(id) on delete cascade`
- `followed_id uuid not null references users(id) on delete cascade`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz`

Constraints:
- check (`follower_id <> followed_id`)
- unique (`school_id`, `follower_id`, `followed_id`)

### 3.16 `blocks`
Purpose: hard social restriction.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `blocker_id uuid not null references users(id) on delete cascade`
- `blocked_id uuid not null references users(id) on delete cascade`
- `reason varchar(255)`
- `created_at timestamptz not null default now()`

Constraints:
- check (`blocker_id <> blocked_id`)
- unique (`school_id`, `blocker_id`, `blocked_id`)

### 3.17 `chat_rooms`
Purpose: unified chat container.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `room_type chat_room_type not null`
- `name varchar(200)`
- `description text`
- `department_id uuid references departments(id) on delete set null`
- `group_id uuid unique`
- `created_by uuid references users(id) on delete set null`
- `last_message_id uuid`
- `last_message_at timestamptz`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Constraints:
- check (
  (`room_type = 'general' and department_id is null and group_id is null`) or
  (`room_type = 'department' and department_id is not null and group_id is null`) or
  (`room_type = 'private' and department_id is null and group_id is null`) or
  (`room_type = 'group' and department_id is null and group_id is not null`)
)

### 3.18 `chat_room_members`
Purpose: membership and participation metadata.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `chat_room_id uuid not null references chat_rooms(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `member_role chat_member_role not null default 'member'`
- `joined_at timestamptz not null default now()`
- `left_at timestamptz`
- `last_read_message_id uuid`
- `notifications_muted boolean not null default false`
- `created_at timestamptz not null default now()`

Constraints:
- unique (`chat_room_id`, `user_id`)

### 3.19 `messages`
Purpose: persisted chat messages.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `chat_room_id uuid not null references chat_rooms(id) on delete cascade`
- `sender_id uuid not null references users(id) on delete restrict`
- `reply_to_message_id uuid references messages(id) on delete set null`
- `message_type message_type not null default 'text'`
- `body text`
- `metadata jsonb not null default '{}'::jsonb`
- `edited_at timestamptz`
- `deleted_at timestamptz`
- `created_at timestamptz not null default now()`

Constraints:
- check (
  (`message_type = 'text' and body is not null`) or
  (`message_type in ('attachment', 'system')`)
)

### 3.20 `message_attachments`
Purpose: attachment metadata for messages.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `message_id uuid not null references messages(id) on delete cascade`
- `storage_key text not null`
- `original_file_name varchar(255) not null`
- `mime_type varchar(120) not null`
- `file_size_bytes bigint not null`
- `created_at timestamptz not null default now()`

### 3.21 `message_reactions`
Purpose: emoji reactions per user per message.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `message_id uuid not null references messages(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `emoji varchar(32) not null`
- `created_at timestamptz not null default now()`

Constraints:
- unique (`message_id`, `user_id`, `emoji`)

### 3.22 `message_read_states`
Purpose: normalized read receipt trail.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `message_id uuid not null references messages(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `read_at timestamptz not null`

Constraints:
- unique (`message_id`, `user_id`)

### 3.23 `message_reports`
Purpose: report abusive messages.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `message_id uuid not null references messages(id) on delete cascade`
- `reporter_id uuid not null references users(id) on delete cascade`
- `reason report_reason not null`
- `description text`
- `status report_status not null default 'open'`
- `reviewed_by uuid references users(id) on delete set null`
- `reviewed_at timestamptz`
- `created_at timestamptz not null default now()`

Constraints:
- unique (`message_id`, `reporter_id`)

### 3.24 `groups`
Purpose: student-created groups.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `name varchar(150) not null`
- `slug varchar(160)`
- `description text`
- `visibility group_visibility not null default 'private'`
- `join_policy group_join_policy not null default 'request_only'`
- `owner_id uuid not null references users(id) on delete restrict`
- `chat_room_id uuid unique`
- `member_count integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

Constraints:
- unique (`school_id`, `slug`) where `slug` is not null and deleted_at is null

### 3.25 `group_members`
Purpose: group membership.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `group_id uuid not null references groups(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `role group_member_role not null default 'member'`
- `joined_at timestamptz not null default now()`
- `left_at timestamptz`
- `created_at timestamptz not null default now()`

Constraints:
- unique (`group_id`, `user_id`)

### 3.26 `group_join_requests`
Purpose: join approval flow.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `group_id uuid not null references groups(id) on delete cascade`
- `requester_id uuid not null references users(id) on delete cascade`
- `status group_join_request_status not null default 'pending'`
- `message text`
- `reviewed_by uuid references users(id) on delete set null`
- `reviewed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:
- unique (`group_id`, `requester_id`)

### 3.27 `academic_materials`
Purpose: tenant-scoped academic content.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `uploader_id uuid not null references users(id) on delete restrict`
- `department_id uuid references departments(id) on delete set null`
- `course_id uuid references courses(id) on delete set null`
- `academic_term_id uuid references academic_terms(id) on delete set null`
- `material_type material_type not null`
- `title varchar(250) not null`
- `description text`
- `storage_key text not null`
- `original_file_name varchar(255) not null`
- `mime_type varchar(120) not null`
- `file_size_bytes bigint not null`
- `visibility material_visibility not null default 'school_only'`
- `download_count integer not null default 0`
- `comment_count integer not null default 0`
- `vote_score integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

### 3.28 `material_tags`
Purpose: reusable school-scoped tags.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `name varchar(60) not null`
- `slug varchar(80) not null`
- `created_at timestamptz not null default now()`

Constraints:
- unique (`school_id`, `slug`)

### 3.29 `academic_material_tag_map`
Purpose: many-to-many between materials and tags.

Columns:
- `material_id uuid not null references academic_materials(id) on delete cascade`
- `tag_id uuid not null references material_tags(id) on delete cascade`
- `created_at timestamptz not null default now()`

Primary key:
- (`material_id`, `tag_id`)

### 3.30 `material_comments`
Purpose: comments on academic materials.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `material_id uuid not null references academic_materials(id) on delete cascade`
- `user_id uuid not null references users(id) on delete restrict`
- `parent_comment_id uuid references material_comments(id) on delete cascade`
- `body text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

### 3.31 `material_votes`
Purpose: upvote/downvote-ready vote model, though MVP may expose upvote only.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `material_id uuid not null references academic_materials(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `vote smallint not null`
- `created_at timestamptz not null default now()`

Constraints:
- check (`vote in (-1, 1)`)
- unique (`material_id`, `user_id`)

### 3.32 `material_bookmarks`
Purpose: personal saved materials.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `material_id uuid not null references academic_materials(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `created_at timestamptz not null default now()`

Constraints:
- unique (`material_id`, `user_id`)

### 3.33 `material_reports`
Purpose: report academic material.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `material_id uuid not null references academic_materials(id) on delete cascade`
- `reporter_id uuid not null references users(id) on delete cascade`
- `reason report_reason not null`
- `description text`
- `status report_status not null default 'open'`
- `reviewed_by uuid references users(id) on delete set null`
- `reviewed_at timestamptz`
- `created_at timestamptz not null default now()`

Constraints:
- unique (`material_id`, `reporter_id`)

### 3.34 `notifications`
Purpose: in-app notification feed.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `user_id uuid not null references users(id) on delete cascade`
- `type notification_type not null`
- `actor_user_id uuid references users(id) on delete set null`
- `entity_type notification_entity_type`
- `entity_id uuid`
- `payload jsonb not null default '{}'::jsonb`
- `is_read boolean not null default false`
- `read_at timestamptz`
- `created_at timestamptz not null default now()`

### 3.35 `notification_preferences`
Purpose: user notification configuration.

Columns:
- `user_id uuid primary key references users(id) on delete cascade`
- `school_id uuid not null references schools(id) on delete cascade`
- `friend_request_enabled boolean not null default true`
- `message_enabled boolean not null default true`
- `group_invite_enabled boolean not null default true`
- `material_comment_enabled boolean not null default true`
- `push_enabled boolean not null default true`
- `email_enabled boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 3.36 `user_reports`
Purpose: report users.

Columns:
- `id uuid primary key`
- `school_id uuid not null references schools(id) on delete cascade`
- `reported_user_id uuid not null references users(id) on delete cascade`
- `reporter_id uuid not null references users(id) on delete cascade`
- `reason report_reason not null`
- `description text`
- `status report_status not null default 'open'`
- `reviewed_by uuid references users(id) on delete set null`
- `reviewed_at timestamptz`
- `created_at timestamptz not null default now()`

Constraints:
- check (`reported_user_id <> reporter_id`)
- unique (`reported_user_id`, `reporter_id`)

### 3.37 `moderation_actions`
Purpose: enforcement trail.

Columns:
- `id uuid primary key`
- `school_id uuid references schools(id) on delete cascade`
- `target_type moderation_target_type not null`
- `target_id uuid not null`
- `action_type moderation_action_type not null`
- `reason text`
- `metadata jsonb not null default '{}'::jsonb`
- `performed_by uuid not null references users(id) on delete restrict`
- `expires_at timestamptz`
- `created_at timestamptz not null default now()`

### 3.38 `audit_logs`
Purpose: immutable system and administrative audit trail.

Columns:
- `id uuid primary key`
- `school_id uuid references schools(id) on delete set null`
- `actor_user_id uuid references users(id) on delete set null`
- `action varchar(120) not null`
- `entity_type varchar(80)`
- `entity_id uuid`
- `ip_address inet`
- `user_agent text`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

## 4. Relationship Design

- `schools` 1:1 `school_settings`
- `schools` 1:n `departments`
- `departments` 1:n `courses`
- `schools` 1:n `academic_terms`
- `schools` 1:n `users`
- `users` n:m `roles` via `user_roles`
- `roles` n:m `permissions` via `role_permissions`
- `users` 1:n `user_sessions`
- `users` 1:1 `user_privacy_settings`
- `users` 1:1 `notification_preferences`
- `chat_rooms` 1:n `chat_room_members`
- `chat_rooms` 1:n `messages`
- `groups` 1:n `group_members`
- `groups` 1:n `group_join_requests`
- `academic_materials` n:m `material_tags` via `academic_material_tag_map`
- `academic_materials` 1:n `material_comments`
- `academic_materials` 1:n `material_votes`
- `academic_materials` 1:n `material_bookmarks`

## 5. Constraints and Data Integrity Rules

### 5.1 Tenant Integrity
- All university-scoped relation tables carry `school_id`.
- Backend writes must validate that related entities belong to the same school.
- For hardening, move high-risk relations toward composite foreign keys on `(id, school_id)`.

### 5.2 Social Integrity
- Prevent self-follow, self-block, self-friend-request.
- Canonical ordering in `friendships` avoids duplicate inverse rows.

### 5.3 Messaging Integrity
- One unified `chat_rooms` model with strict room-type checks.
- Only one active general room per school.
- Only one active department room per department.
- Private room uniqueness should be enforced with a derived pair key in service logic or a future schema column.

### 5.4 Material Integrity
- One material has one primary file reference embedded in `academic_materials`.
- Votes and bookmarks are one per user per material.

## 6. Indexing Strategy

### 6.1 General Rules
- Index `school_id` on every tenant-scoped table.
- Add composite indexes based on access patterns.
- Use partial indexes for active or unread data.

### 6.2 Recommended Indexes

`users`
- index (`school_id`, `department_id`)
- index (`school_id`, `status`)
- index (`school_id`, `created_at`)

`friend_requests`
- index (`school_id`, `recipient_id`, `status`)
- index (`school_id`, `requester_id`, `status`)

`friendships`
- index (`school_id`, `user_one_id`)
- index (`school_id`, `user_two_id`)

`follows`
- index (`school_id`, `followed_id`)
- index (`school_id`, `follower_id`)

`chat_rooms`
- index (`school_id`, `room_type`)
- index (`school_id`, `last_message_at desc`)

`chat_room_members`
- index (`school_id`, `user_id`, `left_at`)
- index (`chat_room_id`, `left_at`)

`messages`
- index (`school_id`, `chat_room_id`, `created_at desc`)
- index (`chat_room_id`, `id`)
- index (`sender_id`, `created_at desc`)
- index (`reply_to_message_id`) where `reply_to_message_id is not null`

`message_reports`
- index (`school_id`, `status`, `created_at`)

`groups`
- index (`school_id`, `visibility`, `created_at desc`)
- index (`school_id`, `owner_id`)

`group_join_requests`
- index (`group_id`, `status`, `created_at`)

`academic_materials`
- index (`school_id`, `created_at desc`)
- index (`school_id`, `department_id`, `created_at desc`)
- index (`school_id`, `course_id`, `created_at desc`)
- index (`school_id`, `material_type`, `created_at desc`)

`material_comments`
- index (`material_id`, `created_at`)

`notifications`
- index (`user_id`, `is_read`, `created_at desc`)
- partial index (`user_id`, `created_at desc`) where `is_read = false`

`moderation_actions`
- index (`school_id`, `target_type`, `target_id`)

`audit_logs`
- index (`school_id`, `created_at desc`)
- index (`actor_user_id`, `created_at desc`)

## 7. Recommended PostgreSQL Enums

- `school_status`: `active`, `suspended`, `archived`
- `user_status`: `pending`, `active`, `suspended`, `banned`, `deactivated`
- `role_scope`: `platform`, `school`
- `profile_visibility`: `public`, `school_only`, `friends_only`, `private`
- `dm_permission`: `everyone`, `school_members`, `friends_only`, `no_one`
- `friend_request_status`: `pending`, `accepted`, `rejected`, `cancelled`
- `academic_term_type`: `fall`, `spring`, `summer`, `winter`, `custom`
- `material_type`: `lecture_note`, `past_exam`, `summary`, `study_material`, `other`
- `material_visibility`: `school_only`, `department_only`, `private`
- `chat_room_type`: `general`, `department`, `private`, `group`
- `chat_member_role`: `member`, `owner`, `admin`
- `message_type`: `text`, `attachment`, `system`
- `group_visibility`: `public`, `private`
- `group_join_policy`: `open`, `request_only`, `invite_only`
- `group_member_role`: `owner`, `admin`, `member`
- `group_join_request_status`: `pending`, `approved`, `rejected`, `cancelled`
- `report_reason`: `spam`, `harassment`, `hate_speech`, `inappropriate_content`, `copyright`, `misinformation`, `other`
- `report_status`: `open`, `under_review`, `resolved`, `dismissed`
- `moderation_target_type`: `user`, `message`, `material`, `group`
- `moderation_action_type`: `warn`, `mute`, `suspend`, `ban`, `remove_content`, `dismiss_report`
- `notification_type`: `friend_request`, `friend_request_accepted`, `new_message`, `group_invite`, `group_join_request`, `material_comment`, `material_vote`, `system`
- `notification_entity_type`: `friend_request`, `message`, `group`, `material`, `comment`, `user`

## 8. Deletion Strategy

### 8.1 Soft Delete
Use `deleted_at` on:
- `schools`
- `departments`
- `courses`
- `users`
- `friendships`
- `follows`
- `chat_rooms`
- `messages`
- `groups`
- `academic_materials`
- `material_comments`

### 8.2 Hard Delete
Use hard delete for:
- `user_sessions`
- `message_reactions`
- `message_read_states`
- `material_bookmarks`
- `material_votes`
- `role_permissions`
- `academic_material_tag_map`

## 9. Future-Proofing Notes

- Stories and shared memories can be added as a new content domain reusing notifications, moderation, and storage patterns.
- Nearby students and location sharing should use separate opt-in tables instead of expanding `users`.
- Course hubs can anchor on existing `courses`.
- Study matchmaking can be introduced as an independent module without changing core chat tables.
- For very large scale, `messages` and `notifications` can be partitioned by time or tenant.

## 10. Final MVP Table List

- `schools`
- `school_settings`
- `departments`
- `courses`
- `academic_terms`
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `user_sessions`
- `user_privacy_settings`
- `friend_requests`
- `friendships`
- `follows`
- `blocks`
- `chat_rooms`
- `chat_room_members`
- `messages`
- `message_attachments`
- `message_reactions`
- `message_read_states`
- `message_reports`
- `groups`
- `group_members`
- `group_join_requests`
- `academic_materials`
- `material_tags`
- `academic_material_tag_map`
- `material_comments`
- `material_votes`
- `material_bookmarks`
- `material_reports`
- `notifications`
- `notification_preferences`
- `user_reports`
- `moderation_actions`
- `audit_logs`

## Final Recommendation

This schema is production-ready for an MVP modular monolith if tenant scoping is enforced consistently in both application logic and SQL design. The highest-risk failure mode is cross-tenant leakage, so the most important implementation rule is strict `school_id` validation on every read and write path.
