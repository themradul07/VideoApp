import { useEffect, useState } from "react";

export function useSocket(meetingId: string, userSettings: any) {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!meetingId || !userSettings) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      // Join the meeting room
      ws.send(JSON.stringify({
        type: 'join-room',
        meetingId,
        participantId: userSettings.participantId,
        participantName: userSettings.displayName
      }));
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [meetingId, userSettings]);

  return { socket };
}
