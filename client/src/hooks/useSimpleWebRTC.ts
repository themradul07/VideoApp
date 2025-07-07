import { useEffect, useState, useRef } from "react";

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
}

  async function fetchXirsysIceServers(): Promise<RTCIceServer[]> {
  const username = "muskey";
  const secret = "382a05e2-595b-11f0-9e9e-0242ac150003";
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
  // Defensive: Ensure iceServers is always an array
  let iceServers = data.v.iceServers;
  if (!Array.isArray(iceServers)) {
    // If it's a single object, wrap it in an array
    iceServers = [iceServers];
  }
  return iceServers;
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
  
  


  function addTrackToPeers(track: MediaStreamTrack, localStream: MediaStream) {
    // Add to local stream if not present
    if (!localStream.getTracks().find(t => t.id === track.id)) {
      localStream.addTrack(track);
    }
    // Add to all peer connections
    peerConnections.current.forEach(pc => {
      // Only add if not already sending this track
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
        // Get user media
        let stream;
        if (userSettings.cameraEnabled !== false || userSettings.micEnabled !== false) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: userSettings.cameraEnabled !== false,
            audio: userSettings.micEnabled !== false
          });
        } else {
          // Create an empty MediaStream if both are off
          stream = new MediaStream();
        }
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
              // New participant joined, initiate connection if we're already in the room
              console.log('New participant joined:', data.participant);
              if (data.participant.id !== userSettings.participantId) {

                await createPeerConnection(data.participant.id, stream, ws, true,servers);

                setParticipants(prev => [...prev, data.participant]);
                
              }
           
              break;

            case 'room-participants':
              // Existing participants in the room
              setParticipants(data.participants.filter((p: any) => p.id !== userSettings.participantId));
              
              // Create connections to existing participants
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

const toggleCamera = async () => {
  if (!localStream) return;

  let videoTrack = localStream.getVideoTracks()[0];

  if (videoTrack) {
    // Toggle enabled
    videoTrack.enabled = !videoTrack.enabled;
    setCameraEnabled(videoTrack.enabled);
    sendMediaStateChange(videoTrack.enabled, micEnabled);
  } else {
    // No video track: get one and add it
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoTrack = stream.getVideoTracks()[0];
      addTrackToPeers(videoTrack, localStream);
      setCameraEnabled(true);
      sendMediaStateChange(true, micEnabled);
    } catch (err) {
      console.error("Error enabling camera:", err);
    }
  }
};


const toggleMicrophone = async () => {
  if (!localStream) return;

  let audioTrack = localStream.getAudioTracks()[0];

  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);
    sendMediaStateChange(cameraEnabled, audioTrack.enabled);
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioTrack = stream.getAudioTracks()[0];
      addTrackToPeers(audioTrack, localStream);
      setMicEnabled(true);
      sendMediaStateChange(cameraEnabled, true);
    } catch (err) {
      console.error("Error enabling mic:", err);
    }
  }
};


  const endCall = () => {
    // 1. Notify server and others
    if (socket && userSettings?.participantId) {
      socket.send(JSON.stringify({
        type: 'leave-room',
        meetingId,
        participantId: userSettings.participantId,
      }));
    }

    // 2. Stop local media
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);

    // 3. Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    // 4. Clear participants
    setParticipants([]);

    // 5. Optionally close socket after a short delay to ensure message is sent
    setTimeout(() => {
      if (socket) {
        socket.close();
      }
    }, 200);
  };



  // Start screen sharing
const startScreenShare = async () => {
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    setScreenStream(displayStream);
    setIsScreenSharing(true);

    // Replace the video track in all peer connections
    const screenTrack = displayStream.getVideoTracks()[0];
    peerConnections.current.forEach((pc) => {
      const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
      if (senders.length > 0) {
        senders[0].replaceTrack(screenTrack);
      }
    });

    // Replace local video track for local preview
    setLocalStream((prev) => {
      if (!prev) return prev;
      const newStream = new MediaStream([
        screenTrack,
        ...prev.getAudioTracks()
      ]);
      return newStream;
    });

    // When user stops sharing from browser UI
    screenTrack.onended = () => {
      stopScreenShare();
    };
  } catch (err) {
    console.error("Error sharing screen:", err);
  }
};

