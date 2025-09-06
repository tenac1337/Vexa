#!/bin/bash

# Start React app with HTTPS enabled specifically for mobile testing
# Use this ONLY when you need to test mobile microphone access

echo "🚀 Starting Noise Maker with HTTPS for mobile testing..."
echo "📱 Mobile devices will be able to access microphone"
echo "🔒 Access via: https://192.168.1.204:3000"
echo "⚠️  This may interfere with Electron floating blob - use start-electron.sh for desktop"
echo ""

export HTTPS=true
export HOST=0.0.0.0

npm start 