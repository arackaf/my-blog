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

The first is performance. Opening a fresh db connection is not the fastest thing in the world.

Fails with error

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
