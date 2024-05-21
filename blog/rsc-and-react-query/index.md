---
title: Combining RSC with react-query for easy data management
date: "2024-05-21T10:00:00.000Z"
description: An introduction to RSC and react-query
---

React Server Components (RSC) are an incredibly exciting innovation in web development. For this post we'll briefly introduce them, show what their purpose and benefits are, as well as their limitations. We'll wrap up by showing how to pair them with react-query to help solve those limitations. Let's get started!

## Why RSC?

React Server Components, as the name implies, execute **on the server**—and the server **alone**. To see why this is significant, let's take a whirlwind tour of how web development evolved over the last 10 or so years.

Prior to RSC, JavaScript frameworks (React, Svelte, Vue, Solid, etc) prodivded you with a component model for building your application. These components were capable of _running on_ the server, but only as a synchronous operation for stringifying your components' html, to send down to the browser so it could server render your app. Your app would then render in the browser, again, at which point it would become interactive. With this model, the only way to load data was as a side-effect on the client. Waiting until your app reached your user's browser before beginning to load data was slow, and inefficient.

To solve this inefficiency, meta-frameworks like Next, SvelteKit, Remix, Nuxt, SolidStart, etc were created. These meta-frameworks provided various ways to load data, server-side, with that data being injected by the meta-framework into your component tree. This code was non-portable, and usually a little awkward. You'd have to define some sort of loader function that was associated with a given route, load data, and then expect it to show up in your component tree based on the rules of whatever meta-framework you're using.

This worked, but it wasn't without issue. In addition to being framework-specific, composition also suffered; where typically components are explicitly passed props by whichever component renders them, now there are _implicit_ props passed by the meta-framework, based on what you return from your loader. Lastly, this setup wasn't the most flexible. A given page needs to know what data it needs up front, and request it all from the loader. With client-rendered SPAs we could just render whatever components we need, and let them fetch whatever data they need. This was awful for performance, but amazing for convenience.

RSC bridges that gap and gives us the best of both worlds. We get to _ad hoc_ request whatever data we need from whichever component we're rendering, but have that code execute on the server, without needing to wait for a round trip to the browser. Best of all, RSC also support _streaming_, or more precisely, out-of-order streaming. If some of our data are slow to load, we can send the rest of the page, and _push_ those data down to the browser, from the server, whenever they happen to be ready.

## How do I use them?

