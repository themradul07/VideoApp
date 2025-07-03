import { meetingRooms, type MeetingRoom, type InsertMeetingRoom, type Participant } from "@shared/schema";

export interface IStorage {
  createMeetingRoom(room: InsertMeetingRoom): Promise<MeetingRoom>;
  getMeetingRoom(meetingId: string): Promise<MeetingRoom | undefined>;
  updateMeetingRoom(meetingId: string, updates: Partial<MeetingRoom>): Promise<MeetingRoom | undefined>;
  addParticipant(meetingId: string, participant: Participant): Promise<MeetingRoom | undefined>;
  removeParticipant(meetingId: string, participantId: string): Promise<MeetingRoom | undefined>;
  endMeetingRoom(meetingId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private meetingRooms: Map<string, MeetingRoom>;
  private currentId: number;

  constructor() {
    this.meetingRooms = new Map();
    this.currentId = 1;
  }

  async createMeetingRoom(insertRoom: InsertMeetingRoom): Promise<MeetingRoom> {
    const id = this.currentId++;
    const room: MeetingRoom = {
      ...insertRoom,
      id,
      isActive: true,
      createdAt: new Date(),
      participants: [],
    };
    this.meetingRooms.set(insertRoom.meetingId, room);
    return room;
  }

  async getMeetingRoom(meetingId: string): Promise<MeetingRoom | undefined> {
    return this.meetingRooms.get(meetingId);
  }

  async updateMeetingRoom(meetingId: string, updates: Partial<MeetingRoom>): Promise<MeetingRoom | undefined> {
    const room = this.meetingRooms.get(meetingId);
    if (!room) return undefined;

    const updatedRoom = { ...room, ...updates };
    this.meetingRooms.set(meetingId, updatedRoom);
    return updatedRoom;
  }

  async addParticipant(meetingId: string, participant: Participant): Promise<MeetingRoom | undefined> {
    const room = this.meetingRooms.get(meetingId);
    if (!room) return undefined;

    const participants = Array.isArray(room.participants) ? room.participants : [];
    const updatedParticipants = [...participants, participant];
    
    const updatedRoom = { ...room, participants: updatedParticipants };
    this.meetingRooms.set(meetingId, updatedRoom);
    return updatedRoom;
  }

  async removeParticipant(meetingId: string, participantId: string): Promise<MeetingRoom | undefined> {
    const room = this.meetingRooms.get(meetingId);
    if (!room) return undefined;

    const participants = Array.isArray(room.participants) ? room.participants : [];
    const updatedParticipants = participants.filter((p: any) => p.id !== participantId);
    
    const updatedRoom = { ...room, participants: updatedParticipants };
    this.meetingRooms.set(meetingId, updatedRoom);
    return updatedRoom;
  }

  async endMeetingRoom(meetingId: string): Promise<void> {
    const room = this.meetingRooms.get(meetingId);
    if (room) {
      const updatedRoom = { ...room, isActive: false };
      this.meetingRooms.set(meetingId, updatedRoom);
    }
  }
}

export const storage = new MemStorage();
