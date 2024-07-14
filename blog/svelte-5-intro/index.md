---
title: Introducing Svelte 5
date: "2024-07-11T10:00:00.000Z"
description: An introduction to Svelte 5, and a guide to upgrading
---

# Introducing Svelte 5

Svelte has always been a delightful, simple, and fun framework to use. It's a framework that's always prioritized developer experience, while producing a result that's light, with minimal JavaScript, and fast. It achieved it's nice, fun DX by giving users dirt simple idioms, while using a compilation step to make everything work. Unfortunately this fun simplicity came at the cost of reliability. It was fairly easy to break Svelte's reactivity in more advanced use cases. It doesn't matter how fast web app is, or how much fun it was to make, if the end result is incorrect.

Svelte 5, currently in Beta at time of writing, is an incredibly exciting release. It's the latest framework to add signals to power their reactivity. That means the reliability problems are gone. Svelte is now every bit as capable of handling robust web applications, with complex state, as alternatives like React and Solid. Best of all, it achieved this with only minimal hits to DX. It's every bit as fun and easy to use, but it's now reliable, and even faster, with a smaller, lighter footprint.

Let's jump in!

## The plan

Let's go through various pieces of Svelte, look at the old way, and then see how Svelte 5 changes things (for the better). In this post we'll cover state, props and effects. Look to later posts for coverage of snippets, and Svelte's new, incredibly exciting fine-grained reactivity.

NOTE:

As of this writing, Svelte 5 is late in the Beta phase. The api should be stable by now, although it's certainly possible some new things might get added.

The docs are also still in beta, but for now, they're located [here](https://svelte-5-preview.vercel.app/docs/introduction). Svelte 5 might be released when you read this, at which point these docs will be on the main Svelte page.

If you'd like to see the code samples below in action, you can find them in [this repo](https://github.com/arackaf/svelte-5-intro-blog).

## State

Effectively managing state is probably the most crucial task for any web framework, so let's start there.

State used to be declared with regular, plain old variable declatations, using `let`.

```ts
let value = 0;
```

Derived state was declared with a quirky, but technically valid JavaScript syntax of `$:`. For example

```ts
let value = 0;
$: doubleValue = value * 2;
```

Svelte's compiler would (in theory) track changes to `value`, and update `doubleValue` accordingly. I say in theory since, depending on how creatively you used `value`, some of the re-assignments might not make it to all of the desived state that used it.

You could also put entire code blocks after `$:` and run arbitrary code. Svelte would look at what you were referencing inside the code block, and re-run it when those things changed.

```ts
$: {
  console.log("Value is ", value);
}
```

### Stores

Those variable declarations, and special `$:` syntax was limited to Svelte components. If you wanted to build some portable state you could define anywhere, and pass around, you'd use a [store](https://svelte.dev/docs/svelte-store).

We won't go through the whole api, but here's a minimal example of a store in action. We'll define a piece of state that holds a number, and, based on what that number is at anytime, spit out a label indicating whether the number is even, or odd. It's silly, but it should show us how stores work.

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

Writable stores exist to ... write values to. Dervied stores take one or more other stores, read their current values, and project some new payload. If you want to provide a mechanism to set a new value, just close over what you need to. To consume a stores value, just prefix it with a `$` in a Svelte component (it's not shown here, but there's also a `subscribe` method on stores, and a `get` import). If the store returns an object with properties, you can either "dot through" to them, or you can use a reactive assignment (`$:`) to get those nested values. The example below shows both, and this distinction will come up later when we talk about interop between Svelte 4 and 5.

```html
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

We moved quickly, but this was the old Svelte. Consult the docs, or any of the materials out there if you want to learn more.

This is a post on the new Svelte, so let's turn our attention there.

## State in Svelte 5

Things are substantially simpler in Svelte 5. Pretty much everything is managed by something new called "runes." Let's see what that means.

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

In Svelte 5 we use the `$derived` rune.

```ts
let countTimes2 = $derived(count * 2);
```

Note that we pass in a raw _expression_. Svelte will run it, see what it depends on, and re-run it as needed. There's also a `$derived.by` rune if you want to pass an actual function; check the docs for more info.

If you want to use these state values in a Svelte template, you just _use them_. No need for special `$` syntax to prefix the runes like we did with stores. You just reference the values in your templates, and they update as needed.

If you want to _update_ a state value, you just assign to it.

```ts
count = count + 1;
```

or of course

```ts
count++;
```

### What about stores?

We saw before that defining portable state, outside of components was accomplished via stores. Stores are also deprecated in Svelte 5. What's especially nice is that they're replaced with what we've _already seen_. That's right, the `$state` and `$derived` runes we saw before can be defined outside of components, in top-level TypeScript (or JavaScript) files. Just be sure to name your file with a `.svelte.ts` extension, so the Svelte compiler knows to enable runes in these files. Let's take a look!

Let's re-implement our number / label code from before, in Svelte 5. This is what it looked like with stores

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

Here it is with runes

```ts
export function createNumberInfo(initialValue: number = 0) {
  let value = $state(initialValue);
  let label = $derived(value % 2 ? "Odd number" : "Even number");

  return {
    update(newValue: number) {
      value = newValue;
    },
    get value() {
      return value;
    },
    get label() {
      return label;
    },
  };
}
```

It's 3 lines shorter, but more importantly, _much_ simpler. We declared out state. We computed our derived state. And we send them both back, along with a method that updates our state.

You may be wondering why we did

```ts
  get value() {
		return value;
	},
	get label() {
		return label;
	}
