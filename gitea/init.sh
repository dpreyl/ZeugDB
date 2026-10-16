#!/bin/sh
set -e

GIT_SERVER="http://gitserver:3000"
ADMIN_USER="${GITEA_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${GITEA_ADMIN_PASSWORD:-admin123}"
ADMIN_EMAIL="${GITEA_ADMIN_EMAIL:-admin@zeugdb.local}"
REPO_NAME="${GITEA_REPO_NAME:-ZeugDB}"

echo "⏳ Waiting for Gitea to be ready..."
# Poll until Gitea responds
for i in $(seq 1 60); do
  if curl -sf "$GIT_SERVER/api/v1/version" > /dev/null 2>&1; then
    echo "✅ Gitea is ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "❌ Gitea did not become ready in time"
    exit 1
  fi
  sleep 2
done

# Check if admin user already exists
EXISTING=$(curl -sf "$GIT_SERVER/api/v1/users/$ADMIN_USER" 2>/dev/null || echo "")
TOKEN=""
if [ -z "$EXISTING" ]; then
  echo "👤 Creating admin user '$ADMIN_USER'..."
  CREATE_OUTPUT=$(su-exec git gitea admin user create \
    --username "$ADMIN_USER" \
    --password "$ADMIN_PASS" \
    --email "$ADMIN_EMAIL" \
    --admin \
    --must-change-password=false \
    --access-token \
    --access-token-name "zeugdb-init" \
    --access-token-scopes "all")
  echo "$CREATE_OUTPUT"
  # Extract token: "Access token was successfully created: <hash>"
  TOKEN=$(echo "$CREATE_OUTPUT" | grep -o '[a-f0-9]\{40\}')
else
  echo "ℹ️  Admin user '$ADMIN_USER' already exists"
  # Generate token for existing user
  TOKEN_OUTPUT=$(su-exec git gitea admin user generate-access-token \
    --username "$ADMIN_USER" \
    --scopes "all" 2>/dev/null || echo "")
  TOKEN=$(echo "$TOKEN_OUTPUT" | grep -o '[a-f0-9]\{40\}')
fi
if [ -n "$TOKEN" ]; then
  echo "🔑 Access token: $TOKEN"
else
  echo "⚠️  Could not extract access token"
fi

# Check if repo already exists
REPO_CHECK=$(curl -sf "$GIT_SERVER/api/v1/repos/$ADMIN_USER/$REPO_NAME" 2>/dev/null || echo "")
if [ -z "$REPO_CHECK" ]; then
  echo "📦 Creating repository '$ADMIN_USER/$REPO_NAME'..."
  PAYLOAD='{"name":"'"$REPO_NAME"'","auto_init":true,"gitignore":"Node"}'
  curl -s -X POST "$GIT_SERVER/api/v1/user/repos" \
    -H "Authorization: token $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD"
  echo ""
  echo "✅ Repository created"
else
  echo "ℹ️  Repository '$ADMIN_USER/$REPO_NAME' already exists"
fi

echo "🎉 Gitea initialization complete"
