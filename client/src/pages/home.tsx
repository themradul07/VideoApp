import { Link } from "wouter";
import { Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 min-h-screen flex items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center">
        <div className="mb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white drop-shadow-md mb-6 animate-fade-in">
            Welcome to <span className="text-yellow-300">VideoMeet</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed px-4 md:px-0 animate-fade-in delay-150">
            Stay connected with your team, clients, and loved ones. Create or join a meeting in just a few clicks. Seamlessly connect, collaborate, and communicate—whether for work, study, or fun!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center animate-fade-in delay-300">
          <Link href="/create-meet">
            <Button 
              size="lg"
              className="bg-white text-indigo-700 hover:bg-yellow-300 hover:text-black px-8 md:px-10 py-4 md:py-5 text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-xl rounded-xl border-2 border-white/20"
            >
              <Video className="mr-3 h-5 w-5" />
              Create Meet
            </Button>
          </Link>

          <Link href="/join-meet">
            <Button 
              variant="outline"
              size="lg"
              className="bg-transparent border-2 border-white/30 hover:bg-white/20 text-white px-8 md:px-10 py-4 md:py-5 text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-xl rounded-xl"
            >
              <Users className="mr-3 h-5 w-5" />
              Join Meet
            </Button>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.8s ease-in-out both;
        }

        .animate-fade-in.delay-150 {
          animation-delay: 150ms;
        }

        .animate-fade-in.delay-300 {
          animation-delay: 300ms;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
