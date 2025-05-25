#!/bin/bash

# Function to check if a port is in use
check_port() {
    lsof -i :$1 >/dev/null 2>&1
    return $?
}

# Function to kill process using a port
kill_port() {
    local port=$1
    if check_port $port; then
        echo "Port $port is in use. Attempting to kill the process..."
        lsof -ti :$port | xargs kill -9 2>/dev/null
        sleep 1
        if check_port $port; then
            echo "Failed to kill process on port $port. Please check manually."
            exit 1
        else
            echo "Successfully killed process on port $port"
        fi
    fi
}

# Kill any existing process on port 5002
kill_port 5002

# Start the Gunicorn backend server in the background
echo "Starting backend server..."
cd backend/app
gunicorn -b 127.0.0.1:5002 main:app &

# Wait a moment for the backend to start
sleep 2

# Verify backend is running
if ! check_port 5002; then
    echo "Failed to start backend server. Please check the logs."
    exit 1
fi

# Start the frontend development server
echo "Starting frontend server..."
cd ../..
npm start