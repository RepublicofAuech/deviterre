#!/usr/bin/env bash
# exit on error
set -o errexit

# Install npm dependencies
npm install

# Install Puppeteer
npx puppeteer install

# Store/pull Puppeteer cache with build cache
if [[ -d $XDG_CACHE_HOME/puppeteer ]]; then
  if [[ ! -d $PUPPETEER_CACHE_DIR ]]; then
    echo "...Copying Puppeteer Cache from Build Cache"
    cp -R $XDG_CACHE_HOME/puppeteer $PUPPETEER_CACHE_DIR
  else
    echo "...Puppeteer Cache already exists in Build Cache, skipping copy"
  fi
else
  echo "...Storing Puppeteer Cache in Build Cache"
  mkdir -p $XDG_CACHE_HOME/puppeteer
  cp -R $PUPPETEER_CACHE_DIR/* $XDG_CACHE_HOME/puppeteer
fi
