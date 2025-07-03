import { useEffect, useState, useRef } from "react";

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
}

export function useSimpleWebRTC(meetingId: string, userSettings: any) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const socketRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    if (!meetingId || !userSettings) return;

    let isMounted = true;

    const setupWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: userSettings.cameraEnabled !== false,
          audio: userSettings.micEnabled !== false,
        });

        if (!isMounted) return;

        setLocalStream(stream);
        setCameraEnabled(userSettings.cameraEnabled !== false);
        setMicEnabled(userSettings.micEnabled !== false);

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'join-room',
            meetingId,
            participantId: userSettings.participantId,
            participantName: userSettings.displayName
          }));
        };

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          const { type } = data;

          switch (type) {
            case 'participant-joined':
              if (data.participant.id !== userSettings.participantId) {
                await createPeerConnection(data.participant.id, stream, true);
                setParticipants(prev =>
                  prev.find(p => p.id === data.participant.id) ? prev : [...prev, data.participant]
                );
              }
              break;

            case 'room-participants':
              const otherParticipants = data.participants.filter(
                (p: any) => p.id !== userSettings.participantId
              );
              setParticipants(otherParticipants);
              for (const participant of otherParticipants) {
                await createPeerConnection(participant.id, stream, false);
              }
              break;

            case 'webrtc-offer':
              await handleOffer(data.fromId, data.offer, stream);
              break;

            case 'webrtc-answer':
              await handleAnswer(data.fromId, data.answer);
              break;

            case 'webrtc-ice-candidate':
              await handleIceCandidate(data.fromId, data.candidate);
              break;

            case 'participant-left':
              handleParticipantLeft(data.participantId);
              break;
          }
        };

        ws.onerror = (err) => console.error("WebSocket error:", err);
        ws.onclose = () => console.log("WebSocket disconnected");

      } catch (err) {
        console.error("WebRTC setup failed:", err);
      }
    };

    setupWebRTC();

    return () => {
      isMounted = false;
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      localStream?.getTracks().forEach(track => track.stop());
      socketRef.current?.close();
    };
  }, [meetingId, userSettings]);

  const createPeerConnection = async (
    participantId: string,
    stream: MediaStream,
    initiator: boolean
  ) => {
    const ws = socketRef.current;
    if (!ws) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: 'turn:0.tcp.in.ngrok.io:12035?transport=tcp',
          username: 'testuser',
          credential: 'testpassword'
        },
      ]
    });

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setParticipants(prev =>
        prev.map(p =>
          p.id === participantId ? { ...p, stream: remoteStream } : p
        )
      );
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: 'webrtc-ice-candidate',
          targetId: participantId,
          candidate: event.candidate,
        }));
      }
    };

    peerConnections.current.set(participantId, pc);

    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({
          type: 'webrtc-offer',
          targetId: participantId,
          offer,
        }));
      } catch (err) {
        console.error("Offer error:", err);
      }
    }
  };

  const handleOffer = async (
    fromId: string,
    offer: RTCSessionDescriptionInit,
    stream: MediaStream
  ) => {
    const ws = socketRef.current;
    if (!ws) return;

    let pc = peerConnections.current.get(fromId);
    if (!pc) {
      await createPeerConnection(fromId, stream, false);
      pc = peerConnections.current.get(fromId);
    }

    if (pc) {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({
        type: 'webrtc-answer',
        targetId: fromId,
        answer
      }));
    }
  };

  const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(fromId);
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  };

  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(fromId);
    if (pc) {
      await pc.addIceCandidate(candidate);
    }
  };

  const handleParticipantLeft = (participantId: string) => {
    const pc = peerConnections.current.get(participantId);
    if (pc) pc.close();
    peerConnections.current.delete(participantId);
    setParticipants(prev => prev.filter(p => p.id !== participantId));
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
        updateLocalUserSettings({ cameraEnabled: videoTrack.enabled });
      }
    }
  };

  const toggleMicrophone = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
        updateLocalUserSettings({ micEnabled: audioTrack.enabled });
      }
    }
  };

  const updateLocalUserSettings = (updates: Partial<typeof userSettings>) => {
    const settings = JSON.parse(localStorage.getItem("videoMeetUser") || "{}");
    const newSettings = { ...settings, ...updates };
    localStorage.setItem("videoMeetUser", JSON.stringify(newSettings));
  };

  const endCall = () => {
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setParticipants([]);
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    socketRef.current?.close();
  };

  return {
    localStream,
    participants,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMicrophone,
    endCall,
  };
}
