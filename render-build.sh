#!/usr/bin/env bash
# exit on error
set -o errexit

# Install npm dependencies
npm install

# Set Puppeteer cache directory
export PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR

# Check if Puppeteer is already installed in the cache
if [ -d "$PUPPETEER_CACHE_DIR/chrome" ]; then
  echo "Puppeteer cache exists, copying to node_modules."
  cp -r $PUPPETEER_CACHE_DIR/chrome/* node_modules/puppeteer/.local-chromium
else
  echo "Installing Puppeteer."
  npm install puppeteer
  echo "Caching Puppeteer."
  mkdir -p $PUPPETEER_CACHE_DIR/chrome
  cp -r node_modules/puppeteer/.local-chromium/* $PUPPETEER_CACHE_DIR/chrome
fi

echo "Build script finished."