At time of writing RSC are mostly only supported in Next.js, although the minimal framework [Waku](https://waku.gg/) also supports it. Remix and TanStack Router are currently working on implementations, so stay tuned. I'll show a very brief overview of what they look like in Next; consult those other frameworks when they ship (the ideas will be the same, even if the implementations differ slightly).

In Next, when using the new "app directory" (it's literally a folder called "app" that you define your various routes in), pages are RSC by default. Any components imported by these pages are also RSC, as well as components imported by those components, and so on. When you're ready to exit server components and switch to "client components," you put the `"use client"` pragma at the top of a component. Now that component, and everything that component imports are client components. Check the [Next docs](https://nextjs.org/docs/app) for more info.

### How do React Server Components work?

React Server Components are just like regular React Components, but with a few differences. For starters, they can be async functions. The fact that you can await asynchronous operations right in the comopnent makes them well suited for requesting data. Note that asynchronous client components are a thing coming soon to React, so this differentiation won't exist for too long. The other big difference is that these components run _only on_ the server. Client components (ie regular components) run on the server, and then re-run on the client in order to "hydrate." That's how frameworks like Next and Remix have always worked. But server components run only on the server.

Server components have no hydration, since they only execute on the server. That means you can do things like connect directly to a database, or use Server-only api's. But it also means there are many things you can't do in RSCs: you cannot use effects or state, you cannot set up event handlers, or use browser-specific api's like Localstorage. If you violate any of those rules you'll get errors.

For a more thorough introduction to RSC, check the [Next docs](https://nextjs.org/docs/app) for the app directory, or depending on when you read this, the Remix or TanStack Router docs. But to keep this post a reasonable length, let's keep the details in the docs, and see how we use them.

Let's put together a very basic proof of concept demo app with RSC, see how data mutations work, and some of their limitations. We'll then take that same app (still using RSC) and see how it looks with react-query.

## The demo app

As I've done before, let's put together a very basic, very ugly web page for searching some books, and also updating the titles of them. We'll also show some other data on this page: the various subjects, and tags we have, which in theory we could apply to our books (if this were a real web app, instead of a demo).

The point is to show how RSC and react-query work, not make anything useful or beautiful, so temper your expectations :) Here's what it looks like

![Book page](/rsc-and-react-query/web-page.jpg)

The page has a search input which puts our search term into the url to filter the books shown. Each book also has an input attached to it for us to update that book's title. You'll note the nav links at the top, for the RSC and RSC + react-query versions. While the pages look and behave identically as far as the user can see, the implementations are different, which we'll get into.

The repo is [here](https://github.com/arackaf/react-query-rsc-blog-post). The data are all static, but the books are put into a SQLite database, so we can update the data. The binary for the SQLite db should be checked in, but you can always re-created it (and reset any updates you've made) by running `npm run create-db`.

Let's dive in

## A note on caching

At time of writing, Next is just about to release a new version with radically different caching api's, and defaults. We won't cover any of that for this post. For the demo, I've disabled all caching. Each call to a page, or api endpoint will always run fresh from the server. The client cache will still work, though. So if you click between the two pages, Next will cache and display what you just saw. But refreshing the page will always recreate everything from the server.

## Loading the data

There's api endpoints inside of the api folder for loading data, and for updating the books. I've added artifical delays of a few hundred ms for each of these endpoints, since they're either loading static data, or running simple queries from SQLite. There's also console logging for these data, so you can see what's loading, when. This will be useful in a bit.

Here's what the terminal console shows for a typical page load in either the RSC or RSC + react-query version.

![Loading logs](/rsc-and-react-query/loading-logs.jpg)

Let's look at the RSC version

## RSC Version

```jsx
export default function RSC(props: { searchParams: any }) {
  const search = props.searchParams.search || "";

  return (
    <section className="p-5">
      <h1 className="text-lg leading-none font-bold">Books page in RSC</h1>
      <Suspense fallback={<h1>Loading...</h1>}>
        <div className="flex flex-col gap-2 p-5">
          <BookSearchForm />
          <div className="flex">
            <div className="flex-[2] min-w-0">
              <Books search={search} />
            </div>
            <div className="flex-1 flex flex-col gap-8">
              <Subjects />
              <Tags />
            </div>
          </div>
        </div>
      </Suspense>
    </section>
  );
}
```

We have a simple page header. Then we see a Suspense boundary. This is how out-of-order streaming works with Next and RSC. Everything above the Suspense boundary will render immediately, and the `Loading...` message will show until all the various data in the various components below have finished. React knows what's pending based on what you've awaited. The `Books`, `Subjects` and `Tags` components all have fetches inside of them, which are awaited. We'll look at one of them momentarily, but first note that, even though three different components are all requesting data, React will run them in parallel. Sibling nodes in the component tree can, and do load data in parallel.

But if you ever have a parent / child component which both load data, then the child component will not (cannot) even start util the parent is finished loading. If the child data fetch depends on the parent's loaded data, then this is unavoidable (you'd have to modify your backend to fix it), but if the data do not depend on each other, then you would solve this waterfall by just loading the data higher up in the component tree, and passing the various pieces down.

### Loading data

Let's see the Books component

```jsx
import { FC } from "react";
import { BooksList } from "../components/BooksList";
import { BookEdit } from "../components/BookEditRSC";

export const Books: FC<{ search: string }> = async ({ search }) => {
  const booksResp = await fetch(`http://localhost:3000/api/books?search=${search}`, {
    next: {
      tags: ["books-query"],
    },
  });
  const { books } = await booksResp.json();

  return (
    <div>
      <BooksList books={books} BookEdit={BookEdit} />
    </div>
  );
};
```

We fetch and await our data right in the component! This was completely impossible before RSC. We then then pass it down into the `BooksList` component. I separated this out so I could re-use the main BookList component with both versions. The `BookEdit` prop I'm passing in is a React component that renders the textbox to update the title, and performs the update. This will differ between the RSC, and react-query version. More on that in a bit.

The `next` property in the fetch is Next-specific, and will be used to invalidate our data in just a moment. The experienced Next devs might spot a problem here, which we'll get into very soon.

### So you've loaded data, now what?

We have a page with three different RSCs which load, and render data. Now what? If our page was just static content we'd be done. We loaded data, and displayed it. If that's your use case, you're done. RSC are perfect for you, and you won't need the rest of this post.

But what if you want to let your user interact with, and update your data?

## Updating your data with Server Actions

To mutate data with RSC you use something called [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations). Check the docs for specifics, but here's what our server action looks like

```ts
"use server";

