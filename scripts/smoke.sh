#!/usr/bin/env bash
# Runs the main flows through the gateway against a running stack
# (`docker compose up --build`). Needs curl and jq. Every run creates two new
# users, so it can be repeated. BASE_URL overrides http://localhost:8080.
set -euo pipefail

BASE=${BASE_URL:-http://localhost:8080}
RUN=$(date +%s)$((RANDOM % 1000))
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

step() { printf '• %s\n' "$*"; }
fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

# call STATUS METHOD PATH [--token T] [--json BODY] [--jar FILE]
# Prints the response body and fails unless the status matches.
call() {
  local expected=$1 method=$2 path=$3
  shift 3
  local args=(-s -o "$TMP/body" -w '%{http_code}' -X "$method")
  while (($#)); do
    case $1 in
      --token) args+=(-H "Authorization: Bearer $2") ;;
      --json) args+=(-H 'Content-Type: application/json' --data "$2") ;;
      --jar) args+=(-b "$2" -c "$2") ;;
    esac
    shift 2
  done
  local status
  status=$(curl "${args[@]}" "$BASE$path")
  if [[ $status != "$expected" ]]; then
    fail "$method $path: expected $expected, got $status: $(cat "$TMP/body")"
  fi
  cat "$TMP/body"
}

# check JSON JQ_FILTER DESCRIPTION: fails unless the filter is true.
check() {
  jq -e "$2" <<<"$1" >/dev/null || fail "$3: $1"
}

# http_status URL [curl args…]: the status of a request outside the gateway (MinIO).
http_status() {
  local url=$1
  shift
  curl -s -o /dev/null -w '%{http_code}' "$@" "$url"
}

step 'services are up'
for service in auth users posts feed; do
  call 200 GET "/api/$service/health" >/dev/null
done

# register NAME: sets NAME_ID and NAME_TOKEN; the refresh cookie goes to $TMP/NAME.jar.
register() {
  local name=$1 username="${1}_$RUN" session
  session=$(call 201 POST /api/auth/register --jar "$TMP/$name.jar" --json "$(jq -nc \
    --arg email "$username@example.com" --arg username "$username" \
    '{email: $email, password: "smoke-password", username: $username, dateOfBirth: "1995-06-15"}')")
  printf -v "${name}_ID" '%s' "$(jq -r .userId <<<"$session")"
  printf -v "${name}_TOKEN" '%s' "$(jq -r .accessToken <<<"$session")"
}

# The profile is created from user.created, asynchronously (I5).
wait_for_profile() {
  for _ in $(seq 20); do
    [[ $(http_status "$BASE/api/users/me" -H "Authorization: Bearer $1") == 200 ]] && return
    sleep 0.5
  done
  fail 'the profile was never created: is Users consuming user.created?'
}

step 'two users sign up and get their profiles'
register alice
register bob
wait_for_profile "$alice_TOKEN"
wait_for_profile "$bob_TOKEN"

step 'bob makes his account private'
profile=$(call 200 PATCH /api/users/me --token "$bob_TOKEN" --json '{"isPrivate": true}')
check "$profile" '.isPrivate == true' 'bob is private'

step 'bob uploads a photo to MinIO with a pre-signed URL and creates a post'
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' |
  base64 -d >"$TMP/photo.png"
size=$(wc -c <"$TMP/photo.png" | tr -d ' ')
upload=$(call 200 POST /api/posts/uploads --token "$bob_TOKEN" \
  --json "{\"files\": [{\"contentType\": \"image/png\", \"size\": $size}]}")
key=$(jq -r '.[0].key' <<<"$upload")
status=$(http_status "$(jq -r '.[0].uploadUrl' <<<"$upload")" \
  -X PUT -H 'Content-Type: image/png' --data-binary "@$TMP/photo.png")
[[ $status == 200 ]] || fail "upload to MinIO: $status"
post=$(call 201 POST /api/posts --token "$bob_TOKEN" --json "$(jq -nc --arg key "$key" '{
  title: "Smoke trip", caption: "Created by scripts/smoke.sh",
  location: {country: "PT", city: "Lisbon", lat: 38.72, lng: -9.14},
  tripStart: "2026-05-01", tripEnd: "2026-05-03", media: [{key: $key}]}')")
