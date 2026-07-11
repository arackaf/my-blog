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

For this blog post we'll set up a durable object to hold the shopping cart for a given user. The user's cart contents will follow them around to any browser on any device (so long as they're logged in). Sure, you could do the same thing with Postgres, but our durable object will come with some other nice features: anytime a user adds an item to the cart, we'll use that web socket feature we just mentioned to broadcast to all devices that the cart was changes, and that the cart contents should refresh.

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

## Building our Durable Object

To avoid dumping too much code all at once let's sketch out a minimal version of our Shopping Cart Durable Object, just to see how everything works, and fits together. Let's create the following methods:

getCart() to retrive cart contents. We'll hard code static data for now, and wire up SQLite in a moment.

addItem() to add an item to the cart, and then broadcast a web socket message that the cart has updated, so any and all browser tabs this user has open will update. Again, we'll hard code the former, for now, before setting up SQLite in a moment.

Then we'll need a method to set up a web socket connection.

And even though, for this use case, we won't need to be sending web sockets from the browser, up to the DO (only the reverse), we'll set that up too so we can see how it works.

With that, here's our initial sketch of our durable object

```ts
import { DurableObject } from "cloudflare:workers";

export class CartDO extends DurableObject {
  getCart() {
    return {
      items: [
        { id: 1, name: "Building Microservices" },
        { id: 2, name: "Standing Desk" },
      ],
    };
  }
  async addItem() {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(
          JSON.stringify({
            type: "cart-updated",
          }),
        );
      } catch {
        // The socket may have disconnected before Cloudflare observed it.
        socket.close(1011, "Unable to send cart update");
      }
    }
  }
  fetch(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", {
        status: 426,
      });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    console.log("received on DO", message);
    socket.send(JSON.stringify({ message: "Message received", originalMessage: message }));
  }
}
```

Let's walk through it. getCart() for now just returns some static data. We'll fix that in a moment. addItem() is where we broadcast our web socket message from. We simply access all subscribed sockets via

```ts
for (const socket of this.ctx.getWebSockets()) {
```

and then call `socket.send`. Simple and humble.

The fetch method may seem surprising, but that's how we set up a new web socket subscriber against our Durable Object. We check the headers to ensure it is indeed a web socket setup, and error out if not; we're free to accept, and reply to any manner of fetch requests if we wanted, of course, but none apply for this use case.

Cloudflare gives us the primitives for this built in

```ts
const pair = new WebSocketPair();
const client = pair[0];
const server = pair[1];

this.ctx.acceptWebSocket(server);
```

`WebSocketPair` is a Cloudflare runtime global. We set up the connection, and then call `this.ctx.acceptWebSocket(server);`

Lastly, `webSocketMessage` is the message we use to _receive_ web socket messages from the client.

## Using our Durable Object

How do we consume those Durable Objects methods from our app?

First let's write a helper function to get an instance of our DO

```ts
import { getCurrentUser } from "./current-user";
import { env } from "cloudflare:workers";

export const getCartForCurrentUser = async () => {
  const user = await getCurrentUser();

  const { CART_DO } = env;
  const cartId = CART_DO.idFromName(user.id);
  const cart = CART_DO.get(cartId);

  return cart;
};
```

We want one Durable Object per user, to hold that user's cart conents. So we grab our user—this isn't a post on auth so user credentials are just hard-coded—then grab our `env` object, and grab our `CART_DO` object from there. Remember, `CART_DO` was wired up in Wrangler here

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

`CART_DO.idFromName` allows us to retrieve a globally unique, internal id for the durable object we want from whatever string identifier we want, and then `CART_DO.get` takes that internal id and gets us the actual, live proxy to interact with the DO with.

We do this interaction from the server, which means we'll need some server functions. Here are two for the `getCart` / `addItems` calls

```ts
const addItem = createServerFn({ method: "POST" }).handler(async () => {
  const cart = await getCartForCurrentUser();
  await cart.addItem();
});

const getItems = createServerFn({ method: "GET" }).handler(async () => {
  const cart = await getCartForCurrentUser();
  const result = await cart.getCart();
  return { items: result.items };
});
```

Get the cart object, and call the methods. Simple.

### Setting up the socket connection

To set up the web socket connection we need to actually fetch to our DO, and we need a real http request. So we'll create a TanStack api endpoint

```ts
// routes/api/cart/subscribe.tsx
import { createFileRoute } from "@tanstack/react-router";
import { getCartForCurrentUser } from "#/server/getCartForCurrentUser";

export const Route = createFileRoute("/api/cart/subscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cart = await getCartForCurrentUser();
        return cart.fetch(request);
      },
    },
  },
});
```

and then a little boilerplate to call into the right place

```ts
export function openWebSocket() {
  return new Promise<WebSocket>((res, rej) => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";

    const socket = new WebSocket(`${protocol}//${location.host}/api/cart/subscribe`);

    socket.addEventListener("open", () => {
      console.log("WebSocket connected");
      res(socket);
    });

    socket.addEventListener("error", event => {
      console.error("WebSocket error:", event);
      rej(event);
    });

    socket.addEventListener("close", event => {
      console.error("WebSocket closed:", event);
    });
  });
}
```

which we can call from whatever, and get back our socket object

```ts
openWebSocket().then(socket => {
  setSocket(socket);
  console.log("Socket open");

  socket.addEventListener("message", event => {
    console.log(event);
  });
});
```

and of course once we have our socket, we can call `.send` on it as desired.

## Wiring up SQLite

## Concluding thoughts

Cloudflare is a delight to develop with. Workers are already a fantastic primitive to ship web applications on top of. With durable objects, a whole host of additional use cases get unlocked beautifully.

Hopefully this post has given you the tools necessary to take advantage.

Happy Coding!
