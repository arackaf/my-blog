---
title: Sharing code between frameworks, using web components
date: "2019-05-13T10:00:00.000Z"
description: Using web components to share code between frameworks
---

Those of us who've been web developers for more than a few years have probably written code for the web in more than one Framework. With all the choices out there—React, Svelte, Vue, Angular, Solid—it's all but inevitable. One of the more frustrating things we have to deal with when working across frameworks is re-building all those low-level ui components: buttons, tabs, dropdowns, etc. These are ui components which we need, and want to look and behave a particular way, but ultimately they aren't directly related to whatever we're building.

What's particularly frustrating is that we'll typically have them defined in one framework, say React, but then need to rewrite them in Svelte if we want to build something in Svelte. Or Vue. Or Solid. And so on. Wouldn't it be better if we could define these low-level ui components once, in a framework-agnostic way, and then re-use them between frameworks? Of course it would, and we can; web components are how. This post will walk you through it.

## Web Components

Web Components are essentially html elements that you define yourself, from the ground up. We'll walk through the process in a bit, but essentially you'll define a JavaScript class, inherit it from `HTMLElement` (there are other options), and then define whatever properties, attributes and styles the web component has, and of course the markup it will ultimately render to your users.

## Web Components: what they're good at, and what they're not

Being able to define custom html elements which aren't bound to any particular component is definitely exciting. But this freedom is also a limitation. Existing independently of any JavaScript framework means you can't really interact with JavaScript frameworks well. Think of a React component which fetches some data, and then renders some *other* React component, passing along the data. This wouldn't really work as a web component, since a web component doesn't really know how to render a React component. 

web components particularly excel as leaf components. Conceptually, leaf components are the last thing to be rendered in a component tree. These are the components which receive some props, and render some ui. These are *not* the components sitting in the middle of your component tree, passing data along, setting context, etc. Just pure pieces of ui which will look the same, no matter which JS framework is powering the rest of the app. 

## What we'll be building

UI leaf components aren't the only think you can use web components for. You can use a web component-first framework and architect and entire *application* from nothing but wc's. If you're curious to learn more, check out either or both of the main options for that, [lit-html](https://lit.dev/docs/v1/lit-html/introduction/) or [Stencil](https://stenciljs.com/).

Personally, I'm most excited by the opportunity to reuse low-level ui components between JS frameworks; it's tedious and frankly boring having to define the same rich button, tabs, etc every time you build something with a new framework, so that'll be our focus here. 

Rather than building something boring (and common), like a button, let's build something a little bit different. In my [last post](https://link.here) we looked at using blurry image previews to prevent content reflow. We looked at base64 encoding a blurry, degraded versions of our images, and showing that in our UI while the real image loaded. And we also looked at generating incredibly compact, blurry previews using a tool called [Blurhash](https://blurha.sh/).

That post showed you how to generate those previews, and how to use them in a React project. This post will show you how to use those previews from a web component, so they can be used by *any* JS framework. 

But we need to walk before we can run, so we'll walk through something trivial and silly first, in order to see exactly how web components work.  

Everything in this post will build vanilla web components without any tooling. That means the code will have a bit of boilerplate, but should be relatively easy to follow. As I mentioned above, tools like Lit and Stencil are designed for building web components, and can be used to remove much of this boilerplate. I urge you to check them out! But for this post, I'll prefer a little more boilerplate in exchange for now having to introduce, and teach another dependency. Let's get started!

## Your first web component

Let's build the classic Hello World of JavaScript components: a counter. We'll render a value, and a button that increments that value. Simple and boring, but it'll let us look at the simplest possible web component.

In order to build a web component, the first step is to make a JavaScript class, which inherits from `HTMLElement`. We could inherit from existing html elements, like `HTMLAnchorElement` but we won't need that here.

```js
class Counter extends HTMLElement {
}
```

the last step is to register the web component, but only if we haven't registered it already

```js
if (!customElements.get("counter-wc")) {
  customElements.define("counter-wc", Counter);
}
```

And of course render it

