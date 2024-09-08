---
title: Introducing TanStack Router
date: "2024-09-01T10:00:00.000Z"
description: An introduction to TanStack Router
---

TanStack Router is an incredibly exciting project. It's essentially a fully-featured _client-side_ JavaScript application framework. It provides a mature routing and navigation system, with nested layouts, and efficient data loading capabilities at every point in the route tree. Best of all, it does all of this in a _type-safe_ manner.

What's especially exciting is that as of this writing, there's a TanStack Start in the works, which will add server-side capabilities to Router, enabling you to build full-stack web applications. Start promises to do this with a server layer applied directly on top of the same TanStack Router we'll be talking about here. That makes this a perfect time to get to know Router if you haven't already.

Router is much more than just a ... router; as we mentioned, it's a full-fledged client-side application framework. So to prevent this post from getting too long, we won't even try to cover it all. Here we'll limit ourselves to routing and navigation, which is a larger topic than you might think, especially considering the type-safe nature of Router.

## Getting started

The TanStack Router docs [are here](https://tanstack.com/router/latest/docs/framework/react/overview), and the quick start guide [is here](https://tanstack.com/router/latest/docs/framework/react/quick-start). To be frank, the quick start is a bit more manual, and less quick than it could be. For now. TanStack Start looks to add the same kind of nice scaffolding projects that like SvelteKit and Next have. But for now you can just clone [the repo](https://github.com/arackaf/tanstack-router-routing-demo) I used for this project and follow along.

## The plan

In order to see what Router can do, and how it works we'll pretend to build a task management system, like Jira. Like the real Jira we won't make any effort at making things look nice, or be pleasant to use. Our goal is to see what Router can do, not build a useful web application.

We'll cover routing; layouts; path, and search parameters; and of course static typing all along the way.

Let's start at the very top.

## The Root Route

This is our root layout, which Router calls `__root.tsx`. If you're following along on your own project, this will go directly under the `routes` folder.

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

We run our app with `npm run dev` which will run our project on `http://localhost:5173/`. More importantly, the dev watch process monitors the routes we'll be adding, and maintains a `routeTree.gen.ts` file. This syncs metadata about our routes in order to help build static types, which will help us work with our routes safely. Speaking of, if you're building this from scratch, you might have noticed some TypeScript errors on our Link tags, since those url's don't yet exist. That's right: TanStack Router deeply integrates TypeScript into the route level, and will even validate that your Link tags are pointing somewhere valid.

To be clear, this is not because of any editor plugins. The TypeScript integration itself is producing errors, as it would in your CI/CD system.

<pre>
src/routes/\_\_root.tsx:8:17 - error TS2322: Type '"/"' is not assignable to type '"." | ".." | undefined'.
</pre>

```ts
          <Link to="/" className="[&.active]:font-bold">
```

## Building the app

Let's get started. We'll add our root page. In Router, we use the file `index.tsx` to represent the root `/` path, wherever we are in the route tree (which we'll explain shortly). We'll create index.tsx, and, assuming you have the dev task running, it should scaffold some code for you that looks like this

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <div>Hello /!</div>,
});
```

There's a bit more boilerplate than you might be used to with metaframeworks like Next or SvelteKit. There, you just default export a React component, or plop down a normal Svelte component and everything _just works_. Here it seems we have have to call a function called `createFileRoute`, and pass in the route to where we are.

The route is necessary for the type safety Router has, but don't worry, you don't have to manage this yourself. The dev process not only scaffolds code like this for new files, it also keeps those path values in sync for you. Try it—change that path to something else, and save the file; it should change it right back, for you. Or create a folder called `junk` and drag it there: it should change the path to `"/junk/"`.

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

Simple and humble. Just a component telling us we're in the top level index page.

## Routes

Let's start to create some actual routes. Our root layout indicated we'd want to have paths for dealing with tasks and epics. Router (by default) uses file-based routing, but provides you two ways to do so, which can be mixed and matched (we'll look at both). You can stack your files into folders which match the path you're browsing. Or you can use "flat routes" and indicate these route hierarchies in individual filenames, separating the paths with dots. If you're thinking only the former is useful, stay tuned.

Just for fun, let's start with the flat routes. Let's create a `tasks.index.tsx` file. This is the same as creating an index.tsx inside of an hypothetical `tasks` folder. For content we'll add some basic markup (we're trying to see how Router works, not build an actual todo app).

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

Before we continue, let's add a layout file for all of our tasks routes, housing some common content that will be present on all pages routed to under `/tasks`. If we had a `tasks` folder, we'd just throw a `route.tsx` file in there. Instead, we'll add a `tasks.route.tsx` file. Since we're using flat files, here, we can also just name it tasks.tsx. But I like keeping things consistent with directory-based files (which we'll see in a bit), so I like opting for `tasks.route.tsx`.

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

As always, don't forget the `<Outlet />` or else the actual content of that path will not render.

To repeat, `xyz.route.tsx` is a component that renders for the entire route, all the way down. It's essentially a layout, but Router calls them routes. And `xyz.index.tsx` is the file for the individual path at `xyz`.

And this renders. There's not much to look at, but take a quick look before we make one interesting change

![statically typed path param](/tanstack-router-intro/tasks-page.jpg)

Notice the navigation links from the root layout at the very top. Below that, we see `Tasks layout`, from the tasks route file (essentially a layout). And then, below that, we have the content for our tasks page.

## Path parameters

The `<Link>` tags in the tasks index file give away where we're headed, but let's build paths to view, and edit tasks. We'll create `/tasks/123` and `/tasks/123/edit` paths, where of course `123` represents whatever the taskId is.

TanStack Router represents variables inside of a path as path parameters, and they're represented as path segments that start with a dollar sign. So with that we'll add `tasks.$taskId.index.tsx` and `tasks.$taskId.edit.tsx`. The former will route to `/tasks/123` and the latter will route to `/tasks/123/edit`. Let's take a look at `tasks.$taskId.index.tsx` and find out how we actually get the path parameter that's passed in.

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

The `Route.useParams()` object that exists on our Route object returns our parameters. But this isn't interesting on its own; every routing framework has something like this. What's particularly compelling is that this one is statically typed. Router is smart enough to know which parameters exist for that route (including parameters from higher up in the route, which we'll see in a moment). That means that not only do we get auto complete

![statically typed path param](/tanstack-router-intro/path-param-auto-complete.jpg)

but if you put an invalid path param in there, you'll get a TypeScript error

![statically typed path param](/tanstack-router-intro/parath-param-typed.jpg)

We also saw this with the Link tags we used to navigate to these routes

```tsx
<Link to="/tasks/$taskId" params={{ taskId: t.id }}>
```

if we'd left off the params here (or specified anything other than `taskId`), we would have gotten an error.

## Advanced routing

Let's start to lean on Router's advanced routing rules (a little) and see some of the nice features it supports. I'll stress, these are advanced features you won't commonly use; but it's nice to know they're there.

The edit task route is essentially identical, except the path is different, and I put the text to say "Edit" instead of "View." But let's use this route to explore a TanStack Router feature we haven't seen.

Conceptually we have two hierarchies: we have the url path, and we have the component tree. So far, these things have lined up 1:1. The url path

`/tasks/123/edit`

has rendered

`root route -> tasks route layout -> edit task path`

The url hierarchy, and the component hierarchy lined up perfectly. But they don't have to.

Just for fun, to see how, let's see how we can remove the main tasks layout file from the edit task route. So we want the `/tasks/123/edit` url to render the same thing, but **without** the `tasks.route.tsx` route file being rendered. To do this, we just rename `tasks.$taskId.edit.tsx` to `tasks_.$taskId.edit.tsx`. Note that `tasks` became `tasks_`. We do need `tasks` in there, where it is, so Router will know how to eventually find the `edit.tsx` file we're rendering, _based on the url_. But by naming it `tasks_`, we remove that _component_ from the rendered component tree, even though `tasks` is still in the url. And now when we render the edit task route, we get this

![statically typed path param](/tanstack-router-intro/edit-task-without-tasks-layout.jpg)

Notice how `Tasks layout` is gone.

What if you wanted to do the opposite? What if you have a _component_ hierarchy you want, (ie, you **want** some layout to render in the edit task page), but you **don't** want that layout to affect the url. Well, just put the underscore on the opposite side. So we have `tasks_.$taskId.edit.tsx` which renders the task edit page, but without putting the tasks layout route into the _component hierarchy_. Let's say we have a special layout we _want_ to use only for task editing. Let's create a `_taskEdit.tsx`

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_taskEdit")({
  component: () => (
    <div>
      Special Task Edit Layout <Outlet />
    </div>
  ),
});
```

