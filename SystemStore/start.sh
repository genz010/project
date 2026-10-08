#!/usr/bin/env bash
echo "starting systemstore..."
cd infra
podman compose up -d || docker compose up -d
cd ..
bun install
bun seed.js
bun server.js

