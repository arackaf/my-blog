---
title: Cloudflare workers and Hyperdrive with SvelteKit
date: "2026-07-12T10:00:00.000Z"
description: Tips and tricks to deploy SvelteKit apps to Cloudflare
---

This is a post about web application setup for Cloudflare workers on SvelteKit. I've written about Cloudflare previously [here](https://master.dev/blog/introduction-to-cloudflare-workers-for-web-apps/) where we introduced workers, and then [here](https://master.dev/blog/cloudflare-workers-and-hyperdrive-with-tanstack-start/) where we showed some of the one-off development considerations needed for getting things to work in TanStack Start, when deployed via Cloudflare workers.

This post will be similar to the latter, except we'll be taking a look at SvelteKit.

I've found the Cloudflare / SvelteKit integration to be not quite as seamless as TanStack, but it's still outstanding, and nonetheless doesn't take much effort to get up and running.

## What are Cloudflare Workers

Cloudflare workers are conceptually similar to AWS Lambda functions. They're cloud functions which spin up on demand, as much as or as little as your application's traffic demands at any given moment in time. Except Cloudflare Workers have very, very low latency. The "cold starts" Lambda is known to have is virtually non-existent with Workers.

## What's the catch?

Not much, really. There was a time when Cloudflare Workers had a runtime that a relatively small subset of Node, but those days are over. Cloudflare Workers now have a Node compat mode that solves those problems.

The main limitation with Workers is that they have some special rules that require you to clean up after yourself in ways other runtimes don't. Namely, you cannot have any long-running I/O objects surviving between requests. In particular, you cannot simply have a module export a `db` object that connects to your database. Each request must spin that connection up fresh. We'll see how to do that in TanStack.

## Introducing Hyperdrive

Spinning up a fresh database connection was always a bad idea from _any_ cloud function runtime, like AWS Lambda. These functions spin up as needed, and during perios of bursting traffic, the number of Lambda functions being created could easily overwhelm your database.

But with Workers requiring a fresh connection _per request_ this is even more dangerous. To say nothing of the fact that, we'd hardly want to ruin Workers' low latency feature by requiring them to perform the time consuming operation of establishing a fresh TCP connection to our database.

To solve all these problems Cloudflare has a tool called Hyperdrive, which keeps a pool of pre-warmed connections to our database open. Our Workers then connect to Hyperdrive, quickly, and have immediate access to these pre-warmed connections.

## Getting started

Let's scaffold an essentially empty, starting point SvelteKit application. We'll go to the directory we want our app, and then a simple

```
npx sv create .
```

should create it.

## Enabling Cloudflare

Let's get basic Cloudflare infrastructure set up for our project.

```
npx wrangler deploy
```

We'll be asked a few questions, to which the defaults should be fine.

![Repo selection](/tanstack-cloudflare-sveltekit/img0a.jpg)

This will install some new dependencies, and set up the Cloudflare plugin.

![Repo selection](/tanstack-cloudflare-sveltekit/img0a.jpg)

Very nice!

## One problem

Well, if we open out Cloudflare dashboard we will _not_ see this new app present, and if we look in our terminal we'll see why.

```
[build] ✘ [ERROR] Types file not found at worker-configuration.d.ts.
[build]
[build]
[build]
[build] 🪵  Logs were written to "/Users/arackis/Library/Preferences/.wrangler/logs/wrangler-2026-07-12_23-14-01_652.log"
[build]
✘ [ERROR] Error: Command failed with exit code 1: npm run build

  ✘ [ERROR] Types file not found at
  worker-configuration.d.ts.


  🪵  Logs were written to
  "/Users/arackis/Library/Preferences/.wrangler/logs/wrangler-2026-07-12_23-14-01_652.log"

  > sveltekit-temp@0.0.1 build
  > wrangler types --check && vite build
```

The problem is the `build` task Cloudflare scaffolded us

```
"build": "vite build && wrangler types --check"
```

The problem is the latter piece `wrangler types --check`: this asks Wrangler to confirm that the generated typings are perfectly synced with the needs of the application. In my experience this is a fickle check that fails for reasons you may not care completely about, like some secrets not being properly declared in your Wrangler under some circumstances. To fix this error you can either run

```
npx wranger types
```

To generate the types and pass (or almost pass, see below) the build, but I'd recommend just removing the `wrangler types --check` from the build script.

You'll absolutely need to run `npx wrangler types` to get typings generated for when you start using Hyperdrive, adding secrets, using Durable Objects, etc. But I wouldn't fail the build step if your types are not completely up to date, especially if those mismathces don't actually lead to TS errors.

If your typings are not correct you'll see TS errors pretty quickly, so the check was never all the valuable to begin with.

And that's that. Note that if you got _this_ error instead (or ever do get it)

```
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
```

Just `rm -rf node_modules`, delete your lockfile, then re-run npm i

## Connecting GitHub

