---
title: Next 13 - Data fetching with React Server Components
date: "2022-10-31T10:00:00.000Z"
description: A high level introduction to data fetching with react server components
---

Next 13 was just released with support for [React Server Components](https://nextjs.org/docs/advanced-features/react-18/server-components) (RSCs). The docs / upgrade guide [are here](https://beta.nextjs.org/docs/upgrade-guide), and are outstanding.

I'd like to do a quick and dirty introduction to RSCs, and show how well they simplify data loading, and server rendering.

**NOTE**

Before we start, please note that RSC support in Next 13 is still in beta. The things I'll show you might change, and there are still missing pieces which are works in progress (mutations in particular) so please don't go shipping any of this to production.

# React Server Components

Typically React components (when used in a SSR framework like Next) will render on the server, send the html down to your user's browser, along with scripts that load react, and re-render the whole app. This re-rendering is called hydraton.

RSCs improve this model by allowing you to have components which only render on the server. This means they don't increase your bundle size. Not only that, but they have new rules which simplify data loading.

## But wait, there's more

RSCs are tightly integrated with Suspense. You can place Suspense boundaries inside of your markup, and React will send down what's ready in the page, along with the Suspense boundaries' loading placeholder. As the data for those Suspense boundaries comes in, React will _update_ your page with the content for those Suspense boundaries. That's right, RSCs aren't just a one-time server render, they're interactive with the page, continuosly updating segments as they come in.

# Let's get started

Let's dive in and build an _extremely_ contrived prototype to see how data loading works. The RSC will server render some initial data, and the page will then be able to filter, and request new data from the RSC. That's right, RSCs are interactive. It's not a one-time render; the page and server actually stay in sync as the user interacts.

We'll just use static data here, rather than try to rig up a database. But we'll get the static data from a Next api endpoint, just to guarentee that we are in fact performing server-side network requests, and we'll manually slow it down so we can focus on loading states.

The repo for all of the code [is here](https://github.com/arackaf/next-13-data-fetching-blog-post).

Let's get started!

## Our Data

Let's start with our data endpoints. They're's not very interesting, but they'll be good enough to show off the nuts and bolts of data fetching. We have a todos endpoint

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
  console.log("requesting");
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
