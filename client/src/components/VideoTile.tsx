import { useEffect, useRef } from "react";
import { Video, VideoOff, Mic, MicOff } from "lucide-react";

interface VideoTileProps {
  stream?: MediaStream;
  participantName: string;
  isLocal?: boolean;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
}

export default function VideoTile({ 
  stream, 
  participantName, 
  isLocal = false, 
  cameraEnabled = true, 
  micEnabled = true 
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600', 'bg-green-600', 'bg-purple-600', 
      'bg-red-600', 'bg-yellow-600', 'bg-indigo-600'
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  return (
    <div className="video-tile relative">
      {stream && cameraEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="participant-video"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={`w-16 h-16 ${getAvatarColor(participantName)} rounded-full flex items-center justify-center mb-2 mx-auto`}>
              <span className="text-white font-bold text-xl">{getInitials(participantName)}</span>
            </div>
            <p className="text-white font-medium">{participantName}{isLocal ? ' (You)' : ''}</p>
          </div>
        </div>
      )}
      
      {/* Participant info overlay */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
        <div className="bg-black bg-opacity-50 rounded px-2 py-1 text-xs text-white">
          {participantName}{isLocal ? ' (You)' : ''}
        </div>
        <div className="flex items-center space-x-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            micEnabled ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {micEnabled ? (
              <Mic className="text-white text-xs w-3 h-3" />
            ) : (
              <MicOff className="text-white text-xs w-3 h-3" />
            )}
          </div>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            cameraEnabled ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {cameraEnabled ? (
              <Video className="text-white text-xs w-3 h-3" />
            ) : (
              <VideoOff className="text-white text-xs w-3 h-3" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
