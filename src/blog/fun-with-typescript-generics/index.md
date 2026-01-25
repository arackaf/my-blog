---
title: Fun with TypeScript
date: "2019-05-13T10:00:00.000Z"
description: A deep dive into TypeScript generics via a bespoke use case
---

Generics are an incredibly powerful feature of TypeScript. There's endless content on TypeScript in general, and certainly generics in particular. This post will (hopefully) differ in that we'll cover things a bit deeper.

This won't be a generic introduction to generics. Instead, we'll implement a very, very niche use case, and in the process we'll cover some advanced uses for generics (and conditional types, and some other goodies)

## A quick refresher on generics (and conditional types)

Let's take a very, very fast introduction to the key concepts of this post. We'll cover the core concepts with extremely contrived examples to keep everything as brief as possible.

If you're already an expert, just scroll past. If you're not sure, give it a read, and if what's in this section isn't old hat, you might want to read some refresher materials before tackling the rest of this post.

### Generics

Think of generics as function parameters that are types. What do I mean by that? Normally function parameters are _values_ (or references to a value, but we won't bother with that). For example

```ts
function arrayLength(arr: any[]) {
  return arr.length;
}
```

Here, arr is an array. Right now it's an array of `any`. If we wanted to, we could add a generic argument to type this array a bit more accurately by adding a generic argument

```ts
function arrayLengthTyped<T>(arr: T[]) {
  return arr.length;
}
```

Now, whenever we call this method, and pass an array, the generic argument `T` will infer to whatever the type of the array is. Make no mistake, even though `T` makes this method definition more accurate, but it's completely pointless. The original method was perfectly fine

```ts
function arrayLength(arr: any[]) {
  return arr.length;
}
```

`arr` is an array of `any`, but that's fine. No matter what the elements of the array are, the `.length` property will always be there.

Let's go from one pointless function to another one. Let's implement our own filter method

```ts
function filterUntyped(array: any[], predicate: (item: any) => boolean): any[] {
  return array.filter(predicate);
}
```

This time we actually have a problem. There's absolutely no checking done on the predicate function we pass in.

```ts
type User = {
  name: string;
};

const users: User[] = [];

filterUntyped(users, user => user.nameX === "John");
```

We're passing in a method that takes each member of the array, but we're clearly misusing it; there is no nameX property on each user. This is where generics shine.

```ts
function filterTyped<T>(array: T[], predicate: (item: T) => boolean): T[] {
  return array.filter(predicate);
}
```

Now TS will verify everything

```ts
filterTyped(users, user => user.nameX === "John");
// -----------------------------^^^^^
// Property 'nameX' does not exist on type 'User'. Did you mean 'name'?
```

We can even limit generic arguments. What if we have a bunch of different user types.

```ts
type User = {
  name: string;
};

type AdminUser = User & {
  role: string;
};

type BannedUser = User & {
  reason: string;
};
```

and for whatever strange reason we wanted to take the `filterTyped` function from before,

```ts
function filterTyped<T>(array: T[], predicate: (item: T) => boolean): T[] {
  return array.filter(predicate);
}
```

but have it only work with any User type.

If you're thinking "just ditch the generics altogether and—"

```ts
function filterUser(array: User[], predicate: (item: User) => boolean): User[] {
  return array.filter(predicate);
}
```

not so fast. This function, while appealing, winds up erasing our return type.

```ts
const adminUsers: AdminUser[] = [];
const adminUsersNamedAdam = filterUser(adminUsers, user => user.name === "Adam");
```

adminUsersNamedAdam is typed as `User[]`, and how could it not be; `filterUser` is explicitly typed to return `User[]` so how could it be otherwise.

The correct solution is to go back to the generic version, but _restrict_ the acceptable values for T

```ts
function filterUserCorrect<T extends User>(array: T[], predicate: (item: T) => boolean): T[] {
  return array.filter(predicate);
}
```

Now our return type is correctly inferred to be the correct, exact same type that we pass in for array, but we're only able to invoke it with a type that matches the `User` type, which is to say, has a `name` property that's a string.

### Conditional Types

Conditional types allow us to, essentially, _ask questions_ about types, and form new types based on the responses.

```ts
type IsArray<T> = T extends any[] ? true : false;

type YesIsArray = IsArray<number[]>;
type NoIsNotArray = IsArray<number>;
```

Here `YesIsArray` is the literal type `true` while `NoIsNotArray` is the literal type `false`. This is obviously pointless; the real value of conditional types usually comes with inferred types.

```ts
type ArrayOf<T> = T extends Array<infer U> ? U : never;

type NumberType = ArrayOf<number[]>;
type NeverType = ArrayOf<number>;
```

Here `Number` type is `number` and NeverType is, predictable, `never`. And yes, we can (and should) use generic constrainted with these helper types

```ts
type ArrayOf2<T extends Array<any>> = T extends Array<infer U> ? U : never;

type NumberType2 = ArrayOf2<number[]>;
type NeverType2 = ArrayOf2<number>;
// ------------------------^^^^^^^
// Type 'number' does not satisfy the constraint 'any[]'
```

Now we're simply forbidden from using `ArrayOf2` with any type that's not an array of something, so we'll never have to worry about getting `never` back.

## Let's get started

I recently wrote a [two-part post on single flight mutations](https://todo) using TanStack start. In order to make that work we very carefully put together react-query options. Our query functions (which do the actual data fetching) were purposefully designed to be a single call against a TanStack Server Function. Then that same query function, as well as the argument payload it takes were placed on the `meta` object, which is a lesser known option in react-query; it allows us to specify arbitrary metadata for a react-query set of options.

Then in middleware, we had code to receive in some query keys, and we looked up the server functions, and argument payloads for a query, so we'd know how to refetch the data for that query on the server.

As part of those efforts, we built a simple helper to remove that duplication

```ts
export function refetchedQueryOptions(queryKey: QueryKey, serverFn: any, arg?: any) {
  const queryKeyToUse = [...queryKey];
  if (arg != null) {
    queryKeyToUse.push(arg);
  }
  return queryOptions({
    queryKey: queryKeyToUse,
    queryFn: async () => {
      return serverFn({ data: arg });
    },
    meta: {
      __revalidate: {
        serverFn,
        arg,
      },
    },
  });
}
```

It's a helper that takes in the query key, the server function, and argument payload, if any, and returns back _some_ of our query options. Then we compose it like this

```ts
export const epicsQueryOptions = (page: number) => {
  return queryOptions({
    ...refetchedQueryOptions(["epics", "list"], getEpicsList, page),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
  });
};
```

It worked fine, but nothing was typed; our server function, and argument payload were both marked as `any`. This post will implement a fully typed version of our `refetchedQueryOptions` functionl it's much harder than it might appear.

## Our success criteria

Here's our complete test setup

```ts
import { QueryKey, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

// ============================ Current Implementation ============================

export function refetchedQueryOptions(queryKey: QueryKey, serverFn: any, arg?: any) {
  const queryKeyToUse = [...queryKey];
  if (arg != null) {
    queryKeyToUse.push(arg);
  }
  return queryOptions({
    queryKey: queryKeyToUse,
    queryFn: async () => {
      return serverFn({ data: arg });
    },
    meta: {
      __revalidate: {
        serverFn,
        arg,
      },
    },
  });
}

// ============== Server Functions for testing ==============

const serverFnWithArgs = createServerFn({ method: "GET" })
  .inputValidator((arg: { value: string }) => arg)
  .handler(async () => {
    return { value: "Hello World" };
  });

const serverFnWithoutArgs = createServerFn({ method: "GET" }).handler(async () => {
  return { value: "Hello World" };
});

// ============================ Tests ============================

refetchedQueryOptions(["test"], serverFnWithArgs, { value: "" });
refetchedQueryOptions(["test"], serverFnWithoutArgs);

// wrong argument type
// FAILS - Unused '@ts-expect-error' directive.
// @ts-expect-error
refetchedQueryOptions(["test"], serverFnWithArgs, 123);

// need an argument
// @ts-expect-error
// FAILS - Unused '@ts-expect-error' directive.
refetchedQueryOptions(["test"], serverFnWithArgs);
```

At the top we have the current iteration of out `refetchedQueryOptions` method. Beneath that, we have some server functions that will help us test this, one with an argument, the other without. And beneath that, we see four calls to `refetchedQueryOptions` to validate that our type checking is working properly. The top two we expect to succeed, and the bottom two we expect to error our, which we verify with the // @ts-expect-error directive. `@ts-expect-error`, well, _expects_ an error on the very next line. If there is an error on the very next line, all is well; if there is no error on the next line, then the `@ts-expect-error` line will itself raise an error.

Above, with our initial implementation we see our expected errors fail to error out. This makes sense, since everything is typed as `any`, and our `arg` parameter is optional, so really anything goes.

Even if you're more than willing to live with imperfect typings, this current solution isn't good for much. Since `serverFn` is typed as any, our `queryFn` will return `any`. That means any application code that's using `useQuery` or `useSuspenseQuery` will now spit out `any` for your data.

The rest of this post will get everything typed properly. We'll have to do some unhinged things, so hopefully we'll learn something new, and maybe even have some fun.

## Iteration 1

How's this for a minimal improvement. Right now, lack of a return type for the server function is absolutely killing us. Any usage of this query data will give use any; we _really_ want our data properly typed in application code.

TanStack Server functions are just ... _functions_. They're special in that you can call them from the client or the server, but at the end of the day they're functions. They always take in a single argument that has a `data` property for the standard arguments your function has defined (it also allows you to pass things like headers, but we won't worry about that, here).

Couldn't we add a generic to our function, representing the server function? Once we have a function, we can use TypeScript's built-in `Parameters` and `ReturnType` helpers. Let's see what that looks like

```ts
export function refetchedQueryOptions<T extends (arg: { data: any }) => Promise<any>>(
  queryKey: QueryKey,
  serverFn: T,
  arg: Parameters<T>[0]["data"],
) {
  const queryKeyToUse = [...queryKey];
  if (arg != null) {
    queryKeyToUse.push(arg);
  }
  return queryOptions({
    queryKey: queryKeyToUse,
    queryFn: async (): Promise<Awaited<ReturnType<T>>> => {
      return serverFn({ data: arg });
    },
    meta: {
      __revalidate: {
        serverFn,
        arg,
      },
    },
  });
}
```

We constrain our generic to be a function that takes in an arg with a data property. Moreover, we can now _use_ our `T` generic in the parameter definition of `arg`, here `arg: Parameters<T>[0]["data"]`. Whatever our function is, we say that `arg` is the same type as the `data` property on the main argument that the function takes in.

How does this look? Let's check our tests

```ts
refetchedQueryOptions(["test"], serverFnWithArgs, { value: "" });
refetchedQueryOptions(["test"], serverFnWithoutArgs);
// Error: Expected 3 arguments, but got 2.

// wrong argument type
// FAILS - Unused '@ts-expect-error' directive.
// @ts-expect-error
refetchedQueryOptions(["test"], serverFnWithArgs, 123);

// need an argument
// FAILS - Unused '@ts-expect-error' directive.
// @ts-expect-error
refetchedQueryOptions(["test"], serverFnWithArgs);
```

We have one argument. It seems we need to pass an argument for the query options for the query function which ... doesn't take any arguments. It makes sense: `refetchedQueryOptions` does indeed define an `arg` parameter, which needs to be passed. I'll be quick to note that simply passing undefined for that arg

```ts
refetchedQueryOptions(["test"], serverFnWithoutArgs, undefined);
```

works perfectly. For the vast, vast majority of apps, this will likely be fine. It's entirely possible the work I'm about to show you to improve on this may not be worth the effort. **But** going through that effort will likely teach us some neat things about TypeScript, and if we're a special kind of strange, may even be fun.

## False prophets

You might think making arg optional would solve all our problem. Unfortunately, when we do that, `arg` becomes optional _everywhere_, including places we want to require it

```ts
// need an argument
// FAILS - Unused '@ts-expect-error' directive.
// @ts-expect-error
refetchedQueryOptions(["test"], serverFnWithArgs);
```

If you're an advanced TypeScript user you might think a conditional type is what we need. Detect the inferred arg type (what's in the `data` arg), and if it's not undefined, require it, but if it _is_ undefined, then _don't_ require it. Unfortunately there's not really an easy way to represent "pass nothing" as the result of a conditional type. I've tried, and I was never able to get things fully working. I may have been missing something (feel free to drop a comment if you can figure it out), but even if there's a trick to make it work, there's a much more straightforward, idiomatic solution.

We essentially want different function parameters in different circumstances: we want an arg when the server function we pass in takes an arg, and we want no arg when the server function we pass in takes no arg. Different function api's is usually referred to a function overloading in computer science, and TypeScript does support this.

### Function overloading in TypeScript

As the simplest possible example, imagine you wanted to write an `add` function with two versions: one that takes in two numbers, and adds them; and one that takes in two strings, and concatenates them. Conceptually we want this

```ts
function add(x: number, y: number): number {
  return x + y;
}

function add(x: string, y: string): string {
  return x + y;
}
```

But that's not valid; since JavaScript is a dynamically typed language you can't have more than one function of the same name, in the same scope. _TypeScript_ does how ever allow us to overload functions, but the mechanics are a bit different. Here's how we do this:

```ts
function add(x: number, y: number): number;
function add(x: string, y: string): string;
function add(x: string | number, y: string | number): string | number {
  if (typeof x === "string" && typeof y === "string") {
    return x + y;
  }
  if (typeof x === "number" && typeof y === "number") {
    return x + y;
  }
  throw new Error("Invalid arguments");
}
```

We start with the function _definitions_.

```ts
function add(x: number, y: number): number;
```

and

```ts
function add(x: string, y: string): string;
```

These define the actual api of our function. We declare that this function can take in two numbers and return a number, or two strings and return a string.

Then we have the actual implementation of the function.

```ts
function add(x: string | number, y: string | number): string | number {
  if (typeof x === "string" && typeof y === "string") {
    return x + y;
  }
  if (typeof x === "number" && typeof y === "number") {
    return x + y;
  }
  throw new Error("Invalid arguments");
}
```

The inputs, and return types all have to be a union of every definition. In other words, the actual implementation has to accept any of the definitions.

And now when we try to call this function, we only see the definitions available to us.

![image](/typescript-fun-with-generics/img1.png)

and

![image](/typescript-fun-with-generics/img2.png)

The implementation is a little weird. You might wonder why we need

```ts
throw new Error("Invalid arguments");
```

The only valid invocations for this function are two strings, or two numbers; that's all TypeScript will allow. So why does TypeScript require us to have that throw at the end. If both arguments are not strings, and both arguments are also not both numbers, the function will never have been allowed. Unfortunately TypeScript isn't quite smart enough to understand that. The function implementation has x and y both as `string | number` so as far as it's concerned, `x` could be a string and `y` could be a number. Understanding that this combination is disallowed by the prior overload definitions isn't currently within its capabilities.

## Building our solution

So we want to overload `refetchedQueryOptions` twice: once for a server function that takes in an argument, and once for a server function that takes no arguments. How do we define either case? This is where things get fun.

To start, let's define a type representing any async function

```ts
type AnyAsyncFn = (...args: any[]) => Promise<any>;
```

This seems like a waste of time, but it'll save us some typing and add a lot of clarity soon.

Let's definte a type that takes in an async function, and just strips out the argument type. A conditional type is perfect for this. We saw something similar before with a conditional type that strips out the type of an array's elements

```ts
type ArrayOf<T extends Array<any>> = T extends Array<infer U> ? U : never;
```

We check that T extends an array, and then we plopped `infer U` right into the generic slow the Array type already has. Let's do something similar to get the parameter type of an async function

```ts
type ServerFnArgs<TFn extends AnyAsyncFn> = Parameters<TFn>[0] extends { data: infer TResult } ? TResult : undefined;
```

There's a `Parameters<T>` type that can pluck parameters out of a function type. We grab the zero'th parameter (functions can have multiple parameters; but server functions only have one). On that single, 0th parameter, look for a `data` property, and if present, infer that. Otherwise return undefined.

From there we can start to ask questions about our types

```ts
type ServerFnHasArgs<TFn extends AnyAsyncFn> = ServerFnArgs<TFn> extends undefined ? false : true;
```

## Concluding thoughts

In the end, a few lines of webpack config allowed us to easily load global, or scoped css, with optional sass processing in either case. Of course this is only scratching the surface of what's possible. There's no shortage of PostCSS, or other plugins you could toss into the loader list.

Happy Coding!
