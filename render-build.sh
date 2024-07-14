#!/usr/bin/env bash
# Exit on errors
set -o errexit

# Set the Puppeteer cache directory environment variable
export PUPPETEER_CACHE_DIR=$PWD/puppeteer

# Install dependencies
npm install

# Store/pull Puppeteer cache with build cache
if [[ ! -d $PUPPETEER_CACHE_DIR ]]; then
  echo "...Copying Puppeteer Cache from Build Cache"
  mkdir -p $PUPPETEER_CACHE_DIR
  cp -R $XDG_CACHE_HOME/puppeteer/* $PUPPETEER_CACHE_DIR
else
  echo "...Storing Puppeteer Cache in Build Cache"
  mkdir -p $XDG_CACHE_HOME/puppeteer
  cp -R $PUPPETEER_CACHE_DIR/* $XDG_CACHE_HOME/puppeteer
fi
