---
title: Introducing TanStack Start
date: "2024-12-15T20:00:32.169Z"
description: An Introduction to TanStack Start
---

This is a post I've been looking forward to writing for a long time; it's also an incredibly difficult post to write. The best way to think about TanStack Start is that it's nothing more than a server layer atop the TanStack Router that already exists (and is amazing). Not only that, but the thin nature of this server layer means that it completely side-steps the many pain points other web meta-frameworks suffer from.

The primary goal (and challenge) of this post will be to show why a server layer on top of a JavaScript router is valuable, and _why_ TanStack Start's implementation is unique compared to the alternatives, and why that's a good thing. From there, showing how TanStack Start actually works will be relatively straightforward. Wish me luck!

## Why Server Render?

Client-rendered web applications, frequently called "Single Page Applications" or "SPAs" were popular for a long time, and actually still are. "SPA" was never defined precisely, and there's actually some disagreement over what the term means, precisely, but however you define it, the type of app I'm describing is one that's fully client rendered. The server sends down an essentially empty html page, with some script tags that load your framework of choice (React, Vue, Svelte, etc), along with all your application logic.

These apps were always fun to build, and in spite of the hate they often get, they (usually) worked just fine (any kind of software can be bad). But they did suffer from one glaring disadvantge: initial render performance. Remember, the initial render of the page was just an empty shell of your app. This displayed while your script files loaded and executed, and once _those_ scripts run, your application code will almost certainly need to request data before your actual app can display. Under the covers, your app is doing something along the lines of this