// Stop screen sharing and revert to camera
const stopScreenShare = async () => {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    setScreenStream(null);
  }
  setIsScreenSharing(false);

  // Get camera again
  const cameraStream = await navigator.mediaDevices.getUserMedia({
    video: cameraEnabled,
    audio: micEnabled,
  });

  // Replace the video track in all peer connections
  const cameraTrack = cameraStream.getVideoTracks()[0];
  peerConnections.current.forEach((pc) => {
    const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
    if (senders.length > 0) {
      senders[0].replaceTrack(cameraTrack);
    }
  });

  // Update local stream for preview
  setLocalStream(cameraStream);
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














// import { useEffect, useState, useRef } from "react";

// interface Participant {
//   id: string;
//   name: string;
//   stream?: MediaStream;
//   cameraEnabled?: boolean;
//   micEnabled?: boolean;
// }

// async function fetchXirsysIceServers(): Promise<RTCIceServer[]> {
//   const username = "muskey";
//   const secret = "382a05e2-595b-11f0-9e9e-0242ac150003";
//   const channel = "MyFirstApp";

//   const response = await fetch(`https://global.xirsys.net/_turn/${channel}`, {
//     method: "PUT",
//     headers: {
//       "Authorization": "Basic " + btoa(username + ":" + secret),
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify({ format: "urls" })
//   });

//   const data = await response.json();
//   // Defensive: Ensure iceServers is always an array
//   let iceServers = data.v.iceServers;
//   if (!Array.isArray(iceServers)) {
//     // If it's a single object, wrap it in an array
//     iceServers = [iceServers];
//   }
//   return iceServers;
// }

// // Custom React hook for managing a simple WebRTC video meeting room
// // meetingId: unique ID for the meeting room
// // userSettings: user preferences and info (camera/mic state, participantId, displayName)
// export function useSimpleWebRTC(meetingId: string, userSettings: any) {
//   // Local user's media stream (camera/mic/screen)
//   const [localStream, setLocalStream] = useState<MediaStream | null>(null);
//   // List of remote participants in the meeting
//   const [participants, setParticipants] = useState<Participant[]>([]);
//   // State for local camera (true = on, false = off)
//   const [cameraEnabled, setCameraEnabled] = useState(true);
//   // State for local microphone (true = on, false = off)
//   const [micEnabled, setMicEnabled] = useState(true);
//   // WebSocket connection for signaling
//   const [socket, setSocket] = useState<WebSocket | null>(null);
//   // State for screen sharing (true = sharing screen)
//   const [isScreenSharing, setIsScreenSharing] = useState(false);
//   // MediaStream for screen sharing
//   const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

//   // Map of participantId to RTCPeerConnection (for each remote peer)
//   const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
//   // Store ICE servers in ref to avoid stale closures
//   const iceServersRef = useRef<RTCIceServer[]>([]);

//   // Helper: Add a media track to all peer connections and local stream if not already present
//   function addTrackToPeers(track: MediaStreamTrack, localStream: MediaStream) {
//     // Add to local stream if not present
//     if (!localStream.getTracks().find(t => t.id === track.id)) {
//       localStream.addTrack(track);
//     }
//     // Add to all peer connections
//     peerConnections.current.forEach(pc => {
//       // Only add if not already sending this track
//       const alreadySending = pc.getSenders().some(sender => sender.track && sender.track.id === track.id);
//       if (!alreadySending) {
//         pc.addTrack(track, localStream);
//       }
//     });
//   }

//   const createPeerConnection = async (participantId: string, stream: MediaStream, ws: WebSocket, initiator: boolean) => {
//     const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

