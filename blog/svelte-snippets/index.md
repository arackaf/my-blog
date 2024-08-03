---
title: Snippets in Svelte 5
date: "2024-07-11T10:00:00.000Z"
description: Introducing snippets in Svelte
---

This post is the second in a 3-part series on Svelte 5. [Part one](https://frontendmasters.com/blog/introducing-svelte-5/) was a basic introduction, covering nuts and bolts features like state, props, and effects. This post is all about snippets, an exciting new feature that allows for content reuse, and more importantly, injecting content into components you render.

If you'd like to see and experiment with the code in this post, you can find the repo [here](https://github.com/arackaf/svelte-snippets).

Stay tuned for the third and final post, which will be a deep dive into Svelte 5's new fine-grained reactivity.

Let's get started.

## What are snippets

Snippets are a new feature in Svelte 5. They allow you to define, well, snippets of content. They're _almost_ lightweight components that you can fine inside of a component file. Before you get too excited, they do not, as of now, allow you to define multiple components in one file. Snippets cannot be exported from anywhere, and even if they could, they do not allow you to define state; they're limited to props.

They seem initially similar to React's minimally useful Stateless Functional Components from back before hooks was a thing. But snippets also have a second use: they allow you to inject content into other components, and in so doing replace one of Svelte's most awkward features: slots.

Let's see how.

## Defining snippets

We define snippets with the #snippet directive. The simplest snippet imaginable looks like this

```html
{#snippet helloWorld()}
<span>Hello World</span>
{/snippet}
```

That defines the snippet. To render the snippet, we use the `@render` directive, like this

```svelte
{@render helloWorld()}
```

As you might have guessed, snippets can also receive props, or really, parameters, since snippets are more of a function, than a component. Parameters are listed in the parens, with types if you're using TypeScript.

```html
{#snippet productDisplay(p: Product)}
<div class="flex flex-row gap-3">
  <img class="max-w-[100px]" src="{p.url}" alt="product url" />
  <div class="flex flex-col">
    <h2 class="text-lg font-bold">{p.name}</h2>
    <span class="italic">${p.price.toFixed(2)}</span>
  </div>
</div>
{/snippet}
```

Unsurprisingly, snippets can render other snippets

```html
{#snippet productReview(review: Review)}
<div class="flex flex-row gap-3">
  <span>{review.date}</span>
  <span>{review.content}</span>
</div>
{/snippet}

<!-- ts-ignore -->

{#snippet productDisplay(p: Product)}
<div class="flex flex-col gap-3">
  <div class="flex flex-row gap-3">
    <img class="max-w-[100px]" src="{p.url}" alt="product url" />
    <div class="flex flex-col">
      <h2 class="text-lg font-bold">{p.name}</h2>
      <span class="italic">${p.price.toFixed(2)}</span>
    </div>
  </div>
  <h3>Reviews:</h3>
  <div>{#each p.reviews ?? [] as review} {@render productReview(review)} {/each}</div>
</div>
{/snippet}
```

And then you can reuse that productDisplay snippet with different products in your component. Let's see a minimal, full example

```html
<script lang="ts">
  type Review = {
    date: string;
    content: string;
  };
  type Product = {
    name: string;
    url: string;
    price: number;
    reviews?: Review[];
  };

  let searchedBook = $state<Product>({
    name: "Effective TypeScript: 83 Specific Ways to Improve Your TypeScript, 2nd Edition",
    url: "https://m.media-amazon.com/images/I/71eWL4AqPqL._SL1500_.jpg",
    price: 44.99,
    reviews: [
      { date: "2/14/2024", content: "Absolutely loved this book" },
      { date: "6/2/2024", content: "Even better than the first edition" },
    ],
  });
  let relatedProduct = $state<Product>({
    name: "Modern C++ Design: Generic Programming and Design Patterns Applied",
    url: "https://m.media-amazon.com/images/I/914ncVx1hxL._SL1413_.jpg",
    price: 55.49,
  });
</script>

{#snippet productReview(review: Review)}
<div class="flex flex-row gap-3">
  <span>{review.date}</span>
  <span>{review.content}</span>
</div>
{/snippet}

<!-- ts-ignore -->

{#snippet productDisplay(p: Product)}
<div class="flex flex-col gap-3">
  <div class="flex flex-row gap-3">
    <img class="max-w-[100px]" src="{p.url}" alt="product url" />
    <div class="flex flex-col">
      <h2 class="text-lg font-bold">{p.name}</h2>
      <span class="italic">${p.price.toFixed(2)}</span>
    </div>
  </div>
  <h3>Reviews:</h3>
  <div>{#each p.reviews ?? [] as review} {@render productReview(review)} {/each}</div>
</div>
{/snippet}

<section class="flex flex-col gap-5">
  <h1 class="mb-5 text-3xl">Product Display Page</h1>

  {@render productDisplay(searchedBook)}

  <aside>You might also be interested in:</aside>

  {@render productDisplay(relatedProduct)}
</section>
```

If that was the extent of Snippets they'd be a minimally useful convenience for re-using small bits of markup within a single component.

But the main benefit of snippets, in my opinion at least, is for injecting content into components. Previously, if you wanted to pass content into a component you'd use slots. Slots were always an awkward feature of Svelte, but they're now deprecated in Svelte 5. We won't cover them here, so check out [the docs](https://svelte.dev/docs/special-elements#slot) if you're curious.

## Passing snippets to components

Snippets shine brightest when we pass them into other components. Let's imagine a (grossly simplified) `DisplayProduct` page. It takes in a product, an optional related product, and a snippet to display products. This component will also render content in the header, which we'll also pass in as a snippet. Let's see the component

```html
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Product } from "./types";

  type Props = {
    product: Product;
    relatedProduct?: Product;
    productDisplay: Snippet<[Product]>;
    children: Snippet;
  };

  let { product, relatedProduct, productDisplay, children }: Props = $props();
</script>

<section class="flex flex-col gap-5">
  {@render children()} {@render productDisplay(product)} {#if relatedProduct}
  <aside>You might also be interested in:</aside>
  {@render productDisplay(relatedProduct)} {/if}
</section>
```

There's a `Snippet` type that svelte exports for us, so we can type the snippets we're receiving. Specifying the parameters that a snippet receives is a little weird, because of how TypeScript is: we list the args as a Tuple. So our productDisplay snippet will take a single arg that's a Product.

The snippet for showing the header I decided to name "children" which has some significance as we'll see in a moment.

Let's put this component to use

```html
{#snippet productDisplay(p: Product)}
<div class="flex flex-row gap-3">
  <img class="max-w-[100px]" src="{p.url}" alt="product url" />
  <div class="flex flex-col">
    <h2 class="text-lg font-bold">{p.name}</h2>
    <span class="italic">${p.price.toFixed(2)}</span>
  </div>
</div>
{/snippet}

<DisplayProduct product="{searchedBook}" relatedProduct="{recommendedBook}" {productDisplay}>
  <h1 class="mb-5 text-3xl">Product Display Page</h1>
</DisplayProduct>
```

We're passing the `productDisplay` snippet in for the `productDisplay` prop (svelte allows you to write {a} instead of a={a} as a convenient shortcut).

But notice the content we put directly inside of the `DisplayProduct` tags. If the component has a prop called `children` that's a snippet, this content will be passed as that snippet. This is a special case just for props called children (similar to the children prop in React). You don't _have_ to do this; you're free to manually pass a `children` prop, just like we did for `productDisplay` if you really want to.

Let's take a look at one more authoring convenience Svelte 5 gives us. If we're just defining a snippet to be passed one time, to one component, Svelte let's us clean the syntax up a bit, like so

```html
<DisplayProduct product="{searchedBook}" relatedProduct="{recommendedBook}">
  <h1 class="mb-5 text-3xl">Product Display Page</h1>
  {#snippet productDisplay(p: Product)}
  <div class="flex flex-row gap-3">
    <img class="max-w-[100px]" src="{p.url}" alt="product url" />
    <div class="flex flex-col">
      <h2 class="text-lg font-bold">{p.name}</h2>
      <span class="italic">${p.price.toFixed(2)}</span>
    </div>
  </div>
  {/snippet}
</DisplayProduct>
```

As before, we have our `<h1>` content directly inside of the tags, as children. But we've also defined a snippet inside of those tags. This is a nice shorthand for passing a snippet as a prop (with the same name) to our component. Don't worry, if the name you give this inline snippet doesn't match a prop, TypeScript will tell you.

## Default content with snippets

One nice feature with slots is that you could define default content pretty easily

```html
<slot name="header-content">
  <span>Default content</span>
</slot>
```

Snippets don't quite have anything like this built in, but they're a flexible enough primitive that you really don't need it.

Let's see how we can provide our own, default content for when a Snippet is not passed in. As before let's say we have our `DisplayProduct` component, except now our `productDisplay` and `children` snippets are optional

```ts
type Props = {
  product: Product;
  relatedProduct?: Product;
  productDisplay?: Snippet<[Product]>;
  children?: Snippet;
};

let { product, relatedProduct, productDisplay, children }: Props = $props();
```

We have a few straightforward options for falling back to our own default content. We can simply test if we have a value for the snippet right in our template, and render the fallback if not

```html
<!-- prettier-ignore -->
{#if children}
  {@render children()} 
{:else}
<h1>Fallback content</h1>
{/if}
```

or we can set up our fallback right in our script

```ts
let productDisplaySnippetToUse: Snippet<[Product]> = productDisplay ?? productDisplayFallback;
```

along with

```html
{#snippet productDisplayFallback(p: Product)}
<div class="flex flex-row gap-3">
  <img class="max-w-[50px]" src="{p.url}" alt="product url" />
  <div class="flex flex-col">
    <h2 class="text-base font-bold">{p.name}</h2>
  </div>
</div>
{/snippet}
```

and render that

```svelte
	{@render productDisplaySnippetToUse(product)}
```

## Parting thoughts

Svelte 5 is an incredibly exciting release. In our last post we covered core features like props, state and side effects. This post turned to one of the more interesting new features: snippets. Snippets are a delightful feature for injecting content into components, and for re-using small bits of content within a single component.
