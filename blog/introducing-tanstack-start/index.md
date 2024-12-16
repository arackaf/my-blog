---
title: Introducing TanStack Start
date: "2024-12-15T20:00:32.169Z"
description: An Introduction to TanStack Start
---

This is a post I've been looking forward to writing for a long time; it's also an incredibly difficult post to write. The best way to think about TanStack Start is that it's nothing more than a server layer atop the TanStack Router that already exists (and is amazing). Not only that, but the thin nature of this server layer means that it completely side-steps the many pain points other web meta-frameworks suffer from.

The primary goal (and challenge) of this post will be to show why a server layer on top of a JavaScript router is valuable, and _why_ TanStack Start's implementation is unique compared to the alternatives, and why that's a good thing. From there, showing how TanStack Start actually works will be relatively straightforward. Wish me luck!

## Why Server Render?

Client-rendered web applications, frequently called "Single Page Applications" or "SPAs" were popular for a long time, and actually still are. "SPA" was never defined precisely, and there's actually some disagreement over what the term means, precisely, but however you define it, the type of app I'm describing is one that's fully client rendered. The server sends down an essentially empty html page, with some script tags that load your framework of choice (React, Vue, Svelte, etc), along with all your application logic.

These apps were always fun to build, and in spite of the hate they often get, they (usually) worked just fine (any kind of software can be bad). But they did suffer from one glaring disadvantge: initial render performance. Remember, the initial render of the page was just an empty shell of your app. This displayed while your script files loaded and executed, and once _those_ scripts run, your application code will almost certainly need to request data before your actual app can display. Under the covers, your app is doing something along the lines of this

![CSR Flow](/introducing-tanstack-start/csr-perf-flow.png)

The initial render of the page, from the web server, renders only an empty shell of your application. Then some scripts are requested, and then parsed and executed once loaded. When those application scripts run, you'll (probably) send some other requests for data. Once _that_ is done, your page will display.

To put it more succintly, with client-rendered web apps, when the user first loads your app, they'll just get a loading spinner. Make your company's logo above it, if they're lucky.

![CSR Flow](/introducing-tanstack-start/csr-user.png)

This is perhaps an overstatement. Users may not even notice the delay caused by these scripts loading (which are likely cached), or hydration, which is probably fast. Depending on the speed of their network, and the type of application, this stuff might not matter much. Maybe.

### SSR

With SSR, the picture looks more like this

![SSR Flow](/introducing-tanstack-start/ssr-render.png)

The server sends down the complete, finished page that the user can see immediately. We do still need to load our scripts and hydrate, so our page can be _interactive_. But that's usually fast, and the user will still have content to see while that happens.

Our hypothetical user looks more like this, now, since the server is responding with a full page the user can see.

![SSR User](/introducing-tanstack-start/ssr-user.png)

### Streaming

We made one implicit assumption above: that our data was fast. If our data was slow to load, our server would be slow to respond. It's bad for the user to be stick looking at a loading spinner, but it's even worse for the user to be looking at a blank screen while the server churns.

As a solution for this, we can use something called "streaming," or "out of order streaming" to be extra precise. Basically, the user still requests all the data, as before. But we tell our server "don't wait for this/these data which are slow - render everything else, now, and send that slow data to the browser when it's ready."

All modern meta-frameworks support this, and our picture now looks like this

![SSR User](/introducing-tanstack-start/ssr-streaming-user.png)

To put a finer point on it, the server does still initiate the request for our slow data _immediately_ on the initial render. It just doesn't block the initial render on it, and instead _pushes down_ the data when ready. We'll look at streaming with Start later in this post.

### Why did we ever do client-rendering?

I'm not here to tear down client-rendered apps. They were, and frankly _still are_ an incredible way to ship deeply interactive user experiences with JavaScript frameworks like React and Vue. The fact of the matter is, server rendering a web app built with React was tricky to get right. You not only needed to server render and send down the html for the url the user requested, but also send down the data for that page, and hydrate everything _just right_ on the client.

It's hard to get right. But here's the thing: **getting this right is the entire purpose of this new generation of meta-frameworks**. Next, Nuxt, Remix, SvelteKit, and SolidStart are some of the more famous examples of these meta-frameworks. And now TanStack Start.

## Why is TanStack Start different?

Why do we need a new meta-framework? There's many possible answers to that question, but I'll give mine. Existing meta-frameworks suffer from some variation on the same issue. They'll provide some server mechanism to load data (on the server). This mechanism is often called a "loader," or in the case of Next, it's just RSCs. Or in Next's pages directory, it's the `getServerSideProps` function. The specifics don't matter. What matters is, for each route, whether the initial load of the page, or client-side navigation via links, some server-side code will run, send down the data, and then render the new page.

### An Impedence Mismatch is Born

Notice the two worlds that exist: the server, where these data loading code will always run, and the client. These frameworks always provide some mechanism to mutate data, and then reload things to show the updated state to your user. Imagine your loader for a page loads some tasks, user settings, and announcements. When the user edits a task, and revalidates, these frameworks will almost always re-run the entire loader, and superfluously re-load the user's announcements and user settings, in addition to tasks, even though tasks are the only thing that changes.

