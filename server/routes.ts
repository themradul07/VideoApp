import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertMeetingRoomSchema, participantSchema } from "@shared/schema";
import { z } from "zod";

interface WebSocketClient extends WebSocket {
  meetingId?: string;
  participantId?: string;
  participantName?: string;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const rooms = new Map<string, Set<WebSocketClient>>();

  // Create meeting room
  app.post("/api/meetings", async (req, res) => {
    try {
      const { meetingId, hostId, hostName } = insertMeetingRoomSchema.parse(req.body);
      const room = await storage.createMeetingRoom({ meetingId, hostId, hostName });
      res.json(room);
    } catch (error) {
      res.status(400).json({ error: "Invalid meeting room data" });
    }
  });

  // Get meeting room
  app.get("/api/meetings/:meetingId", async (req, res) => {
    try {
      const { meetingId } = req.params;
      const room = await storage.getMeetingRoom(meetingId);
      if (!room) {
        return res.status(404).json({ error: "Meeting room not found" });
      }
      res.json(room);
      
    } catch (error) {
      res.status(500).json({ error: "Failed to get meeting room" });
    }
  });

  // Join meeting room
  app.post("/api/meetings/:meetingId/join", async (req, res) => {
    try {
      const { meetingId } = req.params;
      const participant = participantSchema.parse(req.body);
      
      const room = await storage.getMeetingRoom(meetingId);
      if (!room || !room.isActive) {
        return res.status(404).json({ error: "Meeting room not found or inactive" });
      }

      const updatedRoom = await storage.addParticipant(meetingId, participant);
      res.json(updatedRoom);
    } catch (error) {
      res.status(400).json({ error: "Failed to join meeting room" });
    }
  });

  // Leave meeting room
  app.post("/api/meetings/:meetingId/leave", async (req, res) => {
    try {
      const { meetingId } = req.params;
      const { participantId } = req.body;
      
      const updatedRoom = await storage.removeParticipant(meetingId, participantId);
      if (!updatedRoom) {
        return res.status(404).json({ error: "Meeting room not found" });
      }
      
      res.json(updatedRoom);
    } catch (error) {
      res.status(500).json({ error: "Failed to leave meeting room" });
    }
  });

  // End meeting room
  app.post("/api/meetings/:meetingId/end", async (req, res) => {
    try {
      const { meetingId } = req.params;
      await storage.endMeetingRoom(meetingId);
      
      // Notify all participants that meeting has ended
      const roomClients = rooms.get(meetingId);
      if (roomClients) {
        roomClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'meeting-ended',
              meetingId
            }));
          }
        });
        rooms.delete(meetingId);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to end meeting room" });
    }
  });

  // WebSocket handling for real-time communication
  wss.on('connection', (ws: WebSocketClient) => {
    console.log('New WebSocket connection');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'join-room':
            const { meetingId, participantId, participantName , cameraEnabled, micEnabled } = data;
            console.log(`Participant ${participantId} joining room ${meetingId}`, data);
            ws.meetingId = meetingId;
            ws.participantId = participantId;
            ws.participantName = participantName;
            ws.cameraEnabled = cameraEnabled;
            ws.micEnabled = micEnabled;
            
            if (!rooms.has(meetingId)) {
              rooms.set(meetingId, new Set());
            }
            rooms.get(meetingId)?.add(ws);
            
            // Notify other participants
            broadcastToRoom(meetingId, {
              type: 'participant-joined',
              participant: { id: participantId, name: participantName , cameraEnabled, micEnabled }
            }, ws);
            
            // Send current participants to new user
            const roomClients = rooms.get(meetingId);
            if (roomClients) {
            
              const participants = Array.from(roomClients)
                .filter(client => client !== ws && client.participantId)
                .map(client => ({
                  id: client.participantId,
                  name: client.participantName,
                  cameraEnabled: client.cameraEnabled,
                  micEnabled: client.micEnabled
                }));
                
              
              ws.send(JSON.stringify({
                type: 'room-participants',
                participants
              }));
            }
            break;

          case 'webrtc-offer':
          case 'webrtc-answer':
          case 'webrtc-ice-candidate':
            // Forward WebRTC signaling messages
            const targetClient = findClientByParticipantId(ws.meetingId!, data.targetId);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                ...data,
                fromId: ws.participantId
              }));
            }
            break;

          case 'media-state-change':
            // Broadcast media state changes (mute/unmute, camera on/off)
            console.log(`Participant ${ws.participantId} changed media state`, data);
            broadcastToRoom(ws.meetingId!, {
              type: 'participant-media-change',
              participantId: ws.participantId,
              cameraEnabled: data.cameraEnabled,
              micEnabled: data.micEnabled
            }, ws);
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (ws.meetingId && ws.participantId) {
        const roomClients = rooms.get(ws.meetingId);
        if (roomClients) {
          roomClients.delete(ws);
          
          // Notify other participants
          broadcastToRoom(ws.meetingId, {
            type: 'participant-left',
            participantId: ws.participantId
          }, ws);
          
          // Clean up empty rooms
          if (roomClients.size === 0) {
            rooms.delete(ws.meetingId);
          }
        }
      }
    });
  });

  function broadcastToRoom(meetingId: string, message: any, sender?: WebSocketClient) {
    const roomClients = rooms.get(meetingId);
    if (roomClients) {
      roomClients.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  function findClientByParticipantId(meetingId: string, participantId: string): WebSocketClient | undefined {
    const roomClients = rooms.get(meetingId);
    if (roomClients) {
      return Array.from(roomClients).find(client => client.participantId === participantId);
    }
    return undefined;
  }

  return httpServer;
}
