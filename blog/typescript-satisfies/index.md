---
title: Satisfies in TypeScript
date: "2025-06-29T10:00:00.000Z"
description: Understanding the TypeScript `satisfies` keyword
---

This is a post about one of TypeScript's less common features: the `satisfies` keyword. It's occasionally incredibly useful, and knowing how to properly weild it is a valuable trick to have up your sleeve. Let's take a look!

## A quick intro on structural typing

In a nutshell, structural typing means that TypeScript cares only about the _structure_ of your values, not the types they were declared with. That means the following code

```typescript
class Thing1 {
  name: string = "";
}

class Thing2 {
  name: string = "";
}

let thing1: Thing1 = new Thing1();
let thing2: Thing1 = new Thing2();
let thing3: Thing1 = { name: "" };
```

contains no errors. Types are essentially constracts, and TypeScript cares only that you satisfy the contract with something that has what the original type specified.

Interestingly, this also means you can supply extraneous, superfluous "stuff" when satisfying types: the following also has no errors.

```typescript
const val = {
  name: "",
  xyz: 12,
};

let thing4: Thing1 = val;
```

The `Thing1` type only calls for a name property, that's a string. If you also specify other properties, TypeScript is (usually) ok with it. This might seem surprising coming from other languages, but it's a pragmatic tradeoff given that TypeScript's primary purpose is to provide some manner of type safety to a completely untyped programming language: JavaScript.

I said usually above because occasionally TypeScript will be a bit stricter about not allowing "extra" values like we saw above. In particular, when assigning an object literal to a variable that's declared with a type, TypeScript will require a strict matching.

```typescript
let thing4: Thing1 = val;

const val2: Thing1 = {
  name: "",
  xyz: 12,
  // error: Object literal may only specify known properties, and 'xyz' does not exist in type 'Thing1'
};
```

This is called "excess property checking." It happens when assigning an object literal to a variable with a declared type, like we just saw, and also when passing an object literal to a function paremter that has a declared type.

## The Satisfies keyword

To provide the most simplistic example of using `satisfies`, let's go back to this code

```typescript
const val3 = {
  name: "",
  xyz: 12,
};
```

Right now val3 has the inferred type

```typescript
{
  name: string;
  xyz: number;
}
```

If we wanted, we could write this code like this

```typescript
const val3 = {
  name: "",
  xyz: 12,
  // error: Object literal may only specify known properties, and 'xyz' does not exist in type 'Thing1'
} satisfies Thing1;
```

That produced the same error we saw before, and the same error we _would have_ gotten if we had declared val3 as `Thing1`

```typescript
const val3: Thing1 = {
  name: "",
  xyz: 12,
  // // error: Object literal may only specify known properties, and 'xyz' does not exist in type 'Thing1'
};
```

\*\*\*CALLOUT

The `satisfies` keyword allows you to assert that a certain value "satisfies" a given type, while _preventing_ a wider type from being inferred.

\*\*\*CALLOUT

Bear with me.

You're probably thinking that this is completely pointless, since we can just move `Thing1` up, and into a proper type declaration, and even save a few keystrokes while doing so!

But not all situations lend themselves to this solution.

Let's take a look at a slightly more complex, more realistic example

## Satisfies in the wild

This is a situation I actually ran into. I'll do my best to simplify it, while keeping the realistic parts.

Imagine we're writing an inventory management system. We have an inventory item type

```typescript
type InventoryItem = {
  sku: string;
  description: string;
  originCode?: string;
};
```

And maybe we have some external backend systems we need to fetch data from

```typescript
type BackendResponse = {
  item_sku: string;
  item_description: string;
  item_metadata: Record<string, string>;
  item_origin_code: string;
};

function getBackendResponse(): BackendResponse[] {
  return [];
}
```

The `getBackendResponse` function is hard coded to return an empty array, but just pretend it makes a request and returns actual data. And then pretend we want to take that data and actually insert it. We have a function to do the inserting; we're only interested in the types though, so we'll leave the implementation empty

```typescript
function insertInventoryItems(items: InventoryItem[]) {}
```

