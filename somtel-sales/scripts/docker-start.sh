#!/bin/sh
set -e
echo "Applying database migrations..."
npx prisma migrate deploy
echo "Making sure reference data exists..."
npx tsx prisma/seed.ts
echo "Starting the web app..."
exec npx next start
