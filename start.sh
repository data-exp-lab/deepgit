#!/bin/bash

# Start the Gunicorn backend server in the background
echo "Starting backend server..."
cd backend/app
gunicorn -b 127.0.0.1:5002 main:app &

# Wait a moment for the backend to start
sleep 2

# Start the frontend development server
echo "Starting frontend server..."
cd ../..
npm start