import { revalidateTag } from "next/cache";

export const saveBook = async (id: number, title: string) => {
  await fetch("http://localhost:3000/api/books/update", {
    method: "POST",
    body: JSON.stringify({
      id,
      title,
    }),
  });
  revalidateTag("books-query");
};
```

Note the `"use server"` pragma at the top. That means the function we export is now a server action. `saveBook` takes an id, and a title; it posts to an endpoint to update our book in SQLite, and then calls `revalidateTag` with the same tag we passed to our fetch before.

In real life, we wouldn't even need the books/update endpoint. We'd just do the work right in the server action. But we'll be re-using that books/update endpoint in a bit, when we update data without server actions. And it's nice to keep these code samples clean. The books/update endpoint just opens up SQLite, and executes an UPDATE.

Let's see the BookEdit component we use with RSC

```jsx
"use client";

import { FC, useRef, useTransition } from "react";
import { saveBook } from "../serverActions";
import { BookEditProps } from "../types";

export const BookEdit: FC<BookEditProps> = (props) => {
  const { book } = props;
  const titleRef = useRef<HTMLInputElement>(null);
  const [saving, startSaving] = useTransition();

  function doSave() {
    startSaving(async () => {
      await saveBook(book.id, titleRef.current!.value);
    });
  }

  return (
    <div className="flex gap-2">
      <input className="border rounded border-gray-600 p-1" ref={titleRef} defaultValue={book.title} />
      <button className="rounded border border-gray-600 p-1 bg-blue-300" disabled={saving} onClick={doSave}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
};
```

It's a client component. We import the server action, and then just call it in a button's event handler, wrapped in a transiotion so we can have saving state.

Stop and consider just how radical this is, and what React and Next are doing under the covers. All we did was create a vanilla function. We then imported that function, and called it from a button's event handler. But under the covers a network request is made to an endpoint that's synthesized for us. And then the `revalidateTag` tells Next what's changed, so our RSC can re-run, re-request data, and send down updated markup.

Not only that, but all this happens in **one round trip** with the server.

This is an incredible engineering achievement, and it works! If you update one of the titles, and click save, you'll see updated data show up in a moment (the update has an artificial delay since we're only updating in a local SQLite instance)

![Update](/rsc-and-react-query/update-data.jpg)

### What's the catch?

This seems too good to be true. What's the catch? Well, let's see what the terminal shows when we update a book

![Server Action](/rsc-and-react-query/server-action.jpg)

Ummmm, why are _all_ of our data re-loading? We only called `revalidateTag` on our books, not our subjects or tags. The problem is that `revalidateTag` doesn't tell Next what to reload, it tells it what to eject from its cache. The fact is, Next needs to reload everything for the current page when we call `revalidateTag`. This makes sense when you think about what's really happening. These server components are not stateful; they run on the server, but they don't _live_ on the server. The request executes on our server, those RSCs render, and send down the markup, and that's that. The component tree does not live on indefinitely on the server; our servers wouldn't scale very well if they did!

So how do we solve this? For a use case like this, the solution would be to _not_ turn off caching. We'd lean on Next's caching mechanism, whatever they look like when you happen to read this. We'd cache each of these data with different tags, and invalidate the tag related to the data we just updated.

The whole RSC tree will still re-render when we do that, but the requests for cached data would run quickly. Personally, I'm of the view that caching should be a performance tweak you add, as needed; it should not be a _sine qua non_ for avoiding slow updates.

Unfortunately there's yet another problem with server actions: they run serially. Only one server action can be in flight at a time; they'll queue if you try to violate this contraint.

This sounds genuinely unbelievable; but it's true. If we artificially slow down our update a LOT, and then quickly click 5 different save buttons, we'll see horrifying things in our network tab. If the extreme slowdown on the update endpoint seems unfair on my part, remember: you should never, _ever_ assume your network will be fast, or even reliable. Occasional, slow network requests are inevitable, and server actions will do the worst possible thing under those circumstances.

![Serial Server Action](/rsc-and-react-query/serial-execution.jpg)

This is a known issue, and will presumably be fixed at some point. But the re-loading without caching issue is unavoidable with how Next app directory is designed.

Just to be clear, server actions are still, even with these limitations, outstanding (for some use cases). If you have a web page with a form, and a submit button, server actions are **outstanding**. None of these limitations will matter (assuming your form doesn't depend on a bunch of different data sources). In fact, server actions go especially well with forms. You can even set the "action" of a form (in Next) directly to a server action. See [the docs](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) for more info, as well as on related hooks, like [useFormStatus hook](https://react.dev/reference/react-dom/hooks/useFormStatus).

But back to our app. We don't have a page with a single form and no data sources. We have lots of little forms, on a page with lots of data sources. Server actions won't work well here, so let's see an alternative.

## react-query

[React Query](https://tanstack.com/query/latest/docs/framework/react/overview) is probably the most mature, well-maintained data management library in the React ecosystem. Unsurprisngly, it also works well with RSC.

To use react-query we'll need to install two packages: `npm i @tanstack/react-query @tanstack/react-query-next-experimental`. Don't let the experimental in the name scare you; it's been out for awhile, and works well.

Now we'll make a `Providers` component, and render it from our root layout

```jsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import { FC, PropsWithChildren, useEffect, useState } from "react";

export const Providers: FC<PropsWithChildren<{}>> = ({ children }) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryStreamedHydration>{children}</ReactQueryStreamedHydration>
    </QueryClientProvider>
  );
};
```

Now we're ready to go.

### Loading data with react-query

The long and short of it is that we use the `useSuspenseQuery` hook from inside client components. Let's see some code. Here's the Books component from the react-query version of our app.

```jsx
"use client";

