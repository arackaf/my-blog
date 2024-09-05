---
title: Introducing TanStack Router
date: "2024-09-01T10:00:00.000Z"
description: An introduction to TanStack Router
---

TanStack router is an incredibly exciting project. It's essentially a fully-featured _client-side_ JavaScript application framework. It provides a mature routing and navigation features, with nested layouts, and efficient data loading capabilities at every point in the routing tree. Oh and best of all, it does all of this in a _type-safe_ manner.

What's especially exciting is that as of this writing, there's a TanStack Start in the works, which will add on to Router, to enable you to build full-stack web applications. Start promises to do this with a server layer applied directly on top of the TanStack Router this post will be talking about. That makes this a perfect time to get to know Router if you're not already, which is why we're here.

Router is much more than just a ... router; as we mentioned, it's a fully-fledge client-side application framework. So to prevent this post from getting too long, we won't even try to cover it all. For this post we'll limit ourselves to routing and navigation, which is a larger topic than you might think, especially considered the type-safe nature of Router.

Let's get started!

## Getting started

The TanStack Router docs [are here](https://tanstack.com/router/latest/docs/framework/react/overview), and the quick start guide [is here](https://tanstack.com/router/latest/docs/framework/react/quick-start). To be frank, the quick start is a bit more manual, and less quick than it could be. For now. TanStack Start looks to add the same kind of nice scaffolding projects that like SvelteKit and Next already have. But for now you can just clone [the repo](https://github.com/arackaf/tanstack-router-routing-demo) I used for this project if you'd like to poke around with what we're talking about here.

## The plan

In order to see what Router can do, and how it works we'll pretend to build a task management system, like Jira. Like the real Jira we won't make any effort at making anything look nice or be pleasant to use. Our goal is to see what Router can do, not build a useful web application.

We'll cover routing; layouts; path, and search parameters; and of course static typing all along the way.

## Our Root Route

Let's look at our root layout, which Router calls `__root.tsx`. If you're following along on your own project, this will go directly under the `routes` folder.

```ts
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => {
    return (
      <>
        <div className="p-2 flex gap-2">
          <Link to="/" className="[&.active]:font-bold">
            Home
          </Link>
          <Link to="/tasks" className="[&.active]:font-bold">
            Tasks
          </Link>
          <Link to="/epics" className="[&.active]:font-bold">
            Epics
          </Link>
        </div>
        <hr />
        <div className="p-3">
          <Outlet />
        </div>
      </>
    );
  },
});
```

The `createRootRoute` function does what it says. The `<Link />` component is also fairly self-explanatory—Router is kind enough to add an `active` css class to Links which are currently active, which makes it easy to style them accordingly. Lastly, the `<Outlet />` component is interesting. This is how we tell Router where to render the "content" for this layout.

## Running the app

Un surprisingly, we can run this app with `npm run dev` which will run our project on `http://localhost:5173/`. More importantly, the dev watch process monitors the routes we'll be adding, maintains a `routeTree.gen.ts` file. This maintains, and syncs metadata about our routes in order to help build the static types. Speaking of, if you're building this from scratch, you might have noticed some TypeScript errors on our Link tags, since those addresses don't yet exist. That's right: TanStack Router deeply integrates TypeScript into the route level, and will even validate your Link tags are all pointing somewhere valid.

To be clear, this is not because of any editor plugins. The TypeScript integration itself is producing errors, as it would in your CI/CD system.

```
src/routes/\_\_root.tsx:8:17 - error TS2322: Type '"/"' is not assignable to type '"." | ".." | undefined'.

          <Link to="/" className="[&.active]:font-bold">
```

## Wrapping up

TanStack router is an incredibly exciting project. It's a superbly-made, flexible client-side router that promises fantastic server-side integration in the near future.

Happy Coding!
