// ========================================
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
}
