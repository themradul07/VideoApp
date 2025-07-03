import { useEffect, useState, useRef } from "react";
import { WebRTCManager } from "@/lib/webrtc";

export function useWebRTC(meetingId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  useEffect(() => {
    if (!meetingId) return;

    const initWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        setLocalStream(stream);
        
        const manager = new WebRTCManager(meetingId, stream);
        webrtcManagerRef.current = manager;
        
        manager.on('remoteStream', (participantId: string, stream: MediaStream) => {
          setRemoteStreams(prev => ({
            ...prev,
            [participantId]: stream
          }));
        });
        
        manager.on('participantLeft', (participantId: string) => {
          setRemoteStreams(prev => {
            const newStreams = { ...prev };
            delete newStreams[participantId];
            return newStreams;
          });
        });
        
      } catch (error) {
        console.error("Error initializing WebRTC:", error);
      }
    };

    initWebRTC();

    return () => {
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.cleanup();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [meetingId]);

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleMicrophone = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.cleanup();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStreams({});
  };

  return {
    localStream,
    remoteStreams,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMicrophone,
    endCall
  };
}
