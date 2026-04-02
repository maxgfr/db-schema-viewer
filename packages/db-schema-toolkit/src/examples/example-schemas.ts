import type { SchemaTemplate } from "../sql/schema-templates";

export const EXAMPLE_SCHEMAS: SchemaTemplate[] = [
  {
    name: "Social Network",
    description: "Social platform — Drizzle ORM format",
    category: "drizzle",
    fileName: "schema.ts",
    sql: `// ========================================
// Social Network Database Schema - Drizzle ORM
// ========================================

import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ═══════════════════════════════════════════
//  TABLE DEFINITIONS
// ═══════════════════════════════════════════

// ─── Users ───────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    bio: text("bio"),
    avatarUrl: varchar("avatar_url", { length: 512 }),
    coverUrl: varchar("cover_url", { length: 512 }),
    isVerified: boolean("is_verified").default(false).notNull(),
    isPrivate: boolean("is_private").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_username_idx").on(table.username),
    uniqueIndex("users_email_idx").on(table.email),
  ]
);

// ─── Posts ───────────────────────────────────────────

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content"),
    mediaUrl: varchar("media_url", { length: 512 }),
    mediaType: varchar("media_type", { length: 50 }), // image, video, gif
    isPinned: boolean("is_pinned").default(false).notNull(),
    visibility: varchar("visibility", { length: 20 }).default("public").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("posts_author_id_idx").on(table.authorId),
    index("posts_created_at_idx").on(table.createdAt),
  ]
);

// ─── Comments ────────────────────────────────────────

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: integer("parent_comment_id"), // self-ref added via relations
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("comments_post_id_idx").on(table.postId),
    index("comments_author_id_idx").on(table.authorId),
  ]
);

// ─── Likes ───────────────────────────────────────────

export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    likeableId: integer("likeable_id").notNull(),
    likeableType: varchar("likeable_type", { length: 50 }).notNull(), // post, comment
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("likes_unique").on(table.userId, table.likeableId, table.likeableType),
  ]
);

// ─── Follows ─────────────────────────────────────────

export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: integer("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).default("accepted").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("follows_unique").on(table.followerId, table.followingId),
    index("follows_follower_id_idx").on(table.followerId),
    index("follows_following_id_idx").on(table.followingId),
  ]
);

// ─── Conversations ───────────────────────────────────

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  isGroup: boolean("is_group").default(false).notNull(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Conversation Participants ───────────────────────

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastReadAt: timestamp("last_read_at"),
  },
  (table) => [
    unique("conv_participants_unique").on(table.conversationId, table.userId),
  ]
);

// ─── Messages ────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    mediaUrl: varchar("media_url", { length: 512 }),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_sender_id_idx").on(table.senderId),
  ]
);

// ─── Notifications ───────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(), // like, comment, follow, mention, message
    entityId: integer("entity_id"),
    entityType: varchar("entity_type", { length: 50 }), // post, comment, follow, message
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_recipient_id_idx").on(table.recipientId),
    index("notifications_recipient_read_idx").on(table.recipientId, table.isRead),
  ]
);

// ─── Hashtags ────────────────────────────────────────

export const hashtags = pgTable(
  "hashtags",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
  },
  (table) => [uniqueIndex("hashtags_name_idx").on(table.name)]
);

// ─── Post Hashtags (join table) ──────────────────────

export const postHashtags = pgTable(
  "post_hashtags",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    hashtagId: integer("hashtag_id")
      .notNull()
      .references(() => hashtags.id, { onDelete: "cascade" }),
  },
  (table) => [unique("post_hashtags_unique").on(table.postId, table.hashtagId)]
);

// ─── Bookmarks ───────────────────────────────────────

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("bookmarks_unique").on(table.userId, table.postId)]
);

// ═══════════════════════════════════════════
//  RELATIONS (Drizzle relational query API)
// ═══════════════════════════════════════════

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  likes: many(likes),
  followersRel: many(follows, { relationName: "following" }),
  followingRel: many(follows, { relationName: "follower" }),
  sentMessages: many(messages),
  conversationParticipants: many(conversationParticipants),
  notificationsReceived: many(notifications, { relationName: "recipient" }),
  notificationsSent: many(notifications, { relationName: "actor" }),
  bookmarks: many(bookmarks),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
  postHashtags: many(postHashtags),
  bookmarks: many(bookmarks),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parentComment: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: "commentReplies",
  }),
  replies: many(comments, { relationName: "commentReplies" }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationParticipants.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationParticipants.userId],
      references: [users.id],
    }),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
    relationName: "recipient",
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: "actor",
  }),
}));

export const hashtagsRelations = relations(hashtags, ({ many }) => ({
  postHashtags: many(postHashtags),
}));

export const postHashtagsRelations = relations(postHashtags, ({ one }) => ({
  post: one(posts, {
    fields: [postHashtags.postId],
    references: [posts.id],
  }),
  hashtag: one(hashtags, {
    fields: [postHashtags.hashtagId],
    references: [hashtags.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [bookmarks.postId],
    references: [posts.id],
  }),
}));`,
  },
  {
    name: "Social Network",
    description: "Social platform — Prisma format",
    category: "prisma",
    fileName: "schema.prisma",
    sql: `// ========================================
// Social Network Database Schema - Prisma
// ========================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── User ────────────────────────────────────────────

model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique
  email        String   @unique
  passwordHash String   @map("password_hash")
  displayName  String   @map("display_name")
  bio          String?  @db.Text
  avatarUrl    String?  @map("avatar_url")
  coverUrl     String?  @map("cover_url")
  isVerified   Boolean  @default(false) @map("is_verified")
  isPrivate    Boolean  @default(false) @map("is_private")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relations
  posts                    Post[]
  comments                 Comment[]
  likes                    Like[]
  followers                Follow[]                  @relation("Following")
  following                Follow[]                  @relation("Follower")
  sentMessages             Message[]
  conversationParticipants ConversationParticipant[]
  notificationsReceived    Notification[]             @relation("Recipient")
  notificationsSent        Notification[]             @relation("Actor")
  bookmarks                Bookmark[]

  @@index([username])
  @@index([email])
  @@map("users")
}

// ─── Post ────────────────────────────────────────────

model Post {
  id         Int      @id @default(autoincrement())
  authorId   Int      @map("author_id")
  content    String?  @db.Text
  mediaUrl   String?  @map("media_url")
  mediaType  String?  @map("media_type") // image, video, gif
  isPinned   Boolean  @default(false) @map("is_pinned")
  visibility String   @default("public") // public, followers, private
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  // Relations
  author    User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  comments  Comment[]
  hashtags  PostHashtag[]
  bookmarks Bookmark[]

  @@index([authorId])
  @@index([createdAt])
  @@map("posts")
}

// ─── Comment ─────────────────────────────────────────

model Comment {
  id              Int      @id @default(autoincrement())
  postId          Int      @map("post_id")
  authorId        Int      @map("author_id")
  parentCommentId Int?     @map("parent_comment_id")
  content         String   @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  post          Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  author        User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parentComment Comment?  @relation("CommentReplies", fields: [parentCommentId], references: [id], onDelete: SetNull)
  replies       Comment[] @relation("CommentReplies")

  @@index([postId])
  @@index([authorId])
  @@map("comments")
}

// ─── Like ────────────────────────────────────────────

model Like {
  id           Int      @id @default(autoincrement())
  userId       Int      @map("user_id")
  likeableId   Int      @map("likeable_id")
  likeableType String   @map("likeable_type") // post, comment
  createdAt    DateTime @default(now()) @map("created_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, likeableId, likeableType])
  @@map("likes")
}

// ─── Follow ──────────────────────────────────────────

model Follow {
  id          Int      @id @default(autoincrement())
  followerId  Int      @map("follower_id")
  followingId Int      @map("following_id")
  status      String   @default("accepted") // pending, accepted, blocked
  createdAt   DateTime @default(now()) @map("created_at")

  // Relations
  follower  User @relation("Follower", fields: [followerId], references: [id], onDelete: Cascade)
  following User @relation("Following", fields: [followingId], references: [id], onDelete: Cascade)

  @@unique([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
  @@map("follows")
}

// ─── Conversation ────────────────────────────────────

model Conversation {
  id        Int      @id @default(autoincrement())
  isGroup   Boolean  @default(false) @map("is_group")
  name      String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  participants ConversationParticipant[]
  messages     Message[]

  @@map("conversations")
}

// ─── ConversationParticipant ─────────────────────────

model ConversationParticipant {
  id             Int       @id @default(autoincrement())
  conversationId Int       @map("conversation_id")
  userId         Int       @map("user_id")
  joinedAt       DateTime  @default(now()) @map("joined_at")
  lastReadAt     DateTime? @map("last_read_at")

  // Relations
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
  @@map("conversation_participants")
}

// ─── Message ─────────────────────────────────────────

model Message {
  id             Int      @id @default(autoincrement())
  conversationId Int      @map("conversation_id")
  senderId       Int      @map("sender_id")
  content        String   @db.Text
  mediaUrl       String?  @map("media_url")
  isRead         Boolean  @default(false) @map("is_read")
  createdAt      DateTime @default(now()) @map("created_at")

  // Relations
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User         @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([senderId])
  @@map("messages")
}

// ─── Notification ────────────────────────────────────

model Notification {
  id          Int      @id @default(autoincrement())
  recipientId Int      @map("recipient_id")
  actorId     Int      @map("actor_id")
  type        String   // like, comment, follow, mention, message
  entityId    Int?     @map("entity_id")
  entityType  String?  @map("entity_type") // post, comment, follow, message
  isRead      Boolean  @default(false) @map("is_read")
  createdAt   DateTime @default(now()) @map("created_at")

  // Relations
  recipient User @relation("Recipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor     User @relation("Actor", fields: [actorId], references: [id], onDelete: Cascade)

  @@index([recipientId])
  @@index([recipientId, isRead])
  @@map("notifications")
}

// ─── Hashtag ─────────────────────────────────────────

model Hashtag {
  id    Int           @id @default(autoincrement())
  name  String        @unique
  posts PostHashtag[]

  @@map("hashtags")
}

// ─── PostHashtag (join table) ────────────────────────

model PostHashtag {
  id        Int @id @default(autoincrement())
  postId    Int @map("post_id")
  hashtagId Int @map("hashtag_id")

  // Relations
  post    Post    @relation(fields: [postId], references: [id], onDelete: Cascade)
  hashtag Hashtag @relation(fields: [hashtagId], references: [id], onDelete: Cascade)

  @@unique([postId, hashtagId])
  @@map("post_hashtags")
}

// ─── Bookmark ────────────────────────────────────────

model Bookmark {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  postId    Int      @map("post_id")
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([userId, postId])
  @@map("bookmarks")
}`,
  },
  {
    name: "Social Network",
    description: "Social platform — DBML format",
    category: "dbml",
    fileName: "schema.dbml",
    sql: `// ========================================
// Social Network Database Schema - DBML
// ========================================

Table users {
  id            int       [pk, increment]
  username      varchar   [unique, not null]
  email         varchar   [unique, not null]
  password_hash varchar   [not null]
  display_name  varchar   [not null]
  bio           text
  avatar_url    varchar
  cover_url     varchar
  is_verified   boolean   [default: false]
  is_private    boolean   [default: false]
  created_at    timestamp [default: \`now()\`]
  updated_at    timestamp [default: \`now()\`]

  indexes {
    username
    email
  }
}

Table posts {
  id         int       [pk, increment]
  author_id  int       [not null, ref: > users.id]
  content    text
  media_url  varchar
  media_type varchar   [note: 'image, video, gif']
  is_pinned  boolean   [default: false]
  visibility varchar   [default: 'public', note: 'public, followers, private']
  created_at timestamp [default: \`now()\`]
  updated_at timestamp [default: \`now()\`]

  indexes {
    author_id
    created_at
  }
}

Table comments {
  id                int       [pk, increment]
  post_id           int       [not null, ref: > posts.id]
  author_id         int       [not null, ref: > users.id]
  parent_comment_id int       [ref: > comments.id, note: 'for nested replies']
  content           text      [not null]
  created_at        timestamp [default: \`now()\`]
  updated_at        timestamp [default: \`now()\`]

  indexes {
    post_id
    author_id
  }
}

Table likes {
  id             int       [pk, increment]
  user_id        int       [not null, ref: > users.id]
  likeable_id    int       [not null]
  likeable_type  varchar   [not null, note: 'post, comment']
  created_at     timestamp [default: \`now()\`]

  indexes {
    (user_id, likeable_id, likeable_type) [unique]
  }
}

Table follows {
  id          int       [pk, increment]
  follower_id int       [not null, ref: > users.id]
  following_id int      [not null, ref: > users.id]
  status      varchar   [default: 'accepted', note: 'pending, accepted, blocked']
  created_at  timestamp [default: \`now()\`]

  indexes {
    (follower_id, following_id) [unique]
    follower_id
    following_id
  }
}

Table conversations {
  id         int       [pk, increment]
  is_group   boolean   [default: false]
  name       varchar   [note: 'for group chats']
  created_at timestamp [default: \`now()\`]
  updated_at timestamp [default: \`now()\`]
}

Table conversation_participants {
  id              int       [pk, increment]
  conversation_id int       [not null, ref: > conversations.id]
  user_id         int       [not null, ref: > users.id]
  joined_at       timestamp [default: \`now()\`]
  last_read_at    timestamp

  indexes {
    (conversation_id, user_id) [unique]
  }
}

Table messages {
  id              int       [pk, increment]
  conversation_id int       [not null, ref: > conversations.id]
  sender_id       int       [not null, ref: > users.id]
  content         text      [not null]
  media_url       varchar
  is_read         boolean   [default: false]
  created_at      timestamp [default: \`now()\`]

  indexes {
    conversation_id
    sender_id
  }
}

Table notifications {
  id           int       [pk, increment]
  recipient_id int       [not null, ref: > users.id]
  actor_id     int       [not null, ref: > users.id]
  type         varchar   [not null, note: 'like, comment, follow, mention, message']
  entity_id    int
  entity_type  varchar   [note: 'post, comment, follow, message']
  is_read      boolean   [default: false]
  created_at   timestamp [default: \`now()\`]

  indexes {
    recipient_id
    (recipient_id, is_read)
  }
}

Table hashtags {
  id   int     [pk, increment]
  name varchar [unique, not null]
}

Table post_hashtags {
  id         int [pk, increment]
  post_id    int [not null, ref: > posts.id]
  hashtag_id int [not null, ref: > hashtags.id]

  indexes {
    (post_id, hashtag_id) [unique]
  }
}

Table bookmarks {
  id         int       [pk, increment]
  user_id    int       [not null, ref: > users.id]
  post_id    int       [not null, ref: > posts.id]
  created_at timestamp [default: \`now()\`]

  indexes {
    (user_id, post_id) [unique]
  }
}`,
  },
  {
    name: "Social Network",
    description: "Social platform — TypeORM format",
    category: "typeorm",
    fileName: "schema.typeorm.ts",
    sql: `// ========================================
// Social Network Database Schema - TypeORM
// ========================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";

// ─── User ────────────────────────────────────────────

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: "varchar", unique: true })
  username: string;

  @Index({ unique: true })
  @Column({ type: "varchar", unique: true })
  email: string;

  @Column({ type: "varchar", name: "password_hash" })
  passwordHash: string;

  @Column({ type: "varchar", name: "display_name" })
  displayName: string;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({ type: "varchar", nullable: true, name: "avatar_url" })
  avatarUrl: string | null;

  @Column({ type: "varchar", nullable: true, name: "cover_url" })
  coverUrl: string | null;

  @Column({ type: "boolean", default: false, name: "is_verified" })
  isVerified: boolean;

  @Column({ type: "boolean", default: false, name: "is_private" })
  isPrivate: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @OneToMany(() => Comment, (comment) => comment.author)
  comments: Comment[];

  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];

  @OneToMany(() => Follow, (follow) => follow.follower)
  following: Follow[];

  @OneToMany(() => Follow, (follow) => follow.following)
  followers: Follow[];

  @OneToMany(() => Notification, (n) => n.recipient)
  notifications: Notification[];

  @OneToMany(() => Bookmark, (b) => b.user)
  bookmarks: Bookmark[];

  @OneToMany(() => Message, (m) => m.sender)
  sentMessages: Message[];

  @OneToMany(() => ConversationParticipant, (cp) => cp.user)
  conversationParticipants: ConversationParticipant[];
}

// ─── Post ────────────────────────────────────────────

@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text", nullable: true })
  content: string | null;

  @Column({ type: "varchar", nullable: true, name: "media_url" })
  mediaUrl: string | null;

  @Column({ type: "varchar", nullable: true, name: "media_type" })
  mediaType: string | null;

  @Column({ type: "boolean", default: false, name: "is_pinned" })
  isPinned: boolean;

  @Column({ type: "varchar", default: "public" })
  visibility: string;

  @CreateDateColumn({ name: "created_at" })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.posts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "author_id" })
  @Index()
  author: User;

  @Column({ name: "author_id" })
  authorId: number;

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @ManyToMany(() => Hashtag, (hashtag) => hashtag.posts)
  @JoinTable({
    name: "post_hashtags",
    joinColumn: { name: "post_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "hashtag_id", referencedColumnName: "id" },
  })
  hashtags: Hashtag[];

  @OneToMany(() => Bookmark, (b) => b.post)
  bookmarks: Bookmark[];
}

// ─── Comment ─────────────────────────────────────────

@Entity("comments")
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  content: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Post, (post) => post.comments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "post_id" })
  @Index()
  post: Post;

  @Column({ name: "post_id" })
  postId: number;

  @ManyToOne(() => User, (user) => user.comments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "author_id" })
  @Index()
  author: User;

  @Column({ name: "author_id" })
  authorId: number;

  @ManyToOne(() => Comment, (comment) => comment.replies, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "parent_comment_id" })
  parentComment: Comment | null;

  @Column({ nullable: true, name: "parent_comment_id" })
  parentCommentId: number | null;

  @OneToMany(() => Comment, (comment) => comment.parentComment)
  replies: Comment[];
}

// ─── Like ────────────────────────────────────────────

@Entity("likes")
@Unique(["userId", "likeableId", "likeableType"])
export class Like {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "likeable_id" })
  likeableId: number;

  @Column({ type: "varchar", name: "likeable_type" })
  likeableType: string; // 'post' | 'comment'

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.likes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id" })
  userId: number;
}

// ─── Follow ──────────────────────────────────────────

@Entity("follows")
@Unique(["followerId", "followingId"])
export class Follow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", default: "accepted" })
  status: string; // 'pending' | 'accepted' | 'blocked'

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.following, { onDelete: "CASCADE" })
  @JoinColumn({ name: "follower_id" })
  @Index()
  follower: User;

  @Column({ name: "follower_id" })
  followerId: number;

  @ManyToOne(() => User, (user) => user.followers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "following_id" })
  @Index()
  following: User;

  @Column({ name: "following_id" })
  followingId: number;
}

// ─── Conversation ────────────────────────────────────

@Entity("conversations")
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "boolean", default: false, name: "is_group" })
  isGroup: boolean;

  @Column({ type: "varchar", nullable: true })
  name: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @OneToMany(() => ConversationParticipant, (cp) => cp.conversation)
  participants: ConversationParticipant[];

  @OneToMany(() => Message, (m) => m.conversation)
  messages: Message[];
}

// ─── ConversationParticipant ─────────────────────────

@Entity("conversation_participants")
@Unique(["conversationId", "userId"])
export class ConversationParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "timestamp", nullable: true, name: "last_read_at" })
  lastReadAt: Date | null;

  @CreateDateColumn({ name: "joined_at" })
  joinedAt: Date;

  // Relations
  @ManyToOne(() => Conversation, (c) => c.participants, { onDelete: "CASCADE" })
  @JoinColumn({ name: "conversation_id" })
  conversation: Conversation;

  @Column({ name: "conversation_id" })
  conversationId: number;

  @ManyToOne(() => User, (u) => u.conversationParticipants, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id" })
  userId: number;
}

// ─── Message ─────────────────────────────────────────

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "varchar", nullable: true, name: "media_url" })
  mediaUrl: string | null;

  @Column({ type: "boolean", default: false, name: "is_read" })
  isRead: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "conversation_id" })
  @Index()
  conversation: Conversation;

  @Column({ name: "conversation_id" })
  conversationId: number;

  @ManyToOne(() => User, (u) => u.sentMessages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  @Index()
  sender: User;

  @Column({ name: "sender_id" })
  senderId: number;
}

// ─── Notification ────────────────────────────────────

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar" })
  type: string; // 'like' | 'comment' | 'follow' | 'mention' | 'message'

  @Column({ type: "int", nullable: true, name: "entity_id" })
  entityId: number | null;

  @Column({ type: "varchar", nullable: true, name: "entity_type" })
  entityType: string | null;

  @Column({ type: "boolean", default: false, name: "is_read" })
  @Index()
  isRead: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (u) => u.notifications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "recipient_id" })
  @Index()
  recipient: User;

  @Column({ name: "recipient_id" })
  recipientId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "actor_id" })
  actor: User;

  @Column({ name: "actor_id" })
  actorId: number;
}

// ─── Hashtag ─────────────────────────────────────────

@Entity("hashtags")
export class Hashtag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", unique: true })
  name: string;

  @ManyToMany(() => Post, (post) => post.hashtags)
  posts: Post[];
}

// ─── Bookmark ────────────────────────────────────────

@Entity("bookmarks")
@Unique(["userId", "postId"])
export class Bookmark {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (u) => u.bookmarks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id" })
  userId: number;

  @ManyToOne(() => Post, (p) => p.bookmarks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "post_id" })
  post: Post;

  @Column({ name: "post_id" })
  postId: number;
}`,
  },
];