//     // Add local stream
//     stream.getTracks().forEach(track => {
//       pc.addTrack(track, stream);
//     });

//     // Handle incoming stream
//     pc.ontrack = (event) => {
//       console.log('Received remote stream from', participantId);
//       const remoteStream = event.streams[0];
//       setParticipants(prev =>
//         prev.map(p =>
//           p.id === participantId
//             ? { ...p, stream: remoteStream }
//             : p
//         )
//       );
//     };

//     // Handle ICE candidates
//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         ws.send(JSON.stringify({
//           type: 'webrtc-ice-candidate',
//           targetId: participantId,
//           candidate: event.candidate
//         }));
//       }
//     };

//     peerConnections.current.set(participantId, pc);

//     // If we're the initiator, create and send offer
//     if (initiator) {
//       try {
//         const offer = await pc.createOffer();
//         await pc.setLocalDescription(offer);
//         ws.send(JSON.stringify({
//           type: 'webrtc-offer',
//           targetId: participantId,
//           offer: offer
//         }));
//       } catch (error) {
//         console.error('Error creating offer:', error);
//       }
//     }
//   };

//   const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit, stream: MediaStream, ws: WebSocket) => {
//     let pc = peerConnections.current.get(fromId);

//     if (!pc) {
//       await createPeerConnection(fromId, stream, ws, false);
//       pc = peerConnections.current.get(fromId);
//     }

//     if (pc) {
//       try {
//         await pc.setRemoteDescription(offer);
//         const answer = await pc.createAnswer();
//         await pc.setLocalDescription(answer);

//         ws.send(JSON.stringify({
//           type: 'webrtc-answer',
//           targetId: fromId,
//           answer: answer
//         }));
//       } catch (error) {
//         console.error('Error handling offer:', error);
//       }
//     }
//   };

//   const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit) => {
//     const pc = peerConnections.current.get(fromId);
//     if (pc) {
//       try {
//         await pc.setRemoteDescription(answer);
//       } catch (error) {
//         console.error('Error handling answer:', error);
//       }
//     }
//   };

//   const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
//     const pc = peerConnections.current.get(fromId);
//     if (pc) {
//       try {
//         await pc.addIceCandidate(candidate);
//       } catch (error) {
//         console.error('Error adding ICE candidate:', error);
//       }
//     }
//   };

//   const handleParticipantLeft = (participantId: string) => {
//     const pc = peerConnections.current.get(participantId);
//     if (pc) {
//       pc.close();
//       peerConnections.current.delete(participantId);
//     }
//     setParticipants(prev => prev.filter(p => p.id !== participantId));
//   };

//   const sendMediaStateChange = (camera: boolean, mic: boolean) => {
//     if (socket) {
//       socket.send(JSON.stringify({
//         type: 'media-state-change',
//         participantId: userSettings.participantId,
//         cameraEnabled: camera,
//         micEnabled: mic
//       }));
//     }
//   };

//   const toggleCamera = async () => {
//     if (!localStream) return;

//     let videoTrack = localStream.getVideoTracks()[0];

//     if (videoTrack) {
//       // Toggle enabled
//       videoTrack.enabled = !videoTrack.enabled;
//       setCameraEnabled(videoTrack.enabled);
//       sendMediaStateChange(videoTrack.enabled, micEnabled); // Fixed parameter order
//       console.log("toggle camera");
//     } else {
//       // No video track: get one and add it
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video: true });
//         videoTrack = stream.getVideoTracks()[0];
//         addTrackToPeers(videoTrack, localStream);
//         setCameraEnabled(true);
//         sendMediaStateChange(true, micEnabled); // Fixed parameter order
//       } catch (err) {
//         console.error("Error enabling camera:", err);
//       }
//     }
//   };

//   const toggleMicrophone = async () => {
//     if (!localStream) return;

//     let audioTrack = localStream.getAudioTracks()[0];

