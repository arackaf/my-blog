---
title: Fun with TypeScript function types
date: "2024-05-22T10:00:00.000Z"
description: Some advanced fun with Typescript function types, from inferring parameter lists, to return types
---

## Fun with TypeScript inference

This post has an unlikely source: a [Tweet I wrote](https://twitter.com/AdamRackis/status/1788064190516666826/) went unxpectedly viral. It was just a post with some clever TypeScript typings I came up with to accurately typecheck some utility code I was writing. Lots of people liked it. Lots of people got angry. One dude told me I'd never find a woman to reproduce with. And the create of Ruby on Rails quoted it to re-affirm his decision to not use TypeScript.

The drama was interesting, but for this post I'd like to peel the curtain back and actually explain the code in question (which has been simplified since I wrote it). There's lots of good learning opportunities here, which could help you at work.

## The use case

All of this code was for a 100% real, legitimate use case I had. Imagine you have a client-rendered web app. The web app hits various services to load data, as web apps are prone to do. You want to prefetch these services, so the data loading can begin as soon as the page is parsed. I [wrote about this previously](https://frontendmasters.com/blog/prefetching-when-server-loading-wont-do/).

Unfortunately, for "reasons" your services require some special code to be called from a browser which can only happen once JavaScript is running; this completely prevents us from prefetching with a `<link>` tag, since that requires a plain url, and does not allow for any kind of special processing. To solve this, you've built a proxy layer in Node which calls your services. You're in business. You can generate <link> prefetch tags to your proxy, then in application code, you just call the proxy for that first load, and get the prefetched, cached result. All subsequent loads call the real service, to avoid the (small) cost of going through a proxy.

We're on a large team of devs, so we want this simplified and streamlined. We basically want this

```ts
export const bookLoader = createPrefetchedLoader({
  getPrefetchArgs({ url }) {
    const match = matchPath<{ id: string }>(url, {
      path: "/books/:id",
    });

    if (!match) {
      return null;
    }
    const is: string = match.params.id!;
    return [id];
  },
  getProxyUrl(id: string) {
    return "/books/" + id;
  },
  async fetchFromSource(id: string, fullDetails: boolean) {
    return clientSideFetch(`your-service/v0/books/${id}?fullDefails=${fullDetails}`, {
      method: "POST",
      body: JSON.stringify({
        id,
      }),
    });
  },
});
```

and then `bookLoader` would have a single loader

## Type Equality

One of the utilities we'll need is a way to check whether two types are the same. This is surprisingly hard in TypeScript, and the obvious solution will fail for baffling reasons unless you understand conditional types. Let's tackle that before moving on.

We'll start with the most obvious, potential solution

```ts
type TypesMatch<T, U> = T extends U ? true : false;
```

Think of `T extends U` in the same context as you would object-oriented inheritance: is T the same as, or a sub-type of U. And instead of (just) object-oriented hierarchies, remember that you can have literal types in TypeScript. `type Foo = "foo"` is a perfectly valid type in TypeScript. It's the type that represents all strings that match `"foo"`. Similarly, `type Foo = "foo" | "bar";` is the type representing all strings that match either `"foo"`, or `"bar"`. And so on.

Another (more common way) to think about this is that `T extends U` is true if T _can be assigned to_ U, which makes sense; if T is the same, or a sub-type of U, then a variable of type T can be _assigned to_ a variable of type U.

The obvious test works

```ts
type Tests = [Expect<TypesMatch<string, string>>];
```

So far, so good. And

```ts
type Tests = [Expect<False<TypesMatch<string, "foo">>>];
```

also works, as we want it to, since a variable of type `string` cannot be assigned to a variable of type `"foo"`.

```ts
let foo: "foo" = "foo";
let str: string = "blah blah blah";

foo = str; // Error
// Type 'string' is not assignable to type '"foo"'.
```

but we hit problems with

```ts
type Tests = [Expect<False<TypesMatch<"foo", string>>>];
```

This fails. It should be obvious why: the string literal type `"foo"` is assignable to variables of type string.

### Just test them both ways

I know what you're thinking: just test it from both directions!

```ts
// prettier-ignore
type TypesMatch<T, U> = T extends U
  ? U extends T
    ? true
    : false
  : false;
```

This solves both of our problems from above. Now both of these tests pass, as we want them to.

```ts
// prettier-ignore
type Tests = [
  Expect<False<TypesMatch<string, "foo">>>,
  Expect<False<TypesMatch<"foo", string>>>,
];
```

Let's try this with union types

```ts
// prettier-ignore
type Tests = [
  Expect<TypesMatch<string | number, string | number>>,
  Expect<False<TypesMatch<string | number, string | number | object>>>
];
```

**both** of these fail with

> Type 'boolean' does not satisfy the constraint 'true'

Identical union types fail to match as identical, and different union types fail to match as different. What in the world is happening.

The solution is as follows:

```ts
// prettier-ignore
type TypesMatch<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;
```

See the very end of this post for an in-depth explanation, but for now let's just move on so we don't hurt the flow of this post.

REST OF POST
REST OF POST
REST OF POST
REST OF POST

## Conditional types over unions

I promised you an explanation of why this did not work with union types

```ts
// prettier-ignore
type TypesMatch<T, U> = T extends U
  ? U extends T
    ? true
    : false
  : false;
```

while this alternative

```ts
// prettier-ignore
type TypesMatch<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;
```

did. Here we go

Let's back up and simplify. Let's imagine some simple (useless) types. Imagine a square and circle

```ts
type Square = {
  length: number;
};
type Circle = {
  radius: number;
};
```

Now imagine a type that takes a generic in, and returns a description. If we pass in a Square, it returns the string literal type `"4 Sides"`. If we pass in a circle, it returns the string literal `"Round"`. And if we pass in anything else, it returns the string literal type `"Dunno"`. This is very silly but just go with it.

```ts
// prettier-ignore
type Description<T> = T extends Square
  ? "4 Sides"
  : T extends Circle
  ? "Round"
  : "Dunno";
```

Now imagine a function to use this type

```ts
function getDescription<T>(obj: T): Description<T> {
  return null as any;
}
const s: Square = {} as any;
const c: Circle = {} as any;

const sDescription = getDescription(s);
const cDescription = getDescription(c);
```

`sDescription` is `"4 Sides"` and `cDescription` is `"Round"`. Nothing surprising. Now let's consider a union type.

```ts
const either: Circle | Square = {} as any;
const eitherDescription = getDescription(either);
```

The type `Circle | Square` does not extend `Square` (a variable of type `Circle | Square` cannot be assigned to a variable of type `Square`) nor does it extend Circle. So we might naievely expect `eitherDescription` to be `"Dunno"`. But intuitively this feels wrong. `either` is a Circle or a Square, so the description should be either `"4 Sides"` or `"Round"`.

And that's exactly what it is

![Union type](/typescript-tweet/img1.jpg)

## Distributing union types

When we have a generic type argument, that's also a type union, pushed across an `extends` check in a conditional type, the union itself is split up, with each member of the union substituted into that check. TypeScript then takes every result, and unions them together. _That_ union is the result of that `extends` operation.

Any `never`'s are removed, as are any duplicates.

So for the above, we start with our type

![Union type](/typescript-tweet/img2a.jpg)

We substitute the union type that we passed, in for T

![Union type next step](/typescript-tweet/img2b.jpg)

Once our conditional type hits the extends keyword, if we passed in a union type, TypeScript will distribute over the union; it'll run that ternary for each type in our union, and then union all of those results together. Square is first

![Union type next step](/typescript-tweet/img2c.jpg)

`Square` extends `Square` so `"4 Sides"` is the result. Then repeat, with Circle

![Union type next step](/typescript-tweet/img2d.jpg)

`Circle` extends `Circle` so `"Round"` is the result of the second iteration. The two are unioned together, resulting in the `"4 Sides" | "Round"` that we just saw.

## Playing on Hard Mode

Ok let's take a fresh look at this

```ts
// prettier-ignore
type TypesMatch<T, U> = T extends U
  ? U extends T
    ? true
    : false
  : false;
```

Let's run through what happens with

```ts
TypesMatch<string | number, string | number>;
```

We start

![Conditional types](/typescript-tweet/img3a.jpg)

and substitute `string | number` in for T, and U. Evaluation starts, and immediately gets to our first `extends`

![Conditional types](/typescript-tweet/img3b1.jpg)

T and U are both unions, but only the type _before_ the `extends`is distributed. Let's substitute `string | number` for U

![Conditional types](/typescript-tweet/img3b2.jpg)

and now we're ready to process that first `extends`. We'll need to break up the T union, and run it for every type in that union. `string` is first

![Conditional types](/typescript-tweet/img3c.jpg)

`string` does extends `string | number` so we hit the true branch, and are immediately greeted by a second `extends`.

![Conditional types](/typescript-tweet/img3d.jpg)

Think of it like a nested loop. We'll process this inner `extends` in the same way. We'll substitute each type in the `U` union, starting with `string`

![Conditional types](/typescript-tweet/img3e.jpg)

and of course `string extends string` is true. Our first result is `true`.

![Conditional types](/typescript-tweet/img3f1.jpg)

Now let's continue processing our inner loop. U will next be `number`. `number extends string` is of course false, which is the second result of our type.

![Conditional types](/typescript-tweet/img3f2.jpg)

So far we have `true | false`. Ok let's wrap this up. Now our outer loop continues. `T` moves on to become the second member of its union, `number`. `number extends string | number` is true

![Conditional types](/typescript-tweet/img3h.jpg)

so we again hit that first branch

![Conditional types](/typescript-tweet/img3i.jpg)

The inner loop starts all over again, with `U` first becoming `string`

![Conditional types](/typescript-tweet/img3j.jpg)

`string` extends number is false, so our overall result is `true | false | false`. `U` then becomes `number`

![Conditional types](/typescript-tweet/img3k.jpg)

which of course yields `true`.

The whole thing produced `true | false | false | true`. TypeScript removes the duplicates, leaving us with `true | false`.

Do you know what a simpler name for the type `true | false` is? It's `boolean`. This type produced `boolean`, which is why we got the error of

> Type 'boolean' does not satisfy the constraint 'true'

before. We were expecting a literal type of `true` but got a union of trues and falses, which reduced to boolean.

And it's the same idea with

```ts
type Result = TypesMatch<string | number, string | number | object>;
```

We won't go through all the permutations there; suffice it to say we'll get some admixture of trues and falses, which will reduce back to `boolean` again.

## So how to fix it?

We need to stop the union types from distributing. The distributing happens only with a raw generic type in a conditional type expression. We can turn it off merely by turning that type into another type, with the same assignability rules. Which is what I did here

```ts
// prettier-ignore
type TypesMatch<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;
```

Instead of asking if `T extends U` I ask if `[T] extends [U]`. `[T]` is a tuple type with one member, T. Think of it with non-generic types. `[string]` is essentially an error with a single element (and no more!) that's a string.

All our normal rules apply. `["foo"] extends [string]` is true, while `[string] extends ["foo"]`. You can assign a tuple with a single `"foo"` string literal to a tuple with a single string, for the same reason that you can assign a `"foo"` string literal to a variable of type `string`.
