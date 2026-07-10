---
title: Durable Objects on Cloudflare
date: "2026-07-10T10:00:00.000Z"
description: Introduction to Cloudflare's durable objects
---

This is a post about one of Cloudflare's coolest features: Durable Objects. This post will introduce what they are, how they work, and walk through a reasonably realistic use case for them.

## Cloudflare Workers review

I've written about Cloudflare workers previously with an introduction to them [here](https://master.dev/blog/introduction-to-cloudflare-workers-for-web-apps/), along with a post about some of the slightly unorthodox things you have to do to use a database with them [here](https://master.dev/blog/cloudflare-workers-and-hyperdrive-with-tanstack-start/).

We won't rehash all of that here, but as a brief summary, Cloudflare workers are like AWS Lambda functions, except they have much, much lower latency. There are significant differences between those technologies, to be clear. But the high-level elevator pitch is that workers sping up extremely quickly, with virtually no "cold start" to satisfy requests against your web application. And these works spin up as much as needed, giving you built-in horizontal scaling, no matter how spiky your traffic is at any given time.

## What's missing

State. Anonymous Cloudflare workers that can spin up, serve your request, and die off are fantastic for satisfying spikey, growing traffic. But they're terrible for managing long-running state. How could they? They're the absolute opposite of long-running, so they're not capable of managing long-running state.

## What are Durable Objects

Durable objects are Cloudflare's answer to this. Durable objects are a special kind of Worker: they come with persistent storage (either SQLite, or Cloudflare's own key-value storage), and are themselves, well, durable. They go idle when not being used, but when requests against them start up again, they come back to life, with access to their persistent storage.

While they're active they can keep state cached in memory for fast access, with the source of truth of course being their persistent storage (SQLite or KV storage).

## With Web Socket Support

We'll get into the specifics, but durable objects ship with Web Socket support _built in_. You can set up multiple socket connections, post and receive messages, and so on. Ok let's see some code!

## Our use case

For this blog post we'll set up a durable object to hold the shopping cart for a given user. The user's cart contents will follow them around to any browser on any device (so long as they're logged in). Sure, you could do the same thing with Postgres, but our durable object will come with some other nice features: anytime a user adds an item to the cart, we'll use that web socket feature we just mentioned to broadcast to all devices that the cart was changes, and that the app should refresh.

Plus, our durable object will be able to store the carts contents cached in memory while active, avoiding what would have been a roundtrip to whatever database may be powering your web app.

Let's get started!

## Setting up a Durable Object

As with most of my posts we'll be using TanStack Start. The repo for everything [is here](https://github.com/arackaf/cloudflare-do-blog-post) in case I don't explain, or show anything clearly.

### Create the object

A durable object is created from a JavaScript class with the appropriate base class.

```ts
import { DurableObject } from "cloudflare:workers";

export class CartDO extends DurableObject {}
```

We'll add methods to it in a bit.

### Custom Server entrypoint

We need to make sure our Durable Object is exported in our application bundle. The recommended way of doing that is with a custom server entrypoint. We'll create a src/server.ts file with these contents

```ts
import handler from "@tanstack/react-start/server-entry";

export default {
  fetch: handler.fetch,
};
```

That essentially does nothing, and simply re-creates what TanStack Start does out of the box, by default. The point of that is so we can _export_ our Durable Object from this same entrypoint. We do that with a standard old JavaScript export.

```ts
import handler from "@tanstack/react-start/server-entry";

// Export Durable Objects
export { CartDO } from "./durable-obj/Cart";

export default {
  fetch: handler.fetch,
};
```

And now we change the `main` field in our wrangler file from the default of

```json
"main": "@tanstack/react-start/server-entry",
```

to

```json
"main": "src/server.ts",
```

### More wrangler additions

That custom server entrypoint was a one-time change that _allows us_ to then start adding in Cloudflare goodies (like durable objects). But it's also where you'd set up things like queues or cron schedules. Check [Cloudflare\'s docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/?utm_source=chatgpt.com#custom-entrypoints) for more info.

So now we'll add a `durable_objects` section with a binding to the DO we added above

```json
  "durable_objects": {
    "bindings": [
      {
        "name": "CART_DO",
        "class_name": "CartDO",
      },
    ],
  },
```

and then, somewhat annoyingly, we need to add a migration for it as well

```json
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["CartDO"],
    },
  ],
```

## Concluding thoughts

Cloudflare is a delight to develop with. Workers are already a fantastic primitive to ship web applications on top of. With durable objects, a whole host of additional use cases get unlocked beautifully.

Hopefully this post has given you the tools necessary to take advantage.

Happy Coding!
