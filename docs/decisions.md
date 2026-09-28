# Decisions

Requirements come from [assignment.md](assignment.md): the spec plus the assessor's clarifications. This log records each choice the spec leaves open and each departure from it. The README's "Decisions & deviations" section is built from it. **Deviation** marks our own departure from the spec or the clarifications; where a clarification changes the spec, the entry cites it instead.

**Simplicity rule:** a mechanism that is only justified by assuming something the assignment doesn't ask for (scale, a compromised service, sub-minute freshness, hostile uploads) is left out, and the gap is listed under Known limitations.

## Scope

- **S1. What's built:** the spec plus the clarification's page list, and a header box that opens a profile by exact username (without it there is no way to reach someone to follow). **Not built:** search, notifications, admin/user management, account deletion, post deletion (archiving covers it), linking a Google login to an existing email account, server rendering of private posts, deleting media files, nested comments, uploaded avatars (initials are shown instead), tags, feed ranking, map, cloud deployment, load tests.
- **S2. Bonuses** (outbox, thumbnails) come only after everything required works.

## Architecture

- **A1. Gateway.** Nginx serves one origin, `http://localhost:8080`. `/` goes to Next.js; `/api/auth`, `/api/users`, `/api/posts`, `/api/feed` and `/api/interactions` go to the owning service. Internal endpoints live outside `/api`, so they can't be reached through the gateway.
- **A2. Datastores.** Each Postgres-backed service (auth, users, feed) gets its own Postgres container. Posts use MongoDB, media uses MinIO. One Redis is shared by Auth (db 0, sessions) and Feed (db 1, cache). *Why:* durable data is isolated per service; Redis holds only sessions and cache.
- **A3. Code layout.** A NestJS monorepo (`backend/apps/{auth,users,posts,feed}`, `backend/libs/common`) plus `web/`. Each service still has its own Dockerfile, container, database and env. `libs/common` holds only cross-cutting code: the JWT guard, RabbitMQ queue config and consumer helper, event types, the keyset cursor format and page types (Feed builds cursors that Posts reads), the User Service client that Posts and Feed share, app bootstrap. *Why:* shared code without publishing packages. *Trade-off:* one dependency tree for all services.
- **A4. Schema changes.** TypeORM migrations run when a service starts; `synchronize` is off.
- **A5. Events.** Only `user.created` travels over RabbitMQ (Auth → Users), using NestJS's built-in RabbitMQ transport.
  - One durable queue, `users_events`, declared with the same options by publisher and consumer, so a message sent before Users first starts is kept.
  - Users acknowledges a message after handling it. A failing handler is retried 3 times in-process; then the message is rejected into `users_events.dlq`. Handling is idempotent (I5).
  - Auth publishes after saving the account and doesn't wait for the broker (L5).
  - *Why so little:* the spec uses RabbitMQ for this one event, which has one consumer. A topic exchange pays off once an event has several consumers.
- **A6. Internal calls.** Plain HTTP over the Docker network with a 2 s timeout; failures become 503. No service-to-service auth (L6).
- **A7. MinIO image — deviation.** MinIO runs from `pgsty/minio` (with `pgsty/mc` for bucket setup), a maintained community build pinned to a release tag. *Why:* MinIO withdrew its official images from Docker Hub and quay.io, and archived its repositories. The S3 code only talks to the S3 API, so switching images, or moving to real S3, needs no code change.

## Identity

