import { Video, VideoOff, Mic, MicOff, Phone, MoreVertical,Monitor, MonitorOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingControlsProps {
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onEndCall: () => void;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
  isScreenSharing?: boolean; // <-- add this
  onStartScreenShare?: () => void; // <-- add this
  onStopScreenShare?: () => void;  // <-- add this
}


export default function MeetingControls({
  onToggleCamera,
  onToggleMicrophone,
  onEndCall,
  cameraEnabled,
  micEnabled,
  isScreenSharing,
  onStartScreenShare,
  onStopScreenShare
}: MeetingControlsProps) {
  return (
    <div className="fixed bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-full px-4 md:px-6 py-2 md:py-3 flex items-center space-x-2 md:space-x-4 shadow-lg border border-gray-700/50">
        <Button
          onClick={onToggleMicrophone}
          variant="ghost"
          size="icon"
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full transition-all duration-200 ${
            micEnabled 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {micEnabled ? (
            <Mic className="h-4 w-4 md:h-5 md:w-5" />
          ) : (
            <MicOff className="h-4 w-4 md:h-5 md:w-5" />
          )}
        </Button>
        
        <Button
          onClick={onToggleCamera}
          variant="ghost"
          size="icon"
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full transition-all duration-200 ${
            cameraEnabled 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {cameraEnabled ? (
            <Video className="h-4 w-4 md:h-5 md:w-5" />
          ) : (
            <VideoOff className="h-4 w-4 md:h-5 md:w-5" />
          )}
        </Button>
        
        <Button
          onClick={onEndCall}
          variant="ghost"
          size="icon"
          className="w-10 h-10 md:w-12 md:h-12 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-200"
        >
          <Phone className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
        <Button
          onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
          variant="ghost"
          size="icon"
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full transition-all duration-200 ${
            isScreenSharing
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          aria-label={isScreenSharing ? "Stop screen sharing" : "Start screen sharing"}
        >
          {isScreenSharing ? (
            <MonitorOff className="h-4 w-4 md:h-5 md:w-5" />
          ) : (
            <Monitor className="h-4 w-4 md:h-5 md:w-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 md:w-12 md:h-12 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all duration-200 hidden md:flex"
        >
          <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>
    </div>
  );
}
