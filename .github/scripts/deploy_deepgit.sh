#!/bin/bash
# This should be run inside GCP compute engine

# pull deploy branch
cd ~/projects/deepgit
git pull origin deploy

# build and deploy the frontend
npm install
rm -rf dist
npm run build
sudo rm -rf /var/www/deepgit-app/*
sudo cp -rf ~/projects/deepgit/dist/* /var/www/deepgit-app/.

# build and deploy the backend
source .venv/bin/activate
cd backend
pip install -r requirements.txt

# restart nginx and gunicorn
sudo systemctl restart nginx
sudo systemctl restart gunicorn

# check bash status
if [[ $? -eq 0 ]]; then
    echo "Script succeeded"
else
    echo "Script failed"
fi