import { FC } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BooksList } from "../components/BooksList";
import { BookEdit } from "../components/BookEditReactQuery";
import { useSearchParams } from "next/navigation";

export const Books: FC<{}> = () => {
  const params = useSearchParams();
  const search = params.get("search") ?? "";

  const { data } = useSuspenseQuery({
    queryKey: ["books-query", search],
    queryFn: async () => {
      const booksResp = await fetch(`http://localhost:3000/api/books?search=${search}`);
      const { books } = await booksResp.json();

      return { books };
    },
  });

  const { books } = data;

  return (
    <div>
      <BooksList books={books} BookEdit={BookEdit} />
    </div>
  );
};
```

Don't let the `"use client"` pragma fool you. This component still renders on the server, **and that fetch also happens on the server** during the initial load of the page.

As the url changes, the `useSearchParams` result changes, and a new query is fired off by our `useSuspenseQuery` hook, _from the browser_. This would normally suspend the page, but I wrap the call to `router.push` in `startTransition`, so the existing content stays on the screen. Check the repo for details.

### Updating data with react-query

We already have the `/books/update` endpoint for updating a book. How do we tell react-query to re-run whichever queries were attached to that data? The answer is the `queryClient.invalidateQueries` api. Let's take a look at the `BookEdit` component for react-query

```jsx
"use client";