POST_ID=$(jq -r .id <<<"$post")

step 'bob edits the post'
post=$(call 200 PATCH "/api/posts/$POST_ID" --token "$bob_TOKEN" --json '{"title": "Smoke trip, edited"}')
check "$post" '.title == "Smoke trip, edited"' 'edited title'

step 'a non-follower and an anonymous visitor get 404 for the private post'
call 404 GET "/api/posts/$POST_ID" --token "$alice_TOKEN" >/dev/null
call 404 GET "/api/posts/$POST_ID" >/dev/null

step 'alice requests to follow bob, bob accepts'
follow=$(call 200 POST "/api/users/$bob_ID/follow" --token "$alice_TOKEN")
check "$follow" '.relationship == "requested"' 'follow request is pending'
requests=$(call 200 GET /api/users/me/requests --token "$bob_TOKEN")
check "$requests" "any(.items[]; .id == \"$alice_ID\")" "alice's request is listed"
call 204 POST "/api/users/me/requests/$alice_ID/accept" --token "$bob_TOKEN" >/dev/null

step 'alice now sees the post and its photo; the photo needs a signed URL'
post=$(call 200 GET "/api/posts/$POST_ID" --token "$alice_TOKEN")
media_url=$(jq -r '.media[0].url' <<<"$post")
[[ $(http_status "$media_url") == 200 ]] || fail 'signed media URL should load'
[[ $(http_status "${media_url%%\?*}") == 403 ]] || fail 'unsigned media URL should be refused'

step "bob's post is in alice's feed"
feed=$(call 200 GET /api/feed --token "$alice_TOKEN")
check "$feed" "any(.items[]; .id == \"$POST_ID\")" "feed has bob's post"

step 'alice likes and comments'
stats=$(call 200 PUT "/api/interactions/posts/$POST_ID/like" --token "$alice_TOKEN")
check "$stats" '.likeCount == 1 and .likedByMe' 'like counted'
call 201 POST "/api/interactions/posts/$POST_ID/comments" --token "$alice_TOKEN" \
  --json '{"body": "Looks great!"}' >/dev/null
comments=$(call 200 GET "/api/interactions/posts/$POST_ID/comments" --token "$alice_TOKEN")
check "$comments" '.items[0].body == "Looks great!"' 'comment listed'
stats=$(call 200 GET "/api/interactions/posts/$POST_ID/stats" --token "$alice_TOKEN")
check "$stats" '.likeCount == 1 and .commentCount == 1' 'stats'

step 'bob archives the post: only bob sees it, then he unarchives it'
call 200 POST "/api/posts/$POST_ID/archive" --token "$bob_TOKEN" >/dev/null
call 404 GET "/api/posts/$POST_ID" --token "$alice_TOKEN" >/dev/null
archived=$(call 200 GET /api/posts/archived --token "$bob_TOKEN")
check "$archived" "any(.items[]; .id == \"$POST_ID\")" 'post is in the archive'
call 200 POST "/api/posts/$POST_ID/unarchive" --token "$bob_TOKEN" >/dev/null
call 200 GET "/api/posts/$POST_ID" --token "$alice_TOKEN" >/dev/null

step 'the refresh cookie gives alice a new access token; after logout it no longer does'
session=$(call 200 POST /api/auth/refresh --jar "$TMP/alice.jar")
me=$(call 200 GET /api/users/me --token "$(jq -r .accessToken <<<"$session")")
check "$me" ".id == \"$alice_ID\"" 'new access token works'
# Keep a copy of the cookie: logout clears it, but the server must also forget it.
cp "$TMP/alice.jar" "$TMP/alice-old.jar"
call 204 POST /api/auth/logout --jar "$TMP/alice.jar" >/dev/null
call 401 POST /api/auth/refresh --jar "$TMP/alice-old.jar" >/dev/null

printf '\nAll smoke checks passed.\n'
