---
title: Fine-grained reactivity in Svelte 5
date: "2024-08-02T10:00:00.000Z"
description: A deep dive into Svelte 5's new fine-grained reactivity
---

This is the third and final post in a three-part series on Svelte 5. In [the first](https://frontendmasters.com/blog/introducing-svelte-5/), we looked at basic features like state, props and side effects. In [the second](https://todo.com) we looked at Snippets, which is a lightweight feature Svelte added for re-using bits of html within (for now) a single component.

In this post, we'll take a close look at Svelte's new fine-grained reactivity.

## What is fine-grained reactivity?

The best way to describe fine-grained reactivity is to show what it isn't, and the best example of non-fine grained reactivity is React. In React, if you're in a single component, no matter how big or how small, setting a single piece of state will cause the entire component, and all of the components (unless they're created with React.memo) that are rendered by the component, the component's children, etc, to all re-render. Even if the state you're setting is rendered in a single, simple span tag in the component, and not used anywhere else at all, the entire world from that component, all the way down will be re-rendered.

This may seem absurdly wasteful, but in reality this is a consequence of the design features that made React popular when it was new: the data, values, callbacks, etc that we pass through our component trees are all plain JavaScript. We pass plain, vanilla JavaScript objects, arrays and functions around our components and everything just works. At the time, this made an incredibly compelling case for React, vs alternatives like Angular 1 and Knockout. But since that time alternatives like Svelte have really closed the gap. My [first post](https://frontendmasters.com/blog/introducing-svelte-5/) on Svelte 5 showed just how simple, flexible, and most importantly reliable Svlete's new state mangaement primitives are. This post will show you the performance wins these primitives buy us.

## Premature optimization is still bad

This post will walk through some Svelte templates using trickery to snoop on just how much of a component is being re-rendered when we change state. This is **not** something you will usually, or really ever be doing or caring about. As always, write clear and understandable code, and optimize when needed, but not before. The ostensibly inefficient Svelte 4 reactivity we'll look at first is still much, more more performant than what React does out of the box, and React is more than fast enough for the overwhelming majority of use cases.

But being fast enough doesn't mean we can't still look at how much of a better performance baseline Svelte now starts you off at. With a fast-growing ecosystem, and now an incredibly compelling performance story, hopefully this post will encourage you to at least look at Svelte for your next project.

If you'd like to try out the code we'll be looking at in this post, it's all in [this repo](https://github.com/arackaf/svelte-fine-grained-reactivity).

## Getting started

The code we'll be looking at is from a SvelteKit scaffolded project. If you've never used Svelte _Kit_ before that's totally fine. You can check it out [here](https://kit.svelte.dev/docs/creating-a-project), but we're not really using any SvelteKit features until the very, very end of this post, and even then it's just re-hashing what we'll have already covered.

Throughout this post we're going to be inspecting if and when individual bindings in a component are re-evaluated when we change state. There's various ways to do this, but the simplest, and frankly dumbest is to just force some global, non-reactive, always-changing state into these bindings. What do I mean by that? In the very, very root page that hosts our web app, I'm adding this

```html
<script>
  var __i = 0;
  var getCounter = () => __i++;
</script>
```

This adds a completely global `getCounter` function, as well as the `__i` variable. `getCounter` will always return the next value, and if we stick a call to it in our bindings, we'll be able to snoop on when those bindings are being re-executed by Svelte. If you're using TypeScript, you can avoid errors when calling this like so

```ts
declare global {
  interface Window {
    getCounter(): number;
  }
}

export {};
```

This post will look at different pages binding to the same data, declared mostly like this (we'll note differences as we go).

```ts
let tasks = [
  { id: 1, title: "Task A", assigned: "Adam", importance: "Low" },
  { id: 2, title: "Task B", assigned: "Adam", importance: "Medium" },
  { id: 3, title: "Task C", assigned: "Adam", importance: "High" },
  { id: 4, title: "Task D", assigned: "Mike", importance: "Medium" },
  { id: 5, title: "Task E", assigned: "Adam", importance: "High" },
  { id: 6, title: "Task F", assigned: "Adam", importance: "High" },
  { id: 7, title: "Task G", assigned: "Steve", importance: "Low" },
  { id: 8, title: "Task H", assigned: "Adam", importance: "High" },
  { id: 9, title: "Task I", assigned: "Adam", importance: "Low" },
  { id: 10, title: "Task J", assigned: "Mark", importance: "High" },
  { id: 11, title: "Task K", assigned: "Adam", importance: "Medium" },
  { id: 12, title: "Task L", assigned: "Adam", importance: "High" },
];
```

And we'll render these tasks with this markup

```html
<div class="flex flex-col gap-3">
	{#each tasks as t}
		<div class="flex flex-row items-center gap-9">
			<div class="flex flex-row items-center gap-2">
				<span>{t.id + getCounter()}</span>
				<button onclick={() => (t.id += 10)} class="border p-2">Update id</button>
			</div>
			<div class="flex flex-row items-center gap-2">
				<span>{t.title + getCounter()}</span>
				<button onclick={() => (t.title += 'X')} class="border p-2">Update title</button>
			</div>
			<div class="flex flex-row items-center gap-2">
				<span>{t.assigned + getCounter()}</span>
				<button onclick={() => (t.assigned += 'X')} class="border p-2">Update assigned</button>
			</div>
			<div class="flex flex-row items-center gap-2">
				<span>{t.importance + getCounter()}</span>
				<button onclick={() => (t.importance += 'X')} class="border p-2">Update importance</button>
			</div>
		</div>
	{/each}
</div>
```

The Svelte 4 code we'll start with will use the `on:click` synatx for events, but everything else will be the same.

The calls to `getCounter` right inside the bindings will let us see when those bindings are re-executed, since the call to `getCounter()` will always return a new value.

Let's get started

## Svelte 4

We'll render the content we saw above, using Svelte 4.

![Svelte 4](/svelte-5-fine-grained-reactivity/svelte4.png)

Plain and simple. But now let's click any of those buttons, to modify one property, of one of those tasks—it doesn't matter which.

![Svelte 4 after an update](/svelte-5-fine-grained-reactivity/svelte4-updated.png)

Notice that the entire component (every binding in the component) re-rendered. As inefficient as this seems, it's _still_ much better than what React does. It's not remotely uncommon for a single state update to trigger _multiple_ re-renders of _many_ components.

Let's see how Svelte 5 improves things.

## Svelte 5

For Svelte 5, the code is pretty much the same, except we declare out state like this

```ts
let tasks = $state([
  { id: 1, title: "Task A", assigned: "Adam", importance: "Low" },
  // and so on ...
  { id: 12, title: "Task L", assigned: "Adam", importance: "High" },
]);
```

We render the page, and see the same as before. If you're following along in the repo, be sure to refresh the page after navigating, so the page will start over with the global counter.

![Svelte 5](/svelte-5-fine-grained-reactivity/svelte5.png)

Now let's change one piece of state, as before. We'll update the title for Task C, the third one.

![Svelte 5](/svelte-5-fine-grained-reactivity/svelte5-updated.png)

and just like that, only the single piece of state we modified has re-rendered. Svelte was smart enough to leave everything else alone. 99% of the time this won't make any difference, but if you're rendering a _lot_ of data on a page, this can be a substantial performance win.

### Why did this happen

This is actually the default behavior when we pass arrays and objects (and arrays of objects) into the `$state` rune, like we did with

```ts
let tasks = $state([
```

Svelte will read everything you pass, set up [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) objects to track what changes, and update the absolute minimum amount of dom nodes necessary.

## False Coda

We could easily end the post here. Use the `$state` primitive to track your reactive data. Svelte will make it deeply reactive, and update whatever it needs to update when you change anything. This will be _just fine_ the vast majority of the time.

But what if you're writing a web application that has to manage a _ton_ of data. Making everything deeply reactive is not without cost.

Let's see how we can tell Svelte that only _some of_ our data are reactive. I'll stress again, laboring over this will almost never be needed. But it's good to know how it works if it ever comes up.

## Rediscovering a long-lost JavaScript feature

Classes in JavaScript have gotten an unfortunately bad reputation. Classes are an outstanding way to declare the _structure_ of a set of objects, which also happen to come with a built-in factory function for creating those objects. Not only that, but TypeScript is deeply integrated with classes.

You can declare

```ts
class Person {
  firstName: string;
  lastName: string;

  constructor(firstName: string, lastName: string) {
    this.firstName = firstName;
    this.lastName = lastName;
  }
}
```

and not only will this provide you a factory function for creating instances of a Person, via `new Person('Adam', 'Rackis')`, but `Person` can also be used as a type within TypeScript. You can create variables or function parameters of type `Person`. It's one of the few things that exist as a runtime construct, and also a TypeScript type.

That said, if you find yourself reaching for `extends` in order to create deep inheritance hierarchies with classes, please please re-think your decisions...

Anyway, why am I bringing up classes in this post?

## Fine-grained reactivity in Svelte 5

If you have a performance-sensitive section of code where you need to mark some properties as non-reactive, you can do this by creating class instances, rather than vanilla JavaScript objects. Let's define a Task class for our tasks. For the properties we _want to_ be reactive, we'll set default values with the `$state()` rune. For properties we _don't_ want to be reactive, we won't.

```ts
class Task {
  id: number = 0;
  title = $state("");
  assigned = $state("");
  importance = $state("");

  constructor(data: Task) {
    Object.assign(this, data);
  }
}
```

And then we just use that class

```ts
let tasks = $state([
  new Task({ id: 1, title: "Task A", assigned: "Adam", importance: "Low" }),
  // and so on
  new Task({ id: 12, title: "Task L", assigned: "Adam", importance: "High" }),
]);
```

I simplified the class a bit by just taking a raw object with all the properties of the class, and assigning those properties with `Object.assign`. The object literal is typed in the constructor as `Task`, the same as the class, but that's fine because of TypeScript's [structural typing](https://css-tricks.com/typescript-discriminated-unions/).

And now when we run that, we'll see the same exact thing as before, except clicking the button to change the id will not re-render anything at all in our Svelte component. To be clear, the `id` is still changing, but Svelte is not re-rendering. This demonstrates Svelte intelligently not wiring any kind of observability into that particular property.

As a side note if you wanted to actually encapsulate / protect the `id`, you could declare id as `#id` to make it a [private property](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties) and then expose the value with a getter function.

## Going deeper

What if you don't want these tasks to be reactive at the individual property at all. What if we have a _lot_ of these tasks coming down, and you're not going to be editing them. So rather than have Svelte set up reactivity for each of the tasks' properties, you just want the array itself to be reactive.

You basically want to be able to add or remove entries in your array, and have Svelte update the tasks that are rendered. But you don't want Svelte setting up any kind of reactivity for each property on each task.

This is a common enough use case that other state management systems support this directly, for example MobX's [observable.shallow](https://mobx.js.org/observable-state.html#available-annotations). Unfortunately Svelte does not have any such helper, as of yet, though I'm hopeful it gets added at some point.

But we can hack it ourselves. We already saw how passing class instances to an array shut off fine-grained reactivity by default, leaving you to opt-in, as desired, by setting class fields to `$state()`. But our data are likely coming from a database, as plain (hopefully typed) JavaScript objects, unrelated to any class; more importantly we likely have zero desire to cobble together a class just for this.

So let's simulate it. Let's say that a database is providing our Task objects as JS objects. We (of course) have a type for this

```ts
type Task = {
  id: number;
  title: string;
  assigned: string;
  importance: string;
};
```

but we want to put those instances into an array that itself is reactive, but not the individual properties on the tasks. With a tiny bit of cleverness we can make it mostly painless

```ts
class NonReactiveObjectGenerator {
  constructor(data: unknown) {
    Object.assign(this, data);
  }
}

type ReactivePacket<T> = {
  get value(): T;
  set value(newValue: T[]);
};

function shallowObservable<T>(data: T[]): ReactivePacket<T[]> {
  let result = $state(data.map(t => new NonReactiveObjectGenerator(t) as T));
  return {
    get value() {
      return result;
    },
    set value(newData: T[]) {
      result = newData;
    },
  };
}
```

Our `NonReactiveObjectGenerator` class takes in any object, and then smears all that object's properties onto itself. Our `ReactivePacket` type is _just_ so we can put a wrapper around the `$state()` object we'll be returning. As we discussed in my [first post](https://frontendmasters.com/blog/introducing-svelte-5/#state) on Svelte 5, you can't directly return reactive state from a function. If you do, the state will be read and unwrapped right at the call-site, and won't be reactive any longer.

And lastly, we have our `shallowObservable` which takes an array of whatever, and maps it onto instances of our `NonReactiveObjectGenerator` class. This will force each instance to be a class instance, with nothing reactive. The `as T` is us forcing TypeScript to treat these new instances as whatever type was passed in. This is accurate, but something TypeScript needs help understanding, since it's not (as of now) able to read and understand our call to `Object.assign` in the class constructor.

Don't forget to access the array through the `.value` property, via `{#each tasks.value as t, idx}`

Our component will now change slightly

```ts
const tasksData: Task[] = [
  { id: 1, title: "Task A", assigned: "Adam", importance: "Low" },
  // and so on
  { id: 12, title: "Task L", assigned: "Adam", importance: "High" },
];

let tasks = shallowObservable(tasksData);
let numberOfTasks = $derived(tasks.value.length);
```

And with that, rendering should now work, and none of our properties are reactive. Clicking the edit buttons do nothing.

But we can now add a button to push a new task onto our array

```html
<button
	onclick={() =>
		tasks.value.push(
			new NonReactiveObjectGenerator({
				id: nextId++,
				title: 'New task',
				assigned: 'Adam',
				importance: 'Low'
			}) as Task
		)}
	class="self-start border p-3"
>
	Add new task
</button>
```

and we can even add a delete button to each row

```html
<button onclick={() => tasks.value.splice(idx, 1)} class="border border-red-500 p-3">
	Delete
</button>
```

Yes, Svelte's reactive array is smart enough to understand push and splice.

### Editing tasks this way

You might be wondering if we can still actually edit the indivudual tasks. We assumed the tasks would be read-only, but what if that changes. We've been modifying the array and watching Svelte re-render correctly. Can't we edit an individual task by just cloning the task, updating it, and then re-assigning to that index? The answer is yes, with a tiny caveat.

Overriding an array index (with a _new_ object instance) does work, and makes Svelte update. But we can't just do this

```ts
tasks.value[idx] = { ...t, importance: "X" + t };
```

since that would make the new object, which is an object literal, deeply reactive. We have to keep using our class. This time, to keep the typings simple, and to keep the code smell that is the `NonReactiveObjectGenerator` class hidden as much as possible, I wrote up a helper function

```ts
function cloneNonReactive<T>(data: T): T {
  return new NonReactiveObjectGenerator(data) as T;
}
```

Again note the type assertion, which is unfortunately needed. This same function could also be used for the add function we saw above, if you prefer.

To prove editing works, we'll leave the entire template alone, except for the `importance` field, which we'll modify like so

```html
  <div class="flex flex-row items-center gap-2">
  <span>{t.importance + getCounter()}</span>
  <button
    onclick={() => {
      const taskClone = cloneNonReactive(t);
      taskClone.importance += 'X';
      tasks.value[idx] = cloneNonReactive(taskClone);
    }}
    class="border p-2">Update importance</button
  >
</div>
```

Now running shows everything as it's always been

![Svelte 5 shallow reactivity](/svelte-5-fine-grained-reactivity/svelte5-shallow.png)

If we click the button to change the id, title or assigned value, nothing changes, because we're still mutating those properties directly, since I didn't change anything, in order to demonstrate that they're not reactive. But clicking the button to update the importance field runs the code above, and updates the _entire_ row, showing any other changes we've made.

Here I clicked the button to update the title, twice, and then clicked the button to update the importance. The former did nothing, but the latter updated the component to show all changes.

![Svelte 5 shallow reactivity updated](/svelte-5-fine-grained-reactivity/svelte5-shallow-updated.png)

Again, please don't let the foregoing section turn you off to Svelte. It was a little bit of boilerplate we added for a _relatively_ rare edge case where we have good reason to care about performance. Hopefully Svelte will support this directly in the future, but for now it can be approximated easily.

## Svelte Kit

Let's wrap up by briefly talking about how data from SvelteKit loaders is treated in terms of reactivity. In short, it's exactly how you'd expect. First and foremost, if you just return a raw array of objects from your loader,

```ts
export const load = () => {
  return {
    tasks: makeReactive([
      { id: 1, title: "Task A", assigned: "Adam", importance: "Low" },
      { id: 2, title: "Task B", assigned: "Adam", importance: "Medium" },
      { id: 3, title: "Task C", assigned: "Adam", importance: "High" },
      { id: 4, title: "Task D", assigned: "Mike", importance: "Medium" },
      { id: 5, title: "Task E", assigned: "Adam", importance: "High" },
      { id: 6, title: "Task F", assigned: "Adam", importance: "High" },
      { id: 7, title: "Task G", assigned: "Steve", importance: "Low" },
      { id: 8, title: "Task H", assigned: "Adam", importance: "High" },
      { id: 9, title: "Task I", assigned: "Adam", importance: "Low" },
      { id: 10, title: "Task J", assigned: "Mark", importance: "High" },
      { id: 11, title: "Task K", assigned: "Adam", importance: "Medium" },
      { id: 12, title: "Task L", assigned: "Adam", importance: "High" },
    ]),
  };
};
```

none of those data will be reactive in your component. This is to be expected. To make data reactive, you need to wrap it in `$state()`. As of now, you can't call `$state` in a loader, only in a universal svelte file (something that ends in `.svelte.ts`). Hopefully in the future Svelte will allow us to have loaders named `+page.svelte.ts` but for now we can just throw something like this in a `reactive-utils.svelte.ts` file

```ts
type ReactivePacket<T> = {
  get value(): T;
  set value(newValue: T[]);
};

export const makeReactive = <T>(arg: T): ReactivePacket<T> => {
  let result = $state(arg);

  return {
    get value() {
      return result;
    },
    set value(newValue: T) {
      result = newValue;
    },
  };
};
```

and them import it and use it in our loader

```ts
import { makeReactive } from "./reactive-utils.svelte";

export const load = () => {
  return {
    tasks: makeReactive([
      { id: 1, title: "Task A", assigned: "Adam", importance: "Low" },
      { id: 2, title: "Task B", assigned: "Adam", importance: "Medium" },
      { id: 3, title: "Task C", assigned: "Adam", importance: "High" },
      { id: 4, title: "Task D", assigned: "Mike", importance: "Medium" },
      { id: 5, title: "Task E", assigned: "Adam", importance: "High" },
      { id: 6, title: "Task F", assigned: "Adam", importance: "High" },
      { id: 7, title: "Task G", assigned: "Steve", importance: "Low" },
      { id: 8, title: "Task H", assigned: "Adam", importance: "High" },
      { id: 9, title: "Task I", assigned: "Adam", importance: "Low" },
      { id: 10, title: "Task J", assigned: "Mark", importance: "High" },
      { id: 11, title: "Task K", assigned: "Adam", importance: "Medium" },
      { id: 12, title: "Task L", assigned: "Adam", importance: "High" },
    ]),
  };
};
```

And now those objects will support the same fine-grained reactivity we saw before. To customize which properties are reactive, you'd swap in class instances, instead of vanilla object literals, again just like we saw. All the same rules apply.

## Wrapping up

One of the most exciting features of Svelte 5 is the fine-grained reactivity it adds. Svelte was already lightweight, and faster than most, if not all of the alternatives. These additions in version 5 only improve on that. When added to the state management improvements we've already covered in prior posts, Svelte 5 really becomes a serious framework option.

Consider it for your next project.

Happy Coding!
