---
title: Introduction to Cloudflare workers, with TanStack Start
date: "2026-06-06T10:00:00.000Z"
description: Tips and tricks to deploy TanStack Start onto Cloudflare
---

Intro

## Deploy it

If you get Cloudflare errors about lockfiles being out of sync, just `rm -rf node_modules` delete your lock file and run `npm i`

## Create a Wrangler file

Let's run

```
npx wrangler deploy
```

Drizzle

```
npm i drizzle-orm@rc drizzle-kit@rc pg @types/pg
```

drizzle.config.ts

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

## Concluding thoughts

In the end, a few lines of webpack config allowed us to easily load global, or scoped css, with optional sass processing in either case. Of course this is only scratching the surface of what's possible. There's no shortage of PostCSS, or other plugins you could toss into the loader list.

Happy Coding!
