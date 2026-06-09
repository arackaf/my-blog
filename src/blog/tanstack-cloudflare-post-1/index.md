---
title: Introduction to Cloudflare workers, with TanStack Start
date: "2026-06-06T10:00:00.000Z"
description: Tips and tricks to deploy TanStack Start onto Cloudflare
---

This is a post about Cloudflare, and using its Workers feature to ship web applications. In part 1, we'll introduce workers, their advantages, and tradeoffs. Then in part 2 we'll take a closer look at application implementation, and some of the surprising (but manageable) things you have to do to keep Cloudflare happy.

## What are Cloudflare workers?

Cloudflare workers are superficially similar to cloud functions like AWS Lambda: they spin up on demand, for as much, or as little demand as your web application might be experiencing at any given moment in time; workers, like Lambda functions, will pop into existence as much as your traffic demands.

But with one big, important difference: Cloudflare workers run on V8 isolates. Let's unpack what that means. V8 is the JavaScript enginer used by Chrome, and an isolate is a lightweight, sandboxed execution environment inside of V8.

Why does that matter? Lightweight is the key point. They are _extremely_ fast to spin up. AWS Lambda functions have notoriously had startup costs, usually referred to as "cold start." When a new Lambda needs to spin up to server a request, that worker needs to be provisioned, and loaded with the code the developer shipped to it. That loading time is usually in the high two-digit, or even low three-digit ms.

While 100ms may not seem like a huge amount of time, think of it as a handicap your web app has to wait before the normal rendering pipeline even starts.

Cloudflare workers routinely spin up in single-digit ms time; they are extremely low latency.

## How much do cold starts even matter?

I want to be crystal clear: cold starts are not a huge deal. Lambda functions stay alive for some period of time after serving a request, and are re-used for other requests. Do not think that every request has to be served by a fresh Lambda, which itself has to cold start. Applications with steady traffic will likely see very few cold starts; however, spiking traffic will necessarily result in new functions spinning up, and cold starting.

## What's the catch?

Historically Cloudflare workers, since they ran on V8 isolates, had a limited runtime; they did not support many Node api's. That's since changed with the node_compatibility flag, which we'll be seeing.

There's one other tradeoff though: Cloudflare workers have strict rules whereby requests have to be competely independant. Cloudflare workers, like AWS Lambda, do stay alive between, and shared amongst different requests. But each request has to clean itself up completely. We'll look at a common, frustrating example of this in part 2, when we talk about setting up database connections.

## Our first Cloudflare app

I'll be using TanStack Start for this post. I'm just scaffolding a fresh app using instructions [here](https://tanstack.com/start/latest/docs/framework/react/getting-started#start-a-new-project).

After creating an empty app, and pushing it to GitHub, let's see how easy it is to get it running on Cloudflare.

First go to https://dash.cloudflare.com/ (and create an account if needed).

In the side nav on the left under Build, Compute, you should see a Workers & Pages option. Go there, then hit the Create Application button

![Alt text](/tanstack-cloudflare-post-1/img1_pre.jpg)

We'll want to use GitHub

![Alt text](/tanstack-cloudflare-post-1/img1.jpg)

and then choose our app

![Alt text](/tanstack-cloudflare-post-1/img2.jpg)

and the default settings should be fine.

![Alt text](/tanstack-cloudflare-post-1/img3.jpg)

Once done, you should have a url to view your app

![Alt text](/tanstack-cloudflare-post-1/img3_a.jpg)

Which, since it's just the default scaffolded TanStack app, will be fairly boring.

![Alt text](/tanstack-cloudflare-post-1/img3_b.jpg)

**NOTE**
If you ever get Cloudflare errors about lockfiles being out of sync, just `rm -rf node_modules`, delete your lock file and re-run `npm i` (or whatever package manager you're using).

## Maturing our setup

Happy Coding!
