# VideoMeet Application

## Overview

VideoMeet is a modern video conferencing application built with React frontend and Express backend. It provides real-time video communication capabilities with features like meeting room creation, participant management, and WebRTC-based video streaming. The application uses a clean, responsive design with shadcn/ui components and supports both web and mobile interfaces.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state management
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Real-time Communication**: WebSocket server for signaling
- **Session Management**: PostgreSQL-based session storage

### WebRTC Implementation
- **Peer-to-Peer**: Direct WebRTC connections between participants
- **Signaling**: WebSocket-based signaling server
- **STUN Servers**: Google STUN servers for NAT traversal
- **Media Handling**: getUserMedia API for camera/microphone access

## Key Components

### Database Schema
- **meeting_rooms**: Stores meeting information, host details, and participant lists
- **users**: User authentication and profile management
- **Session storage**: PostgreSQL-based session management

### API Endpoints
- `POST /api/meetings` - Create new meeting room
- `GET /api/meetings/:meetingId` - Get meeting room details
- `POST /api/meetings/:meetingId/join` - Join existing meeting

### WebSocket Events
- `join-room` - Participant joins meeting room
- `participant-joined` - Notify other participants of new joiner
- `participant-left` - Handle participant disconnection
- `webrtc-signaling` - Exchange SDP offers/answers and ICE candidates

### React Components
- **VideoTile**: Individual participant video display with camera/mic status
- **MeetingControls**: Camera, microphone, and call end controls
- **InviteModal**: Meeting link sharing and invitation management
- **Pages**: Home, CreateMeet, JoinMeet, MeetingRoom

## Data Flow

1. **Meeting Creation**: User creates meeting → Server generates meeting ID → User redirected to meeting room
2. **Joining Meeting**: User enters meeting ID → Server validates meeting → User enters meeting room
3. **WebRTC Connection**: Participants connect via WebSocket → Exchange signaling data → Establish peer-to-peer connection
4. **Media Streaming**: Local media captured → Transmitted via WebRTC → Displayed in remote participant tiles

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon Database client for PostgreSQL
- **drizzle-orm**: Type-safe ORM for database operations
- **drizzle-zod**: Database schema validation
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React routing
- **ws**: WebSocket implementation

### UI Dependencies
- **@radix-ui/***: Headless UI components
- **tailwindcss**: Utility-first CSS framework
- **shadcn/ui**: Pre-built component library
- **lucide-react**: Icon library

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking
- **tsx**: TypeScript execution
- **esbuild**: Fast bundler for production

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx for TypeScript execution
- **Database**: Neon Database with Drizzle migrations
- **WebSocket**: Integrated with Express server

### Production
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Static Assets**: Served from dist/public directory
- **Database**: Neon Database (serverless PostgreSQL)
- **Environment**: NODE_ENV=production with optimized builds

### Database Management
- **Migrations**: Drizzle migrations in /migrations directory
- **Schema**: Defined in shared/schema.ts
- **Deployment**: `npm run db:push` for schema updates

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **July 03, 2025 - 7:15 AM**: Updated VideoMeet with modern gradient backgrounds
  - Replaced dark grid background with blue-purple gradient (#667eea to #764ba2)
  - Enhanced mobile responsiveness with Tailwind responsive classes
  - Updated all pages (Home, Create Meet, Join Meet) with glass morphism effects
  - Improved meeting room layout with responsive video grid
  - Added proper viewport meta tags for mobile optimization
  - Simplified WebRTC implementation to fix video/audio transmission issues

## User Preferences

- Background: Modern gradient backgrounds instead of dark grid patterns
- Design: Glass morphism effects with backdrop blur
- Responsiveness: Mobile-first design with responsive controls
- Communication style: Simple, everyday language

## Changelog

- July 03, 2025. Initial setup and gradient background implementation