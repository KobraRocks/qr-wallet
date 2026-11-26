#!/usr/bin/env bash
#
# Deploy the built PWA to production.
#
# Production is the static folder `web/qr-wallet/` on the Infomaniak account,
# served at https://kobra.rocks/qr-wallet/. The script is deliberately strict:
# it only ships a committed `main` (so a deployed artifact always maps to a
# commit), gates the upload on the test suite and the size budget, snapshots
# the live release for rollback, and verifies the public URL afterwards.
#
# Usage: npm run deploy   (or scripts/deploy.sh)
#
# Requirements: Node >= 22.18 with dependencies installed, rsync locally and
# on the host, and SSH access via the `infomaniak` host alias.
#
# Host configuration lives in `deploy/htaccess`: it is uploaded only when that
# file exists, because other hosts (Cloudflare Pages, GitHub Pages) do not use
# .htaccess. rsync excludes `.htaccess` so a deploy never deletes it.

set -euo pipefail

readonly HOST="infomaniak"
readonly REMOTE_DIR="web/qr-wallet"
readonly RELEASES_DIR="qr-wallet-releases"
readonly PUBLIC_URL="https://kobra.rocks/qr-wallet/"
readonly KEEP_RELEASES=5
readonly SSH=(ssh -o BatchMode=yes)

cd "$(dirname "$0")/.."

log() { printf '\n== %s\n' "$*"; }
fail() { printf '\ndeploy: %s\n' "$*" >&2; exit 1; }

# --- preflight --------------------------------------------------------------

[[ -f package.json && -d src ]] || fail "run this script from the repository root"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not a git work tree"

if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short
  fail "working tree is dirty; commit (or stash) first so the deployed files map to a commit"
fi

readonly BRANCH="$(git rev-parse --abbrev-ref HEAD)"
readonly COMMIT="$(git rev-parse --short HEAD)"

[[ "$BRANCH" == "main" ]] || fail "production deploys come from main, not '$BRANCH'"

# --- build gates ------------------------------------------------------------

log "Testing $BRANCH @ $COMMIT"
npm test

log "Building"
npm run build

log "Checking the size budget"
npm run check:budget

[[ -f dist/index.html && -f dist/sw.js ]] || fail "build produced no shell or service worker"
readonly BUILD_HASH="$(sed -n 's/^const BUILD_HASH = "\(.*\)";/\1/p' dist/sw.js)"
[[ -n "$BUILD_HASH" ]] || fail "could not read BUILD_HASH from dist/sw.js"

# --- rollback snapshot ------------------------------------------------------

log "Preparing the host"
"${SSH[@]}" "$HOST" "mkdir -p '$RELEASES_DIR'"

if "${SSH[@]}" "$HOST" "test -n \"\$(ls -A '$REMOTE_DIR' 2>/dev/null)\""; then
  readonly SNAPSHOT="qr-wallet-$(date -u +%Y%m%dT%H%M%SZ)-pre-$COMMIT.tar.gz"
  "${SSH[@]}" "$HOST" "tar -C '$REMOTE_DIR' -czf '$RELEASES_DIR/$SNAPSHOT' ."
  # Keep only the newest snapshots; older ones are pruned on the host.
  "${SSH[@]}" "$HOST" \
    "ls -1t '$RELEASES_DIR'/*.tar.gz 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -f --"
  echo "snapshot: ~/$RELEASES_DIR/$SNAPSHOT"
else
  readonly SNAPSHOT=""
  echo "live folder is empty; nothing to snapshot"
fi

# --- upload -----------------------------------------------------------------

log "Syncing dist/ to $HOST:$REMOTE_DIR/"
rsync -az --delete --exclude=.htaccess -e "ssh -o BatchMode=yes" \
  dist/ "$HOST:$REMOTE_DIR/"

if [[ -f deploy/htaccess ]]; then
  log "Uploading host configuration (deploy/htaccess)"
  scp -q -o BatchMode=yes deploy/htaccess "$HOST:$REMOTE_DIR/.htaccess"
  # Apache reads .htaccess as its own user, not as this account: a 0600 copy
  # makes it treat the whole folder as forbidden. scp copies the local mode,
  # so force a world-readable one on the host.
  "${SSH[@]}" "$HOST" "chmod 644 '$REMOTE_DIR/.htaccess'"
fi

# --- verify the public URL --------------------------------------------------

log "Verifying $PUBLIC_URL"
failed=0
check() { # url label expected  (expected is a case-insensitive substring)
  local url="$1" label="$2" expected="$3"
  local code type
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 -H 'Cache-Control: no-cache' "$url")"
  if [[ "$code" != "200" ]]; then
    printf '  FAIL %-32s HTTP %s\n' "$label" "$code" >&2
    failed=1
    return
  fi
  if [[ -n "$expected" ]]; then
    type="$(curl -sSI --max-time 30 -H 'Cache-Control: no-cache' "$url" \
      | tr -d '\r' | awk -F': ' 'tolower($1) == "content-type" { print $2; exit }' | tr 'A-Z' 'a-z')"
    if [[ "$type" != *"$expected"* ]]; then
      printf '  FAIL %-32s content-type %s (want %s)\n' "$label" "${type:-none}" "$expected" >&2
      failed=1
      return
    fi
  fi
  printf '  ok   %-32s\n' "$label"
}

check "$PUBLIC_URL?deploy=$COMMIT" "shell document" "text/html"

while IFS= read -r rel; do
  case "$rel" in
    *.js) expected="javascript" ;;
    *.css) expected="text/css" ;;
    *.webmanifest) expected="application/manifest+json" ;;
    *.png) expected="image/png" ;;
    *.woff2) expected="font/woff2" ;;
    *.txt) expected="text/plain" ;;
    *) expected="" ;;
  esac
  check "${PUBLIC_URL}${rel}?deploy=$COMMIT" "$rel" "$expected"
done < <(cd dist && find . -type f -printf '%P\n' | sort)

# The shell document must point at the artifacts this build produced, and the
# public service worker must be the one this build wrote: together those make a
# stale-cache deploy visible immediately.
js="$(cd dist && find assets -name '*.js')"
if ! curl -sS --max-time 30 -H 'Cache-Control: no-cache' "${PUBLIC_URL}?deploy=$COMMIT" | grep -qF "$js"; then
  printf '  FAIL %-32s does not reference %s\n' "shell document" "$js" >&2
  failed=1
else
  printf '  ok   %-32s %s\n' "shell references build" "$js"
fi

remote_hash="$(curl -sS --max-time 30 -H 'Cache-Control: no-cache' "${PUBLIC_URL}sw.js?deploy=$COMMIT" \
  | sed -n 's/^const BUILD_HASH = "\(.*\)";/\1/p')"
if [[ "$remote_hash" != "$BUILD_HASH" ]]; then
  printf '  FAIL %-32s served %s, built %s\n' "service worker" "${remote_hash:-none}" "$BUILD_HASH" >&2
  failed=1
else
  printf '  ok   %-32s %s\n' "service worker" "$BUILD_HASH"
fi

[[ "$failed" -eq 0 ]] || fail "deploy uploaded but the public URL failed verification"

cat <<EOF

Deployed $BRANCH @ $COMMIT to $PUBLIC_URL
Build hash: $BUILD_HASH
${SNAPSHOT:+Rollback snapshot: ~/$RELEASES_DIR/$SNAPSHOT}
Install it on a phone from that URL (HTTPS), then reload once online so the
shell is cached for offline use.
EOF