```

rather than just referencing those properties. The reason is that _reading_ that state, at any given point in time, evaluates the state rune, and, if we're reading it in a reactive context (like a Svelte component binding, inside of a `$derived` expression), then a subscription is set up to update any time that piece of state is updated. If we had done

```ts
// this won't work
return {
  update(newValue: number) {
    value = newValue;
  },
  value,
  label,
};
```

then those `value` and `label` pieces of state would be _read and evaluated_ right there, in the return value, with those raw values getting injected into that object. They would not be reactive, and they would never update.

And that's about that. Svelte 5 ships a few universal state primitives which can be used outside of components, and easily constructed into larger reactive structures. What's especially exciting is that Svelte's component bindings are also updated, and are now support fine-grained reactivity that didn't used to exist. But that's a topic for a future post.

This is by far the longest section of this post. Let's move on to props, and side effects.

## Props

Defining state inside of a component isn't too useful if you can't pass it on to other components as props. Props are also reworked in Svelte 5 in a way that makes them simpler, and also, as we'll see, includes a nice trick to make TypeScript integration even more powerful.

Svelte 4 props were another example of hijacking existing JavaScript syntax to do something unrelated. To declare a prop on a component, you'd use the export keyword. It was weird, but it worked.

```html
// ChildComponent.svelte
<script lang="ts">
  export let name: string;
  export let age: number;
  export let currentValue: string;
</script>

<div class="flex flex-col gap-2">
  {name} {age}
  <!-- prettier-ignore -->
  <input class="self-start rounded border" bind:value={currentValue} />
</div>
```

This component created 3 props. It also bound the `currentValue` prop into the textbox, so it would change as the user typed. Then to render this component, we'd do soemthing like this

```html
<script lang="ts">
  import ChildComponent from "./ChildComponent.svelte";

  let currentValue = "";
</script>

Current value in parent: {currentValue}
<!-- prettier-ignore -->
<ChildComponent name="Bob" age={20} bind:currentValue />
```

This is Svelte 4, so `let currentValue = ''` is a piece of state that can change. We pass props for name and age, but we also have `bind:currentValue` which is a shorthand for `bind:currentValue={currentValue}`. This creates a _two-way binding_. As the child changes the value of this prop, it propagates the change upward, to the parent. This is a very cool feature of Svelte, but it's also easy to misuse, so exercise caution.

Now, as we type in the ChildComponent's textbox, we'll see currentValue update in the parent component.

### Svelte 5 version

Let's see what these props look like in Svelte 5

```html
<script lang="ts">
  type Props = {
    name: string;
    age: number;
    currentValue: string;
  };

  let { age, name, currentValue = $bindable() }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  {name} {age}
  <!-- prettier-ignore -->
  <input class="self-start rounded border" bind:value={currentValue} />
</div>
```

The props are defined via the `$props` rune, from which we destructure the individual values.

```ts
let { age, name, currentValue = $bindable() }: Props = $props();
```

We can apply typings directly to the destructuring expression. In order to indicate that a prop _can be_ (but doesn't have to be) bound to the parent, like we saw above, we use the `$bindable` rune, like this

```ts
 = $bindable()
```

If you want to provide a default value, just assign it to the destructured value. To assign a default value to a bindable prop, pass that value to the `$bindable` rune.

```ts
let { age = 10, name = "foo", currentValue = $bindable("bar") }: Props = $props();
```

### But wait, there's more

One of the most exciting changes to Svelte's prop handling is the improved TypeScript integration. We saw that you can assign types, above. But what if we want to do something like this (in React)

```tsx
type Props<T> = {
  items: T[];
  onSelect: (item: T) => void;
};
export const AutoComplete = <T,>(props: Props<T>) => {
  return null;
};
```

We want a react component that receives an array of items, as well as a callback that takes a single item (of the same type). This works in React. How would we do it in Svelte?

At first, it looks easy.

```html
<script lang="ts">
  type Props<T> = {
    items: T[];
    onSelect: (item: T) => void;
  };

  let { items, onSelect }: Props<T> = $props();
  //         Error here _________^
