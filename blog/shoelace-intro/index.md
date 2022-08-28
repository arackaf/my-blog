---
title: Introducing Shoelace, a framework independent ux library
date: "2022-08-28T10:00:00.000Z"
description: A high-level introduction to Shoelace, a web component-based ux library.
---

This post is all about [Shoelace](https://shoelace.style/), which is a component library, but with a twist. It defines all your standard UX components: tabs, modals, accordions, auto-completes, and much, much more. They look beautiful out of the box, are accessible, and fully customizable. But rather than creating these components in React, or Solid, or Svelte, or ... etc., it creates them with web components. This means you can use these components with _any_ framework.

## A few preliminary things

Web components are great, but there's currently a few small hitches to be aware of.

### React

I said they work in any JS framework, but as I've written about, React's support for web components is [currently poor](https://css-tricks.com/building-interoperable-web-components-react/#aa-react-is-a-different-beast). Shoelace actually [created wrappers](https://shoelace.style/frameworks/react?id=usage) just for React which React devs can use. Another option, which I really like, is to just create a thin React component that accepts the tag name of a web component, and all of its attributes and properties, and then does the dirty work of handling React's shortcomings with web components. I talked about this option [here](https://css-tricks.com/building-interoperable-web-components-react/#aa-option-2-wrap-it). It's also worth noting that this entire problem is currently fixed in React's experimental branch, and so there's a good chance React 19 will ship it, allowing you to do a find and replace on such a wrapper, leaving behind regular, plain web component usages, without any React wrapper.

### SSR

Support for server side rendering is currently poor. In theory there's something called declarative shadow dom which would enable ssr. But browser support is currently poor, and in any even actually requires _server support_ to work right, which means Next, Remix, or whatever you happen to use on the server will need to become capable of some special handling here.

That said, there are other ways to get web components to _just work_ with a web app that's SSR'd with something like Next. The short version is that your scripts registering your web components need to run in a blocking script before your markup is parsed. I'll cover how to do this in my next post, and discuss the perf implications, and how to minimize them using a Service Worker.

Of course, if you're building any kind of client-rendered SPA, this is a non-issue. Which is what I'll do for this post.

## Let's start

Since I want this post to focus on Shoelace, and on its web component nature, I'll be using Svelte for everything. I'll be using the Stackblitz project [here](https://stackblitz.com/edit/vitejs-vite-4dm7sb?file=index.html). We'll build up this demo step by step in this post, but feel free to open that repl up anytime to see the end result.

I'll show you how to use Shoelace, and more importantly, how to customize it. We'll see how we can create our own thin (web component) wrappers around Shoelace's components in order to bake in any custom styles we might want.

If after reading this post you find you like Shoelace, and want to try it in a React project, my advice would be to just use [a wrapper](https://css-tricks.com/building-interoperable-web-components-react/#aa-option-2-wrap-it) like I mentioned in the introduction. This will allow you to use any of Shoelace's components, or any wrappers you might create, and can be removed in favor of simple, normal web component instances once React ships the web component fixes they already have (look for that in version 19).

## Introducing Shoelace

Shoelace has fairly detailed [installation instructions](https://shoelace.style/getting-started/installation). At its most simple, you can just dump a script, and css tag into your doc, and that's that. For any production app, you'll probably want to selectively import just what you want, and there's instructions for that, too.
