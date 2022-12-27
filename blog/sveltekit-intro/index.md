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

```svelte
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

## Rendering data

Ok, let's render some actual data. Or at least, see how we can render some actual data. There's a hundred ways to create and connect to a database. This post is about SvelteKit though, not managing DynamoDB, so we'll just "load" some static data. But, we'll use all the same machinery to read, and update it that you'd use for real data. For a real web app, swap out the functions returning static data with functions connecting to, and querying to whatever database you happen to life.

Let's create a dirt simple module in `lib/data/todoData.ts` that returns some static data, along with some artifical delays to simulate real querying.

```ts
let _todos = [
  { id: 1, title: "Write SvelteKit intro blog post", assigned: "Adam", tags: [1] },
  { id: 2, title: "Write SvelteKit advanced data loading blog post", assigned: "Adam", tags: [1] },
  { id: 3, title: "Prepare RenderATL talk", assigned: "Adam", tags: [2] },
  { id: 4, title: "Fix all SvelteKit bugs", assigned: "Rich", tags: [3] },
  { id: 5, title: "Edit Adam's blog posts", assigned: "Geoff", tags: [4] },
];

let _tags = [
  { id: 1, name: "SvelteKit Content", color: "ded" },
  { id: 2, name: "Conferences", color: "purple" },
  { id: 3, name: "SvelteKit Development", color: "pink" },
  { id: 4, name: "CSS-Tricks Admin", color: "blue" },
];

const wait = async () => new Promise(res => setTimeout(res, 100));

export async function todos() {
  await wait();

  return { todos: _todos };
}

export async function tags() {
  await wait();

  return { tags: _tags };
}

export async function todo(id: number) {
  return _todos.find(t => t.id == id);
}
```
