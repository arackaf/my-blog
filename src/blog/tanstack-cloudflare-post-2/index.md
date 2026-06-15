---
title: Introduction to Cloudflare workers, with TanStack Start
date: "2026-06-06T10:00:00.000Z"
description: Tips and tricks to deploy TanStack Start onto Cloudflare
---

Welcome to part 2 of this post on Cloudflare. In part 1 we covered the absolute basics. We deployed a web app to Cloudflare, saw how our wrangler file works, set up some secrets, and we saw Cloudflare generate some typings to keep TypeScript happy.

In this part we'll set up a database. We'll look at Hyperdrive and why it's needed, as well as some possibly counterintuitive ways in which we need to set up our database object (or any I/O object). We'll use TanStack Start specifically, here, but these principles apply to any web framework, even though some of the implementation details might differ a bit.

## Preliminaries

I love Drizzle and use it for all my projects. It's an outstanding, unique ORM that's essentially a thin TypeScript layer atop SQL. I've written about it [here](https://master.dev/blog/introducing-drizzle/) and [here](https://master.dev/blog/drizzle-database-migrations/).

I'll be using Postgres, so we'll also install some utilities

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

That will generate our Drizzle schema. We won't cover those specifics here. See the Drizzle posts above if you're curious, but really you can query your data however you want; for the purposes of this post it makes no difference which, if any ORM you use.

## The wrong way (for Clourflare)

For now, let's do something fairly common, that usually works well enough. We'll add a `db.ts` module, with this code

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

Remember, Cloudflare workers spin up very quickly, on demand, as needed to serve requests. As these (potentially numerous) workers come into existence, each of them establishing a connection to your database poses two problems.

The first is performance. Opening a fresh db connection is a relatively slow operation. We don't want that happening every time a worker spins up. This is not a concern limited to Cloudflare; any cloud function solution would have the same problem. A web application sitting atop AWS Lambda would not want to exacerbate existing cold starts by adding TCP database connection overhead; and of course low-latency Cloudflare workers would not want to _create_ cold start characteristics in this way.

The second is the sheer _number of_ connections that would be stood up in this way. Again, this applies to any platform that works via cloud function. As your app grows in traffic, the number of cloud functions (Cloudflare workers, AWS Lambda, etc) would grow to a large number, as would the number of connections open on your database. And databases always have some limit to the number of connections that are supported.

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

Follow the prompts, authenticate if needed, select your database, and most importantly, be sure to fill your database name; you almost certainly do not want the default value of the `postgres`.

![Clourflare error](/tanstack-cloudflare-post-1/img3b.jpg)

Once complete, you should be greeted with a new Wrangler entry.

![Clourflare error](/tanstack-cloudflare-post-1/img4.jpg)

That's what mine looks like, and no, there's nothing secret or private about those data. In fact, you'll need it in your Wrangler file, and commited to git if you want Cloudflare's GitHub integration to work.

Copy that into your Wrangler file

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "fitness-tracker",
  "compatibility_date": "2025-09-02",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry",
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "dd0103f82a11410b91c8fb5752050a21"
    }
  ],
  "observability": {
    "enabled": true
  },
  "upload_source_maps": true
}
```

and now update your typings via `npx wrangler types`.

### Connect to Hyperdrive

And now, via your same `env` object, you can connect to your database through Hyperdrive

```ts
const pool = new Pool({
  connectionString: env.HYPERDRIVE.connectionString,
});
```

But there's one more thing to do. When you attempt to run your app, you'll likely see this error

![Clourflare error](/tanstack-cloudflare-post-1/img5.jpg)

Just add a connection string to your dev database with that key to your .env file

```
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE='postgresql://docker:docker@localhost:5432/your_db'
```

## Fixing per-request cleanup

Our database connections will be much snappier now. But Cloudflare will still be erroring out since our database object is created, and exported from a module. That means it will continue to live between requests.

Let's see how to fix that.

What we need is a fresh database connection _per request_. And it turns out TanStack Start has a feature just for that: [global request middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware#global-middleware)

The focus of this post is Cloudflare, so we'll breeze through the code; check the docs for more info.

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

This middleware will run once _per request_, which is exactly what we want. We create our db object, and then add it to context

```ts
return next({
  context: {
    db,
  },
});
```

And now you can access the `db` object from any server functions, or server routes (api routes) via the `context` object that's passed in.

![Clourflare error](/tanstack-cloudflare-post-1/img6.jpg)

## Odds and ends

If you're connecting to a database that's hosted in a particular region, you'll almost always want your web app served from the same region. Putting the workers serving your app closer to your users might ostensibly make sense, but that only serves to make the workers further from your database, increasing latency of your queries and updates, and your app will likely need to make _multiple_ requests to your database in the process of serving a request.

My PlanetScale DB is in aws's us-east-1 region, and so I can pin my Cloudflare app to the same region with this entry in my Wrangler file.

```json
"placement": {
  "region": "aws:us-east-1",
},
```

It can make a large difference. I saw the latency in running a very simple query against a small table explode from about 7ms when placed in the same region as my db, up to over 10X (about 80ms) when placed on the United States West Coast.

## Concluding thoughts

I absolutely love Cloudflare's development platform. Workers are an outstanding, low-latency way to host your web application. I hope this post has provided the tools needed to help get your first app up and running on there.

Happy Coding!
