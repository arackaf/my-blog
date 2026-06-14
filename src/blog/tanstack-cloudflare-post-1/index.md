---
title: Introduction to Cloudflare workers, with TanStack Start
date: "2026-06-06T10:00:00.000Z"
description: Tips and tricks to deploy TanStack Start onto Cloudflare
---

This is a two-part post about Cloudflare, and using its Workers feature to ship web applications. In part 1 we'll introduce workers, their advantages and tradeoffs. Then in part 2 we'll take a closer look at application implementation, and some of the surprising (but manageable) things you have to do to keep Cloudflare happy.

## What are Cloudflare workers?

Cloudflare workers are superficially similar to cloud functions like AWS Lambda: they spin up on demand, for as much, or as little traffic as your web application might be experiencing at any given moment in time; workers, like Lambda functions, will pop into existence as much as your traffic demands.

But Cloudflare workers have one big, important difference: they run on V8 isolates. Let's unpack what that means. V8 is the JavaScript engine used by Chrome, and an isolate is a lightweight, sandboxed execution environment inside of V8.

Why does that matter? Lightweight is the key point. They are _extremely_ fast to spin up. AWS Lambda functions have startup costs, usually referred to as a "cold start." When a new Lambda needs to spin up to serve a request, that worker needs to be provisioned, and loaded with the code the developer shipped to it. That loading time is usually in the high two-digit, or even low three-digit ms.

While 100ms may not seem like a huge amount of time, think of it as a handicap your web app has to wait before the normal rendering pipeline even starts.

Cloudflare workers routinely spin up in single-digit milliseconds; they have extremely low latency.

## How much do cold starts matter?

I want to be crystal clear: cold starts are not as big of a deal as you might be thinking. Lambda functions stay alive for some period of time after serving a request, and are re-used for other requests. Do not think that every request has to be served by a fresh Lambda, which itself has to cold start. Applications with steady traffic will likely see very few cold starts; however, spiking traffic will necessarily result in new functions spinning up, and cold starting.

But why tolerate any performance hit if you don't have to. Cloudflare's low latency makes them an extremely compelling application host.

## What's the catch?

Historically Cloudflare workers, since they ran on V8 isolates, had a limited runtime; they did not support many Node APIs. That's since changed with the `node_compat` flag, which we'll be seeing.

There's one other tradeoff though: Cloudflare workers have strict rules whereby requests have to be completely independent. Cloudflare workers, like AWS Lambda, do stay alive between, and are reused across different requests. But with Cloudflare workers, each request has to clean itself up _completely_. We'll look at a common, frustrating example of this in part 2, when we talk about setting up database connections.

## Our first Cloudflare app

