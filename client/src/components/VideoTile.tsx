import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, Fullscreen } from "lucide-react";

interface VideoTileProps {
  stream?: MediaStream | null;
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
  const [ishovered, setishovered] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // VIDEO useEffect (as you have it)
  useEffect(() => {
    if (videoRef.current && stream && cameraEnabled && stream.getVideoTracks().length > 0) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream, cameraEnabled]);

  // AUDIO useEffect (NEW)
  useEffect(() => {
    if (audioRef.current && stream && micEnabled && stream.getAudioTracks().length > 0) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = isLocal;
      audioRef.current.play().catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  }, [stream, micEnabled, isLocal]);


  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };


  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
      
    }
  };

  const handleClick = async () => {
    console.log("VideoTile clicked");

    // Immediately set isHovered to false
    setishovered(true);

    // Then set it to true after 3 seconds
    setTimeout(() => {
      setishovered(false);
    }, 3000);
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
    <div onClick={handleClick} className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video border border-gray-700/50 min-h-0 md:min-h-[200px]">
        <audio ref={audioRef} autoPlay />
      {stream && cameraEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="text-center">
            <div className={`w-12 h-12 md:w-16 md:h-16 ${getAvatarColor(participantName)} rounded-full flex items-center justify-center mb-2 mx-auto`}>
              <span className="text-white font-bold text-sm md:text-xl">{getInitials(participantName)}</span>
            </div>
            <p className="text-white font-medium text-sm md:text-base">{participantName}{isLocal ? ' (You)' : ''}</p>
          </div>
        </div>
      )}
      
      {/* Participant info overlay */}
      <div className="absolute bottom-1 md:bottom-2 left-1 md:left-2 right-1 md:right-2 flex justify-between items-center">
        <div className="bg-black/70 backdrop-blur-sm rounded px-1.5 md:px-2 py-0.5 md:py-1 text-xs text-white">
          {participantName}{isLocal ? ' (You)' : ''}
        </div>
        <div className="flex items-center space-x-0.5 md:space-x-1">
          <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center ${
            micEnabled ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {micEnabled ? (
              <Mic className="text-white w-2.5 h-2.5 md:w-3 md:h-3" />
            ) : (
              <MicOff className="text-white w-2.5 h-2.5 md:w-3 md:h-3" />
            )}
          </div>
          <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center ${
            cameraEnabled ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {cameraEnabled ? (
              <Video className="text-white w-2.5 h-2.5 md:w-3 md:h-3" />
            ) : (
              <VideoOff className="text-white w-2.5 h-2.5 md:w-3 md:h-3" />
            )}
          </div>
          {ishovered &&
            <div onClick={handleFullscreen} className={`w-5 h-5 md:w-6 none md:h-6 rounded-full flex items-center justify-center bg-black `}>

              <Fullscreen className="text-white w-2.5 h-2.5 md:w-3 md:h-3" />
            </div>}
        </div>
      </div>
    </div>
  );
}
