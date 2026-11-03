---
title: TanStack AI's Sandbox API
date: "2026-11-03T10:00:00.000Z"
description: Exploring fun use cases with TanStack AI's Sandbox API
---

TanStack AI is a fantastic SDK for integrating AI features into software applications. I've written about it [here](https://blog.master.dev/unlocking-ai-in-your-apps-with-tanstack-ai/), and [here](https://blog.master.dev/structured-output-with-tanstack-ai/). Those posts covered basic prompt-based requests; in particular, we provided some context, and asked AI to generate some workouts for us. We covered streaming, persistence, structured output.

This post is about doing actual agentic work through TanStack AI, via their Sandbox AI. Specifically, we'll see how we can use TanStack AI to drive Claude Code in a remote Sandbox to do work against a GitHub repo we specify, and then open a pull request. Why would you want to do this? Sometimes you're away from your computer, and might have some downtime with nothing better to do than get some tasks done.

I want to be clear: this is already possible with tools like T3, Codex, etc. You can pair your laptop and your phone, and drive the former from the latter. But your laptop needs to be up and running for that to work. Ideally you'd just have a PC set up and always on, with some simple Linux distro for this very purpose. But if you don't have that set up, and don't care to, what I'll show you in this post is a decent next-best alternative. It won't be nearly as fast, and you'll have to pay a small amount of money to providers like Vercel or Railway for use of the remote Sandboxes. But as an occasional fill-in, it's more than good enough in my opinion.

## Wrapping up

TanStack AI's Sandbox api is a joy to use. It makes remote AI request execution a breeze. The flow, performance, and overal UX doesn't compare to Claude Code or Codex, but when you're away from your laptop, it gets the job done well.

Happy Coding!
