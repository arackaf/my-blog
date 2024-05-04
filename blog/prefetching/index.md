---
title: Prefetching when server loading won't do
date: "2024-05-04T10:00:00.000Z"
description: A guide to prefetching data for faster rendering, when ssr loading doesn't work
---

Application metaframeworks like Next and SvelteKit have become incredibly popular recently. In addition to offering developer conveniences like file system-based routing, easy scaffolding of api endoint routes, they also, and more importantly, allow you to server render your application.

Why is that so important. Let's take a look at how the world looks with client-rendered web applications, commonly referred to as "single page applications" or spa's. Let's start with a simplified diagram of what a typical request for a page looks like in a SPA.

![SPA request](/prefetch/img1-spa-request.jpg)

The browser makes a request to some webpage, yoursite.io in this case. With a client-rendered site, it usually sends down a single, mostly empty html page, which has whatever script tags and style tags needed to run the app. This shell of a page might display your company logo, your static header, your copyright message in the footer, etc. But mostly it exists to run JavaScript and offer the real app to your users.

Note: this is why these apps are called "single page" applications. There's a single web page for the whole app, which runs code on the client to detect url changes, and request and render whatever new UI is needed.

So back to our diagram. The inital web page was sent back from the web server. Now what? Well the browser will parse the document, and in doing so, encounter script tags. These script tags contain our application code, our JavaScript framework, etc. The browser will send requests back to the web server to load these scripts. Once the browser gets the scripts back, it'll parse, and execute them, and in so doing, begin executing your application code.
