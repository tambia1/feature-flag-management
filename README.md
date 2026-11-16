## Getting Started

First, run the development server (this will run frontend and backend):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result (frontend).
Log in as `a@a.com` with password `1234`.

Open [http://localhost:3000/api/docs](http://localhost:3000/api/docs) with your browser to see the result (backend api).

## Database

To see and edit the database tables, run Prisma Studio:

```bash
npx prisma studio
```

Open [http://localhost:51212](http://localhost:51212) with your browser to see the tables.

## Redis

Redis is needed when we have 2 or more server, so every server hears when a flag changes.
(It is used for BubSub only, not cache)

Set `REDIS_URL=redis://localhost:6379` in `.env` and restart `npm run dev`.

To see Redis, run Redis Commander:

```bash
npx redis-commander
```

Open [http://localhost:8081](http://localhost:8081) with your browser, open the app and change a flag, then run this in the command line at the bottom:

```
PUBSUB NUMSUB flag-changed
```

`1` or more means the app is connected and listening for flag changes.

To watch the messages when a flag changes:

```bash
redis-cli SUBSCRIBE flag-changed
```

To stop using Redis, set `REDIS_URL=` back to empty in `.env`.
