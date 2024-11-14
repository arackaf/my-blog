---
title: Loading Data with TanStack Router
date: "2024-11-12T10:00:00.000Z"
description: A deep dive into various ways of loading, and mutating data with TanStack Router
---

TanStack Router is one of the most exciting projects in the web development ecosystem, which doesn't get nearly enough attention. It's a fully fledged client-side application framework that supports routing, with all the advanced use cases you'd expect; nested layouts; and hooks for loading data. Best of all, it does all of this with deep type safety.

I wrote about Router previously [here](https://frontendmasters.com/blog/introducing-tanstack-router/). That post covered just the routing, url and query parameters, along with the type safety we mentioned above.

This post is all about data loading. We'll cover the built-in hooks Router ships with to load, and invalidate data. Then we'll cover how easily TanStack Query (also known as react-query) integrates, and see what the tradeoffs of each are.

The code for everything we're covering is [here](https://github.com/arackaf/tanstack-router-loader-demo). As before, I'm building an extremely austere, imaginary Jira knockoff. There's nothing useful in that repo beyond the bare minimum needed for us to take a close look at how data loading works.

The app does load actual data via SQLite, along with some forced delays, so we can more clearly see (and fix) network waterfalls. If you want to run the project, clone it, run `npm i`, and then open **two** terminals. In the first, run `npm run server`, which will create the SQLite database, seed it with data, and set up the api endpoints to fetch, and update data; in the second, run `npm run dev` to start the main project, which will be on `http://localhost:5173/`. There is some (extremely basic) features to edit data. If at any point you want to completely reset the data, just reset the server task in your terminal.

The app is contrived. It exists to show Router's capabilities. We'll often have contrived use cases, and frankly questionable design decisions. This was purposeful, in order to simulate real-world data loading scenarios, without needing a real-world application.

## But what about SSR

As we said above, Router is essentially a client-side framework; in theory there are hooks to get SSR working, but they're very much DIY. If this disappoints you, I'd urge just a bit of patience. TanStack Start, which is currently in Beta, is a new project that, for all intents and purposes, adds SSR capabilities to the very same TanStack Router we'll be talking about. What makes me especially excited about Start is that it adds these server-side capabilities in a very non-intrusive way, which does not change or invalidate anything we'll be talking about in this post (or talked about in my last post on Router, linked above). If that's not entirely clear and you'd like to learn more, stay tuned for my future post on TanStack Start.

## The plan

As we said above, TanStack Router is an entire application framework. You could teach an entire course on it, and indeed there's no shortage of YouTube videos out there. This blog will turn into a book if we try to cover each and every option in depth, so we'll cover the relevant features, and show code snippets where helpful. But refer to the [docs](https://tanstack.com/router/latest/docs/framework/react/overview) for details, or of course the [repo for this post](https://github.com/arackaf/tanstack-router-loader-demo) to see the examples described here, in their entirety.

Don't let the extremely wide range of features scare you. The **vast** majority of the time some basic loaders will get you exactly what you need, but we'll cover some of the advanced features, too, so you know they're there, if you ever do need them.

## Starting at the top: context

When we create our router, we can give it some "context." This is basically global state. For our project, we'll pass in our `queryClient` for react-query (which we'll be using a little later). Passing the context in is simple enough

```ts
const router = createRouter({ routeTree, context: { queryClient } });
```

and then to make sure Router integrates what we put on context into the static types, we create our root route like this

```ts
export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Root,
});
```

This context will be available to all routes in the tree, and inside api hooks like `loader`, which we'll get to shortly.

### Adding to context

Context can change. We set up truly global context when we start Router up at our application's root, but different locations in the route tree can add new things to context, which will be visible from there, downward in the tree. There's two places for this, the `beforeLoad` function, and the `context` function. Yes, route's can take a context _function_ which modifies the route tree's context _value_.

#### beforeLoad

`beforeLoad` runs always, on each active route, anytime the url changes in any way. This is a good place to check preconditions and redirect. If you return a value from here, that value will be merged into the router's context, and visible from that route, downward. This function **blocks** all loaders from running, so be **extremely careful** what you do in here. Data loading should generally be avoided unless absolutely needed, since any loaders will wait until this function is complete, potentially creating waterfalls.

Here's a good example of what to avoid, with an opportunity to see why. This before load fetches the current user, and places it into context, and doing a redirect if there is no user.

```ts
  async beforeLoad({}) {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({
        to: "/login",
      });
    }
    document.cookie = `user=${user.id};path=/;max-age=31536000`;

    return { user };
  },
```

We'll be looking at some data loading in a bit, and measure what starts when. You can go into the `getCurrentUser` function and uncomment the artificial delay in there, and see it block _everything_. This is especially obvious if you're running Router's dev tools. You'll see this path block, and only once ready, allow all loaders below to execute.

But this is a good enough example to show how this works. The `user` object is now in context, visible to routes beneath it.

**NOTE**

```
A more realistic example would probably *just* check for a logged in cookie, and optimistically assume the user is logged in, and rely on network calls we do in the loaders to detect a logged-out user, and redirect accordingly. And to make things even more realistic, those loaders for the initial render would run on the server, and figure out if a user is actually logged out before we show the user *anything*; but that will wait for a future post on TanStack Start.

What we have is sufficient to show how the `beforeLoad` callback works.
```

#### Context (function)

There's also a context `function` we can provide routes. This is a non-async function, that also gives us an opportunity to add to context. But it runs much more conservatively. This function only runs when the url changes in a way that's relevant to _that route_. So for a route of, say, `app/epics/$epicId`, the context function will re-run when the epicId param changes. This might seem strange, but it's useful for modifying the context, but only when the route has changed, especially when you need to put non-primitive values (objects and functions) onto context. These non-primitive values are always compared by reference, and therefore always unique against the last value generated. As a result, they would cause render churning if added in `beforeLoad`, since Router would (incorrectly) think it needed to re-render a route when nothing has changed.

For now, here's some code in our root route to mark the time for when the initial render happens, so we can compare that to the timestamp of when various queries run in our tree. This will help us see, and fix network waterfalls.

```ts
  context({ location }) {
    const timeStarted = +new Date();
    console.log("");
    console.log("Fresh navigation to", location.href);
    console.log("------------------------------------------------------------------------------------");

    return { timestarted: timeStarted };
  },
```

This code is in our root route, so it will never re-run, since there's no path parameters the root route depends on.

Now everywhere in our route tree will have a `timestarted` value that we can use to detect any delays from data fetches in our tree.

## Loaders

Let's actually load some data. Router provides a `loader` function for this. Any of our route configurations can accept a loader function, which we can use to load data. Loaders all run in parallel. It would be bad if a layout needed to complete loading its data before the path beneath it started. Loaders receive any path params on the route's url, any search params (querystring values) the route has subscribed to, the context, and a few other goodies, and loads whatever data it needs. Router will detect what you return, and allow components to retrieve it via the `useLoaderData` hook—strongly typed, of course.

### Loader in a route

Let's take a look at tasks.route.tsx

This is a route that will run for any url at all starting with `/app/tasks`. It will run for that route, for `/app/tasks/$taskId`, for `app/tasks/$taskId/edit`, and so on.

```ts
export const Route = createFileRoute("/app/tasks")({
  component: TasksLayout,
  loader: async ({ context }) => {
    const now = +new Date();
    console.log(`/tasks route loader. Loading task layout info at + ${now - context.timestarted}ms since start`);

    const tasksOverview = await fetchJson<TaskOverview[]>("api/tasks/overview");
    return { tasksOverview };
  },
  gcTime: 1000 * 60 * 5,
  staleTime: 1000 * 60 * 2,
});
```

We receive the context, and grab the `timestarted` value from it. We request some overview data on our tasks, and send that data down.

`gcTime` controls how long old route data are kept in cache. So if we browse from tasks, over to epics, and then come back in 5 minutes, nothing will be there, and the page will load in fresh. `staleTime` controls how long a cached entry is considered "fresh." This determines whether cached data are refetched in the background. Here it's set to two minutes. This means if the user hits this page, then goes to the epics page, waits 3 minutes, then browses back to tasks, the cached data will show, while the tasks data is re-fetched in the background, and (if changes) update the UI.

You're probably wondering if TanStack Router tells you this background re-fetch is happening, so you can show an inline spinner, and yes, you can detect this via

```ts
const { isFetching } = Route.useMatch();
```

### Loader in a page

Now let's take a look at the tasks page

```ts
export const Route = createFileRoute("/app/tasks/")({
  component: Index,
  loader: async ({ context }) => {
    const now = +new Date();
    console.log(`/tasks/index path loader. Loading tasks at + ${now - context.timestarted}ms since start`);

    const tasks = await fetchJson<Task[]>("api/tasks");
    return { tasks };
  },
  gcTime: 1000 * 60 * 5,
  staleTime: 1000 * 60 * 2,
  pendingComponent: () => <div className="m-4 p-4 text-xl">Loading tasks list...</div>,
  pendingMs: 150,
  pendingMinMs: 200,
});
```

This is the route for the specific url `/app/tasks`. If the user were to browse to `/app/tasks/$taskId` then this component would no longer run at all. This is a specific page, not a layout (which Router calls a "route"). Basically the same as before, except now we're loading the list of tasks to display on this page.

We've added some new properties this time though. `pendingComponent` allows us to render some content while the loader is working. We also specified `pendingMs`, which controls how long we _wait_ before showing the pending component. Lastly, `pendingMinMs` allows us to force the pending component to stay on the screen for a specified amount of time, even if the data are ready. This can be useful to avoid an extremely brief flash of a loading component, which can be jarring to the user.

If you're wondering why we'd even want to use `pendingMs` to delay a loading screen, it's for subsequent navigations. Rather than _immediately_ transition from the current page to a new page's loading component, this setting lets us stay on the current page for a moment, in the hopes that the new page will be ready quickly enough that we don't have to show any pending component at all. Of course, on the initial load, when the web app first starts up, these pendingComponents do show immediately, as you'd expect.

Let's run our tasks page

![loaders running in parallel](/tanstack-router-loaders/img-0-tasks-page.jpg)

It's ugly and frankly useless, but it works. Now let's take a closer look.

### Loaders running in parallel

If we peak in our dev tools, we should see something like this

![loaders running in parallel](/tanstack-router-loaders/img-1-loaders-parallel.jpg)

As we can see, these requests started a mere millisecond apart from each other, since the loaders are running in parallel (each request takes at least 750ms, due to the artificial delay in the api endpoints).

#### Different routes using the same data

If we look at the loader for the `app/tasks/$taskId` route, and the loader to the `app/tasks/$taskId/edit` route, we see the same fetch call

```ts
const task = await fetchJson<Task>(`api/tasks/${taskId}`);
```

This makes sense since we need to load the actual task in order to display it, or in order to display it in a form for the user to make changes. Unfortunately though, if you click the edit button for any task, then go back to the tasks list (without saving anything), then click the edit button for the same task, you should notice the same exact data being requested. This makes sense. Both loaders happen to make the same fetch() call, and there's nothing in our client to cache the call. This is probably fine 99% of the time, but this is one of the many things react-query will improve for us, in a bit.

## Updating data

If you click the edit button for any task, you should be brought to a page with an extremely basic form that will let you edit the task's name. Once we click save, we want to navigate back to the tasks list, but most importantly, we need to tell Router that we've changed some data, and that it will need to invalidate some cached entries, and re-fetch when we go back to those routes. Here's the whole code

```ts
import { useRouter } from "@tanstack/react-router";

// ...

const router = useRouter();
const save = async () => {
  await postToApi("api/task/update", {
    id: task.id,
    title: newTitleEl.current!.value,
  });

  router.invalidate({
    filter: route => {
      return (
        route.routeId == "/app/tasks/" ||
        (route.routeId === "/app/tasks/$taskId/" && route.params.taskId === taskId) ||
        (route.routeId === "/app/tasks_/$taskId/edit" && route.params.taskId === taskId)
      );
    },
  });

  navigate({ to: "/app/tasks" });
};
```

Note the call to `router.invalidate`. This tells Router to mark any cached entries matching that filter as stale, causing us to re-fetch it the next time we browse to those paths. Here we invalidated the main tasks list, as well as the view, and edit pages for the individual task we just modified.

Now when we navigate back to the main tasks page we'll immediately see the prior, now-stale data, but new data will fetch, and update the UI when present. Recall that we can use `const { isFetching } = Route.useMatch();` to show an inline spinner while this fetch is happening.

If you'd prefer to completely remove the cache entries, and have the task page's "Loading" component show, then you can use `router.clearCache` instead, with the same exact api. That will _remove_ those cache entries completely, forcing Router to completely re-fetch them, and show the pending component. This is because there is no longer any stale data left in the cache; clearCache removed it.

There is one small caveat though: Router will prevent you from clearing the cache for the page you're on. That means we can't clear the cache for the edit task page, since we're sitting on it already.

Instead, you could do something like this

```ts
router.clearCache({
  filter: route => {
    return route.routeId == "/app/tasks/" || (route.routeId === "/app/tasks_/$taskId/edit" && route.params.taskId === taskId);
  },
});

router.invalidate({
  filter: route => {
    return route.routeId === "/app/tasks_/$taskId/edit" && route.params.taskId === taskId;
  },
});
```

but really, at this point you should probably be looking to use react-query, which we'll cover now.

## TanStack Query

TanStack Query, commonly referred to as react-query, is an incredibly good, incredibly popular tool for managing client-side querying. You could write an entire series of blog posts, or even a course on react-query; and people have.

The incredibly brief introduction for this post, to get us going, is that react-query allows us to write code like this

```ts
const { data, isLoading } = useQuery({
  queryKey: ["task", taskId],
  queryFn: async () => {
    return fetchJson("/api/tasks/" + taskId);
  },
  staleTime: 1000 * 60 * 2,
  gcTime: 1000 * 60 * 5,
});
```

The queryKey does what it sounds like, and lets you identify any particular key for a query. As the key changes, react-query is smart enough to re-run the query, which is contained in the `queryFn` property. As these queries come in, TanStack tracks them in a client-side cache, along with properties like `staleTime` and `gcTime`, which mean the same thing as they do in TanStack Router—these tools are built by the same people, after all.

There's also a `useSuspenseQuery` hook which is the same idea, except instead of giving you an isLoading value, it relies on Suspense, and let's you handle loading state via Suspense boundaries.

This all barely scratches the surface of Query. If you've never used it before, be sure to check out [the docs](https://tanstack.com/query/latest).

We'll move on and cover the setup, and integration with Router, but we'll stay high level to keep this post a manageable length.

## Setup

We need to wrap our entire app with a `QueryClientProvider` which injects a queryClient (and cache) into our application tree. Putting it around the `RouterProvider` we already have is as good a place as any.

```tsx
const queryClient = new QueryClient();

const Main: FC = () => {
  return (
    <>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} context={{ queryClient }} />
      </QueryClientProvider>
      <TanStackRouterDevtools router={router} />
    </>
  );
};
```

Recall from before that we also passed our queryClient to our Router's context

```ts
const router = createRouter({ routeTree, context: { queryClient } });
```

along with

```ts
type MyRouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Root,
});
```

This allows us access to the queryClient inside of our loader functions, via Router's cache. If you're wondering why we'd need loaders at all, now that we're using react-query, stay tuned.

## Querying

We used Router's built-in caching capabilities for our tasks. For our epics, let's use react-query. Moreover, let's use the `useSuspenseQuery` hooks, since managing loading state via Suspense boundaries is extremely ergonomic. Moreover, Suspense boundaries is exactly how Router's `pendingComponent` works. So you can use `useSuspenseQuery`, along with the same pendingComponent we looked at before!

Let's add another (contrived) summary query in our epics layout (route) component.

```tsx
export const Route = createFileRoute("/app/epics")({
  component: EpicLayout,
  pendingComponent: () => <div className="p-3 text-xl">Loading epics route ...</div>,
});

function EpicLayout() {
  const context = Route.useRouteContext();
  const { data } = useSuspenseQuery(epicsSummaryQueryOptions(context.timestarted));

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-2xl">Epics overview</h2>
      <div className="self-start inline-grid grid-cols-[auto_auto] gap-x-12 items-center p-3">
        {data.epicsOverview.map(epic => (
          <Fragment key={epic.name}>
            <div className="font-bold">{epic.name}</div>
            <div className="justify-self-end">{epic.count}</div>
          </Fragment>
        ))}
      </div>

      <div>
        <Outlet />
      </div>
    </div>
  );
}
```

To keep the code somewhat organized (and other reasons, we'll come to...) I stuck the query options into a separate place.

```ts
export const epicsSummaryQueryOptions = (timestarted: number) => ({
  queryKey: ["epics", "summary"],
  queryFn: async () => {
    const timeDifference = +new Date() - timestarted;

    console.log("Running api/epics/overview query at", timeDifference);
    const epicsOverview = await fetchJson<EpicOverview[]>("api/epics/overview");
    return { epicsOverview };
  },
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 5,
});
```

Nothing special. A query key, and function, and some cache settings. I'm passing in the timestarted value from context, so we can see when these queries fire, to detect waterfalls.

Let's look at the root epics page, now (with a few details removed for space).

```tsx
type SearchParams = {
  page: number;
};

export const Route = createFileRoute("/app/epics/")({
  validateSearch(search: Record<string, unknown>): SearchParams {
    return {
      page: parseInt(search.page as string, 10) || 1,
    };
  },
  loaderDeps: ({ search }) => {
    return { page: search.page };
  },
  component: Index,
  pendingComponent: () => <div className="p-3 text-xl">Loading epics ...</div>,
  pendingMinMs: 3000,
  pendingMs: 10,
});

function Index() {
  const context = Route.useRouteContext();
  const { page } = Route.useSearch();

  const { data: epicsData } = useSuspenseQuery(epicsQueryOptions(context.timestarted, page));
  const { data: epicsCount } = useSuspenseQuery(epicsCountQueryOptions(context.timestarted));

  return (
    <div className="p-3">
      <h3 className="text-2xl">Epics page!</h3>
      <h3 className="text-lg">There are {epicsCount.count} epics</h3>
      <div className={`inline-grid gap-x-8 gap-y-4 grid-cols-[auto_auto_auto] items-center p-3`}>
        {epicsData.map((e, idx) => (
          <Fragment key={idx}>
            <div>{e.name}</div>
          </Fragment>
        ))}
        <div className="flex gap-3">
          <Link to="/app/epics" search={{ page: page - 1 }} className="border p-1 rounded" disabled={page === 1}>
            Prev
          </Link>
          <Link to="/app/epics" search={{ page: page + 1 }} className="border p-1 rounded" disabled={!epicsData.length}>
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
```

Two queries on this page: one to get the list of (paged) epics, another to get the total count of all the epics. Let's run it

![loaders running in parallel](/tanstack-router-loaders/img-2-epics-rendered.jpg)

It's as silly as before, but it does show the three pieces of data we've fetched: the overview data we fetched in the epics layout; and then the count of epics, and the list of epics we loaded in the epics page, beneath that.

What's more, when we run this, we first see the the pending component for our root route. That resolves quickly, and shows the main navigation, along with the pending component for our epics route. That resolves, showing the epics data, and then revealing the pending component for our epics page, which eventually resolves and shows the list, and count of our epics.

Our component-level data fetching is working, and integrating, via Suspense, with the same Router pending components we already had. Very cool!

Let's take a peak at our console though, and look at all the various logging we've been doing, to track when these fetches happen

![loaders running in parallel](/tanstack-router-loaders/img-3-epics-waterfall.jpg)

The results are ... awful. Component-level data fetching with Suspense feels really good, but if you're not careful, these waterfalls are extremely easy to create. The problem is, when a component suspends while waiting for data, it prevents its children from rendering. This is precisely what's happening here. The route is suspending, and not even giving the child component, which includes the page (and any other nested route components underneath) from rendering, which prevents those components' fetches from starting.

There's two potential solutions here: we could dump Suspense, and use the `useQuery` hook, instead, which does not suspend. That would require us to manually track multiple isLoading states (for each useQuery hook), and coordinate loading UX to go with that. For the epics page, we'd need to track both the count loading state, and the epics list state, and not show our UI until both have returned. And so on, for every other page.

The other solution is to start pre-fetching these queries sooner.

We'll go with option 2.

### Prefetching

Remember previously we saw that loader functions all run in parallel. This is the perfect opportunity to start these queries off ahead of time, before the components even render. TanStack Query gives us an api to do just that.

To prefetch with Query, we take the `queryClient` object we saw before, and call `queryClient.prefetchQuery` and pass in **the exact same query options** and Query will be smart enough, when the component loads and executes `useSuspenseQuery`, to see that the query is already in flight, and just latch onto that same request. That's also a big reason why we put those query options into the `epicsSummaryQueryOptions` helper function: to make it easier to reuse in the loader, to prefetch.

Here's the loader we'll add to the epics route

```tsx
loader({ context }) {
  const queryClient = context.queryClient;
  queryClient.prefetchQuery(epicsSummaryQueryOptions(context.timestarted));
},
```

The loader receives the route tree's context, from which it grabs the queryClient. From there, we just call `prefetchQuery` and pass in the same options.

Let's move on to the Epics page. To review, this is the relevant code from our Epics page

```tsx
function Index() {
  const context = Route.useRouteContext();
  const { page } = Route.useSearch();

  const { data: epicsData } = useSuspenseQuery(epicsQueryOptions(context.timestarted, page));
  const { data: epicsCount } = useSuspenseQuery(epicsCountQueryOptions(context.timestarted));
```

We grab the current page, from the url, and we grab the context, so we can grab the timestarted value. Now let's do the same thing we just did, and repeat this code in the loader, and prefetch.

```ts
async loader({ context, deps }) {
  const queryClient = context.queryClient;

  queryClient.prefetchQuery(epicsQueryOptions(context.timestarted, deps.page));
  queryClient.prefetchQuery(epicsCountQueryOptions(context.timestarted));
},
```

And now when we check the console, we see something a lot nicer

![loaders running in parallel](/tanstack-router-loaders/img-4-waterfall-solved.jpg)

### Fetching state

What happens when we page up. The page value will change in the url, Router will send a new page value down into our loader, and our component. And then, our `useSuspenseQuery` will execute with new query values, and suspend again. That means our existing list of tasks will disappear, and show the "loading tasks" pending component. That would be a terrible UX.

Fortunately, React offers us a nice solution, with the `useDeferredValue` hook. The docs are [here](https://react.dev/reference/react/useDeferredValue), but this basically allows us to "defer" a state change. If a state change causes our deferred value causes the page to suspend, React will keep the existing UI in place, and the deferred value will simply hold the old value. Let's see it in action

```ts
function Index() {
  const { page } = Route.useSearch();
  const context = Route.useRouteContext();

  const deferredPage = useDeferredValue(page);
  const loading = page !== deferredPage;

  const { data: epicsData } = useSuspenseQuery(epicsQueryOptions(context.timestarted, deferredPage));
  const { data: epicsCount } = useSuspenseQuery(epicsCountQueryOptions(context.timestarted));
```

We just wrap the changing page value in `useDeferredValue`, and just like that, our page does not suspend when the new query is in flight. And to detect that a new query is running, we just compare the real, correct `page` value, with the `deferredPage` value. If they're different, we know new data are loading, and we can display a loading spinner (or in this case, put an opacity overlay on the epics list)

### Queries are re-used!

When using react-query for data management, we can now re-use the same query across different routes. Both the view epic, and edit epic pages need to fetch info on the epic the user is about to view, or edit. Now we can define those options in one place, like we have before

```ts
export const epicQueryOptions = (timestarted: number, id: string) => ({
  queryKey: ["epic", id],
  queryFn: async () => {
    const timeDifference = +new Date() - timestarted;

    console.log(`Loading api/epic/${id} data at`, timeDifference);
    const epic = await fetchJson<Epic>(`api/epics/${id}`);
    return epic;
  },
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 5,
});
```

use them in both routes, and have them be cached in between (assuming we set the caching values to allow that). You can try it in the demo app: view an epic, go back to the list, then edit the same epic (or vice versa). Only the first of those pages you visit should cause the fetch to happen in your network tab.

### Updating with react-query

Just like with tasks, with epics we have a page where we can edit an individual epic. Let's see what the saving logic looks like with react-query.

Let's quickly review the query _keys_ for the epics queries we've seen so far. For an individual epic, it was

```ts
export const epicQueryOptions = (timestarted: number, id: string) => ({
  queryKey: ["epic", id],
```

For the epics list, it was this

```ts
export const epicsQueryOptions = (timestarted: number, page: number) => ({
  queryKey: ["epics", "list", page],
```

the epics count

```ts
export const epicsCountQueryOptions = (timestarted: number) => ({
  queryKey: ["epics", "count"],
```

and finally, the epics overview

```ts
export const epicsSummaryQueryOptions = (timestarted: number) => ({
  queryKey: ["epics", "summary"],
```

Notice the patter: `epics` followed by various things for the queries that affected multiple epics, and for an individual epic, we did `['epic', ${epicId}]`. With that in mind, let's see just how easy it is to invalidate these queries after a mutation:

```ts
const save = async () => {
  setSaving(true);
  await postToApi("api/epic/update", {
    id: epic.id,
    name: newName.current!.value,
  });

  queryClient.removeQueries({ queryKey: ["epics"] });
  queryClient.removeQueries({ queryKey: ["epic", epicId] });

  navigate({ to: "/app/epics", search: { page: 1 } });

  setSaving(false);
};
```

the magic is on these lines

```ts
queryClient.removeQueries({ queryKey: ["epics"] });
queryClient.removeQueries({ queryKey: ["epic", epicId] });
```

With one fell sweep, we remove **all** cached entries for **any** query that _started with_ `epics`, or started with `['epic', ${epicId}]`, and Query will handle the rest. Now, when we navigate back to the epics page (or any page that used these queries), we'll see the suspense boundary show, while fresh data are loaded. If you'd prefer to keep stale data on the screen, while the fresh data load, that's fine too: just use `queryClient.invalidateQueries` instead. If you'd like to detect if a query is re-fetching in the background, so you can display an inline spinner, use the `isFetching` property returned from `useSuspenseQuery`

```ts
const { data: epicsData, isFetching } = useSuspenseQuery(epicsQueryOptions(context.timestarted, deferredPage));
```

### Odds and ends

We've gone pretty deep on TanStack Route and Query. Let's take a look at one last trick. If you recall, we saw that pending components ship a related `pendingMinMs` that forced a pending component to stay on the page a minimum amount of time, even if the data were ready. This was to avoid a jarring flash of a loading state. We also saw that TanStack Router uses Suspense to show those pending components, which means that react-query's `useSuspenseQuery` will seamlessly integrate with it. Well, almost seamlessly. Router can only use the `pendingMinMs` value based on the promise we return from the Router's loader. But now we don't really return any promise from the loader; we prefetch some stuff, and rely on component-level data fetching to do the real work.

Well there's nothing stopping you from doing both! Right now our loader looks like this

```ts
async loader({ context, deps }) {
  const queryClient = context.queryClient;

  queryClient.prefetchQuery(epicsQueryOptions(context.timestarted, deps.page));
  queryClient.prefetchQuery(epicsCountQueryOptions(context.timestarted));
},
```

Query also ships with a `queryClient.ensureQueryData` method, which can load query data, and return a promise for that request. Let's put it to good use so we can use `pendingMinMs` again.

One thing you do _not_ want to do is

```ts
await queryClient.ensureQueryData(epicsQueryOptions(context.timestarted, deps.page)),
await queryClient.ensureQueryData(epicsCountQueryOptions(context.timestarted)),
```

since that will block on each request, serially. In other words, a waterfall. Instead, to kick off both requests immediately, and wait on them in the loader (without a waterfall), you can do this

```ts
await Promise.allSettled([
  queryClient.ensureQueryData(epicsQueryOptions(context.timestarted, deps.page)),
  queryClient.ensureQueryData(epicsCountQueryOptions(context.timestarted)),
]);
```

Which works, and keeps the pending component on the screen for the duration of `pendingMinMs`

You won't always, or even usually need to do this. But it's handy for when you do

## Wrapping up

This has been a whirlwind route of TanStack Router, and Query, but hopefully not an overwhelming one. These tools are incredibly powerful, and offer the ability to do just about anything. I hope this post will help some people put them to good use!
