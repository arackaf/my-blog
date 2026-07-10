---
title: Durable Objects on Cloudflare
date: "2026-07-1T10:00:00.000Z"
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

## Concluding thoughts

I'm extremely excited about web development with Cloudflare's platform. Workers are an outstanding, low-latency way to host your web application. The SvelteKit integration isn't as seamless as it seams. But really the only problems we saw were a simple build script that needed a tweak, and the experimental feature Remote Functions not quite working on Cloudflare, yet.

Happy Coding!
