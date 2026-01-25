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

How's this for a minimal improvement. Right

NOTE:
As the original post on single flight mutations from which this example noted, it may very well be the case that this much effort to lock down typings for such a simple utility may not be worth it.

## Concluding thoughts

In the end, a few lines of webpack config allowed us to easily load global, or scoped css, with optional sass processing in either case. Of course this is only scratching the surface of what's possible. There's no shortage of PostCSS, or other plugins you could toss into the loader list.

Happy Coding!
