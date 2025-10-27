---
title: "position: sticky; the weird parts"
date: "2025-10-26T10:00:00.000Z"
description: Looking at some of the harder, lesser known tricks to getting position stick to work as expected
---

Position sticky is one of those features that's incredibly useful, _seemingly_ simple, and also, frequently, very frustrating.

The premise is simple; you want to be able to scroll your page's content, as always, but you want something to "stick" at the top (or anywhere). Frequetly this will be some sort of header content that you want to always stay at the top, even as the user scrolls, but again it can be anything.

We'll cover a brief introduction to sticky positioning. We'll see how it works, and then we'll look at some common, frustrating ways it can fail, and we'll learn _exactly_ how to fix it.

For all the code examples I'll be using React, along with Tailwind. I know the Tailwind piece might be controversial to some. But really, for this post, it'll allow me to show everything in one place, without ever requiring you, dear reader, to toggle between html markup, and a css file.

## Making content stick

Let's look at the simplest possible example of position

```tsx
export const SimpleStickyDemo = () => {
  return (
    <div className="h-[500px] gap-2 overflow-auto">
      <div className="flex flex-col gap-2 bg-gray-400 h-[400px]">
        <span>Top</span>
        <span className="mt-auto">Bottom</span>
      </div>
      <div className="sticky top-0 h-[200px] bg-red-300 flex flex-col gap-2 flex-1 mt-2">
        <span>Some header content</span>
        <span className="mt-auto">Bottom</span>
      </div>
      <div className="flex flex-col gap-2 bg-gray-400 h-[400px] mt-2">
        <span>Top</span>
        <span className="mt-auto">Bottom</span>
      </div>
    </div>
  );
};
```

Our middle container has `sticky top-0` which sets `position: sticky` and sets the top value to `0`. That means we want it to "sticky" at the zero position of whatever scroll container is doing the scrolling.

![Position sticky working](/position-sticky/basic.gif)

## When things go wrong

This may seem like a simple feature, but in practice it frequently goes wrong, and figuring out why can be maddening. Googling "position sticky doesn't work" will produce a ton of results, the vast majority of which telling you to make sure you don't have any containers between your sticky element, and your scrolling container with overflow: hidden set. This is true: if you do that, sticky positioning won't work.

But there are many other things which can go wrong. The next most common remedy you're likely to see is advising that flex containers be set to `align-self: flex-start`, rather than the default of stretch. This is great advice, and relates strongly to what we'll be covering here. But in so doing we're going to dig deep into _why_ this is necessary; we'll even peak briefly at the css spec, and when we're done, you'll be well equipped to intelligently and efficinetly debug position sticky.

Let's get started. We'll look at two different ways you can (inadvertantly) break sticky positioning, and how to fix.

## Problem 1: Your sticky element is bigger than the scroll container

The title says it all. The sticky element you want to "stick" cannot be larger than the scrolling container in which it's attempting to stick.

Let's see an example

![Position sticky working](/position-sticky/sticky-el-too-tall.gif)

It starts well enough, and the top does in fact stick. But eventually, as you scroll far enough, the browser will ensure that the rest of the sticky element displays in its entirety, which will require the top portion of the element, which had previously "stuck" to the top, scroll away.

This may seem like a silly example; of course you wouldn't do that, and of course you'd probably want all of your content to show. But this problem can show up in subtle, unexpected ways. Maybe your sticky element is a little too long, but your actual content is correctly constrained in a nested element. If that happens, everything will look perfect, but inexplicably your sticky element will overshoot at the end of the scrolling. If you see that happening, this might be why!

## Problem 2: Your sticky element has a bounding context that's too small

Let's take a look at what the css spec has to say (in part) on sticky positioning

> For each side of the box [sticky element], if the corresponding inset property is not auto, and the corresponding border edge of the box would be outside the corresponding edge of the sticky view rectangle, then the box must be visually shifted (as for relative positioning) to be inward of that sticky view rectangle edge, insofar as it can while its position box remains contained within its containing block.

This part

> then the box must be visually shifted (as for relative positioning) to be inward of that sticky view rectangle edge

Refers to the element "sticking." As the sticky element begins to "violate" the sticky constraints you set (ie top: 0), then the browser forcibly shifts it to respect what you said, and stick it in place. But notice the very next line

> insofar as it can while its position box remains contained within its containing block

This is the crucial aspect that the entire rest of this post will obsess over. It manifests itself in many ways (frequently being able to be fixed with the `align-self: flex-start;` trick I mentioned above).

Let's dive in

Here's a sticky demo very similar to what we saw before, except I put the sticky element inside of another element (with a red outline). This _immediately_ breaks the stickyness.

![Position sticky working](/position-sticky/containing-broken.gif)

The sticky element is about to stick, but, if the browser were to allow it to do so, it would have to "break out of" its parent. Its parent is _not_ sticky, and so _it_ will keep scrolling. But the browser will not let the sticky element stick, if doing so will break it out of a parent. Let's make our parent (with the red outline) a little bigger, so this effect will be even clearer

![Position sticky working](/position-sticky/containing-broken2.gif)

Now the sticky element does stick, at first. It sticks because there's some excess space in its parent. The parent does scroll up, and as soon as the bottom of the parent becomes flush, the sticky element stops sticking. Again, this happens because the browser will not allow a sticky element to stick if doing so would break it out of an ancestor element's bounds.

## Using position sticky

## Concluding thoughts

I hope this post has taught you some new things about position sticky which come in handy someday.

Happy Coding!
