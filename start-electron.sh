#!/bin/bash

echo "🚀 Starting Noise Maker Electron App..."
echo "🔒 Security: CSP enabled, secure preload scripts configured"
echo "🛡️  This should eliminate the CSP security warning"
echo ""

# Set NODE_ENV for proper CSP configuration
export NODE_ENV=development

# Use the proper electron development script that starts both React and Electron
npm run electron-dev 