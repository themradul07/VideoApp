interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export class WebRTCManager {
  private meetingId: string;
  private localStream: MediaStream;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private socket: WebSocket | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  private config: WebRTCConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  constructor(meetingId: string, localStream: MediaStream) {
    this.meetingId = meetingId;
    this.localStream = localStream;
    this.initializeSocket();
  }

  private initializeSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("WebRTC WebSocket connected");
      // Join the room to start receiving peer events
      if (this.socket) {
        this.socket.send(JSON.stringify({
          type: 'join-room',
          meetingId: this.meetingId,
          participantId: `webrtc-${Math.random().toString(36).substr(2, 9)}`,
          participantName: 'WebRTC Client'
        }));
      }
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleSignalingMessage(data);
    };

    this.socket.onclose = () => {
      console.log("WebRTC WebSocket disconnected");
    };
  }

  private handleSignalingMessage(data: any) {
    switch (data.type) {
      case 'participant-joined':
        this.createPeerConnection(data.participant.id);
        break;
        
      case 'participant-left':
        this.removePeerConnection(data.participantId);
        break;
        
      case 'webrtc-offer':
        this.handleOffer(data.fromId, data.offer);
        break;
        
      case 'webrtc-answer':
        this.handleAnswer(data.fromId, data.answer);
        break;
        
      case 'webrtc-ice-candidate':
        this.handleIceCandidate(data.fromId, data.candidate);
        break;
    }
  }

  private createPeerConnection(participantId: string) {
    const peerConnection = new RTCPeerConnection(this.config);
    
    // Add local stream tracks
    this.localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, this.localStream);
    });

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      this.emit('remoteStream', participantId, remoteStream);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'webrtc-ice-candidate',
          targetId: participantId,
          candidate: event.candidate
        }));
      }
    };

    this.peerConnections.set(participantId, peerConnection);

    // Create and send offer
    this.createOffer(participantId);
  }

  private async createOffer(participantId: string) {
    const peerConnection = this.peerConnections.get(participantId);
    if (!peerConnection || !this.socket) return;

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.socket.send(JSON.stringify({
        type: 'webrtc-offer',
        targetId: participantId,
        offer: offer
      }));
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  }

  private async handleOffer(fromId: string, offer: RTCSessionDescriptionInit) {
    let peerConnection = this.peerConnections.get(fromId);
    
    if (!peerConnection) {
      peerConnection = new RTCPeerConnection(this.config);
      this.peerConnections.set(fromId, peerConnection);
      
      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        peerConnection!.addTrack(track, this.localStream);
      });

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        const remoteStream = event.streams[0];
        this.emit('remoteStream', fromId, remoteStream);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.socket) {
          this.socket.send(JSON.stringify({
            type: 'webrtc-ice-candidate',
            targetId: fromId,
            candidate: event.candidate
          }));
        }
      };
    }

    try {
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      if (this.socket) {
        this.socket.send(JSON.stringify({
          type: 'webrtc-answer',
          targetId: fromId,
          answer: answer
        }));
      }
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }

  private async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit) {
    const peerConnection = this.peerConnections.get(fromId);
    if (!peerConnection) return;

    try {
      await peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  }

  private async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit) {
    const peerConnection = this.peerConnections.get(fromId);
    if (!peerConnection) return;

    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  }

  private removePeerConnection(participantId: string) {
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
      this.emit('participantLeft', participantId);
    }
  }

  public on(event: string, callback: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
  }

  private emit(event: string, ...args: any[]) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  public cleanup() {
    this.peerConnections.forEach(peerConnection => {
      peerConnection.close();
    });
    this.peerConnections.clear();
    
    if (this.socket) {
      this.socket.close();
    }
    
    this.eventHandlers.clear();
  }
}
