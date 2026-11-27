## Getting Started

Needs [Docker](https://docs.docker.com/get-docker/) and [Node.js](https://nodejs.org/) 24.

On Linux, after installing Docker, start it (now and at every boot) and let your user run it without `sudo`, then log
out and back in:

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Ports `5432` (Postgres), `6379` and `6380` (Redis), `8333` (S3) and `9324` (queue) must be free.
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

Then start the services the app needs: Postgres, two Redis, S3 (SeaweedFS) and the queue (ElasticMQ).

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

And in a second terminal, the worker that makes company icons:

```bash
npm run worker
```

After restarting the computer, run the same commands again:

```bash
docker compose up -d
npm run dev
npm run worker
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

There are two Redis, each with one job (neither is a cache):

- Flag updates (`FLAGS_REDIS_URL`, port 6379): every server hears when a flag changes (Pub/Sub). Needed with 2 or more servers.
- Server status (`STATUS_REDIS_URL`, port 6380): every server posts its numbers here for the Status page.

Both start with `docker compose up -d`.

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
docker compose exec redis-flags redis-cli SUBSCRIBE flag-changed
```

## Company icons: S3, queue and worker

1. The browser asks the app for a presigned URL and uploads the image straight to S3.
2. The app adds a job to the icon queue (SQS).
3. The worker (`npm run worker`) takes the job, makes the 1024px and 64px icons, saves them to S3 and updates the company.
4. A job that fails 3 times moves to the `icons-dead-letters` queue.

Locally, S3 is SeaweedFS and SQS is ElasticMQ, both started by `docker compose up -d`.

To see how many jobs wait in the queue (use `icons-dead-letters` for the failed ones):

```bash
curl "http://localhost:9324/000000000000/icons?Action=GetQueueAttributes&AttributeName.1=ApproximateNumberOfMessages"
```

To list the uploaded files:

```bash
docker compose exec s3 weed shell -master=localhost:9333 <<< "fs.ls /buckets/feature-flags-uploads/companies"
```
