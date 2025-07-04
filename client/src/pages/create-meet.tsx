
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Video, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CreateMeet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const createMeetingMutation = useMutation({
    mutationFn: async (data: { meetingId: string; hostId: string; hostName: string }) => {
      const response = await apiRequest("POST", "/api/meetings", data);
      return response.json();
    },
    onSuccess: (data) => {
         // Store user settings in localStorage
      localStorage.setItem('videoMeetUser', JSON.stringify({
        displayName,
        cameraEnabled,
        micEnabled,
        participantId: data.hostId
      }));
      setLocation(`/meet/${data.meetingId}`);
    },
    onError: (error) => {
      toast({
        title: "Error creating meeting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast({
        title: "Display name required",
        description: "Please enter your display name",
        variant: "destructive",
      });
      return;
    }
    const meetingId = `meet-${Math.random().toString(36).substr(2, 9)}`;
    const hostId = `host-${Math.random().toString(36).substr(2, 9)}`;
    createMeetingMutation.mutate({
      meetingId,
      hostId,
      hostName: displayName.trim()
    });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 min-h-screen flex items-center justify-center p-6 animate-fade-in">
      <Card className="w-full max-w-md bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl rounded-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-white text-2xl md:text-3xl font-bold mb-2">Set Up Your Meeting</CardTitle>
          <CardDescription className="text-white/80 text-sm md:text-base">
            Prepare to connect with others. Enable your camera and mic, and choose a display name to get started.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-white">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder-white/60 focus:ring-yellow-300"
                required
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="h-4 w-4 text-white/80" />
                  <Label htmlFor="camera" className="text-white">Camera</Label>
                </div>
                <Switch
                  id="camera"
                  checked={cameraEnabled}
                  onCheckedChange={setCameraEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mic className="h-4 w-4 text-white/80" />
                  <Label htmlFor="microphone" className="text-white">Microphone</Label>
                </div>
                <Switch
                  id="microphone"
                  checked={micEnabled}
                  onCheckedChange={setMicEnabled}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-white text-indigo-700 hover:bg-yellow-300 hover:text-black border-white/30 font-semibold text-lg py-2.5 rounded-xl transition-transform transform hover:scale-105"
              disabled={createMeetingMutation.isPending}
            >
              {createMeetingMutation.isPending ? "Creating..." : "Create and Join"}
            </Button>
          </form>

          <Button
            variant="ghost"
            className="w-full mt-4 text-white/80 hover:text-white flex justify-center items-center gap-2"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </CardContent>
      </Card>

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.8s ease-in-out both;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
