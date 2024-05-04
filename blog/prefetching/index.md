---
title: Prefetching when server loading won't do
date: "2024-05-04T10:00:00.000Z"
description: A guide to prefetching data for faster rendering, when ssr loading doesn't work
---

Application metaframeworks like Next and SvelteKit have become incredibly popular recently. In addition to offering developer conveniences like file system-based routing, easy scaffolding of api endoint routes, they also, and more importantly, allow you to server render your application.

Why is that so important. Let's take a look at how the world looks with client-rendered web applications, commonly referred to as "single page applications" or spa's. Let's start with a simplified diagram of what a typical request for a page looks like in a SPA.

![SPA request](/prefetch/img1-spa-request.jpg)
