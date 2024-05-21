---
title: Combining RSC with react-query for easy data management
date: "2024-05-21T10:00:00.000Z"
description: An introduction to RSC and react-query
---

React Server Components, or RSC, is one of the most exciting developments in web development. This post provide a brief introduction to them, what their purpose and benefits are, and then show how to pair them with react-query for seemless data management. Let's get started!

## Why RSC?

React Server Components, as the name implies, execute **on the server**. And the server **alone**. To see why this is significant, let's take a whirlwind tour of how web development evolved over the last 10 years or so.

Prior to RSC, JavaScript frameworks (React, Svelte, Vue, Solid, etc) prodivded you with a component model for building your application. These components were capable of _running_ on the server, but only as a synchronous operation for stringifying your components' html, in order to server render your app. Your app would then render in the browser, again, at which point it would become interactive. With this model, the only way to load data was as a side-effect on the client. Waiting until your app reached your user's browser before beginning to laod data was slow, and inefficient.

To solve this inefficiency, meta-frameworks like Next, SvelteKit, Remix, Nuxt, SolidStart, etc were created. These meta-frameworks provided various ways to load data, server-side, with that data being injected, by the meta-framework into your component tree. This code was traditionally non-portable, and a little awkward. You'd have to define some sort of loader function, semantically associated with a given route, asynchronously load data, and then expect it to show up in your component tree based on the rules of whatever meta-framework you're using.

This worked, but it wasn't without issue. The code was meta framework-specific and non-portable. Composition sufferent; where typically components are explicitly pass props by whichever components render them, now there are _implicit_ props passed by the meta-framework, based on what you return from your loader. Lastly, this setup wasn't the most flexible. A given page needs to know what data it needs up front, and request it all from the loader. With client-rendered SPAs we could just render whatever components we need, and let them fetch whatever data they need. This was awful for performance, but amazing for convenience.

RSC bridges that gap and gives us the best of both worlds. We get to _ad hoc_ request whatever data we need from whichever component we're rendering, but have that code execute on the server, without needing to wait for a round trip to the browser. Best of all, RSC also support _streaming_, or more precisely, out-of-order streaming. If some of our data are slow to load, we can send the rest of the page, and _push_ those data down to the browser, from the server, whenever they happen to be ready.

## How do I use them?