```html
<counter-wc></counter-wc>
```

And everything in between is us making the web component do ... whatever we want it to. One common lifecycle method is `connectedCallback`, which fires when our web component is added to the dom. We could use that method to render whatever content we'd like. Remember, this is a JS class, inheriting from `HTMLElement`, which means our `this` value is the web component element itself, with all the normal dom manipulation methods you already know and love.

At it's most simple, we could do this

```js
class Counter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = "<div style='color: green'>Hey</div>";
  }
}

if (!customElements.get("counter-wc")) {
  customElements.define("counter-wc", Counter);
}
```

which would work just fine.

![First web component](./img1.png)

### Adding real content

Let's add some useful, interactive content. We need a span to hold our current value, and we need a button to increment it. Let's see how we can create that. We'll create this content in our constructor this time, and append when the web component is actually in the dom

```js
  constructor() {
    super();
    const container = document.createElement('div');

    this.valSpan = document.createElement('span');

    const increment = document.createElement('button');
    increment.innerText = 'Increment';
    increment.addEventListener('click', () => {
      this.#value = this.#currentValue + 1;
    });

    container.appendChild(this.valSpan);
    container.appendChild(document.createElement('br'));
    container.appendChild(increment);

    this.container = container;
  }

  connectedCallback() {
    this.appendChild(this.container);
    this.update();
  }
  ```

Now we need a settable JavaScript class property named `value`

  ```js
  #currentValue = 0;

  set #value(val) {
    this.#currentValue = val;
    this.update();
  }
  ```

It's just a standard class property, with a setter, along with a second property to hold the value. One fun twist is that I'm using a private JavaScript class property syntax for these values. That means nobody outside out web component can ever touch these values. This is standard JavaScript that's supported in all modern browsers, so don't be afraid to use it. 
  
![CanIUse private class properties](./img2.png)

Or feel free to call it `_value` if you prefer.

And lastly our `update` method.

```js
  update() {
    this.valSpan.innerText = this.#currentValue;
  }
```

And it works.

![First web component working](./img3.png)

Obviously this is not code you'd want to maintain at scale; but you would never need to. As I've said, tools like Lit-html are designed to make this simpler.

Here's a full [working example](https://stackblitz.com/edit/vitejs-vite-7f6brw?file=counter-wc.js) if you'd like a closer look.

## Adding some more functionality 

This post is not a deep dive into web components. We won't cover all the api's and lifecycles; we won't even cover shadow roots or slots; there's endless content on those topics. My goal here is to provide a decent enough introduction to spark some interest, along with some useful guidance on actually *using* web components with the popular JavaScript frameworks you already know and love.

To that end, let's enhance our counter web component a bit. Let's have it accept a `color` attribute, to control the color of the value that's displayed. And let's also have it accept an `increment` property, so consumers of this web component can have it increment by 2, 3, 4 at a time.

And to drive these state changes, let's use our new counter in a Svelte sandbox—we'll get to React in a bit.

We'll start with the same web component as before, and add a color attribute. To configure our web component to accept / react to an attribute, we add a static `observedAttributes` property, which returns the attributes that our web component listens for.

```js
  static observedAttributes = ["color"];
```

with that in place, we can add a `attributeChangedCallback` lifecycle method, which will run whenever any of the attributes listed in `observedAttributes` are set, or updated.

```js
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "color") {
      this.update();
    }
  }
```

and now we update our `update` method to actually use it.

```js
  update() {
    this.valSpan.innerText = this._currentValue;
    this.valSpan.style.color = this.getAttribute("color") || "black";
  }
```

lastly, let's add our `increment` property. Simple and humble.

```js
  increment = 1;
```

### Using our counter in Svelte

Let's use it. We'll go into our Svelte App component, and add something like this

```html
<script>
  let color = "red";
</script>

<style>
  main {
    text-align: center;
  }
</style>

<main>
  <select bind:value={color}>
    <option value="red">Red</option>
    <option value="green">Green</option>
    <option value="blue">Blue</option>
  </select>

  <counter-wc color={color}></counter-wc>
</main>
```