- **I1. Profile ownership** (clarification 7 changes the spec). User Service owns the profile, including allocating usernames. Auth stores only credentials: email, password hash, Google user id. The signup form collects username and date of birth; Auth checks their format and passes them on in `user.created` without storing them.
- **I2. Usernames can't be changed once set.** Our own restriction; editing a username wasn't asked for. *Why:* posts and comments store the author's username (P1, F1), and a username that never changes can't go stale there.
- **I3. Tokens:** the classic access + refresh pair. Both are HS256 JWTs carrying only the user id. The access token (15 min) is signed with a secret shared by all services, each of which verifies it itself. The refresh token (7 days) is signed with a second secret that only Auth has, and Redis keeps an entry for each one issued (`refresh:{tokenId}`, same lifetime). `POST /api/auth/refresh` checks the signature and the Redis entry, then returns a new access token; logout deletes the entry. *Why two secrets:* a refresh token can never pass as an access token. No rotation (L2); shared secret (L12).
- **I4. Token storage.** The access token lives in memory (Zustand). The refresh token is an `httpOnly`, `SameSite=Lax` cookie scoped to `/api/auth` (`Secure` in production). On page load the app calls refresh to restore the session. API calls send `Authorization: Bearer`, so they aren't exposed to CSRF; the two cookie endpoints (refresh, logout) are POST, and `SameSite=Lax` keeps the cookie off cross-site POSTs. *Why:* it's the flow the spec describes (catch a 401, call refresh), and server rendering doesn't need to know who the viewer is (W3).
- **I5. Signup** (clarification 7). Auth saves the account, returns an access token with the refresh cookie, then publishes `user.created`. Users creates the profile with `ON CONFLICT (id) DO NOTHING`, so a redelivered event never overwrites a profile, including one completed on `/onboarding`. If the username belongs to another user, the profile is created with `username = NULL` (I7). The web app polls `/api/users/me` with exponential backoff, up to 5 attempts, showing a skeleton meanwhile and an error state after.
- **I6. Google login.** The strategy is registered only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; without them the button is hidden (the login page asks `GET /api/auth/providers`) and email login still works. Accounts are matched by Google's user id. A first Google login creates the account and publishes `user.created` without username or date of birth; the user completes the profile on `/onboarding` (I7). If the Google email already belongs to an email-and-password account, nothing is linked: the user is sent to the login page with "This email already has an account. Log in with your password." *Why:* email signup doesn't verify addresses, so automatic linking would let whoever registered the address first keep password access to the Google user's account. The OAuth `state` value is checked by Passport's built-in store, backed by a short-lived session cookie on the Google routes only.
- **I7. Incomplete profiles.** A profile without a username is incomplete: a new Google user, or a signup whose username was taken. The web app sends such users to `/onboarding` on every visit until it's done, so an abandoned onboarding resumes. `POST /api/users/me/onboarding` sets the username and, if missing, the date of birth, once. Posting, following and commenting require a complete profile.
- **I8. Username availability** (as Instagram does it). While the user types, the signup and onboarding forms call `GET /api/users/username-available` (debounced). It answers whether the name is free and, if it isn't, suggests up to 3 free variants checked in one query. The answer is advisory: the binding check is the unique index when the profile is created (I5), and a name taken in between is handled on `/onboarding` (I7). If the check can't answer (User Service down), the form says so and still lets the user sign up. Usernames are public, so the check reveals nothing new.

## Social graph

- **G1. Following.** Following a public profile is `ACCEPTED` at once. Following a private one is `PENDING` until the owner accepts or rejects. Unfollowing, or cancelling a request, deletes the row. A new request after a rejection is handled like a first request.
- **G2. Privacy changes** (clarification 8). Switching from private to public accepts every `PENDING` request in one transaction; `REJECTED` rows stay rejected. Switching from public to private keeps existing followers. Every follow change and the toggle first lock the target's profile row (`SELECT … FOR NO KEY UPDATE`), so a request can't slip in as `PENDING` while the profile turns public. `NO KEY UPDATE` rather than `FOR UPDATE`, which would block the foreign-key check on the follower's row and deadlock two users following each other at once.
- **G3. Visibility.** Authors always see their own posts. Anyone else sees a post only if it isn't archived and the author is public or the viewer is an accepted follower. Otherwise the API returns 404, which doesn't reveal that the post exists. Media follows the same rules (P3). A private profile's header (name, bio, counts) is visible to everyone; its posts and follower lists aren't.
- **G4. Counts** of followers and following are computed per request with indexed `COUNT` queries, not stored.

