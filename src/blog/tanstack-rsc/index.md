---
title: React Server Components in TanStack
date: "2026-05-14T10:00:00.000Z"
description: "TanStack's new RSC feature: what it is, and how to use it"
---

This post is about React Server Components (or RSC) in TanStack Start. The implementation is radically different, and in my opinion better than the RSC implementation you've likely seen in Next.js's app directory.

This post will not be a direct 1:1 comparison. Instead, I'll introduce this feature from first principles, as it exists in TanStack.

## What are React Server Components

Server Components are normal React components with one key feature: they run on the server, and only on the server. This leads to a few key differences.

RSCs can be async, and can request data directly from the component. It can `await`, well, anything that yields data. That could be a fetch to a 3rd party api, or it could be a direct call to your database. Since RSC only runs on the server, you don't have to worry about your browser hopelessly failing to establish a TCP connection to your Postgres box, nor do you have to worry about secrets like connection strings being exposed to end users.

The other key difference with RSC is hidden in plain sight from what we've discussed already: since these components only ever execute on the server, their code will not ever be shipped to the client. RSCs simply send down the final markup that was rendered, without the code that created it being pushed to your client bundles.

Since RSCs only exist on the server, they cannot have any state, or user-facing interactivity. They cannot use hooks like useState, or have event handlers like onClick. If you need to _integrate_ content like with with RSC you of course can, and we'll go over how. But the RSCs themselves are React components that exist to run on the Server, and generate static content that's shipped to the client (possibly with client components intermixed within).

## What RSC is not

Don't be mistaken, RSC is _not_ a solution to load data more conveniently. TanStack Start already ships extremely simple, streamlined data-loading options. You have nested, isomorphic loaders for every level in your routing hierarchy. These loaders run on the server for your initial render, and then client-side thereafter. This enables the deep integration with react-query TanStack Start offers, along with fine-grained data invalidation. I wrote all about this in a [previous introduction to TanStack Start](https://frontendmasters.com/blog/introducing-tanstack-start/).

RSC is also not a way to server render content. TanStack Start (and Next.js for that matter), already server render your initial navigation, and always have. Your normal, old-school components always render on the server, and then re-render on the client, wiring up event handlers and effects in a process known as "hydration."

## Where RSC shines

By rendering only on the server, your client bundles are spared the cost of all the code needed to render your content. That means component trees that are large and expensive, with minimal client-side interactivity are a prime candidate for RSC.

