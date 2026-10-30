#!/bin/sh
set -eu
# Touch only this application's dedicated persistent directory, not all /data.
umask 077
mkdir -p /data/pocketbase
chown -R node:node /data/pocketbase
chmod 700 /data/pocketbase
exec su-exec node:node node /app/start.mjs