//     if (audioTrack) {
//       audioTrack.enabled = !audioTrack.enabled;
//       setMicEnabled(audioTrack.enabled);
//       sendMediaStateChange(cameraEnabled, audioTrack.enabled);
//       console.log("toggle microphone");
//     } else {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//         audioTrack = stream.getAudioTracks()[0];
//         addTrackToPeers(audioTrack, localStream);
//         setMicEnabled(true);
//         sendMediaStateChange(cameraEnabled, true);
//       } catch (err) {
//         console.error("Error enabling mic:", err);
//       }
//     }
//   };

//   const endCall = () => {
//     // 1. Notify server and others
//     if (socket && userSettings?.participantId) {
//       socket.send(JSON.stringify({
//         type: 'leave-room',
//         meetingId,
//         participantId: userSettings.participantId,
//       }));
//     }

//     // 2. Stop local media
//     if (localStream) {
//       localStream.getTracks().forEach(track => track.stop());
//     }
//     setLocalStream(null);

//     // 3. Stop screen sharing if active
//     if (screenStream) {
//       screenStream.getTracks().forEach(track => track.stop());
//       setScreenStream(null);
//     }
//     setIsScreenSharing(false);

//     // 4. Close all peer connections
//     peerConnections.current.forEach(pc => pc.close());
//     peerConnections.current.clear();

//     // 5. Clear participants
//     setParticipants([]);

//     // 6. Optionally close socket after a short delay to ensure message is sent
//     setTimeout(() => {
//       if (socket) {
//         socket.close();
//       }
//     }, 200);
//   };

//   // Start screen sharing
//   const startScreenShare = async () => {
//     try {
//       const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
//       setScreenStream(displayStream);
//       setIsScreenSharing(true);

//       // Replace the video track in all peer connections
//       const screenTrack = displayStream.getVideoTracks()[0];
//       peerConnections.current.forEach((pc) => {
//         const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
//         if (senders.length > 0) {
//           senders[0].replaceTrack(screenTrack);
//         }
//       });

//       // Replace local video track for local preview
//       setLocalStream((prev) => {
//         if (!prev) return prev;
//         const newStream = new MediaStream([
//           screenTrack,
//           ...prev.getAudioTracks()
//         ]);
//         return newStream;
//       });

//       // When user stops sharing from browser UI
//       screenTrack.onended = () => {
//         stopScreenShare();
//       };
//     } catch (err) {
//       console.error("Error sharing screen:", err);
//     }
//   };

//   // Stop screen sharing and revert to camera
//   const stopScreenShare = async () => {
//     if (screenStream) {
//       screenStream.getTracks().forEach(track => track.stop());
//       setScreenStream(null);
//     }
//     setIsScreenSharing(false);

//     try {
//       // Get camera again
//       const cameraStream = await navigator.mediaDevices.getUserMedia({
//         video: cameraEnabled,
//         audio: micEnabled,
//       });

//       // Replace the video track in all peer connections
//       const cameraTrack = cameraStream.getVideoTracks()[0];
//       peerConnections.current.forEach((pc) => {
//         const senders = pc.getSenders().filter(s => s.track && s.track.kind === 'video');
//         if (senders.length > 0) {
//           senders[0].replaceTrack(cameraTrack);
//         }
//       });

//       // Update local stream for preview
//       setLocalStream(cameraStream);
//     } catch (err) {
//       console.error("Error reverting to camera:", err);
//     }
//   };

//   // React effect: runs when meetingId or userSettings change
//   useEffect(() => {
//     // If no meetingId or userSettings, do nothing
//     if (!meetingId || !userSettings) return;

//     // Function to initialize WebRTC and signaling
//     const initializeConnection = async () => {
//       try {
//         // 1. Fetch ICE servers from Xirsys (for NAT traversal)
//         const servers = await fetchXirsysIceServers();
//         console.log("Fetched ICE servers:", servers);
//         iceServersRef.current = servers; // Store in ref instead of state

