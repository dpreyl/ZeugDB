#!/bin/sh
set -eu

GIT_SERVER="${GITEA_BASE_URL:-http://gitserver:3000}"
ADMIN_USER="${GITEA_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${GITEA_ADMIN_PASSWORD:-admin123}"
ADMIN_EMAIL="${GITEA_ADMIN_EMAIL:-admin@zeugdb.local}"
REPO_NAME="${GITEA_REPO_NAME:-ZeugDB}"
TEMPLATE_DIR="${GITEA_TEMPLATE_DIR:-/repo-template}"

echo "⏳ Waiting for Gitea to be ready..."
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

if ! curl -sf "$GIT_SERVER/api/v1/users/$ADMIN_USER" > /dev/null 2>&1; then
  echo "👤 Creating admin user '$ADMIN_USER'..."
  su-exec git gitea admin user create \
    --username "$ADMIN_USER" \
    --password "$ADMIN_PASS" \
    --email "$ADMIN_EMAIL" \
    --admin \
    --must-change-password=false
else
  echo "ℹ️  Admin user '$ADMIN_USER' already exists"
fi

REPO_URL="$GIT_SERVER/api/v1/repos/$ADMIN_USER/$REPO_NAME"
if ! curl -sf -u "$ADMIN_USER:$ADMIN_PASS" "$REPO_URL" > /dev/null 2>&1; then
  echo "📦 Creating repository '$ADMIN_USER/$REPO_NAME'..."
  PAYLOAD="{\"name\":\"$REPO_NAME\",\"auto_init\":true,\"default_branch\":\"main\"}"
  curl -fsS -u "$ADMIN_USER:$ADMIN_PASS" -X POST "$GIT_SERVER/api/v1/user/repos" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null
  echo "✅ Repository created"
else
  echo "ℹ️  Repository '$ADMIN_USER/$REPO_NAME' already exists"
fi

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "❌ Repository template directory not found: $TEMPLATE_DIR"
  exit 1
fi

echo "🗂️  Preparing the app repository structure..."
find "$TEMPLATE_DIR" -type f -print | sort | while IFS= read -r TEMPLATE_FILE; do
  REPO_PATH="${TEMPLATE_FILE#"$TEMPLATE_DIR"/}"
  CONTENT_URL="$REPO_URL/contents/$REPO_PATH"
  if curl -fsS -u "$ADMIN_USER:$ADMIN_PASS" "$CONTENT_URL" > /dev/null 2>&1; then
    echo "ℹ️  Keeping existing $REPO_PATH"
    continue
  fi

  CONTENT=$(base64 < "$TEMPLATE_FILE" | tr -d '\r\n')
  PAYLOAD="{\"message\":\"Initialize ZeugDB repository layout\",\"content\":\"$CONTENT\"}"
  curl -fsS -u "$ADMIN_USER:$ADMIN_PASS" -X PUT "$CONTENT_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" > /dev/null
  echo "✅ Added $REPO_PATH"
done

echo "🎉 Gitea initialization complete"
