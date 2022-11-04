---
title: Next 13 - Data fetching with React Server Components
date: "2022-10-31T10:00:00.000Z"
description: A high level introduction to data fetching with react server components
---

Next 13 was just released with support for [React Server Components](https://nextjs.org/docs/advanced-features/react-18/server-components) (RSCs). The docs / upgrade guide [are here](https://beta.nextjs.org/docs/upgrade-guide), and are outstanding.

I'd like to do a quick and dirty introduction to RSCs, and show how well they simplify data loading, and server rendering.

**NOTE**

Before we start, please note that RSC support in Next 13 is still in beta. The things I'll show you might change, and there are still missing pieces which are works in progress (mutations in particular) so please don't go shipping any of this to production.

I just want this post to be a crude, quick and dirty introduction, to hopefully spark some excitement at what's coming.

# React Server Components

Typically React components (when used in a SSR framework like Next) will render on the server, send the html down to your user's browser, along with scripts that load react, and re-render the whole app. This re-rendering is called hydraton.

RSCs improve this model by allowing you to have components which only render on the server. This means they don't run on the client, and therefore don't increase your bundle size. Not only that, but they have new rules which simplify data loading.

## But wait, there's more

RSCs are tightly integrated with Suspense. You can place Suspense boundaries inside of your markup, and React will send down what's ready in the page, along with the Suspense boundaries' loading placeholders. As the data for those Suspense boundaries come in, React will _update_ your page with the content for those Suspense boundaries. That's right, RSCs aren't just a one-time server render; they're interactive with the page, continuosly updating segments as they come in.

# Let's get started

Let's dive in and build an _extremely_ contrived prototype to see how data loading works. Nothing useful, not even any bit of nice formatting. Just the absolute minimum to show how much cool these new data loading capabilities are. The RSC will server render some initial data, and the page will then be able to filter, and request new data from the RSC. That's right, RSCs are interactive. It's not just an initial render; the page and server actually stay in sync as the user interacts.

We'll just use static data here, rather than try to rig up a database. But we'll get the static data from a Next api endpoint, just to guarentee that we are in fact performing server-side network requests, and we'll manually slow it down so we can focus on loading states.

The repo for all of the code [is here](https://github.com/arackaf/next-13-data-fetching-blog-post).

Let's get started!

## Our Data

Let's start with our data endpoints. They're's not very interesting, but they'll be good enough to show the nuts and bolts of data fetching. We have a todos endpoint

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { Todo, TodosResult } from "../../types";

const ALL_TODOS: Todo[] = [
  { name: "Learn Next 13 data fetching", priority: "high", color: "Blue" },
  { name: "Learn Next 13 RSCs", priority: "high", color: "Blue" },
  { name: "Learn Next 13 api routes", priority: "medium", color: "Green" },
  { name: "Learn Vercel hosting dns configuration", priority: "medium", color: "Red" },
  { name: "Learn JavaScript fundamentals", priority: "low", color: "Blue" },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse<TodosResult>) {
  await new Promise(res => setTimeout(res, 1000));

  const filter = req.query.filter;
  res.status(200).json({ data: ALL_TODOS.filter(todo => (!filter || filter === "all" ? true : todo.priority === filter)) });
}
```

and a colors endpoint, since todos can, I guess, render with different colors. It's silly but it'll do.

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { ColorsLookup, ColorsResult } from "../../types";

const ALL_COLORS: ColorsLookup = {
  Red: "#FF0000",
  Green: "#00FF00",
  Blue: "#0000FF",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ColorsResult>) {
  await new Promise(res => setTimeout(res, 1000));

  res.status(200).json({ data: ALL_COLORS });
}
```

## Our RSC

Let's turn to our page.tsx file. Here's a naieve first draft of our component.

```tsx
import { Suspense } from "react";
import { Todos } from "./Todos";
import { RSCProps } from "../types";

import "./styles.css";

async function getTodos(filter: string) {
  const urlBase = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

  const result = await fetch(`${urlBase}/api/todos?filter=${filter}`, { cache: "no-store" });
  return result.json();
}

async function getColors() {
  const urlBase = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

  const result = await fetch(`${urlBase}/api/colors`, { cache: "no-store" });
  return result.json();
}

export default async function Page({ searchParams }: RSCProps) {
  const todos = await getTodos(searchParams?.filter ?? "");
  const colors = await getColors();

  return (
    <main>
      <h1>TODOs Page</h1>
      <Suspense fallback={<h2>Loading ...</h2>}>
        <section>
          <Todos todos={todos} colors={colors} />
        </section>
      </Suspense>
    </main>
  );
}
```

Notice first that our component is using async await. RSCs are designed like this, to help enable you to load data.

The astute among you will immediately spot the waterfall problem. I await the `getTodos()` call, _and then_ await the `getColors()` call. This means our component will block, waiting for the todos, and then block again waiting for the colors. But before we go rushing to toss a `Promise.all` in there, let's just press on, for now, and see how things work.

The page blocks for about 2 seconds (both of our endpoints have a 1 second delay, which run serially because of the waterfall), and then the whole page renders.

![image](/next-13-intro/img3.jpg)

Our suspense boundary didn't render immediately with the placeholder, followed by the data, later. What happened?

## How to properly ... `use` async data 😏

The problem is obvious in retrospect: how could the suspense boundary work when we immediately awaited our data in the very beginning of our component.

Let's fix by moving the awaits into the component that actually uses it. This will allow the rest of our (in this case small) render tree to begin rendering, and when the await happens down in our `<Todos />` component, it will trigger the Suspense boundary. This will cause the server to render the _rest_ of our page, along with the placeholder of the Suspense boundary. Then, when the data are done loading, the rest of `<Todos />` will render. This will happen without us needing to do anything else. Our React Server Components will handle resolving any promises they need to, and transparently swap out suspense boundaries for the newly rendered content, as they become available.

One last thing, instead of using `await` let's use `use`, which is a new export available from the react package. It's like await, except it can also be used from client components. We `use(someDataSource)` and the Suspense boundaries are triggered just like with await. Again, the difference is we can also use it on client components. I'm also a fan of the semantics: we call `use` to _use_ the data. And only when we want to use the data. Do not `use` (or `await`) your data high in the component tree, and then pass it down; that's a fantastic way to create waterfalls. Instead `use()` your data when you need to actually _use_ it.

One last thing: `use` cannot be used in an async component. Bad things will happen. See [this thread](https://github.com/vercel/next.js/issues/42469) for more info. Eventually the lint rule will be updated to prohibit this.

With that out of the way, let's look at our `<Todos>` component.

```tsx
import { use } from "react";
import type { ColorsResult, TodosResult } from "../types";
import { TodoListFiltersHeader } from "./TodoListFiltersHeader";

type Props = { todos: Promise<TodosResult>; colors: Promise<ColorsResult> };

type TodosType = (props: Props) => any;

export const Todos: TodosType = (props: Props) => {
  const todos = use(props.todos);
  const colors = use(props.colors);

  return (
    <section>
      <TodoListFiltersHeader />
      <ul>
        {(todos?.data ?? []).map((todo, idx) => (
          <li key={idx} style={{ color: colors.data[todo.color] }}>
            {todo.name} - {todo.priority}
          </li>
        ))}
      </ul>
    </section>
  );
};
```

And that's that.

If you're wondering why those two consecutive `use` calls are _not_ a waterfall, when the initial two `await` calls were, remember, that first initial await code in the original code halted the entire async function until the first data call resolved, _before starting the second call_. Now, we make both of those calls _without_ awaiting them, and then just pass the promises down to the component that uses them, which calls `use` on them. The use call does block the rest of the render, like before, but this time it's only blocking the rendering _inside of the Suspense boundary the component sits in_; the rest of the render tree is not blocked by it.

Now, when we render our page, we see most of it, plus the Suspense boundary placeholder

![initial](/next-13-intro/img2.jpg)

until the data come in and the page updates

![updated](/next-13-intro/img3.jpg)

## Wrapping up

I'm extrenely excited by Next 13 and React 18. Not only is data loading streamlines, and well integrated with Suspense boundaries, but it's done so in a way that's server driven, and won't bloat your bundle sizes.
