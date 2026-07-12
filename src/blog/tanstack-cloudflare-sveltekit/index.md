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

## Connecting GitHub

To enable easy deployments, let's connect Githib to our new app. We'll go to our [cloudflare dashboard](https://dash.cloudflare.com/)

Find our app under Workers

![Repo selection](/tanstack-cloudflare-sveltekit/img1.jpg)

Go to the build section

![Connect to GitHub](/tanstack-cloudflare-sveltekit/img2.jpg)

And then choose the right repo

![Connect to GitHub](/tanstack-cloudflare-sveltekit/img3.jpg)

## Fixing the build task

Unfortunately, as of this writing in June 2026, there's one small problem with the scaffolding `npx wrangler deploy` set up for us. Let's take a look, and see how to tweak.

Our new `build` script looks like this

```
"build": "wrangler types --check && vite build"
```

When we initially run it, we'll get this error.

```
✘ [ERROR] Types file not found at worker-configuration.d.ts.
```

That's easily fixed with a simple

```
npx wrangler types
```

Which generates the missing file. Now the file exists and we can deploy our application

```
npm run deploy
```

And it works!

But there's still a problem.

Let's add .env file and add a secret to it

```
SECRET_1=hello
```

then add this section to wrangler.jsonc

```json
  "secrets": {
    "required": ["SECRET_1"],
  },
```

and then of course set the secret on Cloudflare

```
npx wrangler secret put SECRET_1
```

Now let's re-run `npx wrangler types` to update our typings to account for the new secret.

Next, we'll delete the `.svelte-kit` folder, and attempt to deploy again. We should see the following error

```
✘ [ERROR] Types at worker-configuration.d.ts are out of date. Run `wrangler types` to regenerate.
```

If you think it's silly to forcibly delete the `.svelte-kit` folder just to create this error, note that this is the error you'd see _every_ time you pushed any changes and replied on your GitHub integration to handle the deployment (since the .svelte-kit folder is created by the `vite build` command, and would therefore not exist on the Cloudflare build servers).

Basically, the root problem is that our `main` application entry point specified in wrangler is

```
"main": ".svelte-kit/cloudflare/_worker.js",
```

which gets generated via `vite build`. But _before_ that can run our `build` script runs

```
wrangler types --check
```

which verifies our typings. But `.svelte-kit/cloudflare/_worker.js` not yet existing is what causes this error; it's a timing issue. There are two potential solutions, both simple. Either just swap the order

```
"build": "vite build && wrangler types --check",
```

or just get rid of the check

```
"build": "vite build",
```

If your typings are not correct you'll see TS errors pretty quickly, so the check was never all the valuable to begin with.

And that's that. Note that if you got _this_ error instead (or ever do get it)

```
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
```

Just `rm -rf node_modules`, delete your lockfile, then re-run npm i

## Getting started with SvelteKit via Cloudflare

We saw in my [prior post](https://todo.todo) that Cloudflare manages the things we need, from secrets to Hyperdrive connection strings on the `env` object. SvelteKit is no different, although the means of accessing this object changes a bit. With TanStack we simply imported our env directly via a special import

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

In theory, to access the Cloudflare `env` object from a remote function, you'd simply import `getRequestEvent`

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

Unfortunately it seems it is, currently at least, very, very easy to get this error when attempting to use Remote Functions with the Cloudflare adapter. In fact this error seems almost unavoidable

```
Error: Could not get the request store. In environments without `AsyncLocalStorage`, the request store (used by e.g. remote functions) must be accessed synchronously, not after an `await`. If it was accessed synchronously then this is an internal error.
```

In spite of the error, Cloudflare workers _do_ have `AsyncLocalStorage` if you have the node compat flag set, which `npx wrangler deploy` did in fact set.

```
"compatibility_flags": ["nodejs_compat"],
```

Remote functions are still in the experimental phase, so hopefully that gets ironed out before being fully released.

## Databases and Hyperdrive

We won't cover Hyperdrive from first principles again. See my [last post](https://todo) on Cloudflare for that.

In short, Cloudflare workers spin up quickly, on demand, to satisfy the requests they receive. That makes them a poor candidate for opening a fresh TCP connection to your database for each request, since doing so would be slow, and would risk overloading your db with more connections than it can support.

We also can't just expose a top-level `db` object that's exported from a module for reasons we'll see shortly.

Hyperdrive solves these problems by giving you a pre-warmed connection pool to connect to. Let's add a valid Hyperdrive entry to our wrangler file (see my previous post for details on connecting to, and setting up Hyperdrive)

```
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "cabc3adcf4c44c03b55e2d17aaef7d99",
      "localConnectionString": "postgresql://docker:docker@localhost:5432/my_library",
    },
  ],
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

## Concluding thoughts

I'm extremely excited about web development with Cloudflare's platform. Workers are an outstanding, low-latency way to host your web application. The SvelteKit integration isn't as seamless as it seams. But really the only problems we saw were a simple build script that needed a tweak, and the experimental feature Remote Functions not quite working on Cloudflare, yet.

Happy Coding!
