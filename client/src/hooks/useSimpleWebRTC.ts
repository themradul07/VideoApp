import { useEffect, useState, useRef } from "react";

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
  screenEnabled?: boolean;
}

  async function fetchXirsysIceServers(): Promise<RTCIceServer[]> {
  const username = "themradul07";
  const secret = "5ea51720-5d66-11f0-a9ef-0242ac150003";
  const channel = "MyFirstApp";

  const response = await fetch(`https://global.xirsys.net/_turn/${channel}`, {
    method: "PUT",
    headers: {
      "Authorization": "Basic " + btoa(username + ":" + secret),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ format: "urls" })
  });

  const data = await response.json();
  let iceServers = data.v.iceServers;
  if (!Array.isArray(iceServers)) {
    iceServers = [iceServers];
  }
  return iceServers;
}


// Create a silent audio track
function createSilentAudioTrack() {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const destination = ctx.createMediaStreamDestination();
  oscillator.connect(destination);
  oscillator.start();

  // Stop the oscillator immediately (no sound), but the track remains
  setTimeout(() => {
    oscillator.stop();
    ctx.close();
  }, 100); // 100ms is enough to get a track, but not play a tone

  const track = destination.stream.getAudioTracks()[0];
  track.enabled = false;
  (track as any)._isDummy = true;
  return track;
}


// Create a black video track
function createBlackVideoTrack() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not get 2D context from canvas");
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const stream = canvas.captureStream(5);
  const track = stream.getVideoTracks()[0];
  track.enabled = false;
  // Tag as dummy for easy removal later
  (track as any)._isDummy = true;
  return track;
}



