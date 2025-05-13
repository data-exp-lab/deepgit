#!/bin/bash

# Start the Flask backend server in the background
echo "Starting backend server..."
cd backend
python topic_processor.py &

# Wait a moment for the backend to start
sleep 2

# Start the frontend development server
echo "Starting frontend server..."
cd ..
npm start