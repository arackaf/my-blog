---
title: Introducing SvelteKit
date: "2022-12-25T10:00:00.000Z"
description: A high-level introduction to SvelteKit
---

SvelteKit is the latest of what I'd call next-gen application frameworks. It of course scaffolds an application for you, with the file-based routing, deployment, server-side rendering Next has done forever. But SvelteKit also supports nested layouts, server mutations that sync up the data on your page and some other nicities we'll get into.

This post is just a high-level introduction, to hopefully build some excitement for anyone who's never used it before. Future posts will take some targetted deep dives, but for now we'll just take a relaxed tour. If you like what you see, the full docs are [here](https://kit.svelte.dev/docs/introduction).

In some ways this is a challenging post to write. SvelteKit is an _application framework_. It exists to help you build ... appications. That makes it hard to demo. It's not feasible to build an entire application in a blog post. So instead, we'll just use our imaginations a bit. We'll build out a skeleton of an application, have some empty ui placeholders, and some hard-coded static data. The goal of this post isn't to build an actual application, but instead to show you how SvelteKit works, so you can build an application of your own.

To that end, we'll build the tried and true todo application. But don't worry, this will be much, much more about seeing how SvelteKit works than in re-implementing yet another TODO app.

The code for everything you'll be seeing is [here](https://github.com/arackaf/sveltekit-blog-1). This project is also deployed on Vercel [here](https://sveltekit-blog-1.vercel.app/).

## Creating your project

Creating your project is simple enough. Just run `npm create svelte@latest your-app-name` and answer the questions. Be sure to pick Skeleton Project, but otherwise make whatever selections you want for TypeScript, eslint, etc.

Once it's created, run `npm i` and `npm run dev` and you should have a dev server running. Fire up `localhost:5173` and you should

## Basic routing

Notice the `routes` folder under src. That holds code for all of our ... routes. There's already a `+page.svelte` file in there. That has content for the root `/` route. No matter where in the file hierarchy you are, the actual page for that path always has the name `+page.svelte`. With that in mind, let's create pages for `/list`, `/details`, `/admin/user-settings` and `admin/paid-status`.

Your file layout should look something like this

![Initial files](/sveltekit-intro/img1-initial-pages.jpg)

and you should be able to navigate around by modifying your url

![Initial files](/sveltekit-intro/img2-initial-page-display.jpg)

## Layouts

Obviously we want some navigational links for our site, and we certainly don't want to copy the same nav markup for each page. So let's create a `+layout.svelte` file in the root of our routes folder, and add some content.

```html
<nav>
  <ul>
    <li>
      <a href="/">Home</a>
    </li>
    <li>
      <a href="/list">Todo list</a>
    </li>
    <li>
      <a href="/admin/paid-status">Account status</a>
    </li>
    <li>
      <a href="/admin/user-settings">User settings</a>
    </li>
  </ul>
</nav>

<slot />

<style>
  nav {
    background-color: beige;
  }
  nav ul {
    display: flex;
  }
  li {
    list-style: none;
    margin: 15px;
  }
  a {
    text-decoration: none;
    color: black;
  }
</style>
```

Some rudimentary nav, with some basic styles. Of particular importance is the `<slot />` tag. This is _not_ the slot you use with web components and shadow dom, but rather a Svelte feature indicating where to put our content. When a page renders, the pages content will slide in where the slot is.

And now we have some navigation. We won't win any design competitions, but we're not trying to.

![Initial files](/sveltekit-intro/img3-root-layout.jpg)

## Nested layouts

What if we wanted all of our admin pages to share inherit the normal layout we just built, but to also add some things common to all admin pages (but only admin pages). No problem, we just add another `+layout.svelte+` file in our root `admin` directory, which will be inherited by everything underneath. Let's add this content

```html
<div>This is an admin page</div>

<slot />

<style>
  div {
    padding: 15px;
    margin: 10px 0;
    background-color: red;
    color: white;
  }
</style>
```

We add a red banner indicating this is an admin page, and then, like before, a `<slot />` denoting where we want our page content to go.

So our root layout from before renders. Inside of the root layout is a `<slot />` tag. Into the root layout's `<slot />`, the nested layout's content goes. And finally, the nested layout defines its own `<slot />`, into which the page content renders.

If you browse to the admin pages, you should see the new red banner

![Initial files](/sveltekit-intro/img4-nested-layout.jpg)

## Defining our data

Ok, let's render some actual data. Or at least, see how we can render some actual data. There's a hundred ways to create and connect to a database. This post is about SvelteKit though, not managing DynamoDB, so we'll just "load" some static data. But, we'll use all the same machinery to read, and update it that you'd use for real data. For a real web app, swap out the functions returning static data with functions connecting to, and querying to whatever database you happen to life.

Let's create a dirt simple module in `lib/data/todoData.ts` that returns some static data, along with some artifical delays to simulate real querying.

```js
let todos = [
  { id: 1, title: "Write SvelteKit intro blog post", assigned: "Adam", tags: [1] },
  { id: 2, title: "Write SvelteKit advanced data loading blog post", assigned: "Adam", tags: [1] },
  { id: 3, title: "Prepare RenderATL talk", assigned: "Adam", tags: [2] },
  { id: 4, title: "Fix all SvelteKit bugs", assigned: "Rich", tags: [3] },
  { id: 5, title: "Edit Adam's blog posts", assigned: "Geoff", tags: [4] },
];

let tags = [
  { id: 1, name: "SvelteKit Content", color: "ded" },
  { id: 2, name: "Conferences", color: "purple" },
  { id: 3, name: "SvelteKit Development", color: "pink" },
  { id: 4, name: "CSS-Tricks Admin", color: "blue" },
];

const wait = async () => new Promise(res => setTimeout(res, 100));

export async function getTodos() {
  await wait();

  return todos;
}

export async function getTags() {
  await wait();

  return tags.reduce((lookup, tag) => {
    lookup[tag.id] = tag;
    return lookup;
  }, {});
}

export async function todo(id: number) {
  return todos.find(t => t.id == id);
}
```

A function to return a flat array of our todos, a lookup of our tags, and a function to fetch a single todo (we'll use that last one in our details page).

## Loading our data

How do we get that data into our Svelte pages? There's a number of ways, but for now, let's create a page.server.js file in our list folder, and put this content therein.

```js
import { getTodos, getTags } from "$lib/data/todoData";

export function load() {
  const todos = getTodos();
  const tags = getTags();

  return {
    todos,
    tags,
  };
}
```

We've defined a load function, which will load the data needed for the page. Notice that we are **not** awaiting our calls to our async functions `getTodos` and `getTags`. Doing so would likely create a data loading waterfall, as we wait for our todos to come in, before loading our tags. Instead we just return the raw promises from `load`, and SveleKit does the work necessary to `await` them.

So how do we access this data from our page component? SvelteKit provides a special `page` store which has our data on it. We import it, and then access our data using a [reactive assignment](https://svelte.dev/docs#component-format-script-3-$-marks-a-statement-as-reactive).

And then we just use it. Our list page component now looks like this.

```html
<script>
  import { page } from "$app/stores";

  $: ({ todos, tags } = $page.data);
</script>

<table cellspacing="10" cellpadding="10">
  <thead>
    <tr>
      <th>Task</th>
      <th>Tags</th>
      <th>Assigned</th>
    </tr>
  </thead>
  <tbody>
    {#each todos as t}
    <tr>
      <td>{t.title}</td>
      <td>{t.tags.map((id) => tags[id].name).join(', ')}</td>
      <td>{t.assigned}</td>
    </tr>
    {/each}
  </tbody>
</table>

<style>
  th {
    text-align: left;
  }
</style>
```

And this should render our todo's.

![List rendering](/sveltekit-intro/img6-list-rendering.jpg)

## Layout groups

Before we move on to the details page, and start looking at mutating data, let's take a peak at a really neat feature of SvelteKit: layout groups. We've already seen nested layouts being used for all admin pages, but what if we wanted to share a layout between some arbitrary pages at the same level of our file system. In particular, what if we wanted to share a layout just between our list page, and our details page. We already have a layout at that level, which is the global layout. Instead, we can create a new directory, but with a name that's in parenthesis, like this

![Layout group](/sveltekit-intro/img5-layout-group.jpg)

We now have a layout group that covers our list, and details pages. I named it `(todo-management)` but you can name it anything; to be clear, this name will **not** affect the url's of the pages inside of the layout group. The url's will remain the same; layout groups allow you to add shared layouts to some pages without them all comprising the entirety of a directory in `routes`.

We _could_ add a `+layout.svelte` file, and add some silly div banner saying "Hey we're managing todo's" but instead, let's do something more interesting. Layouts can also define `load` functions, in order to provide data for all routes underneath them. Let's use this functionaltiy to load our tags, since we'll be using our tags in our `details` page, in addition to the `list` page we already have.

First let's go into our `list` page's `+page.server.js` file, and remove the tags from it.

```js
import { getTodos, getTags } from "$lib/data/todoData";

export function load() {
  const todos = getTodos();

  return {
    todos,
  };
}
```

Our list page should now error out, since there's no tags object.

To fix this, let's add a `+layout.server.js` file and define a load function in it, that loads our tags

```js
import { getTags } from "$lib/data/todoData";

export function load() {
  const tags = getTags();

  return {
    tags,
  };
}
```

And just like that