To enable easy deployments, let's connect Githib to our new app. We'll go to our [cloudflare dashboard](https://dash.cloudflare.com/)

Find our app under Workers

![Repo selection](/tanstack-cloudflare-sveltekit/img1.jpg)

Go to the build section

![Connect to GitHub](/tanstack-cloudflare-sveltekit/img2.jpg)

And then choose the right repo

![Connect to GitHub](/tanstack-cloudflare-sveltekit/img3.jpg)

## Getting started with SvelteKit via Cloudflare

Cloudflare manages the things we need, from secrets to Hyperdrive connection strings on the `env` object. With TanStack we imported our env directly, via a special import

```ts
import { env } from "cloudflare:workers";
```

With SvelteKit, this env object is injected into a `platform` object that shows up in server contexts. In fact, when we first ran `npx wranger deploy` that command adjusted our typings for this.

![Repo selection](/tanstack-cloudflare-sveltekit/img4.jpg)

As we can see, `env` now exists in the platform object. This is what is passed into server loaders (ie, +page.server.ts for a route).

```ts
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform, locals }) => {
  return {
    value: platform?.env.SECRET_1,
  };
};
```

as well as any other server-only locations, like api routes.

Note that this does _not_ work for universal loaders, since those also run on the client, and SvelteKit cannot expose the things on this Cloudflare env object on the client.

## Remote Functions

To access the Cloudflare `env` object from a remote function, you'd simply import `getRequestEvent`

```ts
import { getRequestEvent, query } from "$app/server";
```

and then call it as needed

```ts
export const getPosts = query(async () => {
  const evt = getRequestEvent();
  const val = evt.platform?.env.SECRET_1;

  return [
    /* ... */
  ];
});
```

## Databases and Hyperdrive

Hyperdrive is Cloudflare's answer for connecting to a database from a cloud function that can spin up arbitrarily frequently, depending on your web application's traffic.

Since Cloudflare workers spin up quickly, on demand, to satisfy the requests they receive, they're a poor candidate for opening a fresh TCP connection to your database for each request, since doing so would be slow, and would risk overloading your db with more connections than it can support.

We also can't just expose a top-level `db` object that's exported from a module for reasons we'll see shortly.

Hyperdrive solves all these problems by giving you a pre-warmed connection pool to connect to.

### Setting up Hyperdrive

Cloudflare dashboard, and under Storage and databases, find the option for "Postgres & MySQL (Hyperdrive)"

![Cloudflare error](/tanstack-cloudflare-sveltekit/hyperdrive/img1.jpg)

Amusingly, the Hyperdrive in the menu option may be truncated with how they display it.

Hit the connect to database button

![Cloudflare error](/tanstack-cloudflare-sveltekit/hyperdrive/img2.jpg)

You'll be greeted with a few options for how to proceed. For this post, I'll be using PlanetScale.

![Cloudflare error](/tanstack-cloudflare-sveltekit/hyperdrive/img3.jpg)

Follow the prompts, authenticate if needed, select your database, and most importantly, be sure to fill in your database name; you almost certainly do not want the default value of the `postgres`.

![Cloudflare error](/tanstack-cloudflare-post-2/img3b.jpg)

Once complete, you should be greeted with a new Wrangler entry.

![Cloudflare error](/tanstack-cloudflare-post-2/img4.jpg)

That's what mine looks like, and no, there's nothing secret or private about those data. In fact, you'll need it in your Wrangler file, and committed to git if you want Cloudflare's GitHub integration to work.

Copy that into your Wrangler file, and add a localConnectionString in the process, for use during local development.

```json
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "cabc3adcf4c44c03b55e2d17aaef7d99",
      "localConnectionString": "postgresql://docker:docker@localhost:5432/my_library"
    }
  ]
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

## Managing database connections

As with TanStack, the same Cloudflare rules apply. We cannot keep a long-running I/O object open between requests. Doing so would cause errors with Cloudflare; that's why we can't just `export` a live `db` object from a TypeScript module that contains a database conection when we use Cloudflare workers.

With TanStack Start we solved this with global request middleware, which ran once per request, and allowed us to open a database connection (via Hyperdrive), and put that db object on context, which is present in all server-only contexts.

With SvelteKit we can do similarly with a server hook. If we add a `src/hooks.server.js` file, the `handle` function exported therefrom is invoked once _per request_, which makes it a perfect place to set up our db connection.

```ts
export async function handle({ event, resolve }) {
  const pool = new Pool({
    connectionString: event.platform!.env.HYPERDRIVE.connectionString,
  });
  const db = getDb(pool);

  if (event.url.pathname.includes("/.well-known/appspecific/com.chrome.devtools")) {
    return new Response(null, { status: 204 }); // Return empty response with 204 No Content
  }

  event.locals.db = db;

  const response = await resolve(event);
  return response;
}
```

As you can see, we added our `db` object to the `event.locals` object. This is a standard feature with SvelteKit; in fact there's already a `Locals` interface in the `src/app.d.ts` to hold any of these things we manually add.

```ts
import type { DB } from "./data/db";

declare global {
  namespace App {
    interface Platform {
      env: Env;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }

    // interface Error {}
    interface Locals {
      db: DB;
    }
    // interface PageData {}
    // interface PageState {}
  }
}
```

And now, in server-only contexts like Server loaders, we can access our db object

```ts
export const load: PageServerLoad = async ({ platform, locals }) => {
  const users = await locals.db.select().from(user).limit(10);

  return {
    users,
  };
};
```

Similarly in Remote Functions, use the `getRequestEvent` to get the request object, on which you'll find the `locals` object, which itself has the `db` object you set up.

```ts
import { eq } from "drizzle-orm";
import { getRequestEvent, query } from "$app/server";
import { books as booksTable } from "$drizzle/schema";

export const getBooks = query(async () => {
  const evt = getRequestEvent();
  const books = await evt.locals.db.select().from(booksTable).where(eq(booksTable.userId, "106394015208813116232")).limit(5);

  return books;
});
```

## Concluding thoughts

I'm extremely excited about web development with Cloudflare's platform. Workers are an outstanding, low-latency way to host web applications. The SvelteKit integration is great, and with just a few tricks, you can be up and running quickly.

Happy Coding!
