---
title: Introducing SvelteKit
date: "2022-12-25T10:00:00.000Z"
description: A high-level introduction to SvelteKit
---

SvelteKit is the latest of what I'd call next-gen application frameworks. It of course scaffolds an application for you, with the file-based routing, deployment, server-side rendering Next has done forever. But SvelteKit also supports nested layouts, server mutations that sync up the data on your page and some other nicities we'll get into.

This post is just a high-level introduction, to hopefully build some excitement for anyone who's never used it before. Future posts will take some targetted deep dives, but for now we'll just take a relaxed tour. If you like what you see, the full docs are [here](https://kit.svelte.dev/docs/introduction).

In some ways this is a challenging post to write. SvelteKit is an _application framework_. It exists to help you build ... appications. That makes it hard to demo. It's not feasible to build an entire application in a blog post. So instead, we'll just use our imaginations a bit. We'll build out a skeleton of an application, have some empty ui placeholders, and some hard-coded static data. The goal of this post isn't to build an actual application, but instead to show you how SvelteKit works, so you can build an application of your own.

To that end, we'll build the tried and true todo application. But don't worry, this will be much, much more about seeing how SvelteKit works than in re-implementing yet another TODO app.

The code for everything you'll be seeing is [here](https://github.com/arackaf/sveltekit-blog-1). This project is also deployed on Vercel [here](https://sveltekit-blog-1.vercel.app/).

## Creating your project

Creating your project is simple enough. Just run `npm create svelte@latest your-app-name` and answer the questions. Be sure to pick Skeleton Project, but otherwise make whatever selections you want for TypeScript, eslint, etc.

Once it's created, run `npm i` and `npm run dev` and you should have a dev server running. Fire up `localhost:5173` and you should

## Layout and routing

Notice the `routes` folder under src. That holds code for all of our ... routes. There's already a `+page.svelte` file in there. That has content for the root `/` route. No matter where in the file hierarchy you are, the actual page for that path always has the name `+page.svelte`. With that in mind, let's create pages for `/list`, `/details`, `/admin/user-settings` and `admin/paid-plan`.

In SvelteKit, special files start with a `+` character. +layout.svelte, +page.svelte, +page.server.ts, +server.ts, and so on. We'll cover many of these, the docs cover all of them.

Let's create a root layout to render our header (and in a real app, a footer, mobile hamburger menu, etc).
