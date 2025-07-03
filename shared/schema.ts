import { pgTable, text, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const meetingRooms = pgTable("meeting_rooms", {
  id: serial("id").primaryKey(),
  meetingId: text("meeting_id").notNull().unique(),
  hostId: text("host_id").notNull(),
  hostName: text("host_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  participants: jsonb("participants").default([]),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMeetingRoomSchema = createInsertSchema(meetingRooms).pick({
  meetingId: true,
  hostId: true,
  hostName: true,
});

export const participantSchema = z.object({
  id: z.string(),
  name: z.string(),
  cameraEnabled: z.boolean(),
  micEnabled: z.boolean(),
  joinedAt: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertMeetingRoom = z.infer<typeof insertMeetingRoomSchema>;
export type MeetingRoom = typeof meetingRooms.$inferSelect;
export type Participant = z.infer<typeof participantSchema>;
