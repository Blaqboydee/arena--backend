# Arena — Backend

Real-time game server for [Arena](https://arenagameplay.vercel.app) — Express + Socket.io, with one pluggable engine per game.

## Run locally

```bash
npm install
npm run dev        # starts on http://localhost:3000
```

With no database configured the server runs in **ephemeral mode**: every game
works, but identity and match history are not persisted. That's fine for local
play and keeps dev friction-free.

## Architecture

```
src/
├── index.js                 # Socket.io wiring — routes events to game engines
├── db.js                    # Prisma client (optional; off if no DATABASE_URL)
├── platform/                # Game-agnostic infrastructure
│   ├── identityManager.js   #   durable guest/user identity (Postgres)
│   ├── sessionManager.js    #   per-socket name/avatar (socket.data)
│   ├── roomManager.js       #   rooms + invite codes + player limits
│   └── lobbyManager.js      #   matchmaking queues + live counts
├── games/                   # One engine per game (start/move/forfeit/cleanup)
└── prisma/schema.prisma     # Persistence schema
```

The in-match player key is `socket.id`. `User.id` (from Postgres) is the
**persistent** identity that match history, leaderboards and leagues reference.

## Persistence (optional but required for launch)

Identity, match history, leaderboards, leagues and prizes all read from Postgres.
Enable it by setting `DATABASE_URL`.

1. Create a free Postgres database — [Neon](https://neon.tech) works well with
   Render. Copy its connection string.
2. Configure env:
   ```bash
   cp .env.example .env
   # set DATABASE_URL="postgresql://…?sslmode=require"
   ```
3. Create the tables:
   ```bash
   npm run db:migrate       # dev: creates + applies a migration
   # or, on a deploy host:
   npm run db:deploy        # applies committed migrations only
   ```
4. Start the server — it logs `[db] persistence enabled (Postgres)`.

### Scripts

| Script              | What it does                                        |
|---------------------|-----------------------------------------------------|
| `npm run dev`       | Start the server                                    |
| `npm run db:generate` | Regenerate the Prisma client (runs on `install`)  |
| `npm run db:migrate`  | Create + apply a migration (local dev)            |
| `npm run db:deploy`   | Apply committed migrations (production)            |
| `npm run db:studio`   | Open Prisma Studio to browse the DB               |

### Deploy to Render

1. **Environment** → set in the Render dashboard:
   - `DATABASE_URL` — your Neon connection string.
   - `NODE_ENV=production` — disables the permissive dev CORS patterns.
2. **Build command**: `npm install && npm run db:deploy`
   (`npm install` regenerates the Prisma client via `postinstall`; `db:deploy`
   applies any committed migrations. `prisma` is a regular dependency so this
   works even with `NODE_ENV=production`.)
3. **Start command**: `npm start`

With no `DATABASE_URL` the deploy still boots — in ephemeral mode — so a missing
env var degrades instead of crashing.

## Identity model (hybrid guest + claimable account)

- On first connect the server mints a durable **guest** `User` and sends a token
  back via the `identity` event; the client stores it in `localStorage` and
  replays it in the socket handshake on every future connect.
- `set_session` persists the player's chosen name / avatar color onto that User.
- Claiming a real account (Google / email — a later step) attaches an `Identity`
  row to the same User and keeps all history.
