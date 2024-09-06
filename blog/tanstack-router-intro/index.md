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

## Buildign the app

Let's get started. We'll add our root page. In Router, we use the file `index.tsx` to represent the root `/` path, wherever we are in the route tree (which we'll explain shortly). We'll create index.tsx, and, assuming you have the dev task running, it should scaffold some code for you that looks like this

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <div>Hello /!</div>,
});
```

There's a bit more boilerplate than you might be used to with metaframeworks like Next or SvelteKit. There, you just either default export a React component, or put a normal Svelte component and everything just works. Here it seems we have have to call a function called `createFileRoute`, and pass in the route where we are. The route is necessary for the type safety Router has, but don't worry, you don't have to manage this yourself. The dev process not only scaffolds code like this for new files, it also keeps those path values in sync for you. Try it - change that path to something else, and save the file; it should change it right back, for you. Or create a folder called `junk` and drag it there - it should change the path to `"/junk/"`.

Ok let's add the following content (after moving it back out of the junk folder).

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="p-2">
      <h3>Top level index page</h3>
    </div>
  );
}
```

Simple and humble. Just a component telling us we're in the top level index page. We're

## Routes

Let's start to create some actual routes. Our root layout indeicated we'd want to have paths for dealing with both tasks, and also epics. Router (by default) uses file-based routing, but provides you two ways to do so, which can be mixed and matched (we'll look at both). You can stack your files into folders which match the path your browsing. Or you can indicate these route hierarchies in individual filenames, separating the paths with dots. If you're thinking only the former is useful, stay tuned.

Just for fun, let's start with the flat file system. Let's create a `tasks.index.tsx` file. This is the same as creating an index.tsx inside of an hypothetical `tasks` folder. For content we'll add some basic content (we're trying to see how Router works, not build an actual todo app).

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks/")({
  component: Index,
});

function Index() {
  const tasks = [
    { id: "1", title: "Task 1" },
    { id: "2", title: "Task 2" },
    { id: "3", title: "Task 3" },
  ];

  return (
    <div className="p-2">
      <h3>Tasks page!</h3>
      <div className="flex flex-col gap-2 p-3">
        {tasks.map((t, idx) => (
          <div key={idx} className="flex gap-3">
            <div>{t.title}</div>
            <Link to="/tasks/$taskId" params={{ taskId: t.id }}>
              View
            </Link>
            <Link to="/tasks/$taskId/edit" params={{ taskId: t.id }}>
              Edit
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Before we continue, let's add a layout file for all of our tasks routes. Some common content that will be present on all pages routed to under `/tasks`. If we had a `tasks` folder, we'd just throw a `route.tsx` file in there. Instead, we'll add a `tasks.route.tsx` file.

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks")({
  component: () => (
    <div>
      Tasks layout <Outlet />
    </div>
  ),
});
```

Simple and humble; as always, don't forget the `<Outlet />` or else the actual contnet of that path will not render.

And now let's add a path for /tasks, `tasks.index.tsx`.

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks/")({
  component: Index,
});

function Index() {
  const tasks = [
    { id: "1", title: "Task 1" },
    { id: "2", title: "Task 2" },
    { id: "3", title: "Task 3" },
  ];

  return (
    <div className="p-2">
      <h3>Tasks page!</h3>
      <div className="flex flex-col gap-2 p-3">
        {tasks.map((t, idx) => (
          <div key={idx} className="flex gap-3">
            <div>{t.title}</div>
            <Link to="/tasks/$taskId" params={{ taskId: t.id }}>
              View
            </Link>
            <Link to="/tasks/$taskId/edit" params={{ taskId: t.id }}>
              Edit
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
```

To repeat, `xyz.route.tsx` is a component that renders for the entire route, all the way down. It's essentially a layout, but Router calls them routes. And `xyz.index.tsx` is the file for the individual path at `xyz`.

And this renders. There's not much to look at, but take a quick look before we make one interesting change

![statically typed path param](/tanstack-router-intro/tasks-page.jpg)

Notice the navigation lines from the root layout at the very top. Below that, we see `Tasks layout`, from the tasks route file (other frameworks would refer to this as a layout). And then below that, we have the content for our tasks page.

## Path parameters

The `<Link>` tags in the tasks index file give away where we're headed, but let's build paths to view, and edit tasks. We'll create `/tasks/123` and `/tasks/123/edit` paths, where of course `123` represents whatever the taskId is.

TanStack Router repsents variables inside of a path as path parameters, and they're repsented as path segments that start with a dollar sign. So with that we'll add `tasks.$taskId.index.tsx` and `tasks.$taskId.edit.tsx`. The former will route to `/tasks/123` and the latter will route to `/tasks/123/edit`. Let's take a look at `tasks.$taskId.index.tsx` and find out how we actually get the path parameter that's passed in.

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks/$taskId/")({
  component: () => {
    const { taskId } = Route.useParams();

    return (
      <div className="flex flex-col gap-3 p-3">
        <div>
          <Link to="/tasks">Back</Link>
        </div>
        <div>View task {taskId}</div>
      </div>
    );
  },
});
```

The `Route.useParams()` object that exists on our Route object returns out parameters. But this isn't interesting on its own; every routing framework has something like this. What's particularly compelling is that this one is statically typed. Router is smart enough to know which parameters exist for that route (including parameters from higher up in the route, which we'll see in a moment). That means that not only do we get auto complete

![statically typed path param](/tanstack-router-intro/path-param-auto-complete.jpg)

but if you put an invalid path param in there, you'll get a TypeScript error

![statically typed path param](/tanstack-router-intro/parath-param-typed.jpg)

## Wrapping up

TanStack router is an incredibly exciting project. It's a superbly-made, flexible client-side router that promises fantastic server-side integration in the near future.

Happy Coding!
