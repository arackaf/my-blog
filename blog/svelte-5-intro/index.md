---
title: Introducing Svelte 5
date: "2024-07-11T10:00:00.000Z"
description: An introduction to Svelte 5, and a guide to upgrading
---

# Introducing Svelte 5

Svelte has always been a delightful, simple, and fun framework to use. It's a framework that's always prioritized developer experience, while producing a result that's light, with minimal JavaScript, and fast. It achieved it's nice, fun DX by giving users dirt simple idioms to use, and using a compilation step to make everything work. Unfortunately this fun simplicity came at a cost of reliability. It was unfortunately easy to break Svelte's reactivity in more advanced use cases. It doesn't matter how fast web app is, or how much fun it was to make, if the end result is incorrect.

## How things were

For example, you'd declare state with just a regular variable declatation, using let.

```ts
let value = 0;
```

And you could declare derived state by using a quirky, but technical valid JavaScript syntax of `$:`. For example

```ts
let value = 0;
$: doubleValue = value * 2;
```

Then Svelte's compiler would track changes to `value`, and update `doubleValue` accordingly.

## Parting thoughts

Happy Coding!
