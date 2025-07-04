import { useEffect, useState, useRef } from "react";

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
}

function createSilentAudioTrack() {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const dst = oscillator.connect(ctx.createMediaStreamDestination());
  oscillator.start();
  return dst.stream.getAudioTracks()[0];
}

function createBlackVideoTrack() {
  const canvas = Object.assign(document.createElement("canvas"), { width: 640, height: 480 });
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.fillRect(0, 0, canvas.width, canvas.height);
  const stream = canvas.captureStream();
  return stream.getVideoTracks()[0];
}

export function useSimpleWebRTC(meetingId: string, userSettings: any) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    if (!meetingId || !userSettings) return;

    const initializeConnection = async () => {
      try {
        let stream: MediaStream;

        if (!userSettings.cameraEnabled && !userSettings.micEnabled) {
          stream = new MediaStream();
          stream.addTrack(createBlackVideoTrack());
          stream.addTrack(createSilentAudioTrack());
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: userSettings.cameraEnabled !== false,
            audio: userSettings.micEnabled !== false
          });
        }

        setLocalStream(stream);
        setCameraEnabled(userSettings.cameraEnabled !== false);
        setMicEnabled(userSettings.micEnabled !== false);

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);

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
          switch (data.type) {
            case 'participant-joined':
              if (data.participant.id !== userSettings.participantId) {
                await createPeerConnection(data.participant.id, stream, ws, true);
                setParticipants(prev => [...prev, data.participant]);
              }
              break;

            case 'room-participants':
              const others = data.participants.filter((p: any) => p.id !== userSettings.participantId);
              setParticipants(others);
              for (const participant of others) {
                await createPeerConnection(participant.id, stream, ws, false);
              }
              break;

            case 'webrtc-offer':
              await handleOffer(data.fromId, data.offer, stream, ws);
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

        setSocket(ws);
      } catch (error) {
        console.error("WebRTC Initialization Error:", error);
      }
    };

    initializeConnection();

    return () => {
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      localStream?.getTracks().forEach(track => track.stop());
      socket?.close();
    };
  }, [meetingId, userSettings]);

  const createPeerConnection = async (participantId: string, stream: MediaStream, ws: WebSocket, initiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:3478' },
        {
          urls: 'turn:0.tcp.in.ngrok.io:12035?transport=tcp',
          username: 'testuser',
          credential: 'testpassword'
        },
      ]
    });

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setParticipants(prev =>
        prev.map(p => (p.id === participantId ? { ...p, stream: remoteStream } : p))
      );
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: 'webrtc-ice-candidate',
          targetId: participantId,
          candidate: event.candidate
        }));
      }
    };

    peerConnections.current.set(participantId, pc);

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({
        type: 'webrtc-offer',
        targetId: participantId,
        offer
      }));
    }
  };

  const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit, stream: MediaStream, ws: WebSocket) => {
    await createPeerConnection(fromId, stream, ws, false);
    const pc = peerConnections.current.get(fromId);
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
    if (pc) {
      pc.close();
      peerConnections.current.delete(participantId);
    }
    setParticipants(prev => prev.filter(p => p.id !== participantId));
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
        const settings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
        settings.cameraEnabled = videoTrack.enabled;
        localStorage.setItem('videoMeetUser', JSON.stringify(settings));
      }
    }
  };

  const toggleMicrophone = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
        const settings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
        settings.micEnabled = audioTrack.enabled;
        localStorage.setItem('videoMeetUser', JSON.stringify(settings));
      }
    }
  };

  const endCall = () => {
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setParticipants([]);
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
  };

  return {
    localStream,
    participants,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMicrophone,
    endCall
  };
}