export function useSimpleWebRTC(meetingId: string, userSettings: any) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);



  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const isInitiator = useRef<boolean>(false);
  
  async function renegotiateAllPeers() {
  for (const [id, pc] of Array.from(peerConnections.current.entries())) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (socket && userSettings?.participantId) {
        socket.send(JSON.stringify({
          type: 'webrtc-offer',
          targetId: id,
          offer: offer
        }));
      }
    } catch (e) {
      console.error("Error renegotiating with peer", id, e);
    }
  }
}



  function addTrackToPeers(track: MediaStreamTrack, localStream: MediaStream) {
    if (!localStream.getTracks().find(t => t.id === track.id)) {
      localStream.addTrack(track);
    }
    peerConnections.current.forEach(pc => {
      const alreadySending = pc.getSenders().some(sender => sender.track && sender.track.id === track.id);
      if (!alreadySending) {
        pc.addTrack(track, localStream);
      }
    });
  }

  useEffect(() => {
    if (!meetingId || !userSettings) return;

    const initializeConnection = async () => {
      try {

         // 1. Fetch ICE servers from Xirsys
        const servers = await fetchXirsysIceServers();
        console.log("Fetched ICE servers:", servers);
        setIceServers(servers);
        console.log("ICE servers to use:", iceServers, Array.isArray(iceServers));
        let tracks = [];

        // Handle camera
        if (userSettings.cameraEnabled !== false) {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tracks.push(...camStream.getVideoTracks());
        } else {
          tracks.push(createBlackVideoTrack());
        }

        // Handle mic
        if (userSettings.micEnabled !== false) {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tracks.push(...micStream.getAudioTracks());
        } else {
          tracks.push(createSilentAudioTrack());
        }

        const stream = new MediaStream(tracks);
        setLocalStream(stream);

        setCameraEnabled(userSettings.cameraEnabled !== false);
        setMicEnabled(userSettings.micEnabled !== false);

        // Initialize WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("WebSocket connected");
          
          ws.send(JSON.stringify({
            type: 'join-room',
            meetingId,
            participantId: userSettings.participantId,
            participantName: userSettings.displayName,
            cameraEnabled : userSettings.cameraEnabled !== false,
            micEnabled: userSettings.micEnabled !== false
          }));
        };

        

        ws.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          console.log('Received message:', data); 

          switch (data.type) {
            case 'participant-joined':
              console.log('New participant joined:', data.participant);
              if (data.participant.id !== userSettings.participantId) {

                await createPeerConnection(data.participant.id, stream, ws, true,servers);

                setParticipants(prev => [...prev, data.participant]);
                
              }
           
              break;

            case 'room-participants':
              setParticipants(data.participants.filter((p: any) => p.id !== userSettings.participantId));
              for (const participant of data.participants) {
                if (participant.id !== userSettings.participantId) {
                  await createPeerConnection(participant.id, stream, ws, false,servers);
                }
              }
              break;

            case 'webrtc-offer':
              await handleOffer(data.fromId, data.offer, stream, ws,servers);
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

            case 'participant-media-change':
              // Update participant's media state
              setParticipants(prev =>
                prev.map(p =>
                  p.id === data.participantId
                    ? { ...p, cameraEnabled: data.cameraEnabled, micEnabled: data.micEnabled }
                    : p
                )
              );
              break;

            case 'shared-screen-toogle':
              console.log('Screen sharing toggle received:', data);
              setParticipants(prev =>
                prev.map(p =>
                  p.id === data.participantId
                    ? { ...p, screenEnabled: data.screenEnabled }
                    : p
                )
              );
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

  const createPeerConnection = async (participantId: string, stream: MediaStream, ws: WebSocket, initiator: boolean, iceServers: RTCIceServer[]) => {

    // const pc = new RTCPeerConnection({
    //   iceServers: [
    //     { urls: 'stun:stun.l.google.com:19302' },
    //     { urls: 'stun:stun1.l.google.com:19302' },
    //     { urls: 'stun:stun2.l.google.com:3478' },
    //     {
    //       urls: 'turn:0.tcp.in.ngrok.io:12035?transport=tcp',
    //       username: 'testuser',
    //       credential: 'testpassword'
    //     },
    //   ]
    // });
     const pc = new RTCPeerConnection({ iceServers });

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

  const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit, stream: MediaStream, ws: WebSocket,iceServers: RTCIceServer[]) => {
    let pc = peerConnections.current.get(fromId);

    if (!pc) {
      await createPeerConnection(fromId, stream, ws, false,iceServers);
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

  
const sendMediaStateChange = (camera: boolean, mic: boolean) => {
  if (socket) {
    socket.send(JSON.stringify({
      type: 'media-state-change',
      participantId: userSettings.participantId,
      cameraEnabled: camera,
      micEnabled: mic
    }));
  }
};

//create a function to send details to backend of screen shared
const sendScreenShareState = (screenEnabled: boolean) => {
  if (socket) {
    socket.send(JSON.stringify({
      type: 'shared-screen',
      participantId: userSettings.participantId,
      screenEnabled: screenEnabled
    }));
  }
};

const toggleCamera = async () => {
  if (!localStream) return;

  let videoTrack = localStream.getVideoTracks()[0];

  if (videoTrack && !(videoTrack as any)._isDummy) {
    // Toggle real camera track
    videoTrack.enabled = !videoTrack.enabled;
    setCameraEnabled(videoTrack.enabled);

    // Update localStorage
    const settings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
    settings.cameraEnabled = videoTrack.enabled;
    localStorage.setItem('videoMeetUser', JSON.stringify(settings));
    sendMediaStateChange(videoTrack.enabled, micEnabled);

  } else if (videoTrack && (videoTrack as any)._isDummy) {
    // Remove dummy black track
    localStream.removeTrack(videoTrack);
    peerConnections.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track === videoTrack);
      if (sender) pc.removeTrack(sender);
    });
    // Now get real camera and add
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const realTrack = stream.getVideoTracks()[0];
      localStream.addTrack(realTrack);
      peerConnections.current.forEach(pc => {
        pc.addTrack(realTrack, localStream);
      });
      await renegotiateAllPeers();
      setCameraEnabled(true);

      // Update localStorage
      const settings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
      settings.cameraEnabled = true;
      localStorage.setItem('videoMeetUser', JSON.stringify(settings));
      sendMediaStateChange(true, micEnabled);

    } catch (err) {
      console.error("Error enabling camera:", err);
    }

  } else {
    // No video track at all, just add real camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const realTrack = stream.getVideoTracks()[0];
      localStream.addTrack(realTrack);
      peerConnections.current.forEach(pc => {
        pc.addTrack(realTrack, localStream);
      });
      setCameraEnabled(true);

      // Update localStorage
      const settings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
      settings.cameraEnabled = true;
      localStorage.setItem('videoMeetUser', JSON.stringify(settings));
      sendMediaStateChange(true, micEnabled);

    } catch (err) {
      console.error("Error enabling camera:", err);
    }
  }
};




const toggleMicrophone = async () => {
  if (!localStream) return;

  let audioTrack = localStream.getAudioTracks()[0];

  if (audioTrack && !(audioTrack as any)._isDummy) {
    // Toggle real mic track
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);

    // If disabling, remove real track and add dummy
    if (!audioTrack.enabled) {
      localStream.removeTrack(audioTrack);
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track === audioTrack);
        if (sender) pc.removeTrack(sender);
      });
      // Add dummy silent track
      const dummyTrack = createSilentAudioTrack();
      localStream.addTrack(dummyTrack);
      peerConnections.current.forEach(pc => {
        pc.addTrack(dummyTrack, localStream);
      });
      await renegotiateAllPeers();
    }

    // Update localStorage
    const settings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
    settings.micEnabled = audioTrack.enabled;
    localStorage.setItem('videoMeetUser', JSON.stringify(settings));
    sendMediaStateChange(cameraEnabled, audioTrack.enabled);

  } else if (audioTrack && (audioTrack as any)._isDummy) {
    // Remove dummy audio track
    localStream.removeTrack(audioTrack);
    peerConnections.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track === audioTrack);
      if (sender) pc.removeTrack(sender);
    });
    // Now get real mic and add
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const realTrack = stream.getAudioTracks()[0];
      localStream.addTrack(realTrack);
      peerConnections.current.forEach(pc => {
        pc.addTrack(realTrack, localStream);
      });
      await renegotiateAllPeers();
      setMicEnabled(true);

      // Update localStorage
      const settings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
      settings.micEnabled = true;
      localStorage.setItem('videoMeetUser', JSON.stringify(settings));
      sendMediaStateChange(cameraEnabled, true);

    } catch (err) {
      console.error("Error enabling mic:", err);
    }
  } else {
    // No audio track at all, just add real mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const realTrack = stream.getAudioTracks()[0];
      localStream.addTrack(realTrack);
      peerConnections.current.forEach(pc => {
        pc.addTrack(realTrack, localStream);
      });
      setMicEnabled(true);

      // Update localStorage
      const settings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
      settings.micEnabled = true;
      localStorage.setItem('videoMeetUser', JSON.stringify(settings));
      sendMediaStateChange(cameraEnabled, true);

    } catch (err) {
      console.error("Error enabling mic:", err);
    }
  }
};


  const endCall = () => {
    if (socket && userSettings?.participantId) {
      socket.send(JSON.stringify({
        type: 'leave-room',
        meetingId,
        participantId: userSettings.participantId,
      }));
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    setParticipants([]);

    setTimeout(() => {
      if (socket) {
        socket.close();
      }
    }, 200);
  };


const startScreenShare = async () => {
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    setScreenStream(displayStream);
    setIsScreenSharing(true);

    const screenTrack = displayStream.getVideoTracks()[0];
    peerConnections.current.forEach((pc) => {
      const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
      if (senders.length > 0) {
        senders[0].replaceTrack(screenTrack);
      }
    });
    setLocalStream((prev) => {
      if (!prev) return prev;
      const newStream = new MediaStream([
        screenTrack,
        ...prev.getAudioTracks()
      ]);
      return newStream;
    });

    screenTrack.onended = () => {
      stopScreenShare();
    };
    if(socket){
      socket.send(JSON.stringify({
        type: 'shared-screen',
        participantId: userSettings.participantId,
        screenEnabled: true
      }));

      
    }

  } catch (err) {
    console.error("Error sharing screen:", err);
  }
};

const stopScreenShare = async () => {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    setScreenStream(null);
  }
  setIsScreenSharing(false);

  const cameraStream = await navigator.mediaDevices.getUserMedia({
    video: cameraEnabled,
    audio: micEnabled,
  });

  const cameraTrack = cameraStream.getVideoTracks()[0];
  peerConnections.current.forEach((pc) => {
    const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
    if (senders.length > 0) {
      senders[0].replaceTrack(cameraTrack);
    }
  });
  setLocalStream(cameraStream);
    if(socket){
      socket.send(JSON.stringify({
        type: 'shared-screen',
        participantId: userSettings.participantId,
        screenEnabled: false
      }));
    }

};
  return {
    localStream,
    participants,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMicrophone,
    endCall,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
  };
}