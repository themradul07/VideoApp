import { Video, VideoOff, Mic, MicOff, Phone, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingControlsProps {
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onEndCall: () => void;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
}

export default function MeetingControls({
  onToggleCamera,
  onToggleMicrophone,
  onEndCall,
  cameraEnabled = true,
  micEnabled = true
}: MeetingControlsProps) {
  return (
    <div className="floating-controls">
      <div className="video-controls rounded-full px-6 py-3 flex items-center space-x-4 shadow-lg">
        <Button
          onClick={onToggleMicrophone}
          variant="ghost"
          size="icon"
          className={`control-btn w-12 h-12 rounded-full transition-all duration-200 ${
            micEnabled 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {micEnabled ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </Button>
        
        <Button
          onClick={onToggleCamera}
          variant="ghost"
          size="icon"
          className={`control-btn w-12 h-12 rounded-full transition-all duration-200 ${
            cameraEnabled 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {cameraEnabled ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </Button>
        
        <Button
          onClick={onEndCall}
          variant="ghost"
          size="icon"
          className="control-btn w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-200"
        >
          <Phone className="h-5 w-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="control-btn w-12 h-12 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all duration-200"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
