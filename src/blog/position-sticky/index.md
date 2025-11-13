---
title: "position: sticky; the weird parts"
date: "2025-10-26T10:00:00.000Z"
description: Looking at some of the harder, lesser known tricks to getting position stick to work as expected
---

Position sticky is one of those features that's incredibly useful, _seemingly_ simple, and also, frequently, very frustrating.

The premise is simple: you want to be able to scroll your page's content, as always, but you want something to "stick" at the top (or anywhere). Frequetly this will be some sort of header content that you want to always stay at the top, even as the user scrolls, but again it can be anything.

We'll cover a brief introduction to sticky positioning. We'll see how it works, and then we'll look at some common, frustrating ways it can fail, and we'll learn _exactly_ how to fix it.

For all the code examples I'll be using React, along with Tailwind. I know the Tailwind piece might be controversial to some. But really, for this post, it'll allow me to show everything in one place, without ever requiring you, dear reader, to toggle between html markup, and a css file.

## Making content stick

Let's look at the simplest possible example of position: sticky

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

Our middle container has `sticky top-0` which sets `position: sticky` and sets the top value to `0`. That means we want it to "stick" at the zero position of whatever scroll container is doing the scrolling.

![Position sticky working](/position-sticky/basic.gif)

## When things go wrong

This may seem like a simple feature, but in practice it frequently goes wrong, and figuring out why can be maddening. Googling "position sticky doesn't work" will produce a ton of results, the vast majority of which telling you to make sure you don't have any containers between your sticky element, and your scrolling container with overflow: hidden set. This is true: if you do that, sticky positioning won't work.

But there are many other things which can go wrong. The next most common remedy you're likely to see is advising that flex children be set to `align-self: flex-start`, rather than the default of stretch. This is great advice, and relates strongly to what we'll be covering here. But in so doing we're going to dig deep into _why_ this is necessary; we'll even peak briefly at the css spec, and when we're done, you'll be well equipped to intelligently and efficinetly debug position sticky.

Let's get started. We'll look at two different ways you can (inadvertantly) break sticky positioning, and how to fix.

## Problem 1: Your sticky element is bigger than the scroll container

The title says it all. The sticky element you want to "stick" cannot be larger than the scrolling container in which it's attempting to stick.

Let's see an example

