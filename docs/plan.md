# Build plan

Scope is exactly [assignment.md](assignment.md). Choices and their reasons are in [decisions.md](decisions.md); IDs like G3 refer to it. Each phase ends with something that starts with `docker compose up` and can be demoed.

## Layout

```text
Waymark/
├── docker-compose.yml, .env.example
├── gateway/nginx.conf
├── backend/                          NestJS monorepo (A3)
│   ├── apps/auth|users|posts|feed/   each with its own Dockerfile
│   └── libs/common/                  JWT guard, RabbitMQ queue config + consumer helper, event types, bootstrap
├── web/                              Next.js + Dockerfile
├── scripts/smoke.sh
└── docs/
```

## Containers

| Container | What | Host port |
|---|---|---|
| gateway | Nginx | 8080 |
| web | Next.js | — |
| auth, users, posts, feed | NestJS services | — |
| auth-db, users-db, feed-db | Postgres | — |
| mongo | MongoDB (posts) | — |
| redis | Redis (auth sessions in db 0, feed cache in db 1) | — |
| rabbitmq | RabbitMQ with management UI, pinned tag | 15672 |
| minio, minio-init | S3 storage (`pgsty` community build, A7); the init container creates the private bucket | 9000, 9001 |

## Services

| Service | Public API | Internal API | Events |
|---|---|---|---|
| auth | `/api/auth`: register, login, refresh, logout, providers, google, google/callback | — | publishes `user.created` |
| users | `/api/users`: me (get, patch), me/onboarding, username-available, by-username/:username, :id/followers, :id/following, :id/follow (POST, DELETE), me/requests, me/requests/:id/accept, me/requests/:id/reject | user by id (username, complete or not); following list with follower counts; can-view check | consumes `user.created` |
| posts | `/api/posts`: uploads (presign), create, get, edit, archive, unarchive, list by author, own archived | query by author ids with cursor; can-view check for one post | — |
| feed | `/api/feed` (cursor); `/api/interactions`: like (PUT, DELETE), stats, comments (list, create), delete own comment | — | — |

`user.created` carries `userId`, `username` and `dateOfBirth`; the last two are `null` for Google sign-ups.

## Data

- **auth-db** `accounts`: id, email (unique), password_hash (null for Google accounts), google_id (unique, null for email accounts), created_at.
- **users-db** `profiles`: id (same as the account id), username (unique, `NULL` until chosen: a unique index allows many `NULL`s but only one empty string), date_of_birth (`NULL` until given), display_name, bio, is_private, created_at. `follows`: follower_id, followee_id, status, timestamps; primary key (follower_id, followee_id); index (followee_id, status).
- **mongo** `posts`: authorId, authorUsername, title, caption, location {country, city, lat?, lng?}, tripStart, tripEnd, media [{key, type}], isArchived, timestamps; index {authorId, isArchived, createdAt: -1, _id: -1}.
- **feed-db** `likes`: primary key (post_id, user_id), created_at. `comments`: id, post_id, author_id, author_username, body, created_at; index (post_id, created_at, id).
- **redis**: `refresh:{tokenId}` (7 days), `author:{id}:top20` (60 s), `post:{id}:stats` (5 min).

## Key flows

**Signup.**
1. While the user types a username, the form calls `GET /api/users/username-available` (debounced) and shows "available" or "taken" with suggestions (I8).
2. `POST /api/auth/register` validates the input and returns 409 if the email is taken. It saves the account, sets the refresh cookie, returns `{accessToken, userId}`, and publishes `user.created` without waiting for the broker.
3. Users inserts the profile with `ON CONFLICT (id) DO NOTHING`. If the username belongs to another user, it inserts the profile with `username = NULL` instead.
4. The web app polls `/api/users/me` (I5). A profile without a username goes to `/onboarding` (I7), whose form uses the same live check.

With Google, the callback logs in a known Google account. For a new one it creates the account and publishes `user.created` without username or date of birth. Either way it sets the refresh cookie and redirects to `/`, where step 4 applies. If the email already has a password account, the user goes back to the login page (I6).

**Creating a post.**
1. `POST /api/posts/uploads` returns one pre-signed PUT URL per file.
2. The browser uploads each file to MinIO.
3. `POST /api/posts` sends the fields and the object keys. Post Service checks the keys (P2), copies the author's username from Users and saves the post.

