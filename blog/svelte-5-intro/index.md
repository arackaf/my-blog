---
title: Introducing Svelte 5
date: "2024-07-11T10:00:00.000Z"
description: An introduction to Svelte 5, and a guide to upgrading
---

# Introducing Svelte 5

Svelte has always been a delightful, simple, and fun framework to use. It's a framework that's always prioritized developer experience, while producing a result that's light, with minimal JavaScript, and fast. It achieved it's nice, fun DX by giving users dirt simple idioms to use, and using a compilation step to make everything work. Unfortunately this fun simplicity came at a cost of reliability. It was unfortunately easy to break Svelte's reactivity in more advanced use cases. It doesn't matter how fast web app is, or how much fun it was to make, if the end result is incorrect.

Svelte 5 is in Beta, and is incredibly exciting. It's the latest framework to add signals to power their reactivity. That means the reliability problems are gone. Svelte is now every bit as capable of handling robust web applications with complex state. Best of all, it achieved this with only extremely minimal hits to their DX. It's every bit as fun and easy to use, but it's now reliable, and even faster, with a smaller, lighter footprint.

Let's jump in!

## The plan

Let's go through various pieces of Svelte, look at the old way, and then see how Svelte 5 changes things (for the better). Let's get started.

NOTE:

As of this writing, Svelte 5 is late in the Beta phase. The api should be about stable by now, although it's certainly possible some new things might get added.

## State

Effectively managing state is probably the most crucial task for any web framework, so let's start there.

State used to be declared with regular, plain old variable declatations, using `let`.

```ts
let value = 0;
```

And you could declare derived state by using a quirky, but technical valid JavaScript syntax of `$:`. For example

```ts
let value = 0;
$: doubleValue = value * 2;
```

Svelte's compiler would (in theory) track changes to `value`, and update `doubleValue` accordingly. I say in theory since, depending on how creatively you used value, some of the re-assignments might not make it to all of the desived state that used it.

### Stores

Those variable declarations, and special `?:` syntax was limited to Svelte components. If you wanted to build some portable state you could define anywhere, and pass around, you'd use a [store](https://svelte.dev/docs/svelte-store).

We won't go through the whole api, but here's a minimal example of a store in action

```ts
import { derived, writable } from "svelte/store";

export function createNumberInfo(initialValue: number = 0) {
  const value = writable(initialValue);

  const derivedInfo = derived(value, value => {
    return {
      value,
      label: value % 2 ? "Odd number" : "Even number",
    };
  });

  return {
    update(newValue: number) {
      value.set(newValue);
    },
    numberInfo: derivedInfo,
  };
}
```

Writable stores we can basically ... write values to. Dervied stores take one or more other stores, read their current values, and project some new payload. If you want to provide some mechanism to set a new value, just close over what you need to. To consume a stores value, just prefix it with a `$` in a Svelte component (it's not shown here, but there's also a `subscribe` method on stores, and a `get` import that lets you grab the current value at any point in time. If the store returns an object with properties, you can wither "dot through" to them, or you can also use a `$:` reactive assignment to get those nested values. The example below shows both, and this distinction will come up later when we start talking about interop between Svelte 4 and 5.

```svelte
<script lang="ts">
	import { createNumberInfo } from './numberInfoStore';

	let store = createNumberInfo(0);

	$: ({ numberInfo, update } = store);
	$: ({ label, value } = $numberInfo);
</script>

<div class="flex flex-col gap-2 p-5">
	<span>{$numberInfo.value}</span>
	<span>{$numberInfo.label}</span>
	<hr />
	<span>{value}</span>
	<span>{label}</span>

	<button class="mt-5 self-start rounded border p-2" onclick={() => update($numberInfo.value + 1)}>
		Increment count
	</button>
</div>
```

We moved quick. But this was the old Svelte. Consult the docs, or any of the materials out there if you want to learn more.

But this is a post on the new Svelte, version 5.

## State in Svelte 5

Things are substantially simpler in Svelte 5. The docs are still in beta, but for now, they're located [here](https://svelte-5-preview.vercel.app/docs/introduction). Svelte 5 might be released when you read this, at which point these docs will be on the main Svelte page.

### Runes

As we mentioned before, Svelte 5 joins the increasing number of JavaScript frameworks that use signals. Svelte calls its state primitives "runes" which, under the covers, use signals to maintain correctness. A good introduction to runes can be found [here](https://svelte.dev/blog/runes).

To create a piece of state, we use the `$state` rune. You don't import it, you just use it; it's part of the Svelte language.

```ts
let count = $state(0);
```

For values which are not inferrable, you can provide a generic

```ts
let currentUser = $state<User | null>(null);
```

What if you want to create some derived state? Before we did

```ts
$: countTimes2 = count * 2;
```

In Svelte 5 we used the `$derived` rune.

```ts
let countTimes2 = $derived(count * 2);
```

Note that we pass in a raw expression. Svelte will run it, see what it depends on, and re-run it as needed. There's also a $derived.by rune if you want to pass an actual function; check the docs for more info.

If you want to use these state values in a Svelte template, you just _use them_. No need for special `$` syntax to prefix the runes like we did with stores. You reference the values in your templates, they'll update as needed.

If you want to _update_ a state value, you just assign to it.

```ts
count = count + 1;
```

or of course

```ts
count++;
```

## Parting thoughts

Happy Coding!
