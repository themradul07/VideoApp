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
        // Get user settings for initial camera/mic state
        const userSettings = JSON.parse(localStorage.getItem('videoMeetUser') || '{}');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: userSettings.cameraEnabled !== false,
          audio: userSettings.micEnabled !== false
        });
        
        // Set initial states based on user settings
        setCameraEnabled(userSettings.cameraEnabled !== false);
        setMicEnabled(userSettings.micEnabled !== false);
        
        setLocalStream(stream);
        
        // Don't create WebRTCManager here as it conflicts with the main socket
        // We'll handle WebRTC signaling through the main socket connection
        console.log('Local stream initialized:', stream);
        
      } catch (error) {
        console.error("Error initializing WebRTC:", error);
      }
    };

    initWebRTC();

    return () => {
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