```tsx
export const SimplyStickyDemoBreaking = () => {
  return (
    <div className="h-[500px] gap-2 overflow-auto">
      <div className="flex flex-col gap-2 bg-gray-400 h-[400px]">
        <span>Top</span>
        <span className="mt-auto">Bottom</span>
      </div>
      <div className="sticky top-0 h-[600px] bg-red-300 flex flex-col gap-2 flex-1 mt-2">
        <span>Top</span>
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

Here the scroll container is 500px, and the sticky element is 600px.

This is what the code above renders.

![Position sticky working](/position-sticky/sticky-el-too-tall.gif)

It starts well enough, and the top does in fact stick. But eventually, as you scroll far enough, the browser will ensure that the rest of the sticky element displays in its entirety, which will require the top portion of the element, which had previously "stuck" to the top, to scroll away.

This may seem like a silly example; of course you wouldn't do that, and of course you'd probably want all of your content to show. But this problem can show up in subtle, unexpected ways. Maybe your sticky element is a little too long, but your actual content is in a nested element, correctly constrained. If that happens, everything will look perfect, but inexplicably your sticky element will overshoot at the end of the scrolling. If you see that happening, this might be why!

## Problem 2: Your sticky element has a bounding context that's too small

Let's take a look at what the css spec has to say (in part) on sticky positioning

```
For each side of the box [sticky element], if the corresponding inset property
is not auto, and the corresponding border edge of the box would be outside the
corresponding edge of the sticky view rectangle, then the box must be visually
shifted (as for relative positioning) to be inward of that sticky view rectangle
edge, insofar as it can while its position box remains contained within
its containing block.
```

This part

```
then the box must be visually shifted (as for relative positioning)
to be inward of that sticky view rectangle edge
```

refers to the element "sticking." As the sticky element begins to "violate" the sticky constraints you set (ie top: 0), then the browser forcibly shifts it to respect what you set, and "stick" it in place. But notice the very next line

```
insofar as it can while its position box remains contained within its containing block
```

This is the crucial aspect that the entire rest of this post will obsess over. It manifests itself in many ways (frequently being able to be fixed with the `align-self: flex-start;` trick I mentioned above).

Let's dive in

Here's a sticky demo very similar to what we saw before, except I put the sticky element inside of another element (with a red outline). This _immediately_ breaks the stickyness.

```tsx
export const SimplyStickyDemoBreaking2 = () => {
  return (
    <div className="h-[500px] gap-2 overflow-auto p-1">
      <div className="flex flex-col gap-2 bg-gray-400 h-[400px]">
        <span>Top</span>
        <span className="mt-auto">Bottom</span>
      </div>
      <div className="outline-2 h-[200px] outline-red-500">
        <div className="sticky top-0 h-[200px] bg-red-300 flex flex-col gap-2 flex-1 mt-2">
          <span>Top</span>
          <span className="mt-auto">Bottom</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 bg-gray-400 h-[600px] mt-2">
        <span>Top</span>
        <span className="mt-auto">Bottom</span>
      </div>
    </div>
  );
};
```

![Position sticky working](/position-sticky/containing-broken.gif)

The sticky element is about to stick, but, if the browser were to allow it to do so, it would have to "break out of" its parent. Its parent is _not_ sticky, and so _it_ will keep scrolling. But the browser will not let this "breaking out" happen, so the sticking fails.

Let's make our parent (with the red outline) a little bigger, so this effect will be even clearer

```tsx
export const SimplyStickyDemoBreaking2 = () => {
  return (
    <div className="h-[500px] gap-2 overflow-auto p-1">
      <div className="flex flex-col gap-2 bg-gray-400 h-[400px]">
        <span>Top</span>
        <span className="mt-auto">Bottom</span>
      </div>
      <div className="outline-2 h-[300px] outline-red-500">
        <div className="sticky top-0 h-[200px] bg-red-300 flex flex-col gap-2 flex-1 mt-2">
          <span>Top</span>
          <span className="mt-auto">Bottom</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 bg-gray-400 h-[600px] mt-2">
        <span>Top</span>
        <span className="mt-auto">Bottom</span>
      </div>
    </div>
  );
};
```

![Position sticky working](/position-sticky/containing-broken2.gif)

Now the sticky element does stick, at first. It sticks because there's some excess space in its parent. The parent does scroll up, and as soon as the bottom of the parent becomes flush, the sticky element stops sticking. Again, this happens because the browser will not allow a sticky element to stick if doing so would break it out of an ancestor element's bounds.

This too might seem silly; just don't do that, you might be thinking. Let's see a more realistic example of this very phenominon.

### Flex (or grid) children

Let's pretend to build a top-level navigation layout for a web app. Don't focus on the contrived pieces.

We have a main container, which we've sized to 500px (in real life it would probably be `100vh`), and then a child, which itself is a grid container with two columns: a navigation pane on the left, and then the main content section to the right. And for reasons that will become clear in a moment, I put a purple outline around the grid child.

We want the main navigation pane frozen in place, while the main content scrolls. To (try to) achieve this, I've set the side navigation to be sticky with top: 0.

Naturally, for _this_ layout, you could achieve it much more simply in a way that would work. But a more production ready layout for a real application would be much more complex, and would be much more likely to run into the issue we're about to see. This entire post is about actual production issues I've had to debug and fix, and the learnings therefrom.

```ts
export const FlexInFlexStickyDemoVersion1 = () => {
  return (
    <div className="flex border-2 rounded-md">
      <div className="h-[500px] flex flex-1 gap-2 overflow-auto p-1">
        <div className="grid grid-rows-1 outline-2 outline-purple-600 grid-cols-[250px_1fr] flex-1">
          {/* Side Navigation Pane */}
          <div className="sticky top-0 flex flex-col gap-8">
            {Array.from({ length: 5 }).map((_, idx) => (
              <span>Side Navigation {idx + 1}</span>
            ))}
          </div>

          {/* Main Content Pane */}
          <div className="flex flex-1 gap-2">
            <div className="flex flex-col flex-1 gap-2">
              {Array.from({ length: 100 }).map((_, idx) => (
                <div className="flex gap-2">
                  <span>Main Content line {idx}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

And when we run this, the sticky positioning does not work at all. Everything scrolls.

![Flex child](/position-sticky/flex-child.gif)

The reason should be obvious now. Our grid child is sized to the container, which means our content cannot stick without "breaking out" of its container (the purple grid), and as we saw, the css spec does not allow for this.

Why is this happening? Flex children have, by default, their align-self property set to stretch. That means they stretch in the cross axis and fill up their container. The grid's parent is this

```tsx
<div className="h-[500px] flex flex-1 gap-2 overflow-auto p-1">
```

which is a flex container with a flex direction of row. That means the cross direction is vertical. So the grid grows vertcially to the 500px height, and calls it a day. And this is why our stickiness is broken.

Once we understand the root cause, the fix is simple:

```tsx
export const FlexInFlexStickyDemoVersion1 = () => {
  return (
    <div className="flex border-2 rounded-md">
      <div className="h-[500px] flex flex-1 gap-2 overflow-auto p-1">
        <div className="self-start grid grid-rows-1 outline-2 outline-purple-600 grid-cols-[250px_1fr] flex-1">
          {/* Side Navigation Pane */}
          <div className="self-start sticky top-0 flex flex-col gap-8">
            {Array.from({ length: 5 }).map((_, idx) => (
              <span>Side Navigation {idx + 1}</span>
            ))}
          </div>

          {/* Main Content Pane */}
          <div className="flex flex-1 gap-2">
            <div className="flex flex-col flex-1 gap-2">
              {Array.from({ length: 100 }).map((_, idx) => (
                <div className="flex gap-2">
                  <span>Main Content line {idx}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

We've added self-start to **both** the grid container, _and also_ the sticky element. Adding self-start to the grid tells the grid to _start_ at the start of its flex container, and then, rather than _stretch_ to fill its parent, to just flow as big as it needs to. This allows the grid to grow arbitrarily, so the left pane can sticky without needing to break out of its parent (which, as we've seen, is not allowed.)

Why did we add self-start to the sticky element? Remember, grid and flex children both have stretch as the default value for align-self. When we told the grid to grow as large as it needs, then leaving the sticky element as _it's_ default of stretch would cause it to ... stretch and also grow huge. And that violates our original rule #1 above. Remember when we had a sticky element that was 100px larger than its scrolling container? It stuck only until the last 100px of scrolling. Leaving the sticky element as stretch would cause it to grow _exactly_ as large as the content that's scrolling, which would prevent it from sticking at all.

![Flex child](/position-sticky/flex-child-fixed.gif)

### What if the side nav gets too big?

Let's make one more tweak, and stick a green outline on our sticky element

```tsx
export const FlexInFlexStickyDemoVersion1 = () => {
  return (
    <div className="flex border-2 rounded-md">
      <div className="h-[500px] flex flex-1 gap-2 overflow-auto p-1">
        <div className="self-start grid grid-rows-1 outline-2 outline-purple-600 grid-cols-[250px_1fr] flex-1">
          {/* Side Navigation Pane */}
          <div className="self-start outline-2 outline-green-600 sticky top-0 flex flex-col gap-8">
            {Array.from({ length: 5 }).map((_, idx) => (
              <span>Side Navigation {idx + 1}</span>
            ))}
          </div>

          {/* Main Content Pane */}
          <div className="flex flex-1 gap-2">
            <div className="flex flex-col flex-1 gap-2">
              {Array.from({ length: 100 }).map((_, idx) => (
                <div className="flex gap-2">
                  <span>Main Content line {idx}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

![Flex child](/position-sticky/flex-child-outlined.png)

`self-start` on the sticky element keeps its content no bigger than needed. This prevent it from stretching to the (new) grid size that is arbitrarily big. But what happens if our sticky content just naturally gets too big to fit within the scroll container?

![Flex child](/position-sticky/sticky-element-flex-child-too-big.gif)

It sticks, but as the scroll container gets to the very bottom, the browser un-sticks it, so the rest of its content can scroll and be revealed.

This isn't actually the worst thing in the world. We probably want to give users _some_ way to see the overflowed side navigation content; but we probably want to just cap the height to the main content, and then make that element scrollable.

```tsx
export const FlexInFlexStickyDemoVersion1 = () => {
  return (
    <div className="flex border-2 rounded-md">
      <div className="h-[500px] flex flex-1 gap-2 overflow-auto p-1">
        <div className="self-start grid grid-rows-1 outline-2 outline-purple-600 grid-cols-[250px_1fr] flex-1">
          {/* Side Navigation Pane */}
          <div className="max-h-[492px] overflow-auto self-start outline-2 outline-green-600 sticky top-0 flex flex-col gap-8">
            {Array.from({ length: 20 }).map((_, idx) => (
              <span>Side Navigation {idx + 1}</span>
            ))}
          </div>

          {/* Main Content Pane */}
          <div className="flex flex-1 gap-2">
            <div className="flex flex-col flex-1 gap-2">
              {Array.from({ length: 100 }).map((_, idx) => (
                <div className="flex gap-2">
                  <span>Main Content line {idx}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

The weird value of 492 is to allow for the 4px top and bottom padding around it (the p-1 class). In real life you'd of course do something more sensible, like define some css variables. But for our purposes this shows what we're interested in. The side pane is now capped at the containers height, and scrolls if needed.

![Flex child](/position-sticky/final.gif)

## Parting thoughts

I hope this post has taught you some new things about position sticky which come in handy someday.

Happy Coding!
