## Getting Started

Needs [Docker](https://docs.docker.com/get-docker/) and [Node.js](https://nodejs.org/) 24.

On Linux, after installing Docker, start it (now and at every boot) and let your user run it without `sudo`, then log
out and back in:

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Ports `5432` (Postgres) and `6379` (Redis) must be free.
If Postgres or Redis is already installed on your computer,
stop it, for example:

```bash
sudo systemctl disable --now postgresql-18
sudo systemctl disable --now redis
```

The first time, get the code:

```bash
git clone https://github.com/tambia1/feature-flag-management.git
cd feature-flag-management
```

Create .env file and fill it like we have in .env.example

Then install and start required applications: Postgres and Redis.

```bash
docker compose up -d
```

Then install the libraries and create the database:

```bash
npm i
npm run db:deploy
npm run db:seed
```

Then run the development server (this will run frontend and backend):

```bash
npm run dev
```

After restarting the computer, run the same two commands again:

```bash
docker compose up -d
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

Redis is needed when we have 2 or more servers, so every server hears when a flag changes.
(It is used for Pub/Sub only, not cache)

Redis starts with `docker compose up -d`, and `REDIS_URL=redis://localhost:6379` in `.env` connects the app to it.

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
docker compose exec redis redis-cli SUBSCRIBE flag-changed
```
