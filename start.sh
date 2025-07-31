#!/bin/bash

# Clevio Pro Startup Script
echo "Starting Clevio Pro WhatsApp Management System..."

# Check if node_modules exist
if [ ! -d "dashboard-server/node_modules" ] || [ ! -d "whatsapp-api/node_modules" ]; then
    echo "Installing dependencies..."
    npm run install-all
fi

# Start both servers
echo "Starting Dashboard Server and WhatsApp API..."
npm start

