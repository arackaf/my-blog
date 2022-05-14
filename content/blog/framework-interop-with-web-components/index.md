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
  static get observedAttributes() {
    return ["color"];
  }
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

and it works. Our counter renders, increments, and the dropdown updates the color appropriately. As you can see, we render the color attribute in our Svelte template, and, when the value changes, handles the legwork of calling `setAttribute` on our underlying web component instance. There's nothing special here: this is the same thing it already does for *any* html element's attributes. 

Now let's set the `incrementAmount` prop. Things get a little bit interesting here. This is *not* an attribute on our web component; it's a prop on the web component's class. That means it needs to be set on the web component's instance. Let's see what this means, but stick with me; things will wind up much simpler than they seem.

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
      wcInstance.incrementAmount = increment;
    }
  }
```

This works, but it's not great. We obviously don't want to do this for every web component / prop we need to change. Wouldn't it be nice if we could just set incrementAmount right on our web component, in markup, and have this ... *just work*. In other words, something like this