//         // 2. Get user media (camera/mic)
//         let stream;
//         if (userSettings.cameraEnabled !== false || userSettings.micEnabled !== false) {
//           // If either camera or mic is enabled, get the stream
//           stream = await navigator.mediaDevices.getUserMedia({
//             video: userSettings.cameraEnabled !== false,
//             audio: userSettings.micEnabled !== false
//           });
//         } else {
//           // If both are off, create an empty stream
//           stream = new MediaStream();
//         }
//         setLocalStream(stream);
//         setCameraEnabled(userSettings.cameraEnabled !== false);
//         setMicEnabled(userSettings.micEnabled !== false);

//         // 3. Initialize WebSocket for signaling
//         const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
//         const wsUrl = ${protocol}//${window.location.host}/ws;
//         const ws = new WebSocket(wsUrl);

//         // On WebSocket open, join the meeting room
//         ws.onopen = () => {
//           console.log("WebSocket connected");
//           ws.send(JSON.stringify({
//             type: 'join-room',
//             meetingId,
//             participantId: userSettings.participantId,
//             participantName: userSettings.displayName,
//             cameraEnabled: userSettings.cameraEnabled !== false,
//             micEnabled: userSettings.micEnabled !== false
//           }));
//         };

//         // On WebSocket message, handle signaling and participant events
//         ws.onmessage = async (event) => {
//           const data = JSON.parse(event.data);
//           console.log('Received message:', data);

//           switch (data.type) {
//             case 'participant-joined':
//               // New participant joined, create a peer connection
//               console.log('New participant joined:', data.participant);
//               if (data.participant.id !== userSettings.participantId) {
//                 await createPeerConnection(data.participant.id, stream, ws, true);
//                 setParticipants(prev => [...prev, data.participant]);
//               }
//               break;
//             case 'room-participants':
//               // List of existing participants in the room
//               setParticipants(data.participants.filter((p: any) => p.id !== userSettings.participantId));
//               // Create connections to existing participants
//               for (const participant of data.participants) {
//                 if (participant.id !== userSettings.participantId) {
//                   await createPeerConnection(participant.id, stream, ws, false);
//                 }
//               }
//               break;
//             case 'webrtc-offer':
//               // Received WebRTC offer from another participant
//               await handleOffer(data.fromId, data.offer, stream, ws);
//               break;
//             case 'webrtc-answer':
//               // Received WebRTC answer
//               await handleAnswer(data.fromId, data.answer);
//               break;
//             case 'webrtc-ice-candidate':
//               // Received ICE candidate
//               await handleIceCandidate(data.fromId, data.candidate);
//               break;
//             case 'participant-left':
//               // A participant left the room
//               handleParticipantLeft(data.participantId);
//               break;
//             case 'participant-media-change':
//               // Update participant's media state (camera/mic)
//               setParticipants(prev =>
//                 prev.map(p =>
//                   p.id === data.participantId
//                     ? { ...p, cameraEnabled: data.cameraEnabled, micEnabled: data.micEnabled }
//                     : p
//                 )
//               );
//               break;
//           }
//         };

//         setSocket(ws);
//       } catch (error) {
//         // Log any error during initialization
//         console.error("Error initializing WebRTC:", error);
//       }
//     };

//     // Call the initialization function
//     initializeConnection();

//     // Cleanup function: close all peer connections, stop local media, close socket
//     return () => {
//       peerConnections.current.forEach(pc => pc.close());
//       peerConnections.current.clear();
//       if (localStream) {
//         localStream.getTracks().forEach(track => track.stop());
//       }
//       if (screenStream) {
//         screenStream.getTracks().forEach(track => track.stop());
//       }
//       if (socket) {
//         socket.close();
//       }
//     };
//   }, [meetingId, userSettings]);

//   return {
//     localStream,
//     participants,
//     cameraEnabled,
//     micEnabled,
//     toggleCamera,
//     toggleMicrophone,
//     endCall,
//     isScreenSharing,
//     startScreenShare,
//     stopScreenShare,
//   };
// }
