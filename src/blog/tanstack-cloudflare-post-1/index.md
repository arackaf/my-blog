---
title: Introduction to Cloudflare workers, with TanStack Start
date: "2026-06-06T10:00:00.000Z"
description: Tips and tricks to deploy TanStack Start onto Cloudflare
---

Intro

## Deploy it

If you get Cloudflare errors about lockfiles being out of sync, just `rm -rf node_modules` delete your lock file and run `npm i`

## Create a Wrangler file

Let's run

```
npx wrangler deploy
```

## Concluding thoughts

In the end, a few lines of webpack config allowed us to easily load global, or scoped css, with optional sass processing in either case. Of course this is only scratching the surface of what's possible. There's no shortage of PostCSS, or other plugins you could toss into the loader list.

Happy Coding!