**Loading the feed.** Feed gets the following list from Users (accepted follows only, with follower counts). The authors are those accounts plus the viewer.
- Page 1: popular authors' latest 20 posts come from `author:{id}:top20` (on a miss, query Posts and cache the result for 60 s); everyone else's come from one Posts query. Merge by `(createdAt, _id)` and take 20.
- Page 2 onward: one Posts query over all authors, older than the cursor.
- Then add like and comment counts (Redis, falling back to SQL) and whether the viewer liked each post (one SQL query).

**Post page.**
1. The server fetches the post from Posts as an anonymous visitor, and the counts and first page of comments from Feed, in parallel.
2. A public post renders fully, with meta tags. Otherwise the page renders `noindex`, and the browser fetches the post with the viewer's token and shows it or "not found" (W3).
3. If Feed fails, the page renders without likes and comments.

## Phases

### 0. Skeleton
- The layout above; Compose with healthchecks on the datastores and `depends_on`; Nginx routes; four Nest apps sharing one bootstrap (`api` prefix, ValidationPipe, Swagger, `/api/<service>/health`); web shell with Tailwind, React Query and Zustand; Dockerfiles; `.env.example`.
- **Done when** a clean `docker compose up --build` serves the web app on port 8080, every `/api/<service>/health` answers, and the bucket exists.

### 1. Identity
- Auth: accounts migration; Passport local strategy with argon2 hashes; Passport Google strategy (only when keys are set) with the `state` check and no account linking (I6); access and refresh JWTs with separate secrets (I3); refresh cookie; refresh; logout; `user.created` published after saving.
- `libs/common`: JWT guard (Bearer, access secret), optional guard, `@CurrentUser()`; RabbitMQ queue options shared by publisher and consumer; consumer helper (ack, 3 attempts, then reject into the DLQ).
- Users: profiles migration; `user.created` consumer (I5); `GET me`, `GET by-username`, `GET username-available` with suggestions (I8), `POST me/onboarding`; internal user-by-id.
- Web: register, login and onboarding pages, with the live username check on register and onboarding; Zustand session; fetch wrapper (Bearer, refresh on 401, retry once, else log out); session restore on page load; profile polling; redirect to `/login` on pages that need it; logout.
- **Done when:**
  - a browser signup lands on the feed page and the profile loads;
  - with `users` stopped, even if it has never run, signup succeeds and the profile appears once `users` starts;
  - typing a taken username shows "taken" with up to 3 free suggestions;
  - with `users` stopped, the live check can't answer and doesn't block: two signups with the same username both succeed, and after `users` starts, exactly one has the name while the other lands on `/onboarding`;
  - with RabbitMQ stopped, signup still succeeds and the web app shows the profile error state after 5 attempts;
  - a message that always fails ends up in `users_events.dlq` after 3 attempts;
  - with Google keys set, a user who abandons onboarding lands on `/onboarding` again on the next visit.

### 2. Social graph
- Users: follows migration; follow, unfollow or cancel, accept, reject, request again (G1), all requiring a complete profile (I7) and locking the target's profile row (G2); `PATCH me` (display name, bio, date of birth, private toggle); paged followers and following lists that respect privacy (G3); counts (G4); internal following and can-view endpoints. Unit tests for the follow rules.
- Web: profile page (header, counts, a Follow / Requested / Following button, notice for private profiles, follower lists); settings page; follow requests page.
- **Done when** following a public profile is instant, following a private one goes through request and accept or reject, a new request after a rejection follows the profile's current visibility, and switching to public accepts only the pending requests.

### 3. Posts & media
- Posts: schema and index; presign; create (checks per P2, username from Users); edit; get by id (G3) with signed media URLs (P3); list by author; archive and unarchive; archived list; internal query and can-view.
- Web: create and edit page (dropzone, 1–10 files, type and size checks); post page per W3; post grid on the profile; archive page.
- **Done when:**
  - a post with photos and a video can be created from the browser, with the files really uploaded to MinIO;
  - a public post's page HTML contains the post and its meta tags;
  - a non-follower gets 404 for a private account's post, and a media URL without a signature is refused;
  - a follower sees a private account's post on its page;
  - an archived post is visible only to its author.

