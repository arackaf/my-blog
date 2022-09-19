---
title: Introducing Shoelace, a framework independent ux library
date: "2022-08-28T10:00:00.000Z"
description: A high-level introduction to Shoelace, a web component-based ux library.
---

This is a post about [Shoelace](https://shoelace.style/), a component library, but with a twist. It defines all your standard UX components: tabs, modals, accordions, auto-completes, and much, much more. They look beautiful out of the box, are accessible, and fully customizable. But rather than creating these components in React, or Solid, or Svelte, or ... etc., it creates them with web components. This means you can use these components with _any_ framework.

## Some preliminary things

Web components are great, but there's currently a few small hitches to be aware of.

### React

I said they work in any JS framework, but as I've written before, React's support for web components is [currently poor](https://css-tricks.com/building-interoperable-web-components-react/#aa-react-is-a-different-beast). To address this, Shoelace actually [created wrappers](https://shoelace.style/frameworks/react?id=usage) just for React, which React devs can use. Another option, which I personally like, is to just create a thin React component that accepts the tag name of a web component, and all of its attributes and properties, and then does the dirty work of handling React's shortcomings. I talked about this option [here](https://css-tricks.com/building-interoperable-web-components-react/#aa-option-2-wrap-it). I like this solution because it's designed to be deleted. The web component interop problem is currently fixed in React's experimental branch, so once that's shipped, any thin web component-interop component you're using could be searched, and removed, leaving you with direct web component usages, without any React wrappers.

### SSR

Support for server side rendering is also currently poor. In theory there's something called declarative shadow dom which would enable ssr. But browser support is minimal, and in any event, dsd actually requires _server support_ to work right, which means Next, Remix, or whatever you happen to use on the server will need to become capable of some special handling.

That said, there are other ways to get web components to _just work_ with a web app that's SSR'd with something like Next. The short version is that your scripts registering your web components need to run in a blocking script before your markup is parsed. I'll cover how to do this in my next post, and discuss the perf implications, and how to minimize them using a Service Worker.

Of course, if you're building any kind of client-rendered SPA, this is a non-issue. This is what we'll work with for this post.

## Let's start

Since I want this post to focus on Shoelace, and on its web component nature, I'll be using Svelte for everything. I'll be using the Stackblitz project [here](https://stackblitz.com/edit/vitejs-vite-4dm7sb?file=index.html). We'll build up this demo step by step in this post, but feel free to open that repl up anytime to see the end result.

I'll show you how to use Shoelace, and more importantly, how to customize it. We'll talk about shadow doms, which styles they block from the outside world (and which they don't). We'll also talk about the `::part` css selector which you might never have heard of, and we'll even see how Shoelace allows us to override and customize its various animations.

If after reading this post you find you like Shoelace, and want to try it in a React project, my advice would be to just use [a wrapper](https://css-tricks.com/building-interoperable-web-components-react/#aa-option-2-wrap-it) like I mentioned in the introduction. This will allow you to use any of Shoelace's components, and can be removed altogether once React ships the web component fixes they already have (look for that in version 19).

## Introducing Shoelace

Shoelace has fairly detailed [installation instructions](https://shoelace.style/getting-started/installation). At its most simple, you can just dump a script, and css tag into your doc, and that's that. For any production app, you'll probably want to selectively import just what you want, and there's instructions for that, too.

With Shoelace installed, let's create a Svelte component to Render some content, and then go through the steps to fully customize it. To pick something non-trivial, I went with the tabs and a modal. Here's some markup taken largely from the docs

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

<sl-dialog no-header label="Dialog">
  Hello World!
  <button slot="footer" variant="primary">Close</button>
</sl-dialog>

<br />
<button>Open Modal</button>
```

Which renders some nice, styled tabs. The underline on the active tab even animates nicely, and slides from one active tab to the next.

![Default tabs](/shoelace-intro/img1-default-tabs.jpg)

I won't waste your time running through every inch of the api's that are documented well on the Shoelace website. Instead, let's look into how best to interact with, and fully customize these web components.

## Interacting with the api: methods and events

Calling methods and subscribing to events on a web component might be slightly different than what you're used to with your normal framework of choice, but it's not too complicated. Let's see how.

### Tabs

The tabs component has a `show` method, which will manually show a particular tab. In order to call this, we need to get access to the underlying dom element of our tabs. In Svelte, that means using `bind:this`. In React, it'd be a ref. And so on. Since we're using Svelte, let's declare a variable for our tabs instance

```html
<script>
  let tabs;
</script>
```

and bind it

```html
<sl-tab-group bind:this="{tabs}"></sl-tab-group>
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

Typically we just render tabs, and let the user click between them, so this work isn't usually even necessary, but it's there if you need it. Now let's get the modal interactive.

### Modal

The Dialog component takes an `open` prop which controls whether the modal is ... open. Let's declare it in our Svelte component

```html
<script>
  let tabs;
  let open = false;
</script>
```

It also has an sl-hide event for when the modal is hidden. Let's pass our open prop, and bind to the hide event so we can reset it when the user clicks outside of the modal content to close it. And let's add a click handler to that close button to set our `open` prop to false, which would also close the modal

```jsx
<sl-dialog no-header {open} label="Dialog" on:sl-hide={() => open = false}>
  Hello World!
  <button slot="footer" variant="primary" on:click={() => open = false}>Close</button>
</sl-dialog>
```

Lastly, let's wire up our open modal button

```jsx
<button on:click={() => (open = true)}>Open Modal</button>
```

And that's that. Interacting with a component library's api is more or less straightforward. If that's all this post did, it would be pretty boring.

But Shoelace being built with web components means that some things, in particular styles, will work a bit differently than we might be used to. Read on to learn more.

## Customize all the styles!

** NOTE **

As of this writing, Shoelace is still in beta, and the creator is considering changing some default styles, and in fact removing some defaults altogether, so they'll no longer override your host application's styles. The concepts we'll cover are relevant either way, but don't be surprised if some of the Shoelace specifics I mention are different when you go to use it.

** /NOTE **

As nice as Shoelace's default styles are, we might have our own designs in our web app, and we'll want our UX components to match. Let's see how we'd go about that in a web components world.

We won't try to actually _improve_ anything. The creator of Shoelace is a far better designer than I'll ever be. Instead, we'll just look at how to _change_ things, so you can adapt to your own web apps.

### A quick tour of shadow doms

Take a peak at one of those tab headers in your dev tools, and it should look something like this.

![Shadow dom](/shoelace-intro/img6-shadow-dom.jpg)

Our tab element has created a div container with a tab and tab--active class, a tabindex, and is displaying the text we entered for that tab. But notice that it's sitting inside of a shadow root. This allows web component authors to add their own markup to the web component while also providing a place for the content _we_ provide. Notice the `<slot>` element? That basically means "put whatever content the user rendered **between** the web component tags _here_."

So the sl-tab web component creates a shadow root, adds some content to it rendering the nicely styled tab header, along with a placeholder (slot) to render our content in.

### Encapsulated styles

One of the classic, more frustrating problems in web development has always been styles cascading to places where we don't want them. You might worry that any style rules in our application which specify something like `div.tab` would interfere with these tabs. It turns out this isn't a problem; shadow roots encapsulate styles. Styles from outside the shadow root do not (with some exceptions which we'll talk about) affect what's inside the shadow root, and vice versa.

The exceptions to this are styles which inherit. You of course don't need to apply a font-family style for every element in your web app. Instead, you can specify your font-family once, in :root, or html, and have it inherit everywhere beneath it. This inheritance will in fact pierce the shadow root, as well.

A related exception are custom css properties (often called "css variables"). A shadow root can absolutely read a css prop defined outside the shadow root; this will become relevant in a moment.

### The ::part selector

What about styles which _don't_ inherit. What if we want to customize something like `cursor`, which doesn't inherit, on something inside of the shadow root. Are we out of luck? It turns out we're not. Take another look at the image above, of the tab element, and its shadow root. Notice the `part` attribute on the div? That allows you to target, and style that element from outside the shadow root, using the [::part selector](https://developer.mozilla.org/en-US/docs/Web/CSS/::part). We'll walk through an example is a bit.

## Overriding Shoelace styles

Let's see each of these approaches in action. As of now, _a lot_ of Shoelace styles, including fonts, receive default values from css custom properties. To align those fonts with your application's styles, just override the custom props in question. See [the docs](https://shoelace.style/getting-started/customizing) for info on which css vars Shoelace is using, or of course you can just look at the styles on any given element in dev tools.

### Inheriting styles through the shadow root

Open the app.css file in src, in the StackBlitz. In the `:root` section at the bottom you should see a `letter-spacing: normal;` rule defined. Since `letter-spacing` inherits, try setting a new value, like `2px`, and on saving, all content, including the tab headers defined in the shadow root, will adjust accordingly.

![Shadow dom](/shoelace-intro/img8-letter-spacing.jpg)

### Overwriting Shoelace css variables

The sl-tab-group reads a css prop of `--indicator-color` for the active tab's underline. We can override this with some basic css

```css
sl-tab-group {
  --indicator-color: green;
}
```

and just like that we now have a green indicator

![Shadow dom](/shoelace-intro/img-7-green-indicator.jpg)

### Querying parts

Right now, in the version of Shoelace I'm using, any non-disabled tab will have a pointer cursor. Let's change that to a default cursor for the active (selected) tab. We already saw that the sl-tab element adds a `part="base"` attribute on the container for the tab header. Also, the currently selected tab receives an `active` attribute. Let's use these facts to target the active tab, and change the cursor

```css
sl-tab[active]::part(base) {
  cursor: default;
}
```

and that's that.

## Customizing animations

As some icing on the cake, let's see how Shoelace allows you to customize animations. Shoelace uses the web animations api, and exposes a `setDefaultAnimation` api to control how different elements animate for their various interactions. See the docs for specifics, but as an example, here's how you might change Shoelace's default modal animation from expanding outward, and shrinking inward, to instead animate in from the top, and drop down while hiding.

```js
import { setDefaultAnimation } from "@shoelace-style/shoelace/dist/utilities/animation-registry";

setDefaultAnimation("dialog.show", {
  keyframes: [
    { opacity: 0, transform: "translate3d(0px, -20px, 0px)" },
    { opacity: 1, transform: "translate3d(0px, 0px, 0px)" },
  ],
  options: { duration: 250, easing: "cubic-bezier(0.785, 0.135, 0.150, 0.860)" },
});
setDefaultAnimation("dialog.hide", {
  keyframes: [
    { opacity: 1, transform: "translate3d(0px, 0px, 0px)" },
    { opacity: 0, transform: "translate3d(0px, 20px, 0px)" },
  ],
  options: { duration: 200, easing: "cubic-bezier(0.785, 0.135, 0.150, 0.860)" },
});
```

That code is in the App.svelte file. Comment it out to see the original, default animation.

## Wrapping up

Shoelace is an incredibly ambitious component library that's built with web components. Since web components are framework independent, they can be used in any project, with any framework. With some new frameworks starting come out with both amazing performance characteristics, and also ease of use, the ability to use quality user experience widgets which aren't tied to any one framework has never been more compelling.

Happy coding!
