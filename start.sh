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

# Function to check and download dataset with progress bar
check_and_download_dataset() {
    echo "🔍 Checking for github_meta.duckdb dataset..."
    
    data_file="public/data/github_meta.duckdb"
    
    # Check if file exists and has reasonable size (>1MB)
    if [ -f "$data_file" ]; then
        file_size=$(stat -f%z "$data_file" 2>/dev/null || stat -c%s "$data_file" 2>/dev/null)
        if [ "$file_size" -gt 1048576 ]; then  # Greater than 1MB
            echo "✅ Dataset found (${file_size} bytes)"
            return 0
        else
            echo "⚠️  Dataset exists but is too small (${file_size} bytes), will re-download"
        fi
    else
        echo "❌ Dataset not found"
    fi
    
    echo "📥 Downloading dataset from Hugging Face..."
    
    # Create data directory if it doesn't exist
    mkdir -p public/data
    
    # Download URL
    url="https://huggingface.co/datasets/deepgit/github_meta/resolve/main/github_meta.duckdb"
    
    # Download with progress bar using wget (more reliable than curl for progress)
    if command -v wget >/dev/null 2>&1; then
        echo "Using wget for download..."
        if wget --progress=bar:force:noscroll -O "$data_file" "$url"; then
            echo "✅ Successfully downloaded dataset"
            return 0
        else
            echo "❌ Failed to download dataset with wget"
            return 1
        fi
    elif command -v curl >/dev/null 2>&1; then
        echo "Using curl for download..."
        if curl -L -o "$data_file" --progress-bar "$url"; then
            echo "✅ Successfully downloaded dataset"
            return 0
        else
            echo "❌ Failed to download dataset with curl"
            return 1
        fi
    else
        echo "❌ Neither wget nor curl found. Please install one of them."
        return 1
    fi
}

# Check and download dataset first
if ! check_and_download_dataset; then
    echo "❌ Dataset download failed. Exiting."
    exit 1
fi

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
npm run dev