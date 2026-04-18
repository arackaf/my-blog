---
title: Introducing TanStack Form
date: "2026-04-12T10:00:00.000Z"
description: An introduction to TanStack Form
---

Forms are a notoriously annoying part of React. They seem simple at first: just create some basic state for each input, wire up your controlled inputs, and that's that. But of course you'll need to wire up validation somehow. And you'll probably want to add some niceties, like clearing validation errors as a user types into an invalid field. And you'll probably not want to dump your entire form into one component, so you'd just pass around all those state values. Or put them into context. Of you could use uncontrolled form inputs, in which case you don't need those state values, but now you'll be dealing with raw dom elements for all your inputs.

Manually managing your own forms always starts simple, but quickly becomes a pain.

## TanStack Form

There's no shortage of form libraries to help manage this complexity. In this post, we'll look at TanStack Form.

Like other TanStack libraries, Form takes strong typing, and performance seriously. It's also detail-oriented, and has planned for any weird edge case imaginable.

## Our first form

Let's jump in. We'll build a form to manage a Product of this structure

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

TanStack Form gives us a `useForm` hook for generating our ... _form_.

```ts
const form = useForm({
  defaultValues: defaultProduct,

  onSubmit: async ({ value }) => {
    // ...
  },
});
```

Now we can render our form.

```tsx
<form
  onSubmit={event => {
    event.preventDefault();
    event.stopPropagation();

    form.handleSubmit();
  }}
></form>
```

Our onSubmit handler prevents the native html form behavior, and then calls `form.handleSubmit()` which invokes any validation you define, which we'll get to, and, if no validation errors, invokes the original `onSubmit` callback you passed to the useForm hook.

## Managing fields

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

The structure of the defaultValues we provided became the structure of the data our form now collects, and maintains. This means things like our Fields's `name` prop is statically checked, and therefore even autocompleted.

![Field name autocomplete](/tanstack-form/img1.png)

Similarly, the _value_ associated with any particular form field is also strongly typed, also based on those same defaultValues.

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