Ok let's put things together, fetch some items from our external system, manipulate them into the proper structure for our own `InventoryItem` type, and then call our `insertInventoryItems` function

```typescript
function main() {
  const backendItems = getBackendResponse();
  insertInventoryItems(
    backendItems.map(item => {
      return {
        sku: item.item_sku,
        description: item.item_description,
        originCodeXXXXX: item.item_origin_code,
      };
    })
  );
}
```

Unfortunately, this code has no errors, even though we completely fat-fingered the `originCode` property. You already know that TypeScript will allow you to provide "extra" properties in places where excess property checking doesn't exist, but you may be wondering why it's not an error that we completely _left off_ the real `originCode` property. The reason is that this is an optional property! That makes it all the more important that we disallow excess cruft.

You might be thinking that we can just restructure our code so that excess propety checking is in place, and we certainly could do that

```typescript
function main() {
  const backendItems = getBackendResponse();
  insertInventoryItems(
    backendItems.map(item => {
      const result: InventoryItem = {
        sku: item.item_sku,
        description: item.item_description,
        originCodeXXXXX: item.item_origin_code,
        // error: Object literal may only specify known properties, but 'originCodeXXXXX'
        // does not exist in type 'InventoryItem'. Did you mean to write 'originCode'
      };
      return result;
    })
  );
}
```

This works and produces the error we want to see. But it's just a byproduct of the (frankly weird) way we chose to write it, and this protection would disappear if anyone were to come along, see this weird, pointless intermediate variable declaration, and "helpfully" refactor the code to just immediately return the object literal like we just had.

The better solution is to use `satisfies` to prevent the unwanted widening; that's why it exists!

```typescript
function main() {
  const backendItems = getBackendResponse();
  insertInventoryItems(
    backendItems.map(item => {
      return {
        sku: item.item_sku,
        description: item.item_description,
        originCodeXXXXX: item.item_origin_code,
        // error: Object literal may only specify known properties, but 'originCodeXXXXX'
        // does not exist in type 'InventoryItem'. Did you mean to write 'originCode'
      } satisfies InventoryItem;
    })
  );
}
```

And now we're back to the more idiomatic code we started with, with the same strict checks we're looking for.

Before we wrap up, let's briefly consider this alternative you might be wondering about

```typescript
function main() {
  const backendItems = getBackendResponse();
  insertInventoryItems(
    backendItems.map(item => {
      return {
        sku: item.item_sku,
        description: item.item_description,
        originCodeXXXXX: item.item_origin_code,
      } as InventoryItem;
    })
  );
}
```

This produces no errors at all. `as` is a typecast. It's something to avoid; it essentially allows you to "lie" to the type checker and _assert_ that a given expression matches a given type. In this case, the cast pointless because this object already matches the `InventoryItem` type. It has a sku, and a description. It also has some extra "stuff" but TypeScript doesn't really mind. It's the `satisfies` keyword which additionally forces TypeScript to also _not_ allow a wider type, and therefor _start_ minding about extra properties.

For completeness, this version of the casting code actually does fail

```typescript
function main3() {
  const backendItems = getBackendResponse();
  insertInventoryItems(
    backendItems.map(item => {
      return {
        sku: item.item_sku,
        descriptionXXX: item.item_description,
        // error: Conversion of type '{ sku: string; descriptionXXX: string; originCodeXXXXX: string; }' to type
        // 'InventoryItem' may be a mistake because neither type sufficiently overlaps with the other. If this
        // was intentional, convert the expression to 'unknown' first. Property 'description' is missing in type
        // '{ sku: string; descriptionXXX: string; originCodeXXXXX: string; }' but required in type 'InventoryItem'.
        originCodeXXXXX: item.item_origin_code,
      } as InventoryItem;
    })
  );
}
```

TypeScript will allow you to lie, but only so far. If the cast makes absolutely no sense, TypeScript won't allow it. As the error indicates, if you, for some reason, actually wanted to go through with this code, you'd do

`as unknown as InventoryItem;`

since `unknown` is a "top" type, which means anything can be cast to it, and from it.

## Wrapping up

Use `satisfies` when you want to prevent type widenings, in situations where a top-level variable declaration doesn't quite fit well.

Happy coding!
