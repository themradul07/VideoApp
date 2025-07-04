import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Video, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function JoinMeet() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const { toast } = useToast();
  const [meetingCode, setMeetingCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  useEffect(() => {
    if (params.meetingId) {
      setMeetingCode(params.meetingId);
    }
  }, [params.meetingId]);

  const joinMeetingMutation = useMutation({
    mutationFn: async (data: { meetingId: string; participant: any }) => {
       // First check if meeting exists
      const meetingResponse = await apiRequest("GET", `/api/meetings/${data.meetingId}`);
      const meeting = await meetingResponse.json();
      if (!meeting.isActive) throw new Error("Meeting is not active");


       // Join the meeting
      const response = await apiRequest("POST", `/api/meetings/${data.meetingId}/join`, data.participant);
      return response.json();
    },
    onSuccess: (data) => {

       // Store user settings in localStorage
      const participantId = `participant-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('videoMeetUser', JSON.stringify({
        displayName,
        cameraEnabled,
        micEnabled,
        participantId
      }));
      setLocation(`/meet/${meetingCode}`);
    },
    onError: (error) => {
      toast({
        title: "Error joining meeting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingCode.trim()) {
      toast({ title: "Meeting code required", description: "Please enter a meeting code", variant: "destructive" });
      return;
    }
    if (!displayName.trim()) {
      toast({ title: "Display name required", description: "Please enter your display name", variant: "destructive" });
      return;
    }
    const participantId = `participant-${Math.random().toString(36).substr(2, 9)}`;
    joinMeetingMutation.mutate({
      meetingId: meetingCode.trim(),
      participant: {
        id: participantId,
        name: displayName.trim(),
        cameraEnabled,
        micEnabled,
        joinedAt: new Date().toISOString(),
      }
    });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-white text-2xl font-bold drop-shadow">Join a Meeting</CardTitle>
          <CardDescription className="text-white/80">Enter your name and meeting code to join</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="meetingCode" className="text-white">Meeting Code</Label>
              <Input
                id="meetingCode"
                type="text"
                placeholder="Enter meeting code"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder-white/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-white">Your Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder-white/60"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="h-4 w-4 text-white/80" />
                  <Label htmlFor="camera" className="text-white">Camera</Label>
                </div>
                <Switch id="camera" checked={cameraEnabled} onCheckedChange={setCameraEnabled} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mic className="h-4 w-4 text-white/80" />
                  <Label htmlFor="microphone" className="text-white">Microphone</Label>
                </div>
                <Switch id="microphone" checked={micEnabled} onCheckedChange={setMicEnabled} />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-white text-indigo-700 hover:bg-yellow-300 hover:text-black border border-white/30 transition-all duration-300 shadow-md"
              disabled={joinMeetingMutation.isPending}
            >
              {joinMeetingMutation.isPending ? "Joining..." : "Join Now"}
            </Button>
          </form>

          <Button
            variant="ghost"
            className="w-full mt-4 text-white/80 hover:text-white"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}