and then change our task edit file to this `_taskEdit.tasks_.$taskId.edit.tsx`. And now when we browse to `/tasks/1/edit` we see the task edit page with our custom layout (which did not affect our url)

![custom layout](/tanstack-router-intro/pathless-layout.jpg)

Again, this is an advanced feature. Most of the time you'll use simple, boring, predictable routing rules. But it's nice to know these advanced features exist.

## Directory based routing

Instead of putting file hierarchies into file names with dots, you can also put them in directories. I _usually_ prefer directories, but you can mix and match, and sometimes a judicious use of flat file names for things like pairs of `$pathParam.index.tsx` and `$pathParam.edit.tsx` feel natural inside of a directory. All the normal rules apply, so choose what feels best _to you_.

We won't walk through everything for directories again. We'll just take a peak at the finished product (which is also on GitHub). We have an `epics` path, which lists out, well, epics. For each, we can edit, or view the epic. When viewing, we also show a (static) list of milestones in the epic, which we can also view, or edit. And like before, for fun, when we edit a milestone, we'll remove the milestones route layout.

![directory routing](/tanstack-router-intro/directory-routing.jpg)

So rather than `epics.index.tsx` and `epics.route.tsx` we have `epics/index.tsx` and `epics/route.tsx`. And so on. Again, they're the same rules; just replace the dots in the files names with slashes (and directories).