import { FC, useRef, useTransition } from "react";
import { BookEditProps } from "../types";
import { useQueryClient } from "@tanstack/react-query";

export const BookEdit: FC<BookEditProps> = (props) => {
  const { book } = props;
  const titleRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [saving, startSaving] = useTransition();

  const saveBook = async (id: number, newTitle: string) => {
    startSaving(async () => {
      await fetch("/api/books/update", {
        method: "POST",
        body: JSON.stringify({
          id,
          title: newTitle,
        }),
      });

      await queryClient.invalidateQueries({ queryKey: ["books-query"] });
    });
  };

  return (
    <div className="flex gap-2">
      <input className="border rounded border-gray-600 p-1" ref={titleRef} defaultValue={book.title} />
      <button className="rounded border border-gray-600 p-1 bg-blue-300" disabled={saving} onClick={() => saveBook(book.id, titleRef.current!.value)}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
};
```

The saveBook function calls out to the same book updating endpoint as before. We then call `invalidateQueries` with the first part of the query key, `books-query`. Remember, the actual queryKey we used in our query hook was `queryKey: ["books-query", search]`. Calling invalidate queries with the first piece of that key will invalidate everything that's _starts with_ that key, and will immediately re-fire any of those queries which are still on the page. So if you started out with an empty search, then searched for X, then Y, then Z, and updated a book, this code will clear the cache of all those entries, and then immediately re-run the Z query, and update our UI.

And it works.

### What's the catch?

The downside here is that we need two roundtrips from the browser to the server. The first roundtrip updates our book, and when that finishes, we then, from the browser, call `invalidateQueries`, which causes react-query to send a new network request for the updated data.

This is a surprisingly small price to pay. Remember, with server actions, calling `revalidateTag` will cause your entire component tree to re-render, which by extension will re-request all their various data. If you don't have everything cached (on the server) properly, it's very easy for this single round trip to take longer than the two round trips react-query needs. I say this from experience. I recently helped a friend / founder build a financial dashboard app. I had react-query set up just like this, and also implemented a server action to update a piece of data. And I had the same data rendered, and updated twice: once in an RSC, and again adjacently in a client component from a `useSuspenseQuery` hook. I basically fired off a race to see which would update first, certain the server action would, but was _shocked_ to see react-query win. I initially thought I'd done something wrong until I realized what was happening (and hastened to roll back my server action work).

## Playing on hard mode

There's one obnoxious imperfection hiding. Let's find it, and fix it.

### Fixing routing when using react-query

Remember, when we search our books, I'm calling `router.push` which adds a querystring to the url, which causes `useSearchParams()` to update, which causes react-query to query new data. Let's look at the network tab when this happens.

![Query parameter change waterfall](/rsc-and-react-query/react-query-param-change-waterfall.jpg)

before our books endpoint can be called, it looks like we have other things happening. This is the navigation we caused when we called `router.push`. Next is basically rendering to a new page. The page we're already on, except with a new querystring. Next is right to assume it needs to do this, but in practice react-query is handling our data. We don't actually need, or want Next to render this new page; we just want the url to update, so react-query can request new data. If you're wondering why it navigates to our new, changed page **twice** ... so am I. Apparently the RSC identifier is being changed, but I have no idea why. If anyone does, please reach out to me.

Next has no solutions for this.

The closest Next can come is to let you use [window.history.pushState](https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating#windowhistorypushstate). That will trigger a client-side url update, similar to what used to be called shallow routing in prior versions of Next. This does in fact work; however, it's not integrated with transitions for some reason. So when this calls, and our useSuspenseQuery hook updates, our current ui will suspend, and our nearest Suspense boundary will show the fallback. This is awful UI. I've reported this bug [here](https://github.com/vercel/next.js/issues/66016); hopefully it gets a fix soon.

Next may not have a solution, but react-query does. If you think about it, we already know what query we need to run, we're just stuck waiting on Next to finish navigating to an unchanging RSC page. What if we could pre-fetch this new endpoint request, so it's already running for when Next finally finishes rendering our new (unchanged) page. We can, since react-query has an api just for this. Let's see how.

Let's look at the react-query search form component, in particular the part which triggers a new navigation

```ts
startTransition(() => {
  const search = searchParams.get("search") ?? "";
  queryClient.prefetchQuery({
    queryKey: ["books-query", search],
    queryFn: async () => {
      const booksResp = await fetch(`http://localhost:3000/api/books?search=${search}`);
      const { books } = await booksResp.json();

      return { books };
    },
  });

  router.push(currentPath + (queryString ? "?" : "") + queryString);
});
```

Note the call to `queryClient.prefetchQuery`. `prefetchQuery` takes the same options as `useSuspenseQuery`, and runs that query, now. Later, when Next is finished, and react-query attempts to run the same query, it's smart enough to see that the request is already in flight, and so just latches onto that active promise, and uses the result.

Here's what our network chart now looks like

![Query parameter change waterfall](/rsc-and-react-query/react-query-param-change-waterfall-fixed.jpg)

Now nothing is delaying our endpoint request from firing. And since all data loading is happening in react-query, that navigation to our RSC page (or even two navigations) should be very, very fast.

### Removing the duplication

If you're thinking the duplication between the prefetch and the query itself is gross and fragile, you're right. So just move it to a helper function. In a real app you'd probably just move this boilerplate to something like this

```ts
export const makeBooksSearchQuery = (search: string) => {
  return {
    queryKey: ["books-query", search ?? ""],
    queryFn: async () => {
      const booksResp = await fetch(`http://localhost:3000/api/books?search=${search}`);
      const { books } = await booksResp.json();

      return { books };
    },
  };
};
```

and then use it

```ts
const { data } = useSuspenseQuery(makeBooksSearchQuery(search));
```

as needed

```ts
queryClient.prefetchQuery(makeBooksSearchQuery(search));
```

But for this demo I opted for duplication and simplicity.

Before moving on, let's take a moment and point out that all of this was only necessry because we had data loading tied to the url. If we just click a button to set client-side state, and trigger a new data request, none of this would ever be an issue. Next would not route anywhere, and our client-side state update would trigger a new react-query.

## What about bundle size?

When we did our react-query implementation, we changed our Books component to be a client component by adding the `"use client"` pragma. If you're wondering whether that will cause an increase in our bundle size, you're right. In the RSC version, that component only ever ran on the server. As a client component, it now has to run in both places, which will increase our bundle size a bit.

Honestly I wouldn't worry about it, especially for apps like this, with lots of different data sources that are interactive, and updating. This demo only had a single mutation, but it was just that; a demo. If we were to build this app for real, there'd be many mutation points, each with potentially multiple queries in need of invalidation.

If you're curious, it is technically possible to get the best of both worlds. You _could_ load data in an RSC, and then pass that data to the regular `useQuery` hook via the `initialData` prop. You can check [the docs](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery) for more info, but I honestly don't think it's worth it. You'd now need to define your data loading (the fetch call) in two places, or manually build an isomorphic fetch helper function to share between them. And then with actual data loading happening in RSCs, any navigations back to the same page (ie for querystrings) would re-fire those queries, when in reality react-query is already running those query udates client side. To fix _that_ so you'd have to be certain to only ever use `window.history.pushState` like we talked about. `useQuery` doesn't suspend, so you wouldn't need transitions for those url changes. It should work, but I highly doubt the complexity would be worth it.

Just use client components and let react-query remove the complexity with `useSuspenseHook`.

## Wrapping up

This was a _long_ post but I hope it was a valuable. Next's app directory is an incredible piece of infrastructure that let's us request data on the server, render, and even stream component content from that data, all using the single React component model we're all used to.

There's some things to get right, but depending on the type of app you're building, react-query can simplify things a great deal.

Happy coding!
