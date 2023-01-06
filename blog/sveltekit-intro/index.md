---
title: Introducing SvelteKit
date: "2022-12-25T10:00:00.000Z"
description: A high-level introduction to SvelteKit
---

SvelteKit is the latest of what I'd call next-gen application frameworks. It of course scaffolds an application for you, with the file-based routing, deployment, server-side rendering Next has done forever. But SvelteKit also supports nested layouts, server mutations that sync up the data on your page, and some other niceties we'll get into.

This post is meant to be a high-level introduction, to hopefully build some excitement for anyone who's never used it before. Future posts will take some targeted deep dives, but for now we'll just take a relaxed tour. If you like what you see, the full docs are [here](https://kit.svelte.dev/docs/introduction).

In some ways this is a challenging post to write. SvelteKit is an _application framework_. It exists to help you build ... applications. That makes it hard to demo. It's not feasible to build an entire application in a blog post. So instead, we'll just use our imaginations a bit. We'll build out a skeleton of an application, have some empty ui placeholders, and some hard-coded static data. The goal of this post isn't to build an actual application, but instead to show you how SvelteKit works, so you can build an application of your own.

To that end, we'll build the tried and true todo application. But don't worry, this will be much, much more about seeing how SvelteKit works than in re-implementing yet another TODO app.

The code for everything you'll be seeing is [here](https://github.com/arackaf/sveltekit-blog-1). This project is also deployed on Vercel [here](https://sveltekit-blog-1.vercel.app/).

## Creating your project

Creating your project is simple enough. Just run `npm create svelte@latest your-app-name` and answer the questions. Be sure to pick Skeleton Project, but otherwise make whatever selections you want for TypeScript, eslint, etc.

Once it's created, run `npm i` and `npm run dev` and you should have a dev server running. Fire up `localhost:5173` and you should see the placeholder page that comes with the skeleton app.

## Basic routing

Notice the `routes` folder under src. That holds code for all of our ... routes. There's already a `+page.svelte` file in there. That has content for the root `/` route. No matter where in the file hierarchy you are, the actual page for that path always has the name `+page.svelte`. With that in mind, let's create pages for `/list`, `/details`, `/admin/user-settings` and `admin/paid-status`, and also add some text placeholders for each page.

Your file layout should look something like this

![Initial files](/sveltekit-intro/img1-initial-pages.jpg)

and you should be able to navigate around by modifying your url

![Initial files](/sveltekit-intro/img2-initial-page-display.jpg)

## Layouts

Obviously we want some navigational links for our site, and we certainly don't want to copy the same nav markup for each page. So let's create a `+layout.svelte` file in the root of our `routes` folder, and add some content.

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

What if we wanted all our admin pages to inherit the normal layout we just built, but to also share some things common to all admin pages (but only admin pages). No problem, we just add another `+layout.svelte` file in our root `admin` directory, which will be inherited by everything underneath. Let's do that, and add this content

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

Ok, let's render some actual data. Or at least, see how we can render some actual data. There's a hundred ways to create and connect to a database. This post is about SvelteKit though, not managing DynamoDB, so we'll just "load" some static data. But, we'll use all the same machinery to read, and update it that you'd use for real data. For a real web app, swap out the functions returning static data with functions connecting to, and querying to whatever database you happen to like.

Let's create a dirt simple module in `lib/data/todoData.ts` that returns some static data, along with some artificial delays to simulate real querying. You'll see this lib folder imported elsewhere via `$lib`. This is a SvelteKit feature for that particular folder, and you can even [add your own aliases](https://kit.svelte.dev/docs/configuration#alias).

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

export const wait = async amount => new Promise(res => setTimeout(res, amount ?? 100));

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

export async function getTodo(id) {
  return todos.find(t => t.id == id);
}
```

A function to return a flat array of our todos, a lookup of our tags, and a function to fetch a single todo (we'll use that last one in our details page).

## Loading our data

How do we get that data into our Svelte pages? There's a number of ways, but for now, let's create a `+page.server.js` file in our list folder, and put this content.

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

So how do we access this data from our page component? SvelteKit provides a `data` prop to our component with data on it. We'll access our todos and tags from it using a [reactive assignment](https://svelte.dev/docs#component-format-script-3-$-marks-a-statement-as-reactive).

Our list page component now looks like this.

```html
<script>
  export let data;
  $: ({ todo, tags } = data);
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

Before we move on to the details page, and start looking at mutating data, let's take a peak at a really neat feature of SvelteKit: layout groups. We've already seen nested layouts for all admin pages, but what if we wanted to share a layout between some arbitrary pages at the same level of our file system. In particular, what if we wanted to share a layout just between our list page, and our details page. We already have a layout at that level, which is the global layout. Instead, we can create a new directory, but with a name that's in parenthesis, like this

![Layout group](/sveltekit-intro/img5-layout-group.jpg)

We now have a layout group that covers our list, and details pages. I named it `(todo-management)` but you can name it anything; to be clear, this name will **not** affect the url's of the pages inside of the layout group. The url's will remain the same; layout groups allow you to add shared layouts to some pages without them all comprising the entirety of a directory in `routes`.

We _could_ add a `+layout.svelte` file, and add some silly div banner saying "Hey we're managing todo's" but instead, let's do something more interesting, and new. Layouts can also define `load` functions, in order to provide data for all routes underneath them. Let's use this functionality to load our tags, since we'll be using our tags in our `details` page, in addition to the `list` page we already have. In reality forcing a layout group just to provide a single piece of data is almost certainly not worth it; just duplicate that data in each of your pages' load function. But for this post, it'll provide the excuse we need to see a new SvelteKit feature!

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

To fix this, let's add a `+layout.server.js` file in our layout group, and define a load function that loads our tags

```js
import { getTags } from "$lib/data/todoData";

export function load() {
  const tags = getTags();

  return {
    tags,
  };
}
```

And just like that, our list page is rendering again.

### We're loading data from multiple locations

Let's put a finer point on what's happening. We have a load function defined for our layout group, which we put in `+layout.server.js`. This provides data for **all** pages the layout serves, which in this case means our list, and details pages. Our list page also defines a load function, which goes in its `+page.server.js` file. SvelteKit does the grunt work of taking the results of these data sources, merging them together, and making both available in `data`.

## Our details page

We'll use our details page to edit a todo. First, let's add a column to the table in our list page linking to the details page, with the todo in the querystring.

```html
<td><a href={`/details?id=${t.id}`}>Edit</a></td>
```

Now let's build out our details page.

First we'll add a loader to grab the todo we're editing. Create a `+page.server.js` in /details, with this content

```js
import { getTodo, updateTodo, wait } from "$lib/data/todoData";

export function load({ url }) {
  const id = url.searchParams.get("id");

  console.log(id);
  const todo = getTodo(id);

  return {
    todo,
  };
}
```

Our loader comes with a url property, from which we can pull querystring values. This makes it easy to look up the todo we're editing. Now let's render that todo, along with functionality to edit it.

SvelteKit has wonderful mutation capabilities built in, so long as you use forms. Remember forms? Here's our details page; I've elided the styles for brevity.

```html
<script>
  import { enhance } from "$app/forms";

  export let data;

  $: ({ todo, tags } = data);
  $: currentTags = todo.tags.map(id => tags[id]);
</script>

<form use:enhance method="post" action="?/editTodo">
  <input name="id" type="hidden" value="{todo.id}" />
  <input name="title" value="{todo.title}" />

  <div>
    {#each currentTags as tag}
    <span style="{`color:" ${tag.color};`}>{tag.name}</span>
    {/each}
  </div>

  <button>Save</button>
</form>
```

We're grabbing the tags as before, from our layout group's loader; and the todo from our page's loader. We're grabbing the actual tag objects from the todo's list of tag id's, and then rendering everything. We create a form with a hidden input for the id, and a real input for the title. We display the tags, and then provide a button to submit the form.

If you noticed the `use:enhance`, that just tells SvelteKit to use progressive enhancement, and use ajax to submit our form. You'll likely always use that.

### How do we save our edits?

Notice the `action="?/editTodo"` attribute on the form itself? This tells us where we want to submit our edited data. For our case, we want to submit to an `editTodo` "action." Let's create it. In the `+page.server.js` file which we already have for details (which currently has a load function, to grab our todo) let's add this

```js
import { redirect } from "@sveltejs/kit";

// ...

export const actions = {
  async editTodo({ request }) {
    const formData = await request.formData();

    const id = formData.get("id");
    const newTitle = formData.get("title");

    await wait(250);
    updateTodo(id, newTitle);

    throw redirect(303, "/list");
  },
};
```

Form actions give us a request object, which provide access to our formData, which has a `get` method for our various form fields. We added that hidden input for the id value so we could grab it here, in order to look up the todo we're editing. We simulate a delay, call a (new) update method, and then redirect the user back to the `/list` page. Our updateTodo method just updates our static data; in real life you'd run some sort of update in whatever datastore you're using.

```js
export async function updateTodo(id, newTitle) {
  const todo = todos.find(t => t.id == id);
  Object.assign(todo, { title: newTitle });
}
```

Let's try it out. We'll go to the list page

![Todo list](/sveltekit-intro/img6a-list-rendering.jpg)

Now let's click the edit button of one of them, to bring up the edit page, in /details.

![Editing a todo](/sveltekit-intro/img6b-edit-before.jpg)

Let's add a new title

![Adding a new title](/sveltekit-intro/img6c-edit-during.jpg)

Now let's click save. After a moment, we should be back on our /list page, with the new todo title applied.

![Adding a new title](/sveltekit-intro/img6d-edit-after.jpg)

How did the new title show up like that? It was automatic. Once we redirected over to the /list page, SvelteKit automatically re-ran all of our loaders, just like it would have, regardless. This is the key advancement next-gen application frameworks like SvelteKit, Remix, and Next 13 provide. Rather than giving you a convenient way to render pages, then wishing you the best of luck fetching to whatever endpoints you might have to update data, they integrate data mutation alongside data loading, allowing the two to work in tandem.

A few things you might be wondering:

This mutation update doesn't seem too impressive. The loaders will re-run whenever you navigate; what if we hadn't redirected in our form action, but stayed on the current page? SvelteKit would perform the update in the form action, like before, but would **still** re-run all of the loaders, for the current page, including the loaders in the pages layout(s).

Can we have more targeted means of invalidating our data? For example, our tags never re-ran, so in real life we wouldn't want to re-query them. Yes, what I showed you is just the default behavior for forms in SvelteKit. You can turn the default behavior off by [providing a callback to `use:enhance`](https://kit.svelte.dev/docs/form-actions#progressive-enhancement-use-enhance), and then SvelteKit provides manual [invalidation functions](https://kit.svelte.dev/docs/load#invalidation).

Loading data anew on every navigation is potentially expensive, and unnecessary. Can I cache this data like I do with tools like react-query? Yes, just differently. SvelteKit let's you set (and then respects) the cache-control headers the web already has. This, plus a Vary on a custom header can give you targeted invalidation. Stay tuned for my next post on how this all works.

Everything we've done was with static data, modifying values in memory. So if you ever want to revert everything and start over, just stop, and restart your `npm run dev` node process.

## Wrapping up

We've barely scratched the surface of SvelteKit, but hopefully we've seen enough to create some excitement. I can't remember the last time I've found web development this much fun.
