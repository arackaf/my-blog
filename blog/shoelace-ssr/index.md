---
title: Using web components with Next (or any SSR framework)
date: "2022-09-19T10:00:00.000Z"
description: Enabling web components in Next, without any content shift, while managing perf
---

In my [previous post](https://todo.co/) we looked at Shoelace, which is a component library with a full suite of ux components that are beautiful, accessible, and perhaps unexpected, built with web components. This means they can be used with any JS framework. While React's web component interop is at present less than ideal, even here there are [workarounds](https://css-tricks.com/building-interoperable-web-components-react/#aa-option-2-wrap-it).

But one serious shortcoming of web components is their ssr support is currently poor. There is something called declarative shadow dom in the works, but support is currently minimal, and it actually requires buy-in from your web server to emit special markup for the dsd. There's currently work being done for Next, which I look forward to seeing. But for this post, we'll look at how to manage web components from an ssr framework like Next _today_.

We'll wind up doing a non-trivial amount of manual work, and hurting our page's startup performance in the process—slightly, and we'll look at mitigating these costs. But make no mistake, this solution is not without tradeoffs, so don't expect otherwise. Always measure and profile.

## The problem

Before we dive in, let's take a moment and actually explain the problem. Why don't web components work well with server side rendering?

Application frameworks like Next take your React code and run it through an api to, essentially, "stringify" it, meaning, turn it into plain html. So your React component tree will render on the server hosting your web app, and that html will be sent down with the rest of your web app's html document, to your user's browser. Along with this html will be some script tags loading React, along with the code for your React components. When a browser processes these script tags, React will re-render your component tree, and match things up with the ssr'd html that was sent down. At this point all your effects will start running, your event handlers will wire up, and your state will actually ... contain state. It's at this point that your web app becomes _interactive_. The process of re-processing your component tree on the client, and wiring everything up is called "hydration."

So what does this have to do with web components? Well, when you render something like

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

React (or honestly _any_ JS framework) will see those tags, and just ... pass them along. React (or Svelte, or Solid) are not responsible for turning those tags into nicely formatted tabs. The code for that is tucked away inside of whatever code you have defining those web components. In our case, that code is in the Shoelace library, but the code can be anywhere. What's important is _when_ the code is _run_.

Normally, the code registering these web components will be pulled into your normal application code via a JavaScript `import`. That means this code will wind up in your normal JavaScript bundle, and execute during hydration. Which means that, between your user first seeing the ssr'd html, and hydration happening, these tabs (or any web component) will not render the correct content. Then, when hydration happens, the proper content will display, likely causing the content around these web components to move around, to fit the properly formatted content. This is known as a Flash of Unstyled Content, or FOUC. _In theory_ you could stick markup in between all of those `<sl-tab-xyz>` tags, matching the finished output, but this is all but impossible in practice, especially for a third party component library like Shoelace.

## Moving our web component registration code

So the problem is, the code to make web components do what they need to do won't run until hydration. For this post, we'll look at running that code sooner, in fact immediately. We'll look at custom bundling our web component code, and manually adding a script directly to our document's `<head>` so it runs immediately, and blocks the rest of the document until it does. _This is normally a terrible thing to do_. The whole point of server-side rendering is to _not_ block our page from processing until our JavaScript has processed. But once done, it means that, as the document is initially rendering our html from the server, the web components will be registered, and will immediately, synchronously emit the right content.

In our case, we're _just_ looking to run our web component registration code in a blocking script. This code isn't huge, and we'll look to significantly lessen the perf hit by adding some caching headers to help with subsequent visits. This isn't a perfect solution. Your users' first browse to your page will always block while that script file is loaded. Subsequent visits will cache nicely, but this tradeoff _might not_ be feasible for you—eCommerce, anyone? Anyway, profile, and measure, and make the right decision for your app. Besides, in the future it's entirely possible Next will have full support for declarative shadow dom, and ssr web components.

## Getting started

All of the code we'll be looking at is [here](https://github.com/arackaf/next-wc-ssr) and is deployed with Vercel [here](https://next-wc-ssr.vercel.app/). The web app just renders some shoelace components, along with some text which changes color and content upon hydration. You should be able to see the text change to say "Hydrated," with the Shoelace components already rendering properly.

## Custom bundling web component code

Our first step is to create a single JavaScript module which imports all of our web component definitions. For the shoelace components I'm using, mine looks like this

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

It loads the definitions for the tabs, and modal components, and overrides some default animations for the modal. Simple enough. But the interesting piece, here, is getting this code into our application. We _cannot_ just import this module. If we did that, it'd get bundled into our normal js bundles, and run during hydration. This would cause the FOUC we're trying to avoid.

While Next does have a number of webpack hooks to custom bundle things, I'll just use Vite. First install it with `npm i vite` and then create a vite.config.js file. Mine looks like this

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

This will build a bundle file with our web component definitions in the shoelace-dir folder. Let's move it over to the public folder, so Next will serve it. And we should also keep track of the exact name of the file, with the hash on the end of it. Here's a Node script that moves the file, and writes a JavaScript module that exports a simple constant, with the name of the bundle file (this will come in handy shortly).

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

with a companion npm script

```bash
"bundle-shoelace": "vite build && node util/process-shoelace-bundle",
```

and that should work. For me, `util/shoelace-bundle-info.js` now exists, and looks like this

```js
export const shoelacePath = "/shoelace/shoelace-bundle-a6f19317.js";
```

## Loading the script

Let's go into Next's \_document.js file, pull in the name of our web component bundle file

```js
import { shoelacePath } from "../util/shoelace-bundle-info";
```

and then manually render a script tag in the head. Here's what my entire `_document.js` file looks like

```js
import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

import { shoelacePath } from "../util/shoelace-bundle-info";

export default function Document() {
  return (
    <Html>
      <Head>
        <script src={shoelacePath}></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

And that should work. Our Shoelace registration will load in a blocking script, and be available immediately, as our page processes our initial html.

## Improving perf

We could leave things as they are, but let's add caching for this shoelace bundle. We'll tell Next to make these shoelace bundles cacheable by adding the following entry to our next config file

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

and now when we browse to our site, we see the shoelace bundle cached nicely

![Http Caching](/shoelace-ssr/img2-http-caching.jpg)

## Wrapping up

This may have seemed like a lot of manual work; it was. It's unfortunate web components don't offer better out of the box support for server side rendering.

But we shouldn't forget the benefits they provide: it's nice being able to use quality ux components which aren't tied to a specific framework. It's nice being able to experiment with brand new frameworks like Solid, without needing to find (or hack together) some sort of tab, modal, autocomplete, etc component.
