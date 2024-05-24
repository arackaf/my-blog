---
title: Checking for type equality in TypeScript
date: "2024-05-24T10:00:00.000Z"
description: How to check whether two types are identical in TypeScript
---

As your TypeScript usage gets more advanced, it can be extremely helpful to have utilities around that test, and verify your types. Sort of like unit testing, but without needing to set up Jest, deal with mocking, etc. This post will talk about that, but then dive deeply into a surprisingly difficult type to create: one that checks whether two types are **the same**.

NOTE: this post will cover some advanced corners of TypeScript that you're unlikely to need for regular application code. If you're not a huge fan of TS, please understand that you probably won't need the things in this post for your everyday work, which is fine. But if you're writing or maintaing TypeScript libraries, or even library-like code in your team's web app, the things we discuss here might come in handy.

## Type helpers

Consider this `Expect` helper

```ts
type Expect<T extends true> = T;
```

it basically demands you pass true into it. This seems silly but stay with me.

Now imagine, for some reason, you have a helper for figuring out whether a type is some kind of array

```ts
type IsArray<T> = T extends Array<any> ? true : false;
```

which you'd like to verify. You of course could just type

```ts
type X = IsArray<number[]>;
```

into your editor, mouse over the X and verify that it's true, which it is. But we don't settle for ad hoc testing like that with normal code, so why would we with our advanced types.

Why don't we write this instead

```ts
type X = Expect<IsArray<number[]>>;
```

If we mess up our IsArray type, the line above would error out, which we can see by passing the wrong thing into it

```ts
type Y = Expect<IsArray<number>>;
// error: Type 'false' does not satisfy the constraint 'true'.
```

Better yet, let's create another helper

```ts
type Not<T extends false> = true;
```

and now we can actually test the negative of our IsArray helper

```ts
type Y = Expect<Not<IsArray<number>>>;
```

Except these fake type names like X and Y will get annoying very quickly, so let's do this instead

```ts
// ts-ignore just to ignore the unused warning - everything inside of Tests will still type check
// @ts-ignore
type Tests = [
  // prettier-ignore
  Expect<IsArray<number[]>>,
  Expect<Not<IsArray<number>>>
];
```

So far so good. We can put these tests for our types right in our application files if we want, or move them to a separate file; the types are all erased when we ship either way, so don't worry about bundle size.

## Getting serious

Our `IsArray` type was trivial, as were our tests. In real life, we'll be writing types that do more interesting things, usually taking in one or more types, and creating something new. And to test those sorts of things, we'll need to be able to verify that two types are identical.

For example, say you want to write a type that takes in a generic, and if that generic is a function, returns the parameters of that function, else returns never. Pretend the `Parameters` type is not built into TypeScript, and imagine you write this

```ts
type ParametersOf<T> = T extends (...args: infer U) => any ? U : never;
```

Which we'd test like this

```ts
// ts-ignore just to ignore the unused warning - everything inside of Tests will still type check
// @ts-ignore
type Tests = [
  // prettier-ignore
  Expect<TypesMatch<ParametersOf<(a: string) => void>, [string]>>,
  Expect<TypesMatch<ParametersOf<string>, never>>
];
```

Great. But how do you write `TypesMatch`?

That's the subject of the entire rest of this post. Buckle up!

## Type Equality

Checking type equality is surprisingly hard in TypeScript, and the obvious solution will fail for baffling reasons unless you understand conditional types. Let's tackle that before moving on.

We'll start with the most obvious, potential solution

```ts
type TypesMatch<T, U> = T extends U ? true : false;
```

You can think of `T extends U` in the same way as with object-oriented inheritance: is T the same as, or a sub-type of U. And instead of (just) object-oriented hierarchies, remember that you can have literal types in TypeScript. `type Foo = "foo"` is a perfectly valid type in TypeScript. It's the type that represents all strings that match `"foo"`. Similarly, `type Foo = "foo" | "bar";` is the type representing all strings that match either `"foo"`, or `"bar"`. And literal types, and unions of literal types like that can both be thought of as sub-types of string, for these purposes.

Another (more common way) to think about this is that `T extends U` is true if T _can be assigned to_ U, which makes sense; if T is the same, or a sub-type of U, then a variable of type T can be _assigned to_ a variable of type U.

The obvious test works

```ts
type Tests = [Expect<TypesMatch<string, string>>];
```

So far, so good. And

```ts
type Tests = [Expect<Not<TypesMatch<string, "foo">>>];
```

also works, since a variable of type `string` cannot be assigned to a variable of type `"foo"`.

```ts
let foo: "foo" = "foo";
let str: string = "blah blah blah";

foo = str; // Error
// Type 'string' is not assignable to type '"foo"'.
```

but we hit problems with

```ts
type Tests = [Expect<Not<TypesMatch<"foo", string>>>];
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

This solves both of our problems from above. Now both of these tests pass.

```ts
// prettier-ignore
type Tests = [
  Expect<Not<TypesMatch<string, "foo">>>,
  Expect<Not<TypesMatch<"foo", string>>>,
];
```

Let's try union types

```ts
// prettier-ignore
type Tests = [
  Expect<TypesMatch<string | number, string | number>>,
  Expect<Not<TypesMatch<string | number, string | number | object>>>
];
```

**both** of these fail with

> Type 'boolean' does not satisfy the constraint 'true'

Identical union types fail to match as identical, and different union types fail to match as different. What in the world is happening.

## Conditional types over unions

So why did this not work with union types

```ts
// prettier-ignore
type TypesMatch<T, U> = T extends U
  ? U extends T
    ? true
    : false
  : false;
```

Let's back up and try to simplify. Let's imagine some simple (useless) types. Imagine a square and circle

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
const s: Square = { length: 1 };
const c: Circle = { radius: 1 };

const sDescription = getDescription(s);
const cDescription = getDescription(c);
```

`sDescription` is of type `"4 Sides"` and `cDescription` is of type `"Round"`. Nothing surprising. Now let's consider a union type.

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

T and U are both unions, but only the type _before_ the `extends` is distributed. Let's substitute `string | number` for U

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

We need to stop the union types from distributing. The distributing happens only with a raw generic type in a conditional type expression. We can turn it off merely by turning that type into another type, with the same assignability rules. A tuple type does that perfectly

```ts
// prettier-ignore
type TypesMatch<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;
```

Instead of asking if `T extends U` I ask if `[T] extends [U]`. `[T]` is a tuple type with one member, T. Think of it with non-generic types. `[string]` is essentially an array with a single element (and no more!) that's a string.

All our normal rules apply. `["foo"] extends [string]` is true, while `[string] extends ["foo"]` is false. You can assign a tuple with a single `"foo"` string literal to a tuple with a single string, for the same reason that you can assign a `"foo"` string literal to a variable of type `string`.

## Wrapping up

Conditional types can be incredibly helpful when you're building advanced types. But they also come with some behaviors that can be surprising to the uninitiated. Hopefully this post made some of that clearer.

Happy coding!