Before moving on, let's briefly pause and look at the `$milestoneId.index.tsx` route. There's a `$milestoneId` in the path, so of course we can find that path param. But look up, higher in the route tree. There's also an `$epicId` param two layers higher. It should come as no surprise that Router is smart enough to realize this, and set the typings up such that both are present.

![multiple path params](/tanstack-router-intro/multiple-path-params.jpg)

## Type-safe querystrings

The cherry on the top of this post will be, in the author's opinion, one of the most obnoxious aspects of web development: dealing with search params (sometimes called querystrings). Basically the stuff that comes after the `?` in a url: `/tasks?search=foo&status=open`. The underlying platform primitive `URLSearchParams` can be tedious to work with, and frameworks don't usually do much better, often providing you an un-typed bag of properties, and offering minimal help in constructing a new url with new, updated querystring values.

It should come as no surprise that TanStack Router provides a convenient, fully-featured mechanism for managing search params, **which are also type-safe**. Let's dive in. We'll take a high-level look, but the full docs [are here](https://tanstack.com/router/latest/docs/framework/react/guide/search-params).

We'll add search param support for the `/epics/$epicId/milestones` route. We'll allow various values in the search params that would allow the user to search milestones under a given epic. We've seen the `createFileRoute` function countless times. Typically we just pass a `component` to it.

```tsx
export const Route = createFileRoute("/epics/$epicId/milestones/")({
  component: ({}) => {
    // ...
```

There's lots of other functions it supports. For search params we want `validateSearch`. This is our opportunity to tell Router _which_ search params this route supports, and how to validate what's currently in the url. After all, the user is free to type whatever they want into a url, regardless of the TypeScript typings you set up. It's your job to take potentially invalid values, and project them to something valid.

First, let's define a type for our search params

```ts
type SearchParams = {
  page: number;
  search: string;
  tags: string[];
};
```

and now let's implement our `validateSearch` method. This receives a `Record<string, unknown>` representing whatever the user has in the url, and from that, we return something matching our type. Let's take a look.

```tsx
export const Route = createFileRoute("/epics/$epicId/milestones/")({
  validateSearch(search: Record<string, unknown>): SearchParams {
    return {
      page: Number(search.page ?? "1") ?? 1,
      search: (search.search as string) || "",
      tags: Array.isArray(search.tags) ? search.tags : [],
    };
  },
  component: ({}) => {
```

Note that (unlike `URLSearchParams`) we are not limited to just string values. We can put objects or arrays in there, and TanStack will do the work of serializing and de-serializing it for us. Not only that, but you can even specify [custom serialization mechanisms](https://tanstack.com/router/latest/docs/framework/react/guide/custom-search-param-serialization).

Moreover, for a production application, you'll likely want to use a more serious validation mechanism, like Zod. In fact, Router has a number of adapters you can use out of the box, including zod. Check out the docs [here](https://tanstack.com/router/latest/docs/framework/react/guide/search-params#zod-adapter).

Let's manually browse to this path, without any search params, and see what happens. When we browse to

```
http://localhost:5173/epics/1/milestones
```

Router replaces (does not redirect) us to

```
http://localhost:5173/epics/1/milestones?page=1&search=&tags=%5B%5D
```

TanStack ran our validation function, and then replaced our url with the correct, valid search params. If you don't like that it forces the url to be "ugly" like that, stay tuned; that's easily worked around. But first let's work with what we have.

We've been using the `Route.useParams` method multiple times. There's also a `Route.useSearch` that does the same thing, for search params. But let's do something a little different. We've previously been putting everything in the same route file, so we could just directly reference the Route object from the same lexical scope. Let's build a separate component to read, and update these search params.

I've added a `MilestoneSearch.tsx` component. You might think you could just import the `Route` object from the route file. But that's dangerous. You're likely to create a circular dependency, which might or might not work, depending on your bundler. And even if it "works" you might have some hidden issues lurking.

Fortunately Router gives you a direct api to handle this: `getRouteApi` which is exported from `@tanstack/react-router`. We pass it a (statically typed) route, and it gives us back the correct route object

```ts
const route = getRouteApi("/epics/$epicId/milestones/");
```

and now we can call `useSearch` on that route object and get our statically typed result.

![get search params](/tanstack-router-intro/get-search-params.jpg)

We won't belabor the form elements and click handlers to sync and gather new values for these search parameters. Let's just assume we have some new values, and see how we set them. For this, we can use the `useNavigate` hook.

```ts
const navigate = useNavigate({ from: "/epics/$epicId/milestones/" });
```

We call it, and tell it where we're navigating _from_. Now we use the result and tell it where we want to _go_ (the same place we are), and are given a `search` function from which we return the new search params. Naturally, TypeScript will yell at us if we leave anything off. As a convenience, Router will pass this search function the current values, making it easy to just add / override something. So to page up, we can do

```ts
navigate({
  to: ".",
  search: prev => {
    return { ...prev, page: prev.page + 1 };
  },
});
```

Naturally, there's also a `params` prop to this function, if you're browsing to a route with path parameters that you have to specify (or else TypeScript will yell at you, like always). We don't need an `$epicId` path param here, since there's already one on the route, and since we're going to the same place we already are (as indicated by the `from` value in useNavigate, and the `to: "."` value in navigate function) Router knows to just keep what's there, there.

If we want to set a search value and tags, we could do

```ts
const newSearch = "Hello World";
const tags = ["tag 1", "tag 2"];

navigate({
  to: ".",
  search: prev => {
    return { page: 1, search: newSearch, tags };
  },
});
```

which will make our URL look like this

```
/epics/1/milestones?page=1&search=Hello%20World&tags=%5B"tag%201"%2C"tag%202"%5D
```

Again, the search, and the array of strings were serialized for us.

If we want to _link to_ a page with search params, we specify those search params on the Link tag

```tsx
<Link to="/epics/$epicId/milestones" params={{ epicId }} search={{ search: "", page: 1, tags: [] }}>
  View milestones
</Link>
```

And as always, TypeScript will yell at us if we leave anything off. Strong typing is a good thing.

### Making our url prettier

As we saw, currently, browsing to

```
http://localhost:5173/epics/1/milestones
```

will replace the url with this

```
http://localhost:5173/epics/1/milestones?page=1&search=&tags=%5B%5D
```

since we told Router that our page will always have a page, search, and tags value. If you care about your url, and want that transformation to _not_ happen, you have some options. We can make all of these values optional. In JavaScript (and TypeScript) a value does not exist if it holds the value `undefined`. So we could change our type to this

```ts
type SearchParams = {
  page: number | undefined;
  search: string | undefined;
  tags: string[] | undefined;
};
```

or this (which is the same thing)

```ts
type SearchParams = Partial<{
  page: number;
  search: string;
  tags: string[];
}>;
```

and then do the extra work to put undefined values in place of default values

```ts
validateSearch(search: Record<string, unknown>): SearchParams {
  const page = Number(search.page ?? "1") ?? 1;
  const searchVal = (search.search as string) || "";
  const tags = Array.isArray(search.tags) ? search.tags : [];

  return {
    page: page === 1 ? undefined : page,
    search: searchVal || undefined,
    tags: tags.length ? tags : undefined,
  };
},
```

of course, this will complicate places where you _use_ these values, since now they might be undefined. Our nice simple pageUp call now looks like this

```ts
navigate({
  to: ".",
  search: prev => {
    return { ...prev, page: (prev.page || 1) + 1 };
  },
});
```

On the plus side, our url will now omit search params with default values, and for that matter, our `<Link>` tags to this page now don't have to specify _any_ search values, since they're all optional.

It's up to you which tradeoff you'd like to make.

## Wrapping up

TanStack router is an incredibly exciting project. It's a superbly-made, flexible client-side framework that promises fantastic server-side integration in the near future.

We've barely scratched the surface. We just covered the absolute basics of type-safe navigation, layouts, path params, and search params. Stay tuned for future posts where we'll dive deep into loaders, and even server integration on top or Router with TanStack Start

Happy Coding!
