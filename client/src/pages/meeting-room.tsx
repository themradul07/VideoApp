import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Share, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import VideoTile from "@/components/VideoTile";
import MeetingControls from "@/components/MeetingControls";
import InviteModal from "@/components/InviteModal";
import { useSimpleWebRTC } from "@/hooks/useSimpleWebRTC";

export default function MeetingRoom() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);

  const meetingId = params.meetingId;

  // Load user settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("videoMeetUser");
    if (savedSettings) {
      setUserSettings(JSON.parse(savedSettings));
    } else {
      // Redirect to join page if no settings found
      setLocation(`/join/${meetingId}`);
    }
  }, [meetingId, setLocation]);

  // Fetch meeting data
  const {
    data: meeting,
    isLoading,
    error,
  } = useQuery({
    queryKey: [`/api/meetings/${meetingId}`],
    enabled: !!meetingId,
  });

  // Initialize WebRTC connection
  const {
    localStream,
    participants,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMicrophone,
    endCall,
  } = useSimpleWebRTC(meetingId!, userSettings);

  const handleEndCall = () => {
    endCall();
    setLocation("/");
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
          <p className="text-gray-400 mb-4">
            The meeting you're looking for doesn't exist or has ended.
          </p>
          <Button
            onClick={() => setLocation("/")}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-700/50 p-3 md:p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 md:space-x-4">
          <h1 className="text-base md:text-lg font-semibold text-white">
            VideoMeet
          </h1>
          <span className="text-gray-400 text-xs md:text-sm hidden sm:block">
            Meeting ID: {meetingId}
          </span>
        </div>
        <div className="flex items-center space-x-1 md:space-x-2">
          <Button
            onClick={() => setShowInviteModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm px-2 md:px-4 py-1 md:py-2"
          >
            <Share className="mr-1 md:mr-2 h-3 md:h-4 w-3 md:w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <div className="text-gray-400 text-xs md:text-sm flex items-center">
            <Users className="mr-1 h-3 md:h-4 w-3 md:w-4" />
            <span className="hidden sm:inline">
              {participants.length + 1} participants
            </span>
            <span className="sm:hidden">{participants.length + 1}</span>
          </div>
        </div>
      </header>

      {/* Video Grid */}
      <main className="flex-1 p-2 md:p-4 overflow-hidden">
        {/* Mobile: Column layout */}
        <div className="flex flex-col gap-2 h-full md:hidden overflow-y-auto">
          {/* Local video */}
          <VideoTile
            stream={localStream}
            participantName={userSettings?.displayName || "You"}
            isLocal={true}
            cameraEnabled={cameraEnabled}
            micEnabled={micEnabled}
          />

          {/* Remote videos */}
          {participants.map((participant) => (
            <VideoTile
              key={participant.id}
              stream={participant.stream}
              participantName={participant.name}
              isLocal={false}
              cameraEnabled={participant.cameraEnabled}
              micEnabled={participant.micEnabled}
            />
          ))}
        </div>

        {/* Laptop/Desktop: Grid layout */}

        <div
          className={`hidden md:grid gap-4 h-full px-4 py-2 ${
            participants.length >= 0 ? "overflow-y-auto" : ""
          }`}
          style={{
            alignContent: "start",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gridAutoRows: "minmax(200px, auto)",
            // gridAutoRows: '1fr',
          }}
        >
          {/* Local video */}
          <VideoTile
            stream={localStream}
            participantName={userSettings?.displayName || "You"}
            isLocal={true}
            cameraEnabled={cameraEnabled}
            micEnabled={micEnabled}
            showName={true}
          />

          {/* Remote videos */}
          {participants.map((participant) => (
            <VideoTile
              key={participant.id}
              stream={participant.stream}
              participantName={participant.name}
              isLocal={false}
              cameraEnabled={participant.cameraEnabled}
              micEnabled={participant.micEnabled}
              showName={true}
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
