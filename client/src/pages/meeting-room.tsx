import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Share, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import VideoTile from "@/components/VideoTile";
import MeetingControls from "@/components/MeetingControls";
import InviteModal from "@/components/InviteModal";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useSocket } from "@/hooks/useSocket";

export default function MeetingRoom() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const meetingId = params.meetingId;

  // Load user settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('videoMeetUser');
    if (savedSettings) {
      setUserSettings(JSON.parse(savedSettings));
    } else {
      // Redirect to join page if no settings found
      setLocation(`/join/${meetingId}`);
    }
  }, [meetingId, setLocation]);

  // Fetch meeting data
  const { data: meeting, isLoading, error } = useQuery({
    queryKey: [`/api/meetings/${meetingId}`],
    enabled: !!meetingId,
  });

  // Initialize WebRTC and Socket connections
  const { localStream, remoteStreams, toggleCamera, toggleMicrophone, endCall } = useWebRTC(meetingId!);
  const { socket } = useSocket(meetingId!, userSettings);

  // Handle socket events
  useEffect(() => {
    if (!socket) return;

    socket.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'participant-joined':
          setParticipants(prev => [...prev, data.participant]);
          toast({
            title: "Participant joined",
            description: `${data.participant.name} joined the meeting`,
          });
          break;
          
        case 'participant-left':
          setParticipants(prev => prev.filter(p => p.id !== data.participantId));
          toast({
            title: "Participant left",
            description: "A participant left the meeting",
          });
          break;
          
        case 'room-participants':
          setParticipants(data.participants);
          break;
          
        case 'meeting-ended':
          toast({
            title: "Meeting ended",
            description: "The meeting has been ended by the host",
          });
          setLocation('/');
          break;
      }
    });
  }, [socket, toast, setLocation]);

  const handleEndCall = () => {
    endCall();
    setLocation('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading meeting...</div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Meeting not found</h2>
          <p className="text-gray-400 mb-4">The meeting you're looking for doesn't exist or has ended.</p>
          <Button onClick={() => setLocation('/')} className="bg-blue-600 hover:bg-blue-700">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-white">VideoMeet</h1>
          <span className="text-gray-400 text-sm">Meeting ID: {meetingId}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowInviteModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Share className="mr-2 h-4 w-4" />
            Share
          </Button>
          <div className="text-gray-400 text-sm flex items-center">
            <Users className="mr-1 h-4 w-4" />
            {participants.length + 1} participants
          </div>
        </div>
      </header>

      {/* Video Grid */}
      <main className="flex-1 p-4 overflow-hidden">
        <div className="grid gap-4 h-full" style={{
          gridTemplateColumns: participants.length === 0 ? '1fr' : 
                              participants.length === 1 ? 'repeat(2, 1fr)' :
                              participants.length <= 3 ? 'repeat(2, 1fr)' :
                              'repeat(3, 1fr)'
        }}>
          {/* Local video */}
          <VideoTile
            stream={localStream}
            participantName={userSettings?.displayName || 'You'}
            isLocal={true}
            cameraEnabled={userSettings?.cameraEnabled}
            micEnabled={userSettings?.micEnabled}
          />
          
          {/* Remote videos */}
          {participants.map((participant) => (
            <VideoTile
              key={participant.id}
              stream={remoteStreams[participant.id]}
              participantName={participant.name}
              isLocal={false}
              cameraEnabled={participant.cameraEnabled}
              micEnabled={participant.micEnabled}
            />
          ))}
        </div>
      </main>

      {/* Floating Controls */}
      <MeetingControls
        onToggleCamera={toggleCamera}
        onToggleMicrophone={toggleMicrophone}
        onEndCall={handleEndCall}
        cameraEnabled={userSettings?.cameraEnabled}
        micEnabled={userSettings?.micEnabled}
      />

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        meetingId={meetingId!}
      />
    </div>
  );
}
