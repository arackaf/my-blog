---
title: Fun with TypeScript function types
date: "2024-05-22T10:00:00.000Z"
description: Some advanced fun with Typescript function types, from inferring parameter lists, to return types
---

TODO TODO TODO

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

When we have a generic type argument, that's also a type union, pushed across an `extends` cehck in a conditional type, the union is split up, with each member of the union substituted into that check. TypeScript then takes every result from doing that with every union member, and unions those results together. That union is the result of that `extends` operation.

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

![Conditional types](/typescript-tweet/img3b.jpg)
![Conditional types](/typescript-tweet/img3c.jpg)
![Conditional types](/typescript-tweet/img3d.jpg)
![Conditional types](/typescript-tweet/img3e.jpg)
![Conditional types](/typescript-tweet/img3f.jpg)
![Conditional types](/typescript-tweet/img3g.jpg)
![Conditional types](/typescript-tweet/img3h.jpg)
![Conditional types](/typescript-tweet/img3i.jpg)
![Conditional types](/typescript-tweet/img3j.jpg)
![Conditional types](/typescript-tweet/img3k.jpg)
