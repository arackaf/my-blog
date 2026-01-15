---
title: "Single Flight Mutations in TanStack Start"
date: "2026-01-09T10:00:00.000Z"
description: Implementing single-flight mutations using TanStack Start, and Query.
---

This is a post about single flight mutations. We'll get into the details of what that means, but the short version is, it's mutating data, and then updating the UI with just ONE round trip to the network.

The beautiful thing about implementing this with TanStack is that we can leverage the tools we already know, and love: TanStack Query (formerly react-query), TanStack Router, and Start.

If you're not familiar with these tools, TanStack Router is a client-only SPA framework, about which I wrote a three-part introduction [here](https://frontendmasters.com/blog/introducing-tanstack-router/). TanStack Start is a server layer for Router that enables things like SSR, api routes and server functions; I wrote an introduction for it [here](https://frontendmasters.com/blog/introducing-tanstack-start/), as well as a post on the middleware feature [here](https://frontendmasters.com/blog/introducing-tanstack-start-middleware/).

I've never written about TanStack Query, but it's one of the most widely used React libraries, and there are tons of resources about it.

## Laying the Groundwork

In my [post on TanStack Start](https://frontendmasters.com/blog/introducing-tanstack-start/) I included this image, which is how client-driven single-page applications (SPAs) almost always behave.

![SPA](/single-flight-mutations/img1.png)

The initial request for whatever URL you're viewing returns an empty skeleton of a page. From there, more networks requests happen to fetch scripts and styles, and most likely some data, which eventually results in your actual content page being rendered.

The network round trips will almost always be the single most expensive thing your web application will do. To look at it another way, there are few things you can do to improve performance as much as _removing_ network roundtrips. And this is why server-side rendering can be so beneficial: it allows us to display content to our users _immediately_, after the initial request is responded to.

I expressed this in the Start post with this image.

![SPA](/single-flight-mutations/img2.png)

Those scripts and styles still have to load for your page to be interactive, but that initial response from the server can immediately display content for the user.

## Why Single Flight Mutations

Let's think about how you'd normally update a piece of data in a web application. You probably make a network request to some sort of `/update` endpoint, along with some sort of post packet for whatever you're trying to change. The endpoint will probably return some sort of success flag, possibly returning the actual piece of data you just updated. Then your UI will usually need to request updated data. You might think that returning the updated piece of data you just changed would obviate this need, but frequently it will not.

Imagine you're looking at a list of todo tasks, and you just edited one of them. Just updating the item on the screen isn't good enough; maybe the edit causes this TODO to not longer even be in this list, depending on your filters. Or perhaps your edit causes this TODO to be in a different location, based on your sort order. Or maybe you just _created_ a _brand new_ todo. In that case, who knows where, or even if this todo will show up in your list, again based on your filters or sorts.

So we re-fetch whatever query produces our list. It usually looks like this

![SPA](/single-flight-mutations/img3.png)

This works, and if we're honest with ourselves, it's usually good enough. But can we do better? We wouldn't be good engineers if we didn't at least _try_. Conceptually we'd like to get something like this

![SPA](/single-flight-mutations/img4.png)

The rest of this post will walk through how we can accomplish this in a scalable, flexible way. We'll be using TanStack Start, Middleware, and TanStack Query (formerly react-query).

## Concluding thoughts

Single flight mutations are a great tool for speeding up

Happy Coding!