The original [blog post announcement](https://tanstack.com/blog/react-server-components) for TanStack's RSCs discussed using them for content with code samples. By moving the code to parse, style and format displayed code to the server, those libraries were removed from client-side bundles saving non-trivial amounts of space.

For this post we'll simulate another good use case: content that's mostly non-interactive, with lots of conditional imports and conditional rendering. Imagine an application shell, or layout, that can look lots of different ways depending on who's viewing it: non-authenticated users; authenticated users; admin users; or even just authenticated users with varying permissions, which affect the content they're shown.

To keep things simple we'll build a dirt simple application layout, but use some trickery to bloat the component bundle, so we can see how much lighter it is when we switch to RSC. We'll then see about adding interactivity.

## Getting started

The repo for what we'll be building [is here](https://github.com/arackaf/tanstack-start-rsc-blog-post). It's essentially an empty web application, with a skeleton layout that looks like this

![Base ui](/tanstack-rsc/img1.jpg)

If the icons in the side panel don't make much sense, it's because they're randomly chosen in a way that guarantees that the entirety of the lucide-react icon package cannot be tree shaken. This is how we're simulating a large component tree that's not needed on the client.

In the header, the avatar is clickable, and opens a side panel, driven by ShadCN.

![Side panel open](/tanstack-rsc/img2.jpg)

## The normal way

Building out this UI with normal, non-RSC components is a familiar process for anyone who's seen TanStack.

We of course render our application shell from our \_\_root component, which handles the root layout. To simulate loading our logged in user, we'll add a loader to this same root layout.

```ts
loader: async () => {
    const user = new Promise<{ name: string; avatar: string }>((res) => {
      setTimeout(() => {
        res({ name: "Adam Rackis", avatar: "https://d193qjyckdxivp.cloudfront.net/avatar.jpg" });
      }, 1000);
    });
    return { user };
  },
```

We won't mess with real data, just a (long) manual delay, and we send data back. Actually, we send a _promise_ with the data, back. TanStack Start allows us to return promises from loaders, which get streamed to the UI once ready. This will be a nice opportunity for us to see Suspense-based streaming both with, and without RSC.

And here's our non-RSC application shell component

```tsx
type ApplicationShellProps = {
  user: Promise<{
    name: string;
    avatar: string;
  }>;
};

export const ApplicationShellNonRSC: FC<PropsWithChildren<ApplicationShellProps>> = props => {
  const { children, user } = props;

  return (
    <main className="h-screen">
      <header className="fixed top-0 left-0 right-0 h-12 z-10 bg-blue-200 flex items-center px-4 gap-4">
        <Suspense fallback={<span className="w-6 h-6 bg-gray-400 rounded-full"></span>}>
          <UserHeaderMenu user={user} />
        </Suspense>
        <span>Header</span>
      </header>
      <section className="fixed left-0 top-12 bottom-0 w-60 overflow-auto ">
        <SideBarContent />
      </section>
      <section className="max-w-[600px] pt-16 mx-auto h-full">
        <div className="flex flex-col gap-2 h-full">
          <section className="min-h-[200px]">{children}</section>
          <footer className="px-4 fixed bottom-0 left-0 right-0 h-12 z-10 bg-blue-200 flex gap-4 items-center"></footer>
        </div>
      </section>
    </main>
  );
};
```

Notice that we pass that same _promise_ with our user data over to `UserHeaderMenu`, which itself is wrapped in a Suspense tag. Here's that component

```tsx
const UserHeaderMenu: FC<{ user: Promise<{ name: string; avatar: string }> }> = props => {
  const { user } = props;
  const { name, avatar } = use(user);

  return <SidePanelTrigger name={name} avatar={avatar} />;
};
```

We call `use` on the user info promise, which is a special pseudo-hook exported from React (version 19 and beyond). `use` causes our component to Suspend, and render the fallback from the Suspense tag.

![Fallback](/tanstack-rsc/img3.jpg)

When the data are ready, the promise resolves, and our content shows our full ui.

![Full ui](/tanstack-rsc/img4.jpg)

## The non-RSC payload

As I said above, I've used some trickery to force the entirety of the Lucide React package to be bundled up, to simulate a deeply nested component hierarchy.

One a production build, a total of 308kb of JS is sent down.

## Rendering with RSC

Let's start with the simplest possible RSC component, which takes no props. It won't even take children, which itself is just a prop. Here's a new version of our application shell

```tsx
import { type FC } from "react";
import { SideBarContent } from "./SideBarContent";

type ApplicationShellProps = {};

export const ApplicationShellEmptyRSC: FC<ApplicationShellProps> = () => {
  return (
    <main className="h-screen">
      <header className="fixed top-0 left-0 right-0 h-12 z-10 bg-blue-200 flex items-center px-4 gap-4">
        <span>Header</span>
      </header>
      <section className="fixed left-0 top-12 bottom-0 w-60 overflow-auto ">
        <SideBarContent />
      </section>
      <section className="max-w-[600px] pt-16 mx-auto h-full">
        <div className="flex flex-col gap-2 h-full">
          <section className="min-h-[200px]"></section>
          <footer className="px-4 fixed bottom-0 left-0 right-0 h-12 z-10 bg-blue-200 flex gap-4 items-center"></footer>
        </div>
      </section>
    </main>
  );
};
```

To be clear, this component is useless. It does not display our header, nor does it display the actual, currently rendered page (via children). But it will let us see how to render an RSC that takes no props.

Let's see how to render it as an RSC.

First we'll import it in our \_\_root layout (or any layout, or route, or component), as well as a new helper from TanStack

```ts
import { ApplicationShellEmptyRSC } from "#/components/ApplicationShellEmptyRSC";
import { renderServerComponent } from "@tanstack/react-start/rsc";
```

and then we'll create a serverFn to turn this component into an RSC stream

```ts
const getAppShell = createServerFn({
  method: "GET",
}).handler(async () => {
  return renderServerComponent(<ApplicationShellEmptyRSC />);
});
```

Now we just need to _call_ our server function. We can do this anywhere. For our purposes, we'll just call it in our loader, and send the result down

```ts
  loader: async () => {
    const appShell = await getAppShell();
    return { appShell };
  },
```

and then in our React component we grab that payload, and just render it.

```tsx
function RootDocument({ children }: { children: React.ReactNode }) {
  const { appShell } = Route.useLoaderData();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased wrap-anywhere selection:bg-[rgba(79,184,178,0.24)]">
        {/* render the RSC */}
        {appShell}
      </body>
    </html>
  );
}
```

And this works. As simple as that.

The thing I like most about TanStack Start's RSC implementation is that it's very explicit. You have a clear API for declaring what you want to be rendered as an RSC.

## Passing props to our RSC

Let's finish this up. We need some new helpers

```ts
import { createCompositeComponent, CompositeComponent } from "@tanstack/react-start/rsc";
```

### Props in RSC

Passing props to RSCs is a bit different than passing props to a normal React component. It's important to remember that, by the time our Server Function runs, and we return

```ts
return renderServerComponent(<ApplicationShellEmptyRSC />);
```

(or soon, `createCompositeComponent`) our component has _already rendered_. It's done. It rendered _on the server_ and the thing we're holding, returned from our server function and renderServerComponent (or createCompositeComponent) is, conceptually, the final markup for the RSC.

We'll be rendering it in our component tree, but again, and this cannot be overstated, the RSC itself has _already rendered_.

That means, if you think you can just pass some data into the RSC, and use that data to adjust the content that's rendered, you fundamentally do not understand how RSCs work: again, by the time you attempt to render it in your component tree, the RSC component has _already rendered_ on the server, and produced markup.

### So how can we pass props?

What RSCs do allow is to pass in `children` content, or other _components_ as props. The RSC recognizes these props, and renders "holes" or "slots" (in a generic sense) for those props to get dumped in.

Let's take a look.

### Adding props to our RSC

Here's our new server function

```tsx
const getAppShell = createServerFn({
  method: "GET",
}).handler(async () => {
  return createCompositeComponent(
    (
      props: PropsWithChildren<{
        HeaderContent: FC<{ name: string; avatar: string }>;
      }>,
    ) => <ApplicationShell children={props.children} HeaderContent={props.HeaderContent} />,
  );
});
```

We're using `createCompositeComponent` which allows us to declare props. We're using the `PropsWithChildren` generic helper, which implicitly declares a children prop of type `ReactNode`, and we're adding a `HeaderContent` prop which is a component.

One neat thing about TanStack's RSC implementation is that props passed like this are _automatically_ client components; you don't have to add `"use client"` to the file, although it's fine if you do. Note that this applies to components you _pass_ to props. Content you _render_ as `children` can include RSC content if you'd like. You'd render other RSC content exactly like we did above, with `{appShell}`.

As before, we load our RSC in our loader

```ts
  loader: async () => {
    const appShell = await getAppShell();
    return { appShell };
  },
```

and then grab it in our component

```ts
const { appShell } = Route.useLoaderData();
```

And now we can render this with the `CompositeComponent` helper. We render `CompositeComponent` like a component, and pass the RSC result as the `src` prop, as well as any other props we may have

```tsx
<CompositeComponent src={appShell} HeaderContent={SidePanelTrigger}>
  {children}
</CompositeComponent>
```

### Loading data in RSC

Now let's look at our actual RSC

```tsx
import { Suspense, type FC, type PropsWithChildren } from "react";
import { SideBarContent } from "./SideBarContent";

type ApplicationShellProps = {
  HeaderContent: FC<{ name: string; avatar: string }>;
};

export const ApplicationShell: FC<PropsWithChildren<ApplicationShellProps>> = props => {
  const { children, HeaderContent } = props;

  return (
    <main className="h-screen">
      <header className="fixed top-0 left-0 right-0 h-12 z-10 bg-blue-200 flex items-center px-4 gap-4">
        <Suspense fallback={<span className="w-6 h-6 bg-gray-400 rounded-full"></span>}>
          <UserHeaderMenu HeaderContent={HeaderContent} />
        </Suspense>
        <span>Header</span>
      </header>
      <section className="fixed left-0 top-12 bottom-0 w-60 overflow-auto ">
        <SideBarContent />
      </section>
      <section className="max-w-[600px] pt-16 mx-auto h-full">
        <div className="flex flex-col gap-2 h-full">
          <section className="min-h-[200px]">{children}</section>
          <footer className="px-4 fixed bottom-0 left-0 right-0 h-12 z-10 bg-blue-200 flex gap-4 items-center"></footer>
        </div>
      </section>
    </main>
  );
};
```

Notice this piece.

```tsx
<Suspense fallback={<span className="w-6 h-6 bg-gray-400 rounded-full"></span>}>
  <UserHeaderMenu HeaderContent={HeaderContent} />
</Suspense>
```

We're rendering another component, `UserHeaderMenu` within a Suspense tag, and passing through the HeaderContent prop, which again, is a React component that takes in a name, and avatar prop. Let's see it, next

```tsx
async function UserHeaderMenu(props: { HeaderContent: FC<{ name: string; avatar: string }> }) {
  const { HeaderContent } = props;

  await new Promise(resolve => setTimeout(resolve, 1000));
  const avatar = "https://d193qjyckdxivp.cloudfront.net/avatar.jpg";
  const name = "Adam Rackis";

  return <HeaderContent name={name} avatar={avatar} />;
}
```

Since we're in an RSC we don't have to use the `use` pseudo-hook. We can just `await` our data however we want, and while those data are pending, the Suspense boundary's fallback will render without blocking the rest of the content, as before. Then, a second later, our data will be ready, and our avatar will show.

This works, and produces the same experience as we saw originally, with the client-rendered version; except now as an RSC.

## The total savings with RSC

What are the savings? The non-RSC version pushed 308KB of JS into the client. The RSC version reduces that to 203KB (both measures are on production builds).

## When to use RSC

Please don't think this is a panacea, or even something you should use in every project. The larger and more expensive the component tree, the larger your potential savings. But if your component tree isn't doing much, isn't pulling in heavy dependencies (which don't need state or interactivity), doesn't have a wide import graph with things that are conditionally rendered, then there's a good chance RSC will offer you minimal benefit.

This is a tool like any other, and like any other tool, you need to know when to reach for it, and when not to.

## Concluding thoughts

TanStack's implementation of RSC is what I wanted all along, without ever knowing it. Data fetching in TanStack is already simple; RSC exists to provide a more performant rendering idiom, where things don't exist on the client when they don't need to, and when existing on the client would be expensive.

Happy Coding!
