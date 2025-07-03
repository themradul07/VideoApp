import { Link } from "wouter";
import { Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="gradient-bg min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6 text-white">
            Welcome to VideoMeet
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed px-4">
            Stay connected with your team, clients, and loved ones. Create or join a meeting in just a few clicks. 
            Seamlessly connect, collaborate, and communicate—whether for work, study, or fun!
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center px-4">
          <Link href="/create-meet">
            <Button 
              size="lg"
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 md:px-8 py-4 md:py-6 text-base md:text-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg min-w-[180px] md:min-w-[200px] border border-white/30"
            >
              <Video className="mr-2 md:mr-3 h-4 md:h-5 w-4 md:w-5" />
              Create Meet
            </Button>
          </Link>
          
          <Link href="/join-meet">
            <Button 
              variant="outline"
              size="lg"
              className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white px-6 md:px-8 py-4 md:py-6 text-base md:text-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg border-white/30 min-w-[180px] md:min-w-[200px]"
            >
              <Users className="mr-2 md:mr-3 h-4 md:h-5 w-4 md:w-5" />
              Join Meet
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
