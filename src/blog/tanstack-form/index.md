---
title: Introducing TanStack Form
date: "2026-04-12T10:00:00.000Z"
description: An introduction to TanStack Form
---

Forms are a notoriously annoying part of React. They seem simple at first. Just create some basic state for each input, wire up your controlled inputs, and that's that. But of course you'll need to wire up validation somehow. And you'll probably want to add some niceties, like clearing those validation errors as a user types into an invalid field. And you'll probably not want to dump your entire form into one component, so just pass around all those state values. Or put them into context. Of you could use uncontrolled form inputs, in which case you don't need those state values, but now you'll be dealing with raw dom element objects for all your inputs.

Manually managing your own forms always starts simple, but quickly becomes an enormous pain.

## TanStack Start

There's no shortage of form libraries to help manage this complexity. In this post, we'll look at TanStack Start.

Like other TanStack libraries, Form takes strong typing, and performance seriously. It's also detail-oriented, and has planned for any weird edge case imaginable.

## Our first form

Let's jump in. We'll build a form to manage a Product of this form

```ts
export interface Product {
  name: string;
  price: number | string;
  added?: Date;
  description: string;
  skuNumber: string;
  metadata: { name: string; value: string }[];
}

const defaultProduct: Product = {
  name: "",
  price: 0,
  added: undefined,
  description: "",
  skuNumber: "",
  metadata: [],
};
```

TanStack Form gives us a `useForm` hook for generating out ... _form_.

```ts
useForm({
  defaultValues: defaultProduct,

  onSubmit: async ({ value }) => {
    // ...
  },
});
```

Now we can render our form

```tsx
<form
  onSubmit={event => {
    event.preventDefault();
    event.stopPropagation();

    form.handleSubmit();
  }}
></form>
```

The onSubmit handler prevents the native html forma behavior, and then calls `form.handleSubmit()` which invokes any validation you define, which we'll get to, and, if no validation errors, invokes the onSubmit handler you passed to the useForm hook.

## Defining fields

Let's look at a single field defined inside of our form. We'll look at the entire Field, and then pick it apart.

```tsx
<form.Field
  name="name"
  validators={{
    onSubmit: ({ value }) => {
      if (!value) {
        return "Name is required";
      }
    },
  }}
  children={field => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={field.name}>Product Name</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={event => field.handleChange(event.target.value)}
      />
      {!field.state.meta.isValid && <p className="text-red-500">{field.state.meta.errors.join(", ")}</p>}
      {field.state.meta.isPristine && <p className="text-gray-500">Pristine</p>}
      {field.state.meta.isTouched && <p className="text-gray-500">Touched</p>}
      {field.state.meta.isDirty && <p className="text-gray-500">Dirty</p>}
    </div>
  )}
/>
```

Let's start at the very top. We have to specify which piece of data our form field is entering data for, and that's what the `name` prop is for.

```tsx
name = "name";
```

If you're used to TanStack libraries, you're probably used to incredibly meticulous static typing, and Form is no different.

When we defined

```ts
const defaultProduct: Product = {
  name: "",
  price: 0,
  added: undefined,
  description: "",
  skuNumber: "",
  metadata: [],
};

// and then ...

useForm({
  defaultValues: defaultProduct,
  // ...
});
```

The structure of the defaultValues we provided became the structure of the data our form collected, and maintained. This means that things like the `name` value we provide to Fields is statically checked, and therefore even autocompleted.

![Field name autocomplete](/tanstack-form/img1.png)

### Validators

Moving on,

```ts
validators={{
  onSubmit: ({ value }) => {
    if (!value) {
      return "Name is required";
    }
  },
}}
```

defines our validation. Start allows you to specify where and even _when_ validation occurs. I like having these errors show up only after the user tries to submit the form, but you can specify onChange, or onBlur, or even some other, more advanced options. See the [docs](https://tanstack.com/form/latest/docs/framework/react/guides/validation) for more info.

### Rendering the actual form input

Ok how do we actually render the form input? TanStack Form is headless; it gives you the state you need, and then lets you render whatever you want. It does this with a React classic pattern that's not used quite as often anymore (hooks removed many of its applications) but is no less valuable for use cases exactly like this: render props.

Some may not know this, but the `children` value passed into a React component does not have to be a React Node: you can also pass a _function_ that creates your React node. That's what this is:

```ts
children={(field) => (
  <div className="flex flex-col gap-1">
    <Label htmlFor={field.name}>Product Name</Label>
    <Input
      id={field.name}
      name={field.name}
      value={field.state.value}
      onBlur={field.handleBlur}
      onChange={(event) => field.handleChange(event.target.value)}
    />
    {!field.state.meta.isValid && <p className="text-red-500">{field.state.meta.errors.join(", ")}</p>}
    {field.state.meta.isPristine && <p className="text-gray-500">Pristine</p>}
    {field.state.meta.isTouched && <p className="text-gray-500">Touched</p>}
    {field.state.meta.isDirty && <p className="text-gray-500">Dirty</p>}
  </div>
)}
```

TanStack Form's Field component handles the grunt work of _calling_ the function you provide, and it _passes_ this function a parameter that has everything we need to render everything.

In this code, I'm rendering a ShadCN Label and Input. The field prop passed to my render function gives me a name value, plus a state object that has things like the current value. Naturally there's an onChange handler we need to invoke with any updated values, but you might wonder why I need to pass through an onBlur handler.

That's to help some of the field's state. You can see the validation error info attached to the field's state.meta object, which you can render however you'd like, but there's also input state like `isTouched` and `isDirty`. Check the [the docs](https://tanstack.com/form/latest/docs/framework/react/guides/basic-concepts#field-state) for a full accounting of all these various state values, but `isTouched` indicates whether the user has ever focused, and blured your input, and the onBlur callabck is what makes this work.

## Concluding thoughts

In the end, a few lines of webpack config allowed us to easily load global, or scoped css, with optional sass processing in either case. Of course this is only scratching the surface of what's possible. There's no shortage of PostCSS, or other plugins you could toss into the loader list.

Happy Coding!

```

```