## Posts & media

- **P1. Post fields** (clarification 3): title, caption, location (country, city as text, coordinates optional), trip start and end dates (end not before start), 1–10 media files in display order, the first being the cover. No tags. Post Service copies the author's username from User Service when the post is created (I2).
  - *Country* is an ISO 3166-1 alpha-2 code picked from a searchable list, so "UK" and "United Kingdom" can't both occur; the browser shows the name from its own `Intl` data. Flags are emoji drawn with the Twemoji country-flag font (from `country-flag-emoji-polyfill`, self-hosted, loaded only for flag characters), because Windows has no flag emoji. Posts from before this keep their free text and show it as typed.
  - *Coordinates* aren't typed in: "Find on map" looks up the city with OpenStreetMap's Nominatim, from the browser and only on click (L16).
- **P2. Uploads.** The browser asks Post Service for one pre-signed PUT URL per file (content type fixed in the signature), uploads each file straight to MinIO, then creates the post with the object keys. Post Service checks that every key is under `uploads/{userId}/`, exists, and has an allowed type and size, read from storage. Limits: images (JPEG, PNG, WebP) up to 10 MB, videos (MP4, WebM, MOV) up to 100 MB. A file over the limit is rejected when the post is created, not during the upload. The form shows upload progress (XMLHttpRequest, since `fetch` can't report it), and a save that fails after the uploads doesn't upload the files again.
  - Before uploading, the browser reads each file's average colour and pixel size (a canvas; the first frame for videos) and sends them with its key. They only drive placeholders and card tints, so they aren't checked against the file (L15).
- **P3. Media access — deviation.** The bucket is private, and posts store object keys rather than URLs (the spec says the database stores the URL). Whenever Post Service returns a post, it signs a 1-hour read URL for each file, so media follows the post's visibility (G3). Only public posts get an `og:image` tag (L3).
- **P4. Editing.** Every field and the set of media can change (still 1–10 files); only the author can archive or unarchive. Files dropped from a post stay in storage (L4).

## Feed & interactions

- **F1. Storage** (clarification 5). Likes and comments live in Feed Service's own Postgres; Redis is only a cache. Comments are flat, up to 1,000 characters, listed newest first, and authors can delete their own. The commenter's username is copied from User Service when the comment is created (I2). Liking and unliking are idempotent. Before any like, unlike or comment, and before returning counts or comments, Feed asks Post Service whether the viewer can see the post; if not, it answers 404 (G3).
- **F2. What's in the feed.** The viewer's own posts plus posts by accounts they follow (accepted), excluding archived posts, newest first, 20 per page. The cursor is `(createdAt, _id)`. On an unchanging dataset, paging has no gaps or duplicates; posts created after page 1 loaded appear on the next refresh.
- **F3. Caching** (spec and clarification 5).
  - *Popular authors' top 20.* For authors with at least `POPULAR_FOLLOWER_THRESHOLD` followers (2 in `.env.example`, so a demo with a few accounts goes through the cache), their latest 20 non-archived posts are cached in Redis (`author:{id}:top20`, 60 s). Page 1 of a feed merges these lists with one query over the other authors; later pages are a single query. Nothing invalidates the cache, so a list can be up to 60 s old (L11). The viewer's own posts never come from the cache, so authors see their own changes at once.
  - *Like and comment counts.* Cache-aside (`post:{id}:stats`, 5 min), deleted on every like or comment change.
  - *Interpretation of clarification 5:* per-user first feed pages aren't cached. Each would need invalidating whenever any followed author posts; the per-author cache already makes page 1 cheap.
- **F4. Degradation.** If Feed Service is down, post pages still render, without likes and comments. The feed itself needs User and Post Services (L7). If Redis is down, Feed skips the cache and reads from Postgres and Post Service.

## Frontend

- **W1. Stack.** Next.js App Router, Tailwind CSS, React Query for server data, Zustand for the session, react-hook-form with zod for forms, react-dropzone for picking files.
- **W2. Auth handling.** One fetch wrapper adds the access token; on a 401 it calls refresh (one call shared by concurrent 401s), retries the request once, and logs out only if the refresh token is rejected; if Auth can't answer, the request fails and the session stays. Pages that need login redirect to `/login` when no session could be restored.
- **W3. Server rendering.** `/p/[id]` renders on the server what an anonymous visitor may see: a public post with title, description and `og:image` meta tags, its counts and first comments. Anything else (a private or archived post, or no post) gets a `noindex` page that loads the post in the browser with the viewer's token and shows it or "not found". Personal parts (liked by me, edit and archive buttons) always load in the browser. *Why:* SEO is the reason for server rendering, it only concerns public posts, and crawlers are anonymous.
- **W4. Media display.** Plain `<img>` and `<video>`: Next's image optimizer runs inside the container and can't reach `localhost:9000`. Each file's box gets its size and colour before the file loads (P2), so pages don't jump.
- **W5. Visual design.** Photo-led and editorial: Lora for titles and Manrope for the interface (a travel-journal feel with readable controls), cards and the post page washed with the cover's colour, and the feed laid out along a dashed trail with a painted marker per post in the author's colour (the name: a waymark is the painted stripe that guides hikers). Locations show a flag and, when present, coordinates. Two content widths: narrow for forms, wide for content. Light, dark or system theme, kept in `localStorage` as a per-browser preference, applied before first paint.

## Quality

- **Q1.** class-validator on every DTO, rejecting unknown fields. Swagger per service at `/api/<service>/docs`. Unit tests for the follow rules, the cursor format and the feed merge, including paging a fixed dataset with no gaps or duplicates. `scripts/smoke.sh` runs the main flows through the gateway.

## Known limitations

- **L1.** Logout ends the session, but an access token already issued stays valid until it expires (at most 15 min). It only lived in the tab's memory, so this matters only if it was stolen, for example through XSS.
- **L2.** Refresh tokens aren't rotated, so a stolen one works until logout or expiry. Improvement: issue a new refresh token on every refresh and revoke the session when an old one is reused.
- **L3.** A signed media URL keeps working until it expires (1 h), even after the viewer unfollows or the post is archived. `og:image` links of public posts expire too, so social previews lose their image after an hour. In production: a CDN with signed cookies, and long-lived public URLs for public posts.
- **L4.** Files are never deleted: uploads never attached to a post, files dropped from a post, and uploads rejected for size stay in storage. In production: a lifecycle rule or cleanup job.
- **L5.** If RabbitMQ is unavailable at signup, `user.created` can be lost: the profile is never created and the web app shows its error state. The outbox pattern (bonus) fixes this.
- **L6.** Internal endpoints trust the Docker network; there's no service-to-service auth.
- **L7.** The feed calls User and Post Services synchronously; if either is down, the feed returns 503.
- **L8.** The full following list is fetched on every feed request. Fine at demo scale.
- **L9.** No rate limiting on login, signup or the username check.
- **L10.** No media processing; videos play as uploaded.
- **L11.** Popular authors' posts in other users' feeds can be up to 60 s old: a new post can be missing, an edit not yet shown, an archived post still listed.
- **L12.** All services share the access-token secret, so any of them could issue access tokens. Improvement: RS256, with only Auth holding the private key.
- **L13.** The Google OAuth handshake keeps its state in Auth's memory for a few minutes: fine for one Auth instance, but a restart in the middle of a Google login makes that login fail. With several instances it would need a shared store such as Redis.
- **L14.** Like and comment counts are deleted from the cache on every change, but a read that races a change can put the old count back; it stays until it expires (at most 5 min).
- **L15.** A media file's colour and size come from the client, so a modified client could send wrong ones; the worst case is an odd placeholder colour or aspect ratio. A thumbnail worker (bonus) could compute them server-side.
- **L16.** "Find on map" needs internet access and depends on Nominatim's public service and its usage policy (at most one request a second); without it, posts are saved without coordinates.