At time of writing RSC are mainly only supported in Next.js, although the minimal framework [Waku](https://waku.gg/) also supports it. Remix and TanStack Router are currently working on implementations, so stay tuned, there. I'll show a very brief overview of what they look like in Next; consult those other frameworks when they ship (the ideas will be the same, even if the implementations differ slightly).

In Next, when using the new "app directory" (it's literally a folder called "app" that you define your various routes in), pages, are RSC by default. Any components imported by these pages are also RSC, as well as components imported by those components, and so on. When you're ready to exit server components and switch back to "client components," you put the "use client" pragma at the top of a component. Now that component, and everything that component imports are client components as well. Check the [Next docs](https://nextjs.org/docs/app) for more info.

### How do React Server Components work?

React Server Components are just like regular React Components, but with a few differences. For starters, they can be async functions. The fact that you can await asynchronous operations right in the comopnent makes them well suited for requesting data. Note that asynchronous client components are a thing coming soon to React, so this differentiation won't exist for too long. The other big difference is that these components run _only on_ the server. Client components (ie regular components) run on the server, and then re-run on the client in order to "hydrate." That's how frameworks like Next and Remix have always worked. But server components run only on the server.

Server components have no hydration, and only execute on the server. That means you can do things like connect directly to a database, or use Server-only api's. But it also means there are many things you can't do in RSCs: you cannot use effects or state, you cannot set up event handlers, or use browser-specific api's like Localstorage. If you violate any of those rules you'll get errors.

For a more thorough introduction to RSC, check the Next docs for the app directory, or depending on when you read this, the Remix or TanStack Router docs. But to keep this post a reasonable length, let's keep the details in the docs, and see how we use these tools.

Let's put together a very basic proof of concept demo app with RSC, see how data mutations work, and some of their limitations. We'll then take that same app (still using RSC) and see how it looks with react-query.

## The demo app

As I've done before, let's put together a very basic, very ugly web page for searching some books, and also updating the titles of them. We'll also show some other data on this page, the various subjects, and tags we have, which in theory we could apply to our books (if this were a real web app, instead of a demo).

The point is to show how RSC and react-query work, not make anything useful or beautiful, so temper your expectations :) Here's what it looks like

![Book page](/rsc-and-react-query/web-page.jpg)

The page has a search input which puts our search term into the url to filter the books shown. Each book also has an input attached to it for us to update that book's title. You'll note the nav links at the top, for the RSC and RSC + react-query versions. While the pages look and behave identically as far as the user can see, but the implementations are different, with differences we'll get into.

The repo is [here](https://github.com/arackaf/react-query-rsc-blog-post). The data are all static, but the books are put into a SQLite database, so we can update the data. The binary for the SQLite db should be checked in, but you can always re-created it (and reset any updates you've made) by running `npm run create-db`.

Let's dive in

## A note on caching

At time of writing, Next is just about to update a new version with radically different caching api's, and defaults. We won't cover any of this for this post. For the demo, I've disabled all caching. Each call to a page, or api endpoint will always run fresh from the server. The client cache will still work, though. So if you click between the two pages, Next will cache and display what you just saw. But refreshing the page will always recreate everything.

## Loading the data

There's api endpoints inside of the api folder for loading data, and for updating the books. I've added artifical delays of a few hundred ms for each of these endpoints, since they're either loading static data, or running simple queries from SQLite. There's also console logging for these data, so you can see what's loading, when. This will become key in a bit.

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

We have a simple page header. Then we see a Suspense boundary. This is how out-of-order streaming works with Next and RSC. Everything about the Suspense boundary will render immediately, and the `Loading...` message will show until all the various data in the various components below have finished. React knows what's pending based on what you've awaited. The `Books`, `Subjects` and `Tags` components all have fetches inside of them, which are awaited. We'll look at one of them momentarily, but first note that, even though three different components are all requesting data, React is more than capable of running them in parallel. Sibling nodes in the component tree can and do load data in parallel.

But if you ever have a parent / child component which both load data, then the child component will not (cannot) even start util the parent is finished loading. If the child data fetch depends on the parent's loaded data, then this is unavoidable (you'd have to modify your backend to fix it), but if the data do not depend on it, then you would solve this waterfall by just loading the data higher up in the component tree, and passing the various pieces down.

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

We load our data, and then pass it down into the `BooksList` component. I separated this out so I could re-use the main list with both versions. The `BookEdit` prop I'm passing in is a React component, that renders the textbox to update the title, and performs the update. This will differ between the RSC, and react-query version. More on that in a bit.

The `next` property in the fetch is Next-specific, and will be used to invalidate our data in just a moment. The experienced Next devs might spot a problem here, which we'll show soon.

### So you've loaded data, now what?

We have a page with three different RSCs which load, and render data. Now what? If our page was just static content then we'd be done. We loaded data, and displayed it. If that's your use case, you're done. RSC are perfect for you, and you won't need the rest of this post.

But what if you want to let your user interact with, and update your data?

## Updating your data with RSC

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

Note the `"use server"` pragma at the top. That means the function we export is now a server action. The saveBook takes an id, and a title. We post up to an endpoint that updates that book in SQLite. We then call `revalidateTag` with the same tag we passed to our fetch before.

Let's see the BookEdit component we use with RSC

```jsx
"use client";

import { FC, useRef } from "react";
import { saveBook } from "../serverActions";
import { BookEditProps } from "./types";

export const BookEdit: FC<BookEditProps> = (props) => {
  const { book } = props;
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-2">
      <input className="border rounded border-gray-600 p-1" ref={titleRef} defaultValue={book.title} />
      <button onClick={() => saveBook(book.id, titleRef.current!.value)}>Save</button>
    </div>
  );
};
```

It's a client component. We import the server action, and then just call it in a button's event handler. Stop and consider just how radical this is, and what React and Next are doing under the covers. All we did was create a vanilla function. We then imported that function, and called it from a button's event handler. But under the covers a network request is made to an endpoint that's synthesized for us. And then the `revalidateTag` tells Next what's changed, so our RSC can re-run, re-request data, and send down updated markup.

Not only that, but all this happens in **one round trip** with the server.

This is an incredible engineering achievement, and it works! If you update one of the titles, and click save, you'll see updated data show up in a moment (the update has an artificial delay since we're only updating in a local SQLite instance)

![Update](/rsc-and-react-query/update-data.jpg)

### What's the catch?

This seems too good to be true. What's the catch? Well, let's see what the terminal shows when we update a book

![Server Action](/rsc-and-react-query/server-action.jpg)

Ummmm, why is _all_ of our data re-loading? We only called revalidateTag on our books, not our subjects or tags. The problem is that `revalidateTag` doesn't tell Next what to reload, it tells it what to eject from its cache. The fact is, Next needs to reload everything for the current page when we call `revalidateTag`. This makes sense when you think about what's really happening. These server components are not stateful; they run on the server, but they don't _live_ on the server. The request executes on our server, those RSCs render, and send down the markup, and that's that. The component tree does not live in indefinitely on the server; our servers wouldn't scale very well if they did!

So how do we solve this? For a use case like this, the solution would be to _not_ turn off caching. We'd lean on Next's caching mechanism, whatever they look like when you happen to read this. We cache each of these data with different tags, and invalidate the tag related to the data we just updated.

The whole RSC tree will still re-render when we do that, but the requests for cached data will run quickly. Personally, I'm of the view that caching should be a performance tweak you add, as needed; it should not be a _sine qua non_ for avoiding slow updates.

Unfortunately there's yet another problem with server actions: they run serially. Only one server action can be in flight at a time; they'll queue if you try to violate this contraint.

This sounds genuinely unbelievable, but it's true. If we artificially slow down our update a LOT, and then quickly click 5 different save buttons, we can see horrifying things in our network tab. If the extreme throttling on the update seems unfair on my part, remember hat you should never, ever assume your network will be fast or even reliable. Occasional, slow requests are inevitable, and server actions will do the worst possible thing under those circumstances.

![Serial Server Action](/rsc-and-react-query/serial-execution.jpg)

This is a known issue, and will presumably be fixed at some point. But the re-loading without caching issue is unavoidable with how this works.

Just to be clear, server actions are still, even with these limitations, outstanding (for some use cases). If you have a web page with a form, and a submit button, server actions are **outstanding**. None of these limitations will matter (assuming your form doesn't depend on a bunch of different data sources). In fact, server actions go especially well with forms. You can even set the "action" of a form (in Next) directly to a server action. See the docs for more info, as well as on related hooks, like useFormStatus hook.

But back to our app. We don't have a page with a single form and no data sources. We have lots of little forms, on a page with lots of data sources. Server actions won't work well here, so let's see an alternative.

## react-query

To use react-query we'll need to install two packages: `npm i @tanstack/react-query @tanstack/react-query-next-experimental`. Don't let the experimental scare you; it's been out awhile and works well.

Next let's make a Providers component, and render it from our root layout

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

The long and short of it is that we use the `useSuspenseHook` from inside of client components. Let's see some code. Here's the Books component from the react-query version of our app.

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
    queryKey: ["books-query", search ?? ""],
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

As the url changes, the useSearchParams result changes, and a new query is fired off by our `useSuspenseQuery` hook, from the browser. This would normally suspend the page, but I wrap the call to router.push in startTransition, so the existing content stays on the screen. Check the repo for more info.

### Updating data with react-query
