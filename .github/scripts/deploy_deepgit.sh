#!/bin/bash
# This should be run inside GCP compute engine

# pull deploy branch
cd ~/projects/deepgit
git pull origin deploy

# build and deploy the frontend
cd ~/projects/deepgit
npm install
rm -rf dist
npm run build
touch dist/$(git log -1 --pretty=format:%H)
sudo rm -rf /var/www/deepgit-app/*
sudo cp -rf ~/projects/deepgit/dist/* /var/www/deepgit-app/.

# build and deploy the backend
cd ~/projects/deepgit
cd backend
~/projects/deepgit/.venv/bin/pip install -r requirements.txt

# restart nginx and gunicorn
sudo systemctl restart nginx
sudo systemctl restart gunicorn

