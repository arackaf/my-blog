---
title: Single Flight Mutations with TanStack Start
date: "2025-10-20T10:00:00.000Z"
description: Using middleware to achieve single flight mutations in TanStack Start
---

TanStack Start is an incredibly exciting full-stack web development framework. I wrote an introduction to it [here](https://frontendmasters.com/blog/introducing-tanstack-start/), and a piece solely about middleware [here](https://todo.com).

The brief elevator pitch is that TanStack Start takes TanStack Router, which is a superb client-side JavaScript framework with comprehensive type safety, and adds server-side support. This includes server-side rendering, or ssr, as well as a place to run code on the server, like database queries or mutations.

Server side rendering is a valuable tool since it allows the user to request a url, and see content immediately, since the content was rendered on the server, and sent back as html. The alternative, which SPAs tend to do, is to reply back with an empty html page, possibly with a loading spinner that shows while script files, and then data are all requested from the client. Those client-to-server round trips can be expansive, so replying immediately with content from the server will usually be a good thing to do.

TanStack supports SSR out of the box, and provides something called server functions to run code on the server. They're declared like regular functions, but can be called easily from the client, or from the server. In either case, code is then executed remotely, and safely on the server.

## Improving Mutations

But those client-server round trips come up in another place. It's fairly common to run some sort of server-side operation to update (or "mutate") some piece of data. The server operation responds that all went well, and then, commonly, we use some client-side data fetching solution like react-query to request new, updated data.

You might think that this is a non-issue, since the server-side operation could just return the new, updated piece of data. If you're in a todo list app, and the user updates a todo, why can't you just return the newly updated todo, with its updated fields? The problem is, that updated todo might affect any number of other pieces of data you just happen to have visible in your app. Maybe the updates you did to the todo cause it to no longer be valid. Maybe you're looking at a list of open todo's assigned to you, and you just re-assigned one of them to someone else. That list now needs to update, no longer include that one, and now possibly include a new one, to fill up the page. Or maybe you closed a todo, and now some piece of data showing the number of open todo's needs to update, and decrement. And so on. This comes up in any number of ways and situations.

This is usually a difficult problem to solve generally, but the TanStack ecosystem actually does a superb job of providing all the pieces necessary. Let's think it through. You can't just return new data from the mutation operation, since the new data you might need will differ dramatically depending on which page the user happens to have open. You could, in theory, try to send that over, and clutter your mutation code with a huge switch statement for all the possibilities, but that code will get out of hand quickly, and would be a nightmare to maintain.

## Middleware to the rescue

What we really need is a way to "decorate" our server-side operations. We'd want to look up what relevant data we have loaded, on the client, before our server operation even begins, and pass that information along to the server. Then, when our server-side operation has finished, while we're still on the server, fetch that new data, and send it back down to the client. Then on the client, update whatever client-side data cache we might have.

If you've read my prior post on middleware, you hopefully immediately realized TanStack Start's Middleware fits this description perfectly. Middleware allows us to take a Server Function, and specify code that needs to run both on the client, _and also_ on the server. And it allows us to run the client- and server-side code either before, or after our server operation executes. That's half of what we need. react-query provides the other half. React Query is easily the most popular, high-quality data fetching solution in the React ecosystem. It allows us to specify queries attached to hierarchical query keys. And for our purposes, it also provides us ways to look up which data exist for which keys (partial or complete), and further api's to immediately invalidate, or replace those data with new data.

## The plan

Let's take TanStack Middleware, and React Query, and use it to create middleware that allows us to specify the query key fragments that represent data that will now be invalid when the underlying server mutation (executed by the server function on which the middleware is placed) executes. Our middleware will have a client callback that inspects what data are there, and therefore need to be updated, along with a server callback that fetches this data, so that the client callback can injecy this new data into the react-query cache.

**NOTE**

If this all seems fairly complex, it's because it is. Just adding the extra round trip after a mutation will probably be good enough for a huge percentage of web applications, so don't feel pressured to force something like this in.

But if you love making systems faster and more efficient, read on!

**/NOTE**

Let's get to work.

## Parting thoughts

We've barely scratched the surface of Middleware. Stay tuned for a future post where we'll push middleware to its limit and achieve single-flight mutations.

Happy coding!
