#!/bin/bash
# Gitea-Initialisierung für ZeugDB
# Erzeugt Admin-User und initialisiert das Asset-Repo mit Struktur.
# Läuft als Einmal-Setup (idempotent).

set -e

GITEA_URL="http://localhost:8929"
ADMIN_USER="zeugdb-admin"
ADMIN_PASS="zeugdb-dev-2025"
ADMIN_EMAIL="admin@zeugdb.local"
REPO_OWNER="zeugdb"
REPO_NAME="assets"

echo "🔧 Gitea-Initialisierung..."

# Warte auf Gitea
for i in {1..30}; do
  if curl -sf "$GITEA_URL/api/v1/version" > /dev/null 2>&1; then
    echo "✅ Gitea ist erreichbar"
    break
  fi
  echo "  Warte auf Gitea ($i/30)..."
  sleep 2
done

# Admin-User erstellen (falls nicht existiert)
EXISTING=$(curl -sf "$GITEA_URL/api/v1/users/$ADMIN_USER" 2>/dev/null || echo "")
if [ -z "$EXISTING" ]; then
  echo "👤 Erstelle Admin-User..."
  curl -sf -X POST "$GITEA_URL/api/v1/admin/users" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$ADMIN_USER\",
      \"password\": \"$ADMIN_PASS\",
      \"email\": \"$ADMIN_EMAIL\",
      \"is_admin\": true
    }"
  echo ""
  echo "✅ Admin-User erstellt"
else
  echo "ℹ️  Admin-User existiert bereits"
fi

# Token für API-Zugriff erzeugen
TOKEN_FILE="/tmp/gitea-token"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "🔑 Erstelle API-Token..."
  TOKEN=$(curl -sf -X POST "$GITEA_URL/api/v1/users/$ADMIN_USER/tokens" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"zeugdb-init\",
      \"read_write\": true
    }" | jq -r '.sha1')
  echo "$TOKEN" > "$TOKEN_FILE"
  echo "✅ Token gespeichert"
else
  echo "ℹ️  Token existiert bereits"
fi

TOKEN=$(cat "$TOKEN_FILE")

# Repo erstellen (falls nicht existiert)
EXISTING_REPO=$(curl -sf "$GITEA_URL/api/v1/repos/$REPO_OWNER/$REPO_NAME" 2>/dev/null || echo "")
if [ -z "$EXISTING_REPO" ]; then
  echo "📦 Erstelle Asset-Repo..."
  curl -sf -X POST "$GITEA_URL/api/v1/user/repos" \
    -H "Authorization: token $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$REPO_NAME\",
      \"auto_init\": true,
      \"gitignore\": \"Node\",
      \"private\": true
    }"
  echo ""
  echo "✅ Repo erstellt"
else
  echo "ℹ️  Repo existiert bereits"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Gitea-Setup abgeschlossen"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " UI:    $GITEA_URL"
echo " API:   $GITEA_URL/api/v1"
echo " Repo:  $REPO_OWNER/$REPO_NAME"
echo " User:  $ADMIN_USER"
echo " Pass:  $ADMIN_PASS"
echo " Token: $(cat $TOKEN_FILE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
