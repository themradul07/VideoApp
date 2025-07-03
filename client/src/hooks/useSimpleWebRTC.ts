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
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const isInitiator = useRef<boolean>(false);

  useEffect(() => {
    if (!meetingId || !userSettings) return;

    const initializeConnection = async () => {
      try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: userSettings.cameraEnabled !== false,
          audio: userSettings.micEnabled !== false
        });
        
        setLocalStream(stream);
        setCameraEnabled(userSettings.cameraEnabled !== false);
        setMicEnabled(userSettings.micEnabled !== false);

        // Initialize WebSocket
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

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          console.log('Received message:', data);

          switch (data.type) {
            case 'participant-joined':
              // New participant joined, initiate connection if we're already in the room
              if (data.participant.id !== userSettings.participantId) {
                await createPeerConnection(data.participant.id, stream, ws, true);
                setParticipants(prev => [...prev, data.participant]);
              }
              break;

            case 'room-participants':
              // Existing participants in the room
              setParticipants(data.participants.filter((p: any) => p.id !== userSettings.participantId));
              // Create connections to existing participants
              for (const participant of data.participants) {
                if (participant.id !== userSettings.participantId) {
                  await createPeerConnection(participant.id, stream, ws, false);
                }
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
        console.error("Error initializing WebRTC:", error);
      }
    };

    initializeConnection();

    return () => {
      // Cleanup
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (socket) {
        socket.close();
      }
    };
  }, [meetingId, userSettings]);

  const createPeerConnection = async (participantId: string, stream: MediaStream, ws: WebSocket, initiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local stream
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle incoming stream
    pc.ontrack = (event) => {
      console.log('Received remote stream from', participantId);
      const remoteStream = event.streams[0];
      setParticipants(prev => 
        prev.map(p => 
          p.id === participantId 
            ? { ...p, stream: remoteStream }
            : p
        )
      );
    };

    // Handle ICE candidates
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

    // If we're the initiator, create and send offer
    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({
          type: 'webrtc-offer',
          targetId: participantId,
          offer: offer
        }));
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  };

  const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit, stream: MediaStream, ws: WebSocket) => {
    let pc = peerConnections.current.get(fromId);
    
    if (!pc) {
      await createPeerConnection(fromId, stream, ws, false);
      pc = peerConnections.current.get(fromId);
    }

    if (pc) {
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        ws.send(JSON.stringify({
          type: 'webrtc-answer',
          targetId: fromId,
          answer: answer
        }));
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    }
  };

  const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(fromId);
    if (pc) {
      try {
        await pc.setRemoteDescription(answer);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  };

  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(fromId);
    if (pc) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
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
        
        // Update localStorage
        const userSettings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
        userSettings.cameraEnabled = videoTrack.enabled;
        localStorage.setItem('videoMeetUser', JSON.stringify(userSettings));
      }
    }
  };

  const toggleMicrophone = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
        
        // Update localStorage
        const userSettings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
        userSettings.micEnabled = audioTrack.enabled;
        localStorage.setItem('videoMeetUser', JSON.stringify(userSettings));
      }
    }
  };

  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
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