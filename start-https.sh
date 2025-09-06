#!/bin/bash

# Start React app for network access (without HTTPS for local development)
# Mobile users will need to use the web version via HTTP for local testing

echo "🚀 Starting Noise Maker for network access..."
echo "📱 Access via: http://192.168.1.204:3000"
echo "⚠️  Note: Mobile microphone won't work on HTTP, use for testing only"
echo ""

export HOST=0.0.0.0

npm start 