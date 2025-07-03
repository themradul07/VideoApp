import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CreateMeet from "@/pages/create-meet";
import JoinMeet from "@/pages/join-meet";
import MeetingRoom from "@/pages/meeting-room";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create-meet" component={CreateMeet} />
      <Route path="/join-meet" component={JoinMeet} />
      <Route path="/join/:meetingId" component={JoinMeet} />
      <Route path="/meet/:meetingId" component={MeetingRoom} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
