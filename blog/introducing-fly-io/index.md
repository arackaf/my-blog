---
title: Introducing Fly.io
date: "2024-11-28T10:00:00.000Z"
description: An introduction to building applications with Fly.io
---

[Fly.io](https://fly.io/) is an increasingly popular infrastructure platform—basically a place to deploy your applications to, like Vercel or Netlify, but with some different tradeoffs (and a lot of similarities).

This post will introduce the platform, show how to deploy web apps, stand up databases, and do some other fun things. If you leave here wanting to learn more, the docs [are here](https://fly.io/docs/) and are outstanding.

## What is Fly?

Where platforms like Vercel and Netlify run your app on serverless functions which spin up and die off as needed (Vercel uses AWS Lambda, and Netlify has their own serverless functions), Fly runs your machines on actual VM's, running in their infrastructure. These VMs can be configured to scale up as your app's traffic grows, just like with serverless functions; but being continuously running, they won't cold start. That said, if you're on a budget, or your app isn't that important (or both) you can also configure Fly to scale your app down to zero machines when traffic dies. You'll be billed essentially nothing during those periods of inactivity, though your users will see a cold start time if they're the first to hit your app during an inactive period.

To be perfectly frank, the cold start problem has been historically exaggerated, so please don't pick a platform just to avoid cold starts. It's honestly not a huge problem in practice.

## Why VMs

You might be wondering why, if cold starts aren't a big deal in practice, one should care about Fly using VMs instead of cloud functions. For me there's two reasons: the ability to execute long-running processes, the ability to run anything that will run in a Docker image. Let's dive into both a bit.

The ability to handle long-running processes great expands the range of apps Fly can run. They have turn-key solutions for Phoenix LiveView, and Postgres. Anything you ship on Fly will be via a Dockerfile (don't worry, they'll help you generate them). That means anything you can put together in a Dockerfile, can be run by Fly. If there's a niche database you've been wanting to try out (Neo4J, CouchDB, etc), just stand one up via a Dockerfile (and both of those DBs have official images), and you're good to go. New databases, new languages, new anything: if there's something you've been wanting to try, you can run it on Fly, if you can containerize it: and anything can be containerized.

## But I don't know Docker

Don't worry, Fly will, as you're about to see, help you scaffold a Dockerfile from any common app framework. We'll take a quick look at what's generated, and explain the high points. That said, Docker is one of the most valuable tools for a new engineer to get familiar with, so if Fly motivates you to do so, so much the better!

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

```
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

Docker is a book unto its own, but as an extremely quick intro, Docker allows us to package our app into a "container." Containers allow you to start with an entire, but minimal operating system (almost always a Linux distro), and allow you to do ... whatever you want with it. Docker then packages whatever you create, and allows it to be run. The Docker image is completely self-contained. You choose the whatever goes into it, from the base operating system, down to whatever you install into the image. They're self-contained.

Not let's take a quick tour of the important pieces of the Dockerfile.

After some comments and labels, we find what will always be present at the top of a Dockerfile: the FROM command.

```
FROM node:${NODE_VERSION}-slim as base
```

This tells us the base of the image. We could start with any random Linux distro, and then install Node and npm, but unsurprisingly there's already an officially maintained Node image: there will almost always be officially maintained Docker images for almost any technology. In fact, there's many different Node images to choose from, and you can see them all [here](https://hub.docker.com/_/node)

There's a LABEL that's added, likely for use with Fly. Then we set the working directory in our image

```
WORKDIR /app
```

We copy the package.json, and lock files

```
# Install node modules
COPY package-lock.json package.json ./
```

Then run `npm i` (but in our Docker image)

```
RUN npm ci --include=dev
```

Then we copy the rest of the application code

```
# Copy application code
COPY . .
```

Hopefully you get the point. We won't go over every line, here. But hopefully the general idea is clear enough, and hopefully you'd feel comfortable tweaking this if you wanted to. Two last points though. This

```
# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3
```

Runs the linux package manage to install some things Next might need, for things like image optimization.

Lastly, if you were wondering why the package.json and lock files were copies, followed by `npm install` _and then_ followed by copying the rest of the application code, the reason is (Docker) performance. Briefly, each line in the Dockerfile creates a "layer." These layers can be cached and re-used if anything has changed. If anything _has_ changed, that invalidates the cache for that layer, _and also_ all layers after it. So you'll want to push your likely-to-change work as low as possible. Your application code will almost always change; the dependencies in your package.json will change much less frequently, so we do that install first, by itself, so it will be more likely to be cached, and speed up our builds.

## Fly.toml

Now let's take a peek at the flo.toml file.

```
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

This is basically the config file for the Fly app. The options for this file are almost endless, and are documented [here](https://fly.io/docs/reference/configuration/). The three most important from above are

```
auto_stop_machines = 'stop'
```

this tells Fly to automatically kill machines when they're not needed, as in, when traffic is low on our app. This line

```
auto_start_machines = true
```

allows Fly to automatically spin up new machines when it detects it needs to do so, given your traffic. Lastly, this line

```
min_machines_running = 0
```

allows us to tell Fly to always keep a minimum number of machines running, no matter how minimal your current traffic is. Setting it to zero allows for no machines to be running, which means that your next visitor will see a slow response as the first machine spins up.

You may have noticed above that Fly spun up two machines initially, even though there was no traffic at all. It does this by default to give your app a higher availability, ie in case anything happens to the one machine, the other will (hopefully) still be up and running. If you don't want or need this, you can prevent it by passing `--ha=false` when you run `fly launch` or `fly deploy` (or you can just kill one of the machines in the dashboard - Fly will not re-create it on subsequent deploys)

## Adding a database

You can launch a Fly app anytime with just a Dockerfile. You could absolutely find an official Postgres Docker image and deploy from that. But it turns out Fly has this built in. Let's run `fly postgres create` in a terminal and see what happens

![Fly postgres create](/fly-io/img-9-fly-postgres-create.png)

It'll ask you for a name and a region, and then just how serious of a Postgres setup you want. Once it's done, it'll show you something like this. It'll give you

![Fly postgres create](/fly-io/img-10-fly-postgres-created.png)

### Making your database publicly available

It's ideal not to, but if you really want to make your Fly pg box publicly available, you can. You basically have to add a dedicated ipv4 address to it (at a cost of $2 per month), and then tweak your config. Instructions can be found [here](https://fly.io/docs/postgres/connecting/connecting-external/).

### Consider using a dedicated host for serious applications.

Fly's built-in Postgres support is superb, but for truly serious production applications, you might consider using a dedicated pg host, and there's none better than [Supabase](https://supabase.com/). Fly even has [a service](https://fly.io/docs/supabase/) for creating Supabase db's on Fly infra, for extra low latency. It's currently only in public alpha, but it might be worth keeping an eye on.

## Odds and ends

### Custom domains

Needless to say, Fly makes it easy to add a custom domain to your app. You'll just need to add the right records. Full instructions can be found [here](https://fly.io/docs/networking/custom-domain/).

### Secrets

You'll probably have some secrets you want run in your app, in production. If you're thinking you could just bundle a .env.prod file into your Docker image, yes, you could. But that's considered a bad idea. Instead, leverage Fly's secret management. The docs [are here](https://fly.io/docs/js/the-basics/secrets/), and are roughly what you'd expect.

## Wrapping up

This post is starting to get too long, if it's not already. And yet we've truly, barely scratched the surface. For simple side projects what we've covered here is probably more than you'd need. But Fly also has power tools available for advanced use cases. The sky's the limit!

## Concluding thoughts

Fly.io is a wonderful platform. It's fun to work with, will scale to your application's changing load, and is incredibly flexible. I urge you to five it a try for your next project.

Happy Coding!
