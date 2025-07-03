#!/bin/bash

# Build script for Render deployment
echo "Building VideoMeet application..."

# Install dependencies
npm ci

# Build the frontend and backend
npm run build

echo "Build completed successfully!"