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
    <div className="gradient-bg min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="text-center">
          <CardTitle className="text-white text-xl md:text-2xl">Set Up Your Meeting</CardTitle>
          <CardDescription className="text-white/80">
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
                className="bg-white/20 border-white/30 text-white placeholder-white/60"
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
              className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30"
              disabled={createMeetingMutation.isPending}
            >
              {createMeetingMutation.isPending ? "Creating..." : "Create and Join"}
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
