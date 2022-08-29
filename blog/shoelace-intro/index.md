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

With Shoelace installed, let's render a ux component, and then go through the steps to fully customize it. To pick something non-trivial, I went with the tabs. Here's the markup from the docs

```html
<sl-tab-group>
  <sl-tab slot="nav" panel="general">General</sl-tab>
  <sl-tab slot="nav" panel="custom">Custom</sl-tab>
  <sl-tab slot="nav" panel="advanced">Advanced</sl-tab>
  <sl-tab slot="nav" panel="disabled" disabled>Disabled</sl-tab>

  <sl-tab-panel name="general">This is the general tab panel.</sl-tab-panel>
  <sl-tab-panel name="custom">This is the custom tab panel.</sl-tab-panel>
  <sl-tab-panel name="advanced">This is the advanced tab panel.</sl-tab-panel>
  <sl-tab-panel name="disabled">This is a disabled tab panel.</sl-tab-panel>
</sl-tab-group>
```

Which renders some nice, styled tabs. The underline on the active tab even animates nicely, and slides from one active tab to the next.

![Default tabs](/shoelace-intro/img1-default-tabs.jpg)

I won't waste your time running through every inch of the api's that are documented well on the Shoelace website. Instead, let's look into how best to interract with, and fully customize these web components.

## Interacting with the api: methods and events

Let's take a quick look at how we can interact with the methods and events that might exist on various controls. We'll look at wrapping these components later, to create a more declarative api, so don't dwell on this if you start to feel uncomfortable with the growing complexity; we'll make it better in a bit.

The tabs component has a `show` method, which will manually show a particular tab. In order to call this, we need to get access to the underlying dom element of our tabs. In Svelte, that means using `bind:this`. In React, it'd be a ref. And so on. So since we're using Svelte, let's declare a variable for our tabs instance

```html
<script>
  let tabs;
</script>
```

and bind it to our tabs

```jsx
<sl-tab-group bind:this={tabs}></sl-tab-group>
```

And now we can add a button, which calls it

```jsx
<button on:click={() => tabs.show("custom")}>Show custom</button>
```

which works.

For events, it's the same idea. There's a `sl-tab-show` event which fires when a new tab is shown. We could use `addEventListener` on our tabs variable, or we can use Svelte's shortcut of `on:event-name`

```jsx
<sl-tab-group bind:this={tabs} on:sl-tab-show={e => console.log(e)}>
```

which works, and logs the event objects as you show different tabs.

![Default tabs](/shoelace-intro/img2-event-obj.jpg)

Again, we'll see how to wrap this component later, to change its default styling, and while we're at it, add a nice, declarative api.

## Customize all the styles!

As nice as Shoelace's default styles are, we might have our own designs in our web app, and we'll want our UX components to match. Let's see how we'd go about that in a web components world.

We won't try to actually _improve_ anything. The creator of Shoelace is a far better designer than I'll ever be. Instead, we'll just look at how to _change_ things, so you can adapt to your own web apps.

### Fonts

Let's take a look at the markup that's rendered

![Default tabs](/shoelace-intro/img3-tabs-markup.jpg)

As we can see, Shoelace is intelligently designed to use css custom properties (commonly referred to as css variables). The font of our tabs uses the custom properties `--sl-font-sans`, so let's set that to something new. To make it obvious, let's have some fun and use comic sans.

```html
<style>
  sl-tab-group {
    --sl-font-sans: "Comic Sans MS";
  }
</style>
```

which works

![Default tabs](/shoelace-intro/img4-custom-font.jpg)

In a real app we'd probably want to put these font overrides in some sort of global stylesheet, so they apply everywhere. But this is good enough for demonstration purposes.

### Styles

We're on a role. Let's change some styles. Right now all non-disabled tabs have a pointer cursor. Let's see if we can have the active tab have a default cursor, so it doesn't look like clicking on a tab that's already active will do anything. Here's what the style rules currently look like for our active tab

![Tab styles](/shoelace-intro/img5-tab-styles.jpg)

We can see the cursor property at the bottom, and we can even see a stlye definition just for the active tabs. Let's simply add a style targetting that same tab header, and change