</script>
```

The first `T` is a generic _parameter_, which is defined as part of the `Props` type. This is fine. The problem is, we need to instantiate that generic type with an actual value for T when we attempt to use it in the destructuring. The `T` that I used there is undefined. It doesn't exist. TypeScript has no idea what that `T` is because it hasn't been defined.

### What changed?

Why did this work so easily with React? The reason is, React components are _functions_. You can define a generic function, and when you _call it_ TypeScript will _infer_ (if it can) the values of its generic types. It does this by looking at the arguments you pass to the function. With React, _rendering_ a component is conceptually the same as calling it, so TypeScript is able to look at the various props you pass, and infer the generic types as needed.

Svelte components are not functions though. They're just a proprietary bit of code thrown into a .svelte file, that the Svelte compiler turns into something useful. We do still render Svelte components, and TypeScript could easily look at the props we pass, and infer back the generic types as needed. The root of the problem, though, is that we haven't (yet) declared any generic types that are associated with the _component itself_. With React components, these are the same generic types we declare for any function. What do we do for Svelte?

Fortunately the Svelte maintainers thought of this. You can declare generic types for the component itself with the `generics` attribute on the `<script>` tag at the top of your Svelte component

```html
<script lang="ts" generics="T">
  type Props<T> = {
    items: T[];
    onSelect: (item: T) => void;
  };

  let { items, onSelect }: Props<T> = $props();
</script>
```

You can even define constraints on your generic arg

```html
<script lang="ts" generics="T extends { name: string }">
  type Props<T> = {
    items: T[];
    onSelect: (item: T) => void;
  };

  let { items, onSelect }: Props<T> = $props();
</script>
```

And TypeScript will enforce this. If you violate that constraint

```html
<script lang="ts">
  import AutoComplete from "./AutoComplete.svelte";

  let items = [{ name: "Adam" }, { name: "Rich" }];
  let onSelect = (item: { id: number }) => {
    console.log(item.id);
  };
</script>

<div class="flex flex-col gap-2 p-4">
  <AutoComplete {items} {onSelect} />
</div>
```

TypeScript will let you know

> Type '(item: { id: number; }) => void' is not assignable to type '(item: { name: string; }) => void'.
> Types of parameters 'item' and 'item' are incompatible.
>
> Property 'id' is missing in type '{ name: string; }' but required in type '{ id: number; }'.

## Effects

Let's wrap up with something comparatively easy: side effects. As we saw before, briefly, in Svelte 4 you could run code for side effects inside of `$:` reactive blocks

```ts
$: {
  console.log(someStateValue1, someStateValue2);
}
```

and that code would re-run when either of those values changed.

Svelte 5 introduces the `$effect` rune. This will run after state has changed, and been applied to the dom. It is for _side effects_. Things like resetting the scroll position after state changes. It is _not_ for synchronizing state. If you're using the `$effect` rune to synchronize state, you're probably doing something wrong (the same goes for the `useEffect` hook in React).

The code is pretty anti-climactic.

```ts
$effect(() => {
  console.log("Current count is ", count);
});
```

When this code first starts, and anytime count changes, you'll see this log. To make it more interesting, let's pretend we have a current timestamp value that auto-updates

```ts
let timestamp = $state(+new Date());
setInterval(() => {
  timestamp = +new Date();
}, 1000);
```

and we want to include that value when we log, but we _don't_ want our effect to run whenever our timestamp changes; we only want it to run when count changes. Svelte provides an `untrack` utility for that

```ts
import { untrack } from "svelte";

$effect(() => {
  let timestampValue = untrack(() => timestamp);
  console.log("Current count is ", count, "at", timestampValue);
});
```

And that's that.

## Interop

Big Bang upgrades where an entire app is updated to use a new framework version's api's are seldom feasible, so it should come as no surprise that Svelte 5 continues to support Svelte 4. You can upgrade your app incremenetally. Svelte 5 components can render Svelte 4 components, and Svelte 4 components can render Svelte 5 components. The one thing you can't do is mix and match within a single component. You cannot use reactive assignments `$:` in the same component that's using Runes (the Svelte compiler will remind you if you forget).

There's one exception to this, though. Stores can continue to be used in Svelte 5 components. Remember the `createNumberInfo` method from before, which returned an object with a store on it? We can use it in Svelte 5. This component is perfectly valid, and works.

```html
<script lang="ts">
	import { createNumberInfo } from '../svelte4/numberInfoStore';

	const numberPacket = createNumberInfo(0);

	const store = numberPacket.numberInfo;
	let junk = $state('Hello');
</script>

<span>Run value: {junk}</span>
<div>Number value: {$store.value}</div>

<button onclick={() => numberPacket.update($store.value + 1)}>Update</button>
```

The one thing we can't do, is use a reactive assignment to destructure values off of the store. So we _have to_ "dot through" to nested proerties with things like `{$store.value}` in the binding (which always works) rather than

```ts
$: ({ value } = $store);
```

which generates the error of

> `$:` is not allowed in runes mode, use `$derived` or `$effect` instead

The error is even clear enough to give you another alternative to inining those nested properties, which is to create a `$derived` state

```ts
let derivedState = $derived($store.value);
```

Personally I'm not a huge fan of mixing the new `$derived` primitive with the old Svelte 4 syntax of `$store`, but that's a matter of taste.

## Parting thoughts

Svelte 5 has shipped some incredibly exciting changes. We covered the new, more reliable reactivity primitives, the improved prop management, with tighter TypeScript integration, and the new side effect primitive. But we haven't come closing to covering everything. Not only are there more variations on the `$state` rune, but Svelte 5 also updated it's event handling mechanism, and even shipped an exciting new way to re-use "snippets" of html. Stay tuned for future posts covering these things.

Svelte 5 is worth a serious look for your next project.

Happy Coding!