defines our validation. Form allows you to specify where and even _when_ validation occurs. I like having these errors show up only after the user tries to submit the form, but you can specify onChange, onBlur, or even some other, more advanced options. See the [docs](https://tanstack.com/form/latest/docs/framework/react/guides/validation) for more info.

### Rendering the actual form input

How do we actually render the form input? TanStack Form is headless; it gives you the state you need, and then lets you render whatever you want. It does this with a classic React pattern that's not used quite as often anymore (hooks removed many of its applications) but is no less valuable for use cases exactly like this: render functions.

Some may not know this, but the `children` value passed into a React component does not have to be a React Node: you can also pass a _function_ that returns your React node. That's what this is:

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

**_NOTE_**
You don't have to use the children prop; you can also pass this function as the actual value in between `<form.Field>` and `</form.Field>`. The two are equivalent. The TanStack Form docs uses the actual children prop, but you can use whichever you prefer; they're identical.  
**_/NOTE_**

TanStack Form's Field component handles the grunt work of _calling_ the function you provide, and it _passes_ this function a parameter that has everything we need to render everything.

In this code, I'm rendering a ShadCN Label, and Input. The field prop passed to my render function gives me a name value, plus a state object that has things like the current value. Naturally there's an onChange handler we need to invoke with any updated values, but you might wonder why I need to pass an onBlur handler.

That's to help some of the field's state. In the code above you can see the validation error info attached to the field's state.meta object, but there's also input state like `isTouched` and `isDirty`. Check the [the docs](https://tanstack.com/form/latest/docs/framework/react/guides/basic-concepts#field-state) for a full accounting of all these various state values, but `isTouched` indicates whether the user has ever focused, and blurred your input, and the onBlur callback is what makes this work.

## Array fields

Our original data had a metadata field that was an Array.

```ts
export interface Product {
  // ...
  metadata: { name: string; value: string }[];
}
```

Let's see how TanStack Form manages that. First, we use a Field like we have been, but we set its mode to "array." The "field" in the render prop will have a `pushValue` method, for adding an item to the array, as well as a `removeValue` method for removing one of the items, by index.

From there, `field.state.value` inside the Field component's render function would be the array itself. We can loop it, and for each item, render _another_ field for each item.

Let's look at the code

```tsx
<form.Field name="metadata" mode="array">
  {field => (
    <div className="flex flex-col gap-1">
      <Button variant="outline" type="button" onClick={() => field.pushValue({ name: "", value: "" })}>
        Add Metadata
      </Button>
      {field.state.value.map((_, idx) => {
        return (
          <div key={idx} className="flex gap-1">
            <div>
              <form.Field
                name={`metadata[${idx}].name`}
                validators={{
                  onSubmit: ({ value }) => {
                    if (!value) {
                      return "Name is required";
                    }
                  },
                }}
                children={field => (
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={field.name}>Name</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={event => field.handleChange(event.target.value)}
                      placeholder=""
                    />
                    {!field.state.meta.isValid && <p className="text-red-500">{field.state.meta.errors.join(", ")}</p>}
                  </div>
                )}
              />
            </div>
            <div>
              <form.Field
                name={`metadata[${idx}].value`}
                validators={{
                  onSubmit: ({ value }) => {
                    if (!value) {
                      return "Value is required";
                    }
                  },
                }}
                children={field => (
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={field.name}>Value</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={event => field.handleChange(event.target.value)}
                      placeholder=""
                    />
                    {!field.state.meta.isValid && <p className="text-red-500">{field.state.meta.errors.join(", ")}</p>}
                  </div>
                )}
              />
            </div>
            <div className="self-end">
              <Button variant="outline" type="button" onClick={() => field.removeValue(idx)}>
                Remove
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  )}
</form.Field>
```

Notice the `name` on the inner field

```tsx
name={`metadata[${idx}].name`}
```

TanStack allows, and even type checks that this is a perfectly valid name value.

We can add items to our metadata

```tsx
<Button variant="outline" type="button" onClick={() => field.pushValue({ name: "", value: "" })}>
  Add Metadata
</Button>
```

and remove them

```tsx
<Button variant="outline" type="button" onClick={() => field.removeValue(idx)}>
  Remove
</Button>
```

## Referencing other field values

Let's get a little contrived and pretend that, when entering a product, if the price is > 50, we require a description. Let's further pretend that whenever price has a value > 50, we immediately want to display a helpful message indicating that description will be required since the price is what it is.

The naive solution won't work; we can't just do this:

```ts
const DescriptionFieldUseStore: FC<{ form: ProductForm }> = (props) => {
  const { form } = props;

  const price = form.getFieldValue("price");
  const descriptionRequired = typeof price === "number" && price > 50;

  // later ...
  {descriptionRequired && <p className="text-yellow-800">Description is required when price is greater than $50</p>}
}
```

The reason is that `form.getFieldValue("price");` is not reactive. This is for performance reasons. If you want to dynamically and reactively get access to other parts of the form, you have a few options.

### useStore

The useStore hook is one option.

```ts
import { useStore } from "@tanstack/react-form";
```

This allows you to reactively grab whatever you need.

```ts
const price = useStore(form.store, state => state.values.price);
```

### Subscribe

The other option is the Subscribe component. You specify the slice of the form's state you want, and you're given a render function with that reactive slice of the form passed in

```tsx
<form.Subscribe selector={(formState) => ({ price: formState.values.price })}>
  {({ price }) => {
    const descriptionRequired = typeof price === "number" && price > 50;
    return (
      <form.Field
        name="description"
        // and so on...
```

Use whichever is more convenient for your particular use case.

## Composition

Do we have everything we need? Not really. Our `form` object was created from the `useForm` hook, and we've been using that for our Field components. Field is not a component we import; instead it's created on the fly, from the `useForm` hook, and attached to the `form` object returned therefrom. The reason is so that all our various form fields will be strongly typed, with appropriate `name`, `value`, etc values.

But we may not want to put our entire form into one big React component if things grow even moderately large. Breaking up our form into smaller components is a great idea, and we could simply pass our `form` object around as needed, as a prop.

But what's the _type_ of this `form` object? Unfortunately, Typescript reports it as

```ts
const form: ReactFormExtendedApi<Product, FormValidateOrFn<Product> | undefined, FormValidateOrFn<Product> | undefined, FormAsyncValidateOrFn<Product> | undefined, FormValidateOrFn<Product> | undefined, FormAsyncValidateOrFn<Product> | undefined, FormValidateOrFn<Product> | undefined, FormAsyncValidateOrFn<Product> | undefined, FormValidateOrFn<...> | undefined, FormAsyncValidateOrFn<...> | undefined, FormAsyncValidateOrFn<...> | undefined, unknown>
```

The return type from the `useForm` type is a generic that takes a LOT of args, and they're required. These control things like the data in the form, obviously, but also things like validation.

Fortunately, a good understanding of TypeScript can go a long, long way here. Let's move the call to useForm into its own function

```ts
export const useProductForm = (onSubmit: (value: Product) => void) => {
  return useForm({
    defaultValues: defaultProduct,

    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });
};
```

and now we can leverage some TypeScript helpers, and inferred typing to easily get the type we're looking for.

```ts
export type ProductForm = ReturnType<typeof useProductForm>;
```

And now we can break up our form into smaller components, and pass the `form` object in correctly

```ts
const DescriptionFieldSubscribe: FC<{ form: ProductForm }> = (props) => {
```

## Composing even better

Let's imagine this bit of markup

```tsx
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
</div>
```

is actually more complex than it is, and that it would make sense to put it into a reusable component. You'd think this would be easy, but passing the `field` object we see used above is trickier than it would seem; there's again no simple type, and there's no trick available like we saw before, when we wrapped our useForm hook call in a function, and then used TypeScript's ReturnType helper.

But Form has the helpers we need. Let's take a look.

First we can grab some new imports

```ts
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
```

This part is a little weird and won't make complete sense, yet

```ts
const { fieldContext, useFieldContext, formContext } = createFormHookContexts();
```

Now let's create the reusable form component

```ts
const BasicTextField: FC<{ label: string }> = (props) => {
  const { label } = props;
  const field = useFieldContext<string>();

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {!field.state.meta.isValid && <p className="text-red-500">{field.state.meta.errors.join(", ")}</p>}
    </div>
  );
};
```

It's just a simple component, which takes a label as a prop. The real magic happens here:

```ts
const field = useFieldContext<string>();
```

This says, just grab whatever the current field is, in this form. And since we can't rely on inferred typing, since we don't have direct access to the type, we have to pass a generic arg to let TS know that this is in fact a string field.

Now we can tell TanStack about our custom form component, and get back a new hook to create our form with

```ts
const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { BasicTextField },
  formComponents: {},
});

export const useProductForm = (onSubmit: (value: Product) => void) => {
  return useAppForm({
    defaultValues: defaultProduct,

    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });
};
```

And now we can do everything as before, but now when we provide the markup for a field, we have a new option

```ts
<form.AppField
  name="name"
  validators={{
    onSubmit: ({ value }) => {
      if (!value) {
        return "Product name is required!";
      }
    },
  }}
  children={(field) => <field.BasicTextField label="Product Name" />}
/>
```

Going through this trouble for such a simple component is probably silly, but for a real application it can simplify a lot of things.

## Concluding thoughts

TanStack form is a surprisingly pleasant form library. The api is a bit more superficially complex than you might expect, but once you understand how it works, you immediately see its power, and flexibility.

Happy coding!
