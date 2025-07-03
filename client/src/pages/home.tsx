import { Link } from "wouter";
import { Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="grid-bg min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-6 gradient-text">
            Welcome to VideoMeet
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Stay connected with your team, clients, and loved ones. Create or join a meeting in just a few clicks. 
            Seamlessly connect, collaborate, and communicate—whether for work, study, or fun!
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Link href="/create-meet">
            <Button 
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg min-w-[200px]"
            >
              <Video className="mr-3 h-5 w-5" />
              Create Meet
            </Button>
          </Link>
          
          <Link href="/join-meet">
            <Button 
              variant="outline"
              size="lg"
              className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-6 text-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg border-gray-600 min-w-[200px]"
            >
              <Users className="mr-3 h-5 w-5" />
              Join Meet
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
