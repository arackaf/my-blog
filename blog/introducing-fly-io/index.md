---
title: Introducing Fly.io
date: "2024-11-28T10:00:00.000Z"
description: An introduction to building applications with Fly.io
---

[Fly.io](https://fly.io/) is an increasingly popular infrastructure platform—basically a place to deploy your applications, like Vercel or Netlify, but with some different tradeoffs (and a lot of similarities).

This post will introduce the platform, show how to deploy web apps, stand up databases, and some other fun things. If you leave here wanting to learn more, the docs [are here](https://fly.io/docs/) and are outstanding.

## What is Fly?

Where platforms like Vercel and Netlify run your app on serverless functions which spin up, and die off as needed (Vercel uses AWS Lambda, and Netlify has their own serverless functions), Fly runs your machines on actual VM's, running in their infrastructure. These VMs can be configured to scale up as your app's traffic grows, just like with serverless functions; but being continuously running, they won't cold start. That said, if you're on a budget, or your app isn't that important (or both) you can also configure Fly to scale your app down to zero machines when traffic dies. You'll be billed essentially nothing during those periods of inactivity, though your users will see a cold start time if they're the first to hit your app during an inactive period.

To be perfectly frank, the cold start problem has been historically exaggerated, so please don't pick a platform just to avoid cold starts. It's honestly not a huge problem in practice.

## Why VMs

You might be wondering why, if cold starts aren't a big deal in practice, one should care about Fly using VMs instead of cloud functions. For me there's two reasons: the ability to execute long-running processes, and the ability to run anything that will run in a Docker image. Let's dive into both.

The ability to handle long-running processes greatly expands the range of apps Fly can run. They have turn-key solutions for Phoenix LiveView, Laravel, Django, Postgres, and lots more. Anything you ship on Fly will be via a Dockerfile (don't worry, they'll help you generate them). That means anything you can put into a Dockerfile, can be run by Fly. If there's a niche database you've been wanting to try (Neo4J, CouchDB, etc), just stand one up via a Dockerfile (and both of those DBs have official images), and you're good to go. New databases, new languages, new anything: if there's something you've been wanting to try, you can run it on Fly if you can containerize it; and anything can be containerized.

## But I don't know Docker

Don't worry, Fly will, as you're about to see, help you scaffold a Dockerfile from any common app framework. We'll take a quick look at what's generated, and explain the high points. That said, Docker is one of the most valuable tools for a new engineer to get familiar with, so if Fly motivates you to learn more, so much the better!

## Let's launch an app!

Ok let's ship something. Let's create a brand new Next.js app, using the standard scaffolding [here](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

We'll create an app, run `npm i` and then `npm run dev` and verify that it works.

![Running next app](/fly-io/img-1-next-app.png)

Now let's deploy it to Fly. If you haven't already, install the Fly cli, and sign up for an account. Instructions can be found in the first few steps of the [quick start guide](https://fly.io/docs/getting-started/launch/).

Now, as I said, to deploy an app on Fly, you need to containerize your app. We _could_ manually piece together a valid Dockerfile that would run our Next app, and then run `fly deploy`. But that's a tedious process, and thankfully Fly has made life easier for us. Instead, we can just run `fly launch` from our app's root directory.

![Fly launch](/fly-io/img-2-fly-launch-initial.png)

Fly easily detected Next.js, and then made some best guesses as to deployment settings. It opted for the third cheapest deployment option. Full pricing can be found [here](https://fly.io/docs/about/pricing/). Fly let's us accept these defaults, or tweak them. Let's hit yes to tweak. We should be taken to the fly.io site, where our app is in the process of being set up.

![Fly settings initial](/fly-io/img-3-default-settings.png)

For fun, let's switch to the cheapest option, and change the region to Virginia (what aws would call us-east-1).

![Fly settings initial](/fly-io/img-4-updated-settings.png)

Hit confirm, and return to your cli. It should finish setting everything up, which should look like this, in part.

![Fly settings updated](/fly-io/img-5-cli-finish.png)

If we head over to our [Fly dashboard](https://fly.io/dashboard), we should see something like this:

![Fly dashboard](/fly-io/img-6-fly-dashboard.png)

We can then click that app and see the app's details

![App in dashboard](/fly-io/img-7-app-in-dashboard.png)

And lastly, we can go to the url listed, and see the app actually running

![App running](/fly-io/img-8-app-running.png)

## Looking closer

There's a number of files that Fly created for us. The two most important are the Dockerfile, and fly.toml. Let's take a look at each. We'll start with the Dockerfile.

```docker
# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.18.1
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Next.js"

# Next.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
```

### Quick Docker detour

Docker is a book unto its own, but as an extremely quick intro, Docker allows us to package our app into a "container." Containers allow you to start with an entire, but minimal operating system (almost always a Linux distro), and allow you to do ... whatever you want with it. Docker then packages whatever you create, and allows it to be run. The Docker image is completely self-contained. You choose the whatever goes into it, from the base operating system, down to whatever you install into the image. Again, they're self-contained.

Now let's take a quick tour of the important pieces of our Dockerfile.

After some comments and labels, we find what will always be present at the top of a Dockerfile: the FROM command.

```docker
FROM node:${NODE_VERSION}-slim as base
```

This tells us the base of the image. We could start with any random Linux distro, and then install Node and npm, but unsurprisingly there's already an officially maintained Node image: there will almost always be officially maintained Docker images for almost any technology. In fact, there's many different Node images to choose from, many with different underlying base linux distro's. You can see them all [here](https://hub.docker.com/_/node)

There's a LABEL that's added, likely for use with Fly. Then we set the working directory in our image

```docker
WORKDIR /app
```

We copy the package.json, and lock files

```docker
# Install node modules
COPY package-lock.json package.json ./
```

Then run `npm i` (but in our Docker image)

```docker
RUN npm ci --include=dev
```

Then we copy the rest of the application code

```docker
# Copy application code
COPY . .
```

Hopefully you get the point. We won't go over every line, here. But hopefully the general idea is clear enough, and hopefully you'd feel comfortable tweaking this if you wanted to. Two last points though. This

```docker
# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3
```

tells the linux package manager to install some things Fly thinks Next might need, but in actuality [probably doesn't](https://x.com/leeerob/status/1862312276985868783). Don't be surprised if these lines are absent when you read this, and try for yourself.

Lastly, if you were wondering why the package.json and lock files were copied, followed by `npm install` _and then_ followed by copying the rest of the application code, the reason is (Docker) performance. Briefly, each line in the Dockerfile creates a "layer." These layers can be cached and re-used if nothing has changed. If anything _has_ changed, that invalidates the cache for that layer, _and also_ all layers after it. So you'll want to push your likely-to-change work as low as possible. Your application code will almost always change between deployments; the dependencies in your package.json will change much less frequently. So we do that install first, by itself, so it will be more likely to be cached, and speed up our builds.

## Fly.toml

Now let's take a peek at the fly.toml file.

```toml
# fly.toml app configuration file generated for next-fly-test on 2024-11-28T19:04:19-06:00
#
# See https://fly.io/docs/reference/configuration/ for information about how to use this file.
#

app = 'next-fly-test'
primary_region = 'iad'

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

[[vm]]
  size = 'shared-cpu-1x'
```

This is basically the config file for the Fly app. The options for this file are almost endless, and are documented [here](https://fly.io/docs/reference/configuration/). The three most important lines are

```toml
auto_stop_machines = 'stop'
```

this tells Fly to automatically kill machines when they're not needed, when traffic is low on our app. This line

```toml
auto_start_machines = true
```

allows Fly to automatically spin up new machines when it detects it needs to do so, given your traffic. Lastly, this line

```toml
min_machines_running = 0
```

allows us to tell Fly to always keep a minimum number of machines running, no matter how minimal your current traffic is. Setting it to zero allows for no machines to be running, which means your next visitor will see a slow response as the first machine spins up.

You may have noticed above that Fly spun up two machines initially, even though there was no traffic at all. It does this by default to give your app a higher availability, ie in case anything happens to the one machine, the other will (hopefully) still be up and running. If you don't want or need this, you can prevent it by passing `--ha=false` when you run `fly launch` or `fly deploy` (or you can just kill one of the machines in the dashboard - Fly will not re-create it on subsequent deploys)

### Machines won't bill you if they're not running

When a machine is not running, you'll be billed _essentially_ zero for it. You'll just pay $0.15 per GB, per machine (machines will usually have only one GB).

## Adding a database

You can launch a Fly app anytime with just a Dockerfile. You could absolutely find an official Postgres Docker image and deploy from that. But it turns out Fly has this built in. Let's run `fly postgres create` in a terminal, and see what happens

![Fly postgres create](/fly-io/img-9-fly-postgres-create.png)

It'll ask you for a name and a region, and then just how serious of a Postgres setup you want. Once it's done, it'll show you something like this.

![Fly postgres create](/fly-io/img-10-fly-pg-created.png)

The connection string listed at the bottom can be used to connect to your db _from within another Fly app_ (which you own). But to run database creation and migration scripts, and for local development you'll need to connect to this db on your local machine. To do that, you can run

```bash
fly proxy 5432 -a <your app name>
```

![Fly postgres create](/fly-io/img-11-fly-proxy.png)

and now connect via the same connection string on your local machine, but on `localhost:5432` instead of `flycast:5432`. For more information, see the docs [here](https://fly.io/docs/postgres/connecting/).

### Making your database publicly available

It's not ideal, but if you want to make your Fly pg box publicly available, you can. You basically have to add a dedicated ipv4 address to it (at a cost of $2 per month), and then tweak your config. Instructions can be found [here](https://fly.io/docs/postgres/connecting/connecting-external/).

### Consider using a dedicated host for serious applications.

Fly's built-in Postgres support is superb, but for truly serious production applications, you might consider using a dedicated pg host, and there's none better than [Supabase](https://supabase.com/). Fly even has [a service](https://fly.io/docs/supabase/) for creating Supabase db's on Fly infra, for extra low latency. It's currently only in public alpha, but it might be worth keeping an eye on.

## Interlude

If you just want a nice place to deploy your apps, what we've covered will suffice for the vast majority of use cases. I could stop this post here, but I'd be remiss if I didn't show some of the cooler things you can do with Fly. Please don't let what follows be indicative of the complexity you'll normally deal with. We'll be putting together a cron job for running Postgres backups. In practice, you'll just use a mature DB provider like Supabase or PlanetScale, which will handle things like this for you.

But sometimes it's fun to tinker, especially for side projects. So let's kick the tires a bit and see what we can come up with.

## Having some fun

Like I said, one of Fly's greatest strengths is its flexibility. You give it a Dockerfile, and it'll run it. To drive that point home, let's conclude this post with a fun example.

As much as I love Fly, it makes me a _little_ uneasy that my database is running isolated in some VM under my account. Accidents happen, and I'd want automatic backups. Why don't we build a Docker image to do just that?

I'll want to run a script, written in TypeScript, preferably without hating my life: Bun is ideal for this. I'll also need to run the actual `pg_dump` command. So what should I build my Dockerfile from: the bun image, which would lack to pg utilities, or the pg base, which wouldn't have bun installed. I could do either, and use the linux package manager to install what I need. But really, there's a simpler way: use a multi-stage Docker build. Let's see the whole Dockerfile

```docker
FROM oven/bun:latest AS BUILDER

WORKDIR /app

COPY . .

RUN ["bun", "install"]
RUN ["bun", "build", "index.ts", "--compile", "--outfile", "run-pg_dump"]

FROM postgres:16.4

WORKDIR /app
COPY --from=BUILDER /app/run-pg_dump .
COPY --from=BUILDER /app/run-backup.sh .

RUN chmod +x ./run-backup.sh

CMD ["./run-backup.sh"]
```

We start with a bun image. We run a `bun install` to tell Bun to install what we need: aws sdk's and such. Then we tell Bun to compile our script into a standalone executable: yes, Bun can do that, and yes it's that easy.

```docker
FROM postgres:16.4
```

Tells Docker to start a new stage, from a new (Postgres) base.

```docker
WORKDIR /app
COPY --from=BUILDER /app/run-pg_dump .
COPY --from=BUILDER /app/run-backup.sh .

RUN chmod +x ./run-backup.sh

CMD ["./run-backup.sh"]
```

This drops into the /app folder from the prior step, and copies over the `run-pg_dump` file, which Bun compiled for us, and also copies over `run-backup.sh`. This is a shell script I wrote. It runs `pg_dump` a few times, to generate the files the Bun script (`run-pg_dump`) is expecting, and then calls it. Here's what that file looks like

run-backup.sh

```bash
#!/bin/sh

PG_URI_CLEANED=$(echo ${PG_URI} | sed -e 's/^"//' -e 's/"$//')

pg_dump ${PG_URI_CLEANED} -Fc > ./backup.dump

pg_dump ${PG_URI_CLEANED} -f ./backup.sql

./run-pg_dump
```

This unhinged line

```bash
PG_URI_CLEANED=$(echo ${PG_URI} | sed -e 's/^"//' -e 's/"$//')
```

is something ChatGPT helped me write, to strip the double quotes from my connection string environment variable.

Lastly, if you're curious about the index.ts file Bun compiled into a standalone executable, this is it

```ts
import fs from "fs";
import path from "path";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const numToDisplay = (num: number) => num.toString().padStart(2, "0");

const today = new Date();
const date = `${today.getFullYear()}/${numToDisplay(today.getMonth() + 1)}/${numToDisplay(today.getDate())}`;
const time = `${today.getHours()}-${numToDisplay(today.getMinutes())}-${numToDisplay(today.getSeconds())}`;
const filename = `${date}/${time}`;

const REGION = "us-east-1";
const dumpParams = {
  Bucket: "my-library-backups",
  Key: `${filename}.dump`,
  Body: fs.readFileSync(path.resolve(__dirname, "backup.dump")),
};
const sqlParams = {
  Bucket: "my-library-backups",
  Key: `${filename}.sql`,
  Body: fs.readFileSync(path.resolve(__dirname, "backup.sql")),
};

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ID!,
    secretAccessKey: process.env.AWS_SECRET!,
  },
});

s3.send(new PutObjectCommand(sqlParams))
  .then(() => {
    console.log("SQL Backup Uploaded!");
  })
  .catch(err => {
    console.log("Error: ", err);
  });

s3.send(new PutObjectCommand(dumpParams))
  .then(() => {
    console.log("Dump Backup Uploaded!");
  })
  .catch(err => {
    console.log("Error: ", err);
  });
```

A better Docker expert could probably come up with something better, but this works well enough.

To see this whole thing all together, in one place, you can see it in my GitHub [here](https://github.com/arackaf/booklist/tree/master/data/my-library-pg-backup).

### Scheduling a custom job

We have a working, valid Docker image. How do we tell Fly to run it on an interval? Fly has a command just for that: `fly machine run`, which is documented [here](https://fly.io/docs/flyctl/machine-run/). In fact, it can take a `schedule` argument, to have Fly run it on an interval. Unfortunately, the options are horribly limited: only hourly, daily, and monthly. But, as a workaround you can run this command at different times: this will set up executions at whatever interval you selected, scheduled off of when you ran the command. So if you run

```
fly machine run . --schedule=daily
```

at noon, that will schedule a daily task that runs at noon every day. If you run that command again at 5pm, it will schedule a _second_ task to run daily, at 5pm (without interfering with the first). Each job will have a dedicated machine, but will be idle when not running, which means it will cost you almost nothing; you'll pay the normal $0.15 per month, per gb on the machine.

I hate this limitation in scheduling machines. In theory there's a true cron job template [here](https://github.com/fly-apps/cron-manager), but it's not the simplest thing to look through.

## Odds and ends

That was a lot. Let's lighten things up a bit with some happy odds and ends, before we wrap up.

### Custom domains

Needless to say, Fly makes it easy to add a custom domain to your app. You'll just need to add the right records. Full instructions can be found [here](https://fly.io/docs/networking/custom-domain/).

### Secrets

You'll probably have some secrets you want run in your app, in production. If you're thinking you could just bundle a .env.prod file into your Docker image, yes, you could. But that's considered a bad idea. Instead, leverage Fly's secret management. The docs [are here](https://fly.io/docs/js/the-basics/secrets/), and are roughly what you'd expect.

## Wrapping up

This post is starting to get too long, if it's not already. And yet we've truly, barely scratched the surface. For simple side projects what we've covered here is probably more than you'd need. But Fly also has power tools available for advanced use cases. The sky's the limit!

## Concluding thoughts

Fly.io is a wonderful platform. It's fun to work with, will scale to your application's changing load, and is incredibly flexible. I urge you to five it a try for your next project.

Happy Coding!
