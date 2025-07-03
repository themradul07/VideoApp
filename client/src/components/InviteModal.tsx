import { useState } from "react";
import { X, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
}

export default function InviteModal({ isOpen, onClose, meetingId }: InviteModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const inviteLink = `${window.location.origin}/join/${meetingId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Meeting link has been copied to your clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy the meeting link",
        variant: "destructive",
      });
    }
  };

  const shareViaEmail = () => {
    const subject = "Join my VideoMeet meeting";
    const body = `Hi! I'd like to invite you to join my VideoMeet meeting.\n\nMeeting Link: ${inviteLink}\n\nSee you there!`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const shareViaWhatsApp = () => {
    const message = `Hi! Join my VideoMeet meeting: ${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Share Meeting</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Share this link with others to invite them to the meeting.
          </p>
          
          <div className="flex space-x-2">
            <Input
              value={inviteLink}
              readOnly
              className="bg-gray-800 border-gray-600 text-white"
            />
            <Button
              onClick={copyToClipboard}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          
          <div className="flex space-x-2">
            <Button
              onClick={shareViaEmail}
              variant="outline"
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button
              onClick={shareViaWhatsApp}
              variant="outline"
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
            >
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.688z"/>
              </svg>
              WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
