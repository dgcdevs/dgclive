#!/bin/bash
cd /Users/user1/dgclive/apps/api
echo "🔄 Clearing Prisma cache..."
rm -rf node_modules/.prisma
echo "✓ Cache cleared"
echo ""
echo "🔄 Regenerating Prisma client..."
npx prisma generate
echo "✓ Prisma client regenerated"
echo ""
echo "🔄 Deploying migrations..."
npx prisma migrate deploy
echo "✓ Migrations deployed"
echo ""
echo "✅ Done! Your database is now synchronized with the schema."
