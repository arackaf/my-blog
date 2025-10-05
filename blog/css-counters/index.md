---
title: Fun with CSS Counters
date: "2025-10-05T10:00:00.000Z"
description: CSS Counters
---

```c
for (int i = 0; i < 10; i++) {
}
```

For most of us, some variation of this code is one of the first things we learned when we were first starting out. For me it was C++, but just about any language has some version of it—even CSS. Yes, CSS has counter variables.

Let's take a look!

## CSS Counters in action

CSS Counters are driven by 4 css properties: `counter-reset`, `counter-set`, `counter-increment`, and a `counter()` function.

Let's say we wanted a React component that renders a few lines of text, where the number of lines is received as a prop. But we also want to display line numbers next to each line, _and_ we want to use CSS to do so. That last assumption might seem silly, but bear with me; we'll look at a real-world use case at the end.

Here's the component

```ts
const NumberedSection: FC<{ count: number }> = ({ count }) => {
  return (
    <div className="counter-container p-2 flex flex-col gap-2">
      {Array.from({ length: count }).map((_, idx) => (
        <span key={idx}>This is line</span>
      ))}
    </div>
  );
};
```

We'll use a css counter called `count-val` to manage our line numbers. In css we can reset our counter for each and every `counter-container` div like this

```css
.counter-container {
  counter-reset: count-val;
}
```

And then for each line inside that container, we can increment our counter, and render the current number in a pseudo-element like this

```css
.counter-container span::before {
  counter-increment: count-val;
  content: counter(count-val);
  margin-right: 5px;
  font-family: monospace;
}
```

And it works. Rendering two of these components like so

```jsx
  <NumberedSection count={3} />
  <hr />
  <NumberedSection count={4} />
```

displays line numbers.

![CSS Counters working](/css-counters/img1.png)

If for some reason you wanted to increment by some other value than 1, you can specify whatever increment you want

```css
counter-increment: count-val 2;
```

And if you wanted to just _set_ a counter to a specific value, the counter-set property is for you. There's a few other options that are of course discussed on [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_counter_styles/Using_CSS_counters).

I know this seems silly, and I know this would have been _simpler_ to do in JavaScript. The counter variable is already _right there_

# A better use case

Let's get _slightly_ more realistic. What if you have various h1 headings on your page, representing section titles. And, as you might have guessed, you want them numbered.

Now we can reset a css counter right at the root of our page

```css
body {
  counter-reset: tile-num;
}
```

and then increment and display that counter for each heading that happens to be on our page.

```css
h1.title::before {
  counter-increment: tile-num;
  content: counter(tile-num) ": ";
}
```

And now when we render some content

```jsx
<div className="flex flex-col gap-2 mt-2">
  <h1 className="title">This is a title</h1>
  <p>Content content content</p>
  <h1 className="title">This is the next title on the page</h1>
  <p>Content content content</p>
  <h1 className="title">This is a title</h1>
  <p>Content content content</p>
</div>
```

we have line numbers next to each heading

![CSS Counters working](/css-counters/img2.png)

# One last example

Before going, I'd like to share the use case that led me to discover this feature. So far the examples we've seen are either contrived, or better served by just using JavaScript. But what if you don't have control over the markup that's generated on our page?

I recently moved my blog's code formatting from Prism, to Shiki. Everything went well except for one thing: Shiki does not support line numbers. Which made for a perfect use case for css counters.

I used the Shiki configuration to inject a `data-linenumbers` attribute onto any `pre` tag containing code I wanted numbered, and then I could solve this with a little bit of css

```css
pre[data-linenumbers] code {
  counter-reset: step;
}

pre[data-linenumbers] code .line::before {
  content: counter(step);
  counter-increment: step;
  width: 1rem;
  margin-right: 1rem;
  display: inline-block;
  text-align: right;
  color: rgba(115, 138, 148, 0.4);
}
```

and just like what, I had numbered lines

![CSS Counters working](/css-counters/img2.png)

## Concluding thoughts

CSS counters are a fun feature that can occasionally come in handy. They're a useful feature to keep in the back of your mind: they might come in handy for you one day.

Happy Coding!