and it works. Our counter renders, increments, and the dropdown updates the color. As you can see, we render the color attribute in our Svelte template and, when the value changes, handles the legwork of calling `setAttribute` on our underlying web component instance. There's nothing special here: this is the same thing it already does for *any* html element's attributes. 

Now let's set the `incrementAmount` prop. Things get a little bit interesting here. This is *not* an attribute on our web component; it's a prop on the web component's class. That means it needs to be set on the web component's instance. Let's see what this means, but bear with me; things will wind up much simpler than they seem.

First, we'll add some variables to our Svelte component

```js
  let increment = 1;
  let wcInstance;
```

Our powerhouse of a counter component will let you increment by 1, or by 2.

```html
  <button on:click={() => increment = 1}>Increment 1</button>
  <button on:click={() => increment = 2}>Increment 2</button>
```

but, *in theory* we need to get the actual instance of our web component. This is the same thing we always do anytime we add a ref with React. With Svelte, it's a simple `bind:this` directive.

```html
  <counter-wc bind:this={wcInstance} color={color}></counter-wc>
```

and now, in our Svelte template we listen for changes to our component's increment variable, and set the underlying web component property.

```js
  $: {
    if (wcInstance) {
      wcInstance.increment = increment;
    }
  }
```

Which works. You can test it out [here](https://stackblitz.com/edit/vitejs-vite-smjw4o?file=src/App.svelte)

This isn't ideal. We obviously don't want to do this for every web component / prop we need to manage. Wouldn't it be nice if we could just set `increment` right on our web component, in markup, like we normally do for component props, and have it ... *just work*? In other words, it'd be nice if we could delete all usages of `wcInstance` and just do this

```html
<counter-wc increment={increment} color={color}></counter-wc>
```

Well you can. And it works. Seriously. Svelte handles that legwork for us. Check it out [here](https://stackblitz.com/edit/vitejs-vite-ucexzq?file=src/App.svelte). This is standard behavior for pretty much all JavaScript frameworks.

So why did I show you the manual way of setting the web component's prop? Two reasons: it's useful to understand how these things work, and a moment ago I said "pretty much" all JavaScript frameworks. There's one framework which, maddeningly, does not support web component prop setting like we just saw.

![React logo](./react-logo.png)

Yes. It's React. The most popular JavaScript framework on the planet does not support basic interop with web components. This is a well known problem that's unique to React. Interestingly, this is actually fixed in React's experimental branch, but for some reason wasn't merged into version 18. Track the progress of this [here](https://custom-elements-everywhere.com/). And you can try this yourself with a live demo [here](https://stackblitz.com/edit/react-ydpj3u?file=src/App.js). 

The solution of course is to use a ref, grab the web component instance, and manually set `increment` when that value changes. It looks like this

```js
import React, { useState, useRef, useEffect } from 'react';
import './counter-wc';

export default function App() {
  const [increment, setIncrement] = useState(1);
  const [color, setColor] = useState('red');
  const wcRef = useRef(null);

  useEffect(() => {
    wcRef.current.increment = increment;
  }, [increment]);

  return (
    <div>
      <div className="increment-container">
        <button onClick={() => setIncrement(1)}>Increment by 1</button>
        <button onClick={() => setIncrement(2)}>Increment by 2</button>
      </div>

      <select value={color} onChange={(e) => setColor(e.target.value)}>
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>

      <counter-wc ref={wcRef} increment={increment} color={color}></counter-wc>
    </div>
  );
}
```

there's a live demo of this [here](https://stackblitz.com/edit/react-y43odj?file=src%2FApp.js).

As we discussed, coding this up manually for every web component property is not scalable. But all is not lost; we have a few options, which we'll consider in turn.

### Use attributes everywhere

We have attributes. If you clicked the React demo above, the increment prop wasn't working, but the color did change correctly. Can't we code everything with attributes? Sadly, no. Attribute values can only be strings. That's good enough here, and we'd be able to get somewhat far with this approach. Numbers like `increment` can be converted to and from strings easily. We could even JSON stringify/parse objects. But eventually we'll need to pass a function into a web component, and at that point we'd be out of options.

### Wrap it

There's an old saying, that you can solve any problem in computer science by adding a level of indirection (except the problem of too many levels of indirection). The code to set these props is pretty predictable and simple. What if we hide it in a library. The smart folks behind lit-html have one solution [here](https://www.npmjs.com/package/@lit-labs/react). This library creates a new React component for you, after you give it a web component, and list out the properties it needs. While clever, I'm not a fan of this approach. 

Rather than have a 1:1 mapping of web components to manually-created React components, what if we had **one** React component that we passed our web component *tag name* to (`counter-wc` in our case), along with all the attributes and properties, and this component rendered our web component, added the ref, and then figured out what was a prop, and what was an attribute. That's the ideal solution in my opinion. I don't know of a library that does this, but it should be straightforward to create. Let's give it a shot!

This is the *usage* we're looking for

```js
<WcWrapper wcTag="counter-wc" increment={increment} color={color} />
```

`wcTag` is the web component tag name, and the rest are the properties and attributes we want passed along.

Here's what my implementation looks like 

```js
import React, { createElement, useRef, useLayoutEffect, memo } from 'react';

const _WcWrapper = (props) => {
  const { wcTag, children, ...restProps } = props;
  const wcRef = useRef(null);

  useLayoutEffect(() => {
    const wc = wcRef.current;

    for (const [key, value] of Object.entries(restProps)) {
      if (key in wc) {
        if (wc[key] !== value) {
          wc[key] = value;
        }
      } else {
        if (wc.getAttribute(key) !== value) {
          wc.setAttribute(key, value);
        }
      }
    }
  });

  return createElement(wcTag, { ref: wcRef });
};

export const WcWrapper = memo(_WcWrapper);
```

The most interesting line is at the end

```js
return createElement(wcTag, { ref: wcRef });
```

This is how we create an element in React with a dynamic name. In fact, this is what React normally transpiles your JSX into. All your `<div>`'s are converted to `createElement("div")` calls. We don't normally need to call this api directly, but it's there when you need it.

Beyond that, we want to run a layout effect, and loop through every prop that was passed to our component. We loop through them all, and check to see if it's a property with a simple `in` check. This checks the web component instance object, and also its prototype chain, which will catch any getters/setters that wind up on the class prototype. If no such property exists, it's assumed to be an attribute. In either case, we only set it if the value has actually changed.

If you're wondering why we use `useLayoutEffect`, instead of `useEffect` it's because we want to run these updates immediately, before our content is rendered. Lastly, note that we have no dependency array to our `useLayoutEffect`; this means we want to run this update on **every render**. This can be risky, since React tends to re-render ... *a lot*. To ameliorate this, I'm wrapping the whole thing in `React.memo`. This is essentially the modern version of `React.PureComponent`, which just means the component will only re-render if any of its actual props have changed, which it checks via a simple equality check. The only risk here is that if you're passing an object prop that you're mutating directly, without re-assigning, then you won't see the updates. But this is highly discouraged, especially in the React community, so I wouldn't worry about it.

Before moving on, I'd like to call out one last thing. You might not be happy with what the usage of this looks like. Again, this component is used like this:

```js
<WcWrapper wcTag="counter-wc" increment={increment} color={color} />
```

You might not like passing the web component tag name to the WcWrapper component, and prefer instead the @lit-labs/react package above, which created a new, individual React component for each web component. That's totally fair, and I'd encourage you to use whatever you're most comfortable with. But for me, one advantage with this approach is that it's easy to *delete*. If by some miracle React merges proper web component handling from their experimental branch, into main tomorrow, and publishes, you'd be able to change the above code from this

```js
<WcWrapper wcTag="counter-wc" increment={increment} color={color} />
```

to this

```js
<counter-wc ref={wcRef} increment={increment} color={color} />
```

In fact you could probably write a single codemod to do that everywhere, and then just delete `WcWrapper` altogether. Actually scratch that: a global search and replace with a RegEx would probably work.

## The implementation 

Sorry that intro took so long. If you recall, our original goal was to take the image preview code we looked at in my [last post](link.here), and move it to a web component, so it could be used in any JS framework. React's lack of proper interop added a lot of detail to the introduction. But now that we have a decent handle on how to create a web component, and use it, the implementation will almost be anti-climactic. 

I'll post the entire web component, and call out some of the interesting bits. If you'd like to skip to seeing it in action, here's a [working demo](https://stackblitz.com/edit/vitejs-vite-tt8yns?file=src/book-cover-wc.js). It'll switch between my three favorite books, on my three favorite programming languages. The url for each will be unique each time, so you can see the preview each time, though you'll likely want to throttle your network speed in your dev tools network tab. 

```js
class BookCover extends HTMLElement {
  static observedAttributes = ['url'];

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'url') {
      this.createMainImage(newValue);
    }
  }

  set preview(val) {
    this.previewEl = this.createPreview(val);
    this.render();
  }

  createPreview(val) {
    if (typeof val === 'string') {
      return base64Preview(val);
    } else {
      return blurHashPreview(val);
    }
  }

  createMainImage(url) {
    this.loaded = false;
    const img = document.createElement('img');
    img.alt = 'Book cover';
    img.src = url;
    img.addEventListener('load', () => {
      if (img === this.imageEl) {
        this.loaded = true;
        this.render();
      }
    });
    this.imageEl = img;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const elementMaybe = this.loaded ? this.imageEl : this.previewEl;
    syncSingleChild(this, elementMaybe);
  }
}
```

First we register the attribute we're interested in, and react when it changes 

```js
  static observedAttributes = ['url'];

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'url') {
      this.createMainImage(newValue);
    }
  }
```

this causes our image component to be created, which will show only when loaded 

```js
  createMainImage(url) {
    this.loaded = false;
    const img = document.createElement('img');
    img.alt = 'Book cover';
    img.src = url;
    img.addEventListener('load', () => {
      if (img === this.imageEl) {
        this.loaded = true;
        this.render();
      }
    });
    this.imageEl = img;
  }
```

next we have our preview property, which can either be our base64 preview string, or our blurhash packet.

```js
  set preview(val) {
    this.previewEl = this.createPreview(val);
    this.render();
  }

  createPreview(val) {
    if (typeof val === 'string') {
      return base64Preview(val);
    } else {
      return blurHashPreview(val);
    }
  }
```

this defers to whichever helper function we need 

```js
function base64Preview(val) {
  const img = document.createElement('img');
  img.src = val;
  return img;
}

function blurHashPreview(preview) {
  const canvasEl = document.createElement('canvas');
  const { w: width, h: height } = preview;

  canvasEl.width = width;
  canvasEl.height = height;

  const pixels = decode(preview.blurhash, width, height);
  const ctx = canvasEl.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);

  return canvasEl;
}
```

And lastly our render method

```js
  connectedCallback() {
    this.render();
  }

  render() {
    const elementMaybe = this.loaded ? this.imageEl : this.previewEl;
    syncSingleChild(this, elementMaybe);
  }
```

and a few helpers methods to tie everything together 

```js
export function syncSingleChild(container, child) {
  const currentChild = container.firstElementChild;
  if (currentChild !== child) {
    clearContainer(container);
    if (child) {
      container.appendChild(child);
    }
  }
}

export function clearContainer(el) {
  let child;

  while ((child = el.firstElementChild)) {
    el.removeChild(child);
  }
}
```

It's a little bit more boilerplate than we'd need if we build this in a Framework, but the upside is that we can re-use this in any framework we'd like (although React will need a wrapper, for now, as we discussed).

## Wrapping up

Web components are an interested, often underused part of the web development landscape. They can help reduce your dependence on any single JavaScript framework by managing your ui, or "leaf" components. While creating these components as web components, as opposed to Svelte, or React components won't be as ergonomic, the upside is that they'll be widely reusable. 

Happy coding!