### 4. Feed & interactions
- Feed: likes and comments migrations; like, unlike, comments (commenter's username from Users) and stats, each behind the Posts can-view check; stats cache; feed composition with the top-20 cache (threshold from env, set low for the demo). Unit tests for the merge and the cursor.
- Web: feed with `useInfiniteQuery`, IntersectionObserver and an empty state; like button; comments on the post page.
- **Done when:**
  - on a fixed dataset the feed pages through with no gaps or duplicates;
  - an archived post leaves followers' feeds within 60 s;
  - with `feed` stopped, post pages still render.

### 5. Wrap-up
- `scripts/smoke.sh` (curl and jq through the gateway): two users; a private follow with request and accept; upload, create, edit; feed; like and comment; archive and unarchive; token refresh; a non-follower getting 404 on a private post.
- README: how to run, a Mermaid architecture diagram, decisions and deviations (from decisions.md), limitations, a short scaling section.
- **Done when** on a fresh clone, `cp .env.example .env && docker compose up --build` followed by `scripts/smoke.sh` passes.

### Bonus (only after phase 5, in this order)
1. Outbox in Auth (fixes L5).
2. Thumbnail worker triggered through RabbitMQ.
3. Map or location filter.

## Known traps

- **MinIO has two addresses.** Services reach it at `http://minio:9000`, the browser at `http://localhost:9000`. Signed URLs must use the browser's address, so Posts keeps a second S3 client used only for signing.
- **Pre-signed PUT and Content-Type.** The AWS SDK signs only the `host` header by default, so a wrong type would still upload. `signableHeaders: ['content-type']` puts the type into the signature; the browser must then send exactly that `Content-Type`.
- **AWS SDK checksums break browser uploads.** Recent SDK versions add checksum parameters to pre-signed PUT URLs, which a plain browser upload can't satisfy. The S3 clients set `requestChecksumCalculation: 'WHEN_REQUIRED'`.
- **Don't wait for the `user.created` publish in the signup request.** While RabbitMQ is down the client may hold the message or fail; either way signup must neither hang nor fail (L5). Log publish errors.
- **Both sides declare `users_events`.** Nest's RabbitMQ client and server each declare the queue, so they need identical options from `libs/common`; a mismatch fails with `PRECONDITION_FAILED`. The consumer also declares the DLQ at startup, before anything can be rejected into it.
- **Acknowledge explicitly.** With manual acks, the consumer helper must ack or reject every message; don't rely on Nest to reject one when a handler throws.
- **Internal routes stay off `/api`.** `setGlobalPrefix('api', { exclude: [...] })` keeps `/internal/*` outside `/api`, and the gateway only forwards `/api`.
- **The web app needs two API base URLs.** Server-side fetches go to `http://gateway` on the Docker network; browser fetches go to `/api`.
- **MinIO images and docs.** `minio/minio` and `minio/mc` no longer exist on Docker Hub, and min.io's docs redirect to the commercial AIStor product. We use pinned `pgsty/minio` and `pgsty/mc` tags (A7); the community server's docs are in the archived `minio/minio` GitHub repo.
- **TypeScript 7 doesn't work with Nest CLI 12.** npm's `latest` TypeScript is 7.0 (the Go rewrite); the Nest CLI and its builders need `~6.0`. Keep the backend on 6.x.
- **Nest 12 projects are ESM.** Relative imports need the `.js` extension, and TypeORM relation properties need the `Relation<>` wrapper type, or circular entity imports fail at startup.
- **Nest 12's typed `@EventPattern` rejects `@Ctx()`.** With a plain string pattern, TypeScript picks the new typed overload, which types every parameter after the payload as `unknown`. `@EventPattern<string>(...)` selects the classic overload.
- **Nest's RabbitMQ client must keep auto-ack.** It listens on RabbitMQ's direct reply-to queue, which rejects manual acks, so `noAck: false` goes on the consumer's options only.
- **Nest's `AuthGuard` ignores Passport's `failureRedirect`.** It passes Passport a custom callback, so a failed Google login would be a 401 JSON page; the guard's `handleRequest` returns `null` instead, and the callback redirects to `/login`.
- **TypeORM's `.orIgnore()` emits `ON CONFLICT DO NOTHING` without a target,** which would also swallow a taken-username error. The `user.created` insert uses raw SQL with `ON CONFLICT (id)`.
- **RabbitMQ's management API counts lag by about 5 seconds.** Re-read queue depths before trusting them in tests.
- **Vitest doesn't see the `@app/common` path.** The apps' tsconfigs exclude spec files, so Vite's tsconfig-paths support never applies to them; `vitest.config.ts` sets the alias directly.
- **The Rspack builder's packages aren't installed by the monorepo schematic.** The backend needs `@rspack/core`, `webpack-node-externals` and `tsconfig-paths-webpack-plugin` as dev dependencies.
