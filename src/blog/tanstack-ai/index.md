---
title: Unlocking AI in your apps with TanStack AI
date: "2026-10-05T10:00:00.000Z"
description: Introduction to TanStack AI
---

TanStack AI is the latest offering from the TanStack universe. It's an ecosystem of AI-libraries that together allow you to add virtually any AI features you can imagine into your apps. Like other TanStack libraries, it's fully features, and extremely strongly typed.

This will be a two-part post will introduce some of the more basic, common features you're more likely to reach for in every day applications. Future posts will push the limits and use TanStack AI to spin up agents.

Part 1 will cover basic setup and AI requests, streaming, persistence and resumability. I know that sounds like a lot, but honestly TanStack makes this stuff incredibly simple, and borderline turnkey, so we'll cover this ground fairly quickly.

Part 2 will get into structured output, also with streaming.

Let's get started!

## Setting up

## Wrapping up

Hopefully this post has shown you some useful tools you can use in your own projects, and at work to write meaningful tests for your data access code.

The `@testcontainers` package will get Docker running right inside your Vitest tests. Spin up an empty database, use your existing data access utilities to make sure things work exactly as expected. And remember, more tests is absolutely not always better. Test the meaningful parts of your application, with non-trivial logic. Tests which verify every single basic CRUD operation are unlikely to add much value, and are very likely to slow your test suite down to a crawl.

Happy coding!