I'll be using TanStack Start for this post. I'm just scaffolding a fresh app using instructions [here](https://tanstack.com/start/latest/docs/framework/react/getting-started#start-a-new-project).

After creating an empty app, and pushing it to GitHub, let's see how easy it is to get it running on Cloudflare.

First go to [https://dash.cloudflare.com/](https://dash.cloudflare.com/) (and create an account if needed).

In the side nav on the left under Build, Compute, you should see a Workers & Pages option. Go there, then hit the Create Application button

![Create application](/tanstack-cloudflare-post-1/img1_pre.jpg)

We'll want to use GitHub

![Github integration](/tanstack-cloudflare-post-1/img1.jpg)

and then choose our app

![Repo selection](/tanstack-cloudflare-post-1/img2.jpg)

and the default settings should be fine.

![App settings](/tanstack-cloudflare-post-1/img3.jpg)

Once done, you should have a url to view your app

![App created](/tanstack-cloudflare-post-1/img3_a.jpg)

Which, since it's just the default scaffolded TanStack app, will be fairly boring.

![App renders](/tanstack-cloudflare-post-1/img3_b.jpg)

**NOTE**
If you ever get Cloudflare errors about lockfiles being out of sync, just `rm -rf node_modules`, delete your lockfile and re-run `npm i` (or whatever package manager you're using).

## Maturing our setup

Clicking some buttons in the Cloudflare dashboard is simple and easy, but really our app needs a wrangler file. Wrangler is the CLI tool Cloudflare ships to manage all aspects of your app, usually through a wrangler.jsonc file, which is ultimately (if present) the source of truth for your application.

## Creating our wrangler.jsonc file

Rather than manually create the file and start filling in values, let's let Cloudflare create this file for us.

We'll do this by running `npx wrangler deploy`

![Wrangler deploy](/tanstack-cloudflare-post-1/img4.jpg)

As we can see, this does indeed create our wrangler file, and populate it with correct values.

![Wrangler file created](/tanstack-cloudflare-post-1/img5.jpg)

`name` is what we'd expect, and what Cloudflare already inferred when we set this repo up manually.

The compatibility date is to prevent regressions from any changes made to the Cloudflare platform at a date later than what's listed here; this feature avoids breaking changes happening _after_ this date.

`observability` allows any logging we do to show up in our Cloudflare logs. If anyone at Cloudflare is reading this, please consider making this true by default!

`main` tells Cloudflare how to execute our app, and wonderfully, it inferred that we had a TanStack app, and put the correct value in, here.

Lastly, `"compatibility_flags": ["nodejs_compat"]` adds Node compatibility to our Cloudflare worker, which of course allows many of TanStack Start's features to work.

But most impressively, it also adjusted some of our scripts to be more appropriate for Cloudflare, and even installed some new packages, the Cloudflare Vite plugin in particular.

![Vite plugin added](/tanstack-cloudflare-post-1/img6.jpg)

And it even _adjusted our Vite config_ to remove our Nitro plugin (the agnostic deployment package for TanStack) and replaced it with the Cloudflare one.

![Vite config changed](/tanstack-cloudflare-post-1/img7.jpg)

### We're up and running

It's worth pausing and really noting how much Cloudflare did for us. It inferred the type of application we had, and it set everything up _for us_, from deployment scripts, to adding the Cloudflare plugin. This is an incredibly impressive DX, and it's clear a lot of love, and work went into this.

If you're wondering how anything worked before, when we simply imported our app into Cloudflare via the dashboard, without any wrangler file existing, or Cloudflare plugin installed, or added to our Vite config, my best guess is that the `npx wrangler deploy` that was configured by default for the "Deploy Command" (scroll up and see) did all this on the Cloudflare servers. But really it doesn't matter: just run this locally and get your local environment set up properly.

## Setting secrets and generating types

Before we wrap up and move on to part 2, where we'll cover some important, but subtly tricky things like managing database connections, let's cover something simple: managing secrets. This will also let us see Cloudflare's impressive typegen functionality.

To set a secret, use the command

```
npx wrangler secret put SECRET_NAME
```

Wrangler will prompt you for a value, and this will be set in production, on the Cloudflare workers this app deploys to.

![Setting a secret](/tanstack-cloudflare-post-1/img8.jpg)

Now let's add those values to your local .env file

```
SECRET_1='local secret1'
SECRET_2='local secret2'
```

For security reasons, your local dev environment pull from here, locally, not your production secrets which exist only on the Cloudflare workers.

## Using secrets

To use our secrets, we have two options. We can simply do `process.env.SECRET_1`. But Cloudflare gives us a nifty, strongly typed alternative. Let's add this special import

```ts
import { env } from "cloudflare:workers";
```

At first this import will error out, since no such module exists. But Cloudflare ships with a typegen command: `"wrangler types"`. In fact this was set up as an npm script `"cf-typegen": "wrangler types"`

Honestly `npx wrangler types` is easier for me to remember than `cf-typegen` but you can use either, or configure a different npm script.

However you run it, you'll wind up with a `worker-configuration.d.ts` file generated, which looks like this, in part

![Typings created](/tanstack-cloudflare-post-1/img9.jpg)

The entire file runs to over 15,000 lines, but the very top contains our secrets.

And now we can grab our secrets right off of our `env` object, in a strongly typed manner.

![Accessing secrets](/tanstack-cloudflare-post-1/img10.jpg)

## On to part 2

We've barely scratched the surface of Cloudflare. Many production apps will require a database to function. In part 2 we'll see how to set that up, and some of the special considerations Cloudflare's platform requires.

Let's go!
