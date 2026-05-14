---
title: React Server Components in TanStack
date: "2026-05-14T10:00:00.000Z"
description: "TanStack's new RSC feature: what it is, and how to use it"
---

This is a post about TanStack Start's implementation of React Server Components, or RSC. The implementation is radically different, and in my opinion better than the RSC implementation you likely saw in Next.js's app directory.

This post will not be a direct 1:1 comparrison. Instead, I'll introduce this feature from first principles, as it related to TanStack.

## What are React Server Components

Server Components are normal React components with one big difference: they run on the server, and only on the server. This leads to a few key differences.

RSCs can be async, and can request data directly from the component. It can `await`, well, anything that yields data. That would be a fetch to a 3rd party api, or it could be a direct call to your database. Since RSC only runs on the server, you don't have to worry about your browser hopelessly failing to establish a TCP connection to your Postgres box, nor do you have to worry about secrets like connection strings being exposed to end users.

The other key difference with RSC is hidden in plain sight from what we've discussed already: since these components only ever execute on the server, their code will not ever be shipped to the client. RSCs simply send down the final markup that was rendered, without the code that created it being pushed to your client bundles.

Since RSCs only exist on the server, they cannot have any state, or user-facing interactivity. They cannot use hooks like useState, or have event handlers like onClick. If you need to _integrate_ content like with with RSC you of course can, and we'll go over how. But the RSCs themselves are React components that exist to run on the Server, and generate static content that's shipped to the client (possibly with client components intermixed within).

## What RSC is not

Don't be mistaken, RSC are _not_ a solution to load data more conveniently. TanStack Start already ships extremely simple, and streamlined data loading options. You have nested, isomorphic loaders for every level in your routing hierarchy. Moreover, these loaders will run on the server for your initial render, and then client-side thereafter. Enables the deep integration with react-query TanStack Start offers, along with fine-grained data invalidation. I wrote all about this in a [previous introduction to TanStack Start](https://frontendmasters.com/blog/introducing-tanstack-start/).

RSC is also not a way to server render content. TanStack Start (and Next.js for that matter), already server render your initial navigation, and always have. Your normal, old-school components always render on the server, and then re-render on the client, wiring up event handlers and effects in a process known as "hydration."

## Where RSC shines

By rendering only on the server, your client bundles are spared the cost of all the code needed to render your content. That means component trees that are large and expensive, with minimal client-side interactivity are a prime candidate for RSC.

The original [blog post announcement](https://tanstack.com/blog/react-server-components) for TanStack's RSCs discussed using them for content with code samples. By moving the code to parse, style and format code to the server, those libraries were removed from client-side bundles saving non-trivial amounts of space.

For this post we'll simulate another good use case: content that's mostly non-interactive, with lots of conditional imports and conditional rendering. Imagine an application shell, or layout, that can look lots of different ways depending on who's viewing it: non-authenticated users; authenticated users; admin users; or even just authenticated users with varying permissions, which affect the content they're shown.

To keep things simple we'll build a dirt simple application layout, but use some trickery to bloat the component bundle, so we can see how much lighter it is when we switch to RSC. We'll then see about adding interactivity.

## Getting started

## Concluding thoughts

TanStack's implementation of RSC is what I wanted all along, without ever knowing it. Data fetching in TanStack is already simple; RSC exists to provide a more performant rendering idiom, where things don't exist on the client, when they don't need to, and when existing on the client would be expensive.

Happy Coding!
