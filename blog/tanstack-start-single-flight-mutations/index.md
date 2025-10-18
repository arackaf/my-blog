---
title: Single Flight Mutations with TanStack Start
date: "2025-10-20T10:00:00.000Z"
description: Using middleware to achieve single flight mutations in TanStack Start
---

TanStack Start is an incredibly exciting full-stack web development framework. I wrote an introduction to it [here](https://frontendmasters.com/blog/introducing-tanstack-start/), and a piece solely about middleware [here](https://todo.com).

The brief elevator pitch is that TanStack Start takes TanStack Router, which is a superb client-side JavaScript framework with comprehensive type safety, and adds server-side support. This includes server-side rendering, or ssr, as well as a place to run code on the server, like database queries or mutations.

Server side rendering is a valuable tool since it allows the user to request a url, and see content immediately, since the content was rendered on the server, and sent back as html. The alternative, which SPAs tend to do, is to reply back with an empty html page, possibly with a loading spinner that shows while script files, and then data are all requested from the client. Those client-to-server roundtrips can be expansive, so replying immediately with content from the server will usually be a good thing to do.

## Parting thoughts

We've barely scratched the surface of Middleware. Stay tuned for a future post where we'll push middleware to its limit and achieve single-flight mutations.

Happy coding!
