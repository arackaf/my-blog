---
title: Next 13 - Data fetching with React Server Components
date: "2022-10-31T10:00:00.000Z"
description: A high level introduction to data fetching with react server components
---

Next 13 was just released. It introduces support for [React Server Components](https://nextjs.org/docs/advanced-features/react-18/server-components) (RSCs). It does this through a new routing structure that supports cool new features like the much awaited nested layouts. The docs / upgrade guide [are here](https://beta.nextjs.org/docs/upgrade-guide), and are outstanding.

This post will briefly introduce RSCs. We'll talk about what they are, and roughly how they work. Then for the bulk of the post we'll go over data fetching, and how RSCs greatly simplify it.

**NOTE**

The RSC support in Next 13, via the "app" folder (which we'll get into below) is still in beta. The things I'll show you might change, so please don't go shipping any of this to production.

# React Server Components

Traditionally, React components would render fully on the server. The markup would be sent to the client, along with some script tags. The script tags would contain React (of course), as well as the code for your _entire application_. The script tags would run, and _re-render_ your _entire application_, wire up your event handlers, etc; your application would essentially be "live" at this point. This process of re-rendering / activating you at which point your browser would take over. This process of re-rendering your application is called "hydration."

This worked well enough, but it obviously wasn't ideal. RSCs allow you to separate server, from client code. RSCs only exist on the server; they do not get sent down to your client with your hydration script. This helps reduce bundle size, which is a win in and of itself, but as we'll see, RSCs go even further, and provide some nice data fetching utilities.

# Using RSCs in Next 13

Again, the full [guide](https://beta.nextjs.org/docs/upgrade-guide) is here, but the elevator summary is that Next how has a separate routing page called `app` that co-exists with the `pages` directory you're used to. Route pages in `app` are always called `page.js` (or `page.tsx`, naturally). So `app/page.tsx` will route from `/`. `app/foo/page.tsx` will route from `/foo` and so on. There's much more to know here, of course, including layouts, but for this post we'll move on.

Routes in the app directory default to being RSCs, as do components they import, etc. Later we'll see how to switch over to client components, but for now, let's write our first server component. I'll create a file `blog-demo/page.tsx`, and place this inside of it

```jsx
export default function () {
  return <div>Hello World, RSC!</div>;
}
```

![first rsc](/next-13/img1.jpg)

Remember, this component only exists on the server. It's not sent down to the client except as the rendered html; no matter how mcuh code we dump into this RSC, it won't increase our hydration script.

## But what if I ...

If this component is _only_ running on the server, what would happen if we tried to add some state, or wire up event handlers. The short answer is you're not allowed to do those things, but don't worry about forgetting, Next will remind you.

```jsx
import { useState } from "react";

export default function () {
  const [val] = useState(0);

  return <div>Hello World, RSC!</div>;
}
```

![rsc error](/next-13/img2.jpg)

# Let's get started

We've poked around at RSCs just a bit. Let's dive in and build a small, contrived prototype to see how data loading works. The RSC will server render some initial data, and the page will then be able to filter, and request new data from the RSC. That's right, RSCs are interactive. It's not a one-time render; the page and server actually stay in sync as the user interacts. We'll see how.

We'll just use static data here, rather than try to rig up a database. But we'll get the static data from a Next api endpoint, just to guarentee that we are in fact performing server-side network requests.

The repo for all of the code [is here](https://github.com/arackaf/next-13-data-fetching-blog-post).

Let's get started!

## Our Data

Let's start with our data endpoint. It's not very interesting, but it'll be good enough to show off the nuts and bolts of data fetching.

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { Todo, TodosResult } from "../../types";

const ALL_TODOS: Todo[] = [
  { name: "Learn Next 13 data fetching", priority: "high" },
  { name: "Learn Next 13 RSCs", priority: "high" },
  { name: "Learn Next 13 api routes", priority: "medium" },
  { name: "Learn Vercel hosting dns configuration", priority: "medium" },
  { name: "Learn JavaScript fundamentals", priority: "low" },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse<TodosResult>) {
  await new Promise(res => setTimeout(res, 1000));

  const filter = req.query.filter;
  res.status(200).json({ data: ALL_TODOS.filter(todo => (filter ? todo.priority === filter : true)) });
}
```

We define an array of TODOs, read an optional filter from the request querystring, and then return a simple filter.

## Out RSC
