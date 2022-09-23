---
title: Using Web Components With Next (or Any SSR Framework)
date: "2022-09-19T10:00:00.000Z"
description: Enabling web components in Next, without any content shift, while managing perf
---

In my [previous post](https://css-tricks.com/shoelace-component-frameowrk-introduction) we looked at Shoelace, which is a component library with a full suite of <abbr>UX</abbr> components that are beautiful, accessible, and — perhaps unexpectedly — built with [Web Components](https://css-tricks.com/an-introduction-to-web-components/). This means they can be used with any JavaScript framework. While React's Web Component interoperability is, at present, less than ideal, [there are workarounds](https://css-tricks.com/building-interoperable-web-components-react/#aa-option-2-wrap-it).

But one serious shortcoming of Web Components is their current lack of support for server-side rendering (<abbr>SSR</abbr>). There is something called the Declarative Shadow DOM (<abbr>DSD</abbr>) in the works, but current support for it is pretty minimal as well, and it actually requires buy-in from your web server to emit special markup for the <abbr>DSD</abbr>. There's currently work being done for [Next.js](https://nextjs.org) that I look forward to seeing. But for this post, we'll look at how to manage Web Components from an <abbr>SSR</abbr> framework, like Next.js, _today_.

We'll wind up doing a non-trivial amount of manual work, slightly hurting our page's startup performance in the process, and looking at how to mitigate these performance costs. But make no mistake: this solution is not without tradeoffs, so don't expect otherwise. Always measure and profile.

### The problem

Before we dive in, let's take a moment and actually explain the problem. Why don't Web Components work well with server-side rendering?

Application frameworks, like Next.js, take React code and run it through an <abbr>API</abbr> to essentially "stringify" it, meaning it turn the data into plain HTML. So the React component tree will render on the server hosting the web app and that HTML will be sent down with the rest of the web app's HTML document to your user's browser. Along with this HTML are some `<script>` tags that load React, along with the code for any React components. When a browser processes these `<script>` tags, React will re-render the component tree, and match things up with the <abbr>SSR</abbr>'d HTML that was sent down. At this point, all of the effects will start running, the event handlers will wire up, and the state will actually... contain state. It's at this point that the web app becomes _interactive_. The process of re-processing your component tree on the client, and wiring everything up is called **<dfn id="hydration">hydration</dfn>**.

So, what does this have to do with web components? Well, when you render something, say the same Shoelace `<sl-tab-group>` component we visited [last time](https://css-tricks.com/shoelace-component-frameowrk-introduction):

```html
<sl-tab-group ref="{tabsRef}">
  <sl-tab slot="nav" panel="general"> General </sl-tab>
  <sl-tab slot="nav" panel="custom"> Custom </sl-tab>
  <sl-tab slot="nav" panel="advanced"> Advanced </sl-tab>
  <sl-tab slot="nav" panel="disabled" disabled> Disabled </sl-tab>

  <sl-tab-panel name="general">This is the general tab panel.</sl-tab-panel>
  <sl-tab-panel name="custom">This is the custom tab panel.</sl-tab-panel>
  <sl-tab-panel name="advanced">This is the advanced tab panel.</sl-tab-panel>
  <sl-tab-panel name="disabled">This is a disabled tab panel.</sl-tab-panel>
</sl-tab-group>
```

React (or honestly _any_ JavaScript framework) will see those tags and simply pass them along. React (or Svelte, or Solid) are not responsible for turning those tags into nicely-formatted tabs. The code for that is tucked away inside of whatever code you have that defines those Web Components. In our case, that code is in the Shoelace library, but the code can be anywhere. What's important is _when the code runs_.

Normally, the code registering these Web Components will be pulled into your normal application code via a JavaScript `import`. That means this code will wind up in your JavaScript bundle and execute during hydration which means that, between your user first seeing the <abbr>SSR</abbr>'d HTML and hydration happening, these tabs (or any Web Component for that matter) will not render the correct content. Then, when hydration happens, the proper content will display, likely causing the content around these Web Components to move around and fit the properly formatted content. This is known as a **flash of unstyled content**, or <abbr>FOUC</abbr>. In theory, you could stick markup in between all of those `<sl-tab-xyz>` tags to match the finished output, but this is all but impossible in practice, especially for a third-party component library like Shoelace.

### Moving our Web Component registration code

So the problem is the code to make Web Components do what they need to do won't run until hydration. For this post, we'll look at running that code sooner; immediately, in fact. We'll look at custom bundling our Web Component code, and manually adding a script directly to our document's `<head>` so it runs immediately, and blocks the rest of the document until it does. _This is normally a terrible thing to do._ The whole point of server-side rendering is to _not_ block our page from processing until our JavaScript has processed. But once done, it means that, as the document is initially rendering our HTML from the server, the Web Components will be registered, and will immediately, synchronously emit the right content.

In our case, we're _just_ looking to run our Web Component registration code in a blocking script. This code isn't huge, and we'll look to significantly lessen the performance hit by adding some cache headers to help with subsequent visits. This isn't a perfect solution. The first time a user browses your page will always block while that script file is loaded. Subsequent visits will cache nicely, but this tradeoff _might not_ be feasible for you — e-commerce, anyone? Anyway, profile, measure, and make the right decision for your app. Besides, in the future it's entirely possible Next.js will fully support <abbr>DSD</abbr> and Web Components.

### Getting started

All of the code we'll be looking at is [in this GitHub repo](https://github.com/arackaf/next-wc-ssr) and [deployed here with Vercel](https://next-wc-ssr.vercel.app/). The web app renders some Shoelace components, along with text that changes color and content upon hydration. You should be able to see the text change to say "Hydrated," with the Shoelace components already rendering properly.

### Custom bundling Web Component code

Our first step is to create a single JavaScript module which imports all of our Web Component definitions. For the Shoelace components I'm using, mine looks like this:

```js
import { setDefaultAnimation } from "@shoelace-style/shoelace/dist/utilities/animation-registry";

import "@shoelace-style/shoelace/dist/components/tab/tab.js";
import "@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js";
import "@shoelace-style/shoelace/dist/components/tab-group/tab-group.js";

import "@shoelace-style/shoelace/dist/components/dialog/dialog.js";

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
  options: { duration: 250, easing: "cubic-bezier(0.785, 0.135, 0.150, 0.860)" },
});
```

It loads the definitions for the [`<sl-tab-group>`](https://shoelace.style/components/tab-group) and [`<sl-dialog>`](https://shoelace.style/components/dialog) components, and overrides some default animations for the dialog. Simple enough. But the interesting piece here is getting this code into our application. We _cannot_ simply `import` this module. If we did that, it'd get bundled into our normal JavaScript bundles and run during hydration. This would cause the <abbr>FOUC</abbr> we're trying to avoid.

While Next.js does have a number of webpack hooks to custom bundle things, I'll use [Vite](https://css-tricks.com/adding-vite-to-your-existing-web-app/) instead. First, install it with `npm i vite` and then create a `vite.config.js` file. Mine looks like this:

```js
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    outDir: path.join(__dirname, "./shoelace-dir"),
    lib: {
      name: "shoelace",
      entry: "./src/shoelace-bundle.js",
      formats: ["umd"],
      fileName: () => "shoelace-bundle.js",
    },
    rollupOptions: {
      output: {
        entryFileNames: `[name]-[hash].js`,
      },
    },
  },
});
```

This will build a bundle file with our Web Component definitions in the `shoelace-dir` folder. Let's move it over to the `public` folder so that Next.js will serve it. And we should also keep track of the exact name of the file, with the hash on the end of it. Here's a Node script that moves the file and writes a JavaScript module that exports a simple constant with the name of the bundle file (this will come in handy shortly):

```js
const fs = require("fs");
const path = require("path");

const shoelaceOutputPath = path.join(process.cwd(), "shoelace-dir");
const publicShoelacePath = path.join(process.cwd(), "public", "shoelace");

const files = fs.readdirSync(shoelaceOutputPath);

const shoelaceBundleFile = files.find(name => /^shoelace-bundle/.test(name));

fs.rmSync(publicShoelacePath, { force: true, recursive: true });

fs.mkdirSync(publicShoelacePath, { recursive: true });
fs.renameSync(path.join(shoelaceOutputPath, shoelaceBundleFile), path.join(publicShoelacePath, shoelaceBundleFile));
fs.rmSync(shoelaceOutputPath, { force: true, recursive: true });

fs.writeFileSync(path.join(process.cwd(), "util", "shoelace-bundle-info.js"), `export const shoelacePath = "/shoelace/${shoelaceBundleFile}";`);
```

Here's a companion npm script:

```bash
"bundle-shoelace": "vite build && node util/process-shoelace-bundle",
```

That should work. For me, `util/shoelace-bundle-info.js` now exists, and looks like this:

```js
export const shoelacePath = "/shoelace/shoelace-bundle-a6f19317.js";
```

### Loading the script

Let's go into the Next.js `\_document.js` file and pull in the name of our Web Component bundle file:

```js
import { shoelacePath } from "../util/shoelace-bundle-info";
```

Then, we manually render a `<script>` tag in the `<head>`. Here's what my entire `_document.js` file looks like:

```js
import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

import { shoelacePath } from "../util/shoelace-bundle-info";

export default function Document() {
  return (
    <Html>
      <Head>
        <script src={shoelacePath}></>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

And that should work! Our Shoelace registration will load in a blocking script and be available immediately as our page processes the initial HTML.

### Improving performance

We could leave things as they are but let's add caching for this Shoelace bundle. We'll tell Next.js to make these Shoelace bundles cacheable by adding the following entry to our Next.js config file:

```js
async headers() {
  return [
    {
      source: "/shoelace/shoelace-bundle-:hash.js",
      headers: [
        {
          key: "Cache-Control",
          value: "public,max-age=31536000,immutable",
        },
      ],
    },
  ];
}
```

Now, when we browse to our site, we see the Shoelace bundle caching things nicely!

![Http Caching](/shoelace-ssr/img2-http-caching.jpg)

### Wrapping up

This may have seemed like a lot of manual work; and it was. It's unfortunate Web Components don't offer better out-of-the-box support for server-side rendering.

But we shouldn't forget the benefits they provide: it's nice being able to use quality <abbr>UX</abbr> components that aren't tied to a specific framework. It's aldo nice being able to experiment with brand new frameworks, like [Solid](https://www.solidjs.com), without needing to find (or hack together) some sort of tab, modal, autocomplete, or whatever component.