Are there fixes? Of course. Many of these frameworks will allow you to create extra loaders, spread the data loading across them, and revalidate only some of those loaders. Other frameworks encourage you to cache these data. These solutions all work, but come with their own tradeoffs. And remember, they're solutions to a problem that meta-frameworks created, but having server-side loading code for every path in your app.

You might think using a component-level data loading solution like react-query can solve these problems. react-query is great, but it doesn't eliminate these problems. If you have two different pages that each have 5 data sources, of which 4 are shared in common, browsing from the first page to the second will indeed cause the second page to request all 5 pieces of data, even though 4 of them are already present in client-side state. The server is unaware of what happens to exist on the client. The server is not keeping track of what state you have in your browser; in fact the "server" might just be a Lambda function that spins up, satisfies your request, and then dies off.

### Where to, from here?

The root problem is that these meta-frameworks inevitably server-only code running on each path, integrating with long-running client-side state. This leads to conflicts and inefficiencies which need to be managed. There's ways of handling these things, which I touched on above. But it's not a completely clean fit. So what makes TanStack Start different, here?

### Isomorphic loaders

In TanStack, we do have loaders. These are defined by TanStack Router. I wrote a three-part series on Router [here](https://frontendmasters.com/blog/introducing-tanstack-router/). If you haven't read that, and aren't familiar with Router, give it a quick look, since nothing will make sense here without that.

Start takes what we already have with Router, and adds server handling to it. On the initial load, your loader will run on the server, load your data, and send it down. On all subsequent client-side navigations, your loader will run on the client, like it already does. If you like react-query, you'll be happy to know that's integrated too. Your react-query client can run on the server to load, and send data down. On subsequent navigations, these loaders will run on the client, which means your react-query queryClient will have full access to the client-side cache, and will know what does not need to be loaded.

It's honestly such a refreshing, simple, and most importantly, effective pattern that it's hard not being annoyed none of the other frameworks thought of it first. Admittedly, SvelteKit does have universal loaders which are isomorphic in the same way, but without a component-level query library like react-query integrated with the server piece.

## TanStack Start

Enough setup, let's look at some code. TanStack Start is still in beta, so some of the setup is still a bit manual, for now.

The repo for this post [is here](https://github.com/arackaf/tanstack-start-blog-dataloading).

If you'd like to set something up yourself, the getting started guide [is here](https://tanstack.com/router/latest/docs/framework/react/start/getting-started). If you'd like to use react-query, be sure to add the library for that. You can see an example of that [here](https://github.com/TanStack/router/blob/main/examples%2Freact%2Fstart-basic-react-query%2Fapp%2Frouter.tsx). Depending on when you read this, there might be a cli to do all of this for you.

This post will continue to use the same code I used in my [prior posts](https://frontendmasters.com/blog/introducing-tanstack-router/) on TanStack Route. I basically set up a new Start project, copied over all the route code, and tweaked a few import paths (since the default Start project has a slightly different folder structure). I also removed all of the artificial delays, unless otherwise noted. I want our data to be fast by default, and slow in a few places where we'll use streaming to manage the slowness.

### Loading data

All of the routes, and loaders we set up with Router are still valid. Start sits on top of Router, and adds server processing. Our loaders will execute on the server for the first load of the page, and then the client as the user browses. But there's a small problem. While the server environment these loaders will execute in does indeed have a `fetch` function defined, in reality there are significant differences between client-side fetch, and server-side fetch—for example, cookies, fetching to relative paths.

To solve for this, Start lets you define a server function. Server functions can be called from the browser, or from the server, but the server function itself always executes on the server. You can define a server function in the same file as your route, or in a separate file; if you do the former, TanStack will do the work of ensuring that server-only code does not ever exist in your client bundle.

Let's define a server function to load our tasks, and then call it from the tasks loader.

```ts
import { getCookie } from "vinxi/http";
import { createServerFn } from "@tanstack/start";
import { Task } from "../../types";

export const getTasksList = createServerFn({ method: "GET" }).handler(async () => {
  const result = getCookie("user");

  return fetch(`http://localhost:3000/api/tasks`, { method: "GET", headers: { Cookie: "user=" + result } })
    .then(resp => resp.json())
    .then(res => res as Task[]);
});
```

We have access to a `getCookie` utility from the vinxi library on which Start is built. Server functions actually provide a lot more functionality than this simple example shows. Be sure to check out [the docs](https://tanstack.com/router/latest/docs/framework/react/start/server-functions) to learn more.

And now we can just _call it_ from our loader

```ts
loader: async ({ context }) => {
    const now = +new Date();
    console.log(`/tasks/index path loader. Loading tasks at + ${now - context.timestarted}ms since start`);
    const tasks = await getTasksList();
    return { tasks };
  },
```

that's all there is to it. It's almost anti-climactic. The page loads, as it did in the last post. Except now it server renders. You can shut JavaScript off, and the page will still load and dispaly (and hyperlinks will still work, of course).

![Tasks page](/introducing-tanstack-start/tasks-page.png)

### Streaming

Let's make the individual task loading slow (we'll just keep the delay that was already in there), so we can see how we can stream it in. Here's our server function to load a single task

```ts
export const getTask = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data }) => {
    return fetch(`http://localhost:3000/api/tasks/${data}`, { method: "GET" })
      .then(resp => resp.json())
      .then(res => res as Task);
  });
```

Note the `validator` which is how we can strongly type our server function (and validate the inputs). But otherwise it's more of the same.

Now let's call it in our loader, and see about enabling streaming

Here's our loader

```ts
  loader: async ({ params, context }) => {
    const { taskId } = params;

    if (taskId == "22") {
      throw new Error("I don't want to");
    }
    const now = +new Date();
    console.log(`/tasks/${taskId} path loader. Loading at + ${now - context.timestarted}ms since start`);
    const task = getTask({ data: taskId });

    return { task };
  },
```

Did you catch it? We called `getTask` **without** awaiting it. That means task is just a promise, which Start and Router allows us to return from our loader (ideally we should maybe name it taskPromise or similar).

But how do we consume this promise, show loading state, and `await` the real value. There's two ways. TanStack Router defines and [Await](https://tanstack.com/router/latest/docs/framework/react/api/router/awaitComponent#await-component) component for just this purpose. But if you're using React 19, you can use the new `use` psuedo-hook

```ts
function TaskView() {
  const { task: taskPromise } = Route.useLoaderData();
  const { isFetching } = Route.useMatch();

  const task = use(taskPromise);

  return (
    <div className="flex flex-col gap-4 p-3">
      <Link to="/app/tasks">Back to tasks list</Link>
      <div className="flex flex-col gap-2">
        <div>
          Task {task.id} {isFetching ? "Loading ..." : null}
        </div>
        <h1 className="text-lg">{task.title}</h1>
        <Link className="text-blue-500 underline" to="/app/tasks/$taskId/edit" params={{ taskId: task.id }}>
          Edit
        </Link>
        <div />
      </div>
    </div>
  );
}
```

Use will cause this component to suspend, which will show the nearest Suspense boundary in the tree. Fortunately, the `pendingComponent` you set up in Router also doubles as a Suspense boundary. TanStack is impressively well integrated with modern React features.

Now when we load an individual task's page, we'll first see the overview data which loaded quickly, and server rendered, above the Suspense boundary for the task data we're streaming

![Tasks streaming](/introducing-tanstack-start/streaming-tasks.png)

When the task data come in, the promise will resolve, the server will push the data down, and our use call can provide data for our component.

![Tasks streaming finish](/introducing-tanstack-start/streaming-tasks-finish.png)

## React Query

As before, let's integrate react-query. And as before, there's not much for us to do. Since we integrated the `@tanstack/react-router-with-query` package when we started, our queryClient will be available on the server, and will sync up with the queryClient on the client, and put data (or in-flight streamed promises) into cache.

Let's start with our main epics page. Our loader looked like this before

```ts
  async loader({ context, deps }) {
    const queryClient = context.queryClient;

    queryClient.ensureQueryData(epicsQueryOptions(context.timestarted, deps.page));
    queryClient.ensureQueryData(epicsCountQueryOptions(context.timestarted));
  }
```

That would kick off the requests on the server, but let the page render, and then suspend in the component that called `useSuspenseQuery`—what we've been calling streaming.

Let's change it to actually load our data in our loader, and server render the page instead. The change couldn't be simpler

```ts
async loader({ context, deps }) {
  const queryClient = context.queryClient;

  await Promise.allSettled([
    queryClient.ensureQueryData(epicsQueryOptions(context.timestarted, deps.page)),
    queryClient.ensureQueryData(epicsCountQueryOptions(context.timestarted)),
  ]);
},
```

We just await the calls. Make sure you don't just sequentially await each individual call; that would create a waterfall. And be sure to use `Promise.allSettled`, rather than `Promise.all`, since the latter will quit immediately if any of the promises error out.

### Streaming with react-query

As I implied above, to stream data with react-query, just do the exact same thing, but don't await the promise. Let's do that for the page for viewing an individual epic.

```ts
loader: ({ context, params }) => {
  const { queryClient, timestarted } = context;

  queryClient.ensureQueryData(epicQueryOptions(timestarted, params.epicId));
},
```

And now if this page is loaded initially, the query for this data will start on the server, and stream to the client. If the data are pending, our suspense boundary will show, triggered automatically by react-query's `useSuspenseBoundary` hook.

If the user browses to this page, the loader will instead run on the client, and fetch those same data from the server, and trigger the same suspense boundary.

## Parting thoughts

I hope this post was useful to you. It wasn't a deep dive into TanStack Start; the docs (or an online course, which is bound to exist before long) is a better venue for that. Instead I hope I was able to show why server rendering can offer almost any web app performance boost, and why TanStack Start is a superb tool for doing so. Not only does it simplify a great deal of things by running loaders isomorphically, but it even integrates wonderfully with react-query.

The react-query integration is especially exciting to me. It delivers component-level data fetching while still allowing for server fetching, streaming, all without sacrificing one bit of convenience. It's genuinely the best of all worlds, and a better solution than I've seen anywhere else.
