---
title: Introduction to Cloudflare workers, with TanStack Start
date: "2026-06-06T10:00:00.000Z"
description: Tips and tricks to deploy TanStack Start onto Cloudflare
---

Welcome to part 2 of this post on Cloudflare. In part 1 we covered the absolute basics. We deployed a web app to Cloudflare, we saw how our wrangler file works, we set up some secrets, and we saw Cloudflare generate some typings for things like secrets.

In this part we'll set up a database. We'll look at Hyperdrive and why it's needed, and we'll look at some possibly counterintuitive ways in which we need to set up our database object (or any I/O object).

## Preliminaries

I love to use Drizzle for all my data access. It's an outstanding, unique ORM that's essentially designed to be a thin TypeScript layer atop SQL. I've written about it [here](https://master.dev/blog/introducing-drizzle/) and [here](https://master.dev/blog/drizzle-database-migrations/).

I'll be using Postgres for my db access, so we'll install some things

```
npm i drizzle-orm@rc drizzle-kit@rc pg @types/pg
```

add a drizzle.config.ts file

```ts
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.POSTGRES!;

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  out: "./src/drizzle",
});
```

and then run

```
npx drizzle-kit pull
```

That will generate our Drizzle schema. We won't cover any of that. See the Drizzle posts above if you're curious, but really you can query your data however you want; for the purposes of this post it makes no difference which, if any ORM you use.

## The wrong way (for Clourflare)

For now, let's do something fairly common, that usually works well enough. We'll add a `db.ts` module, with this content

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES!,
});

export const db = drizzle({ client: pool });
```

Again, this has nothing to do with Drizzle. Export a connection to your database however you'd like. The issues will be the same.

### Issue 1: Performance

Remember, Cloudflare workers spin up very quickly, on demand, as needed, in order to serve a request. As these (potentially numerous) workers come into existence, each of them establishing a connection to your database poses two problems.

The first is performance. Opening a fresh db connection is a relatively slow operation. We don't want that happening every time a worker spins up. This is not a concern limited to Cloudflare; any cloud function solution would have the same problem. A web application sitting atop AWS Lambda would not want to exacerbate existing cold starts by adding TCP database connection overhead; and of course low-latency Cloudflare workers would not want to _create_ cold start characteristics in this way.

The second is the sheer _number of_ connections that would be stood up in this way. Again, this applies to any platform that works via cloud function. As your app grows in traffic, the number of cloud functions (Cloudflare workers, AWS Lambda, etc) would grow to a large number, as would the number of connections open on your database. And databases always have some limit to the number of connections that can be open at any given time.

This is of course a solved problem. Solutions like PgBouncer pool pre-warmed connections, and act as a proxy to your database. Your applicaton connects to PgBouncer, and PgBouncer provides an open connection. Cloudflare provides its own version of this called Hyperdrive, which we'll look at shortly.

### Issue 2: Per request cleanup

The second issue with the code we saw above

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES!,
});

export const db = drizzle({ client: pool });
```

is that it violates Cloudflare's rule that each request needs to completely clean up after itself. You cannot have I/O objects left open like this in between requests. If you do, and attempt to run your application, you'll be greeted with an error that looks like this

![Clourflare error](/tanstack-cloudflare-post-1/img1.jpg)

Let's solve both of these problems

## Hyperdrive

No matter _how_ we create our database object in code, we don't want to connect directly to our source db; we want to connect to a pre-warmed connection pool. Clourflare provides one for us called Hyperdrive. To get started, go to the Cloudlfare dashboard, and under Storage and databases, find the option for "Postgres & MySQL (Hyperdrive)"

![Clourflare error](/tanstack-cloudflare-post-1/img2.jpg)

Amusingly, the Hyperdrive in the menu option may be truncated with how they display it.

Hit the connect to database button

![Clourflare error](/tanstack-cloudflare-post-1/img3.jpg)

You'll be greeted with a few options for how to proceed. For this post, I'll be using PlanetScale.

![Clourflare error](/tanstack-cloudflare-post-1/img3a.jpg)

Follow the prompts, authenticate if needed, select your database, and you should be greeted with a new Wrangler entry.

```ts
// src/start.ts
import { Pool } from "pg";
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { getDb } from "./data/db";

const globalContextMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const pool = new Pool({
      connectionString: process.env.POSTGRES!,
    });

    const db = getDb(pool);

    return next({
      context: {
        db,
      },
    });
  } catch (error) {
    console.log({ msg: "Error in root context middleware", error });
    throw error;
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: ctx => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, globalContextMiddleware],
  functionMiddleware: [],
}));
```

Existing user when placed together == 7ms

Existing user when placed on opposite coast == 80ms

## Concluding thoughts

In the end, a few lines of webpack config allowed us to easily load global, or scoped css, with optional sass processing in either case. Of course this is only scratching the surface of what's possible. There's no shortage of PostCSS, or other plugins you could toss into the loader list.

Happy Coding!
