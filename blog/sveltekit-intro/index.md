---
title: Introducing SvelteKit
date: "2022-12-25T10:00:00.000Z"
description: A high-level introduction to SvelteKit
---

[SvelteKit]("https://kit.svelte.dev") is the latest of what I'd call next-gen application frameworks. It, of course, scaffolds an application for you, with the file-based routing, deployment, server-side rendering that Next has done forever. But SvelteKit also supports nested layouts, server mutations that sync up the data on your page, and some other niceties we'll get into.

This post is meant to be a high-level introduction to hopefully build some excitement for anyone who's never used SvelteKit. It'll be a relaxed tour. If you like what you see, the [full docs are here](https://kit.svelte.dev/docs/introduction).

In some ways this is a challenging post to write. SvelteKit is an _application framework_. It exists to help you build... well, applications. That makes it hard to demo. It's unfeasible to build an entire application in a blog post. So instead, we'll use our imaginations a bit. We'll build the skeleton of an application, have some empty <abbr>UI</abbr> placeholders, and hard-coded static data. The goal isn't to build an actual application, but instead to show you how SvelteKit's moving pieces work so you can build an application of your own.

To that end, we'll build the tried and true To-Do application as an example. But don't worry, this will be much, much more about seeing how SvelteKit works than creating yet another To-Do app.

The code for everything in this post is [available at GitHub](https://github.com/arackaf/sveltekit-blog-1). This project is also [deployed on Vercel](https://sveltekit-blog-1.vercel.app/) for a live demo.

### Creating your project

Spinning up a new SvelteKit project is simple enough. Run `npm create svelte@latest your-app-name` in the terminal and answer the question prompts. Be sure to pick "Skeleton Project" but otherwise make whatever selections you want for TypeScript, ESLint, etc.

Once the project is created, run `npm i` and `npm run dev` and a dev server should start running. Fire up `localhost:5173` in the browser and you'll get the placeholder page for the skeleton app.

### Basic routing

Notice the `routes` folder under `src`. That holds code for all of our routes. There's already a `+page.svelte` file in there with content for the root `/` route. No matter where in the file hierarchy you are, the actual page for that path always has the name `+page.svelte`. With that in mind, let's create pages for `/list`, `/details`, `/admin/user-settings` and `admin/paid-status`, and also add some text placeholders for each page.

Your file layout should look something like this:

![Initial files](/sveltekit-intro/img1-initial-pages.jpg)

You should be able to navigate around by changing URL paths in the browser address bar.

![Initial files](/sveltekit-intro/img2-initial-page-display.jpg)

### Layouts

We definitely want navigation links in our app, and we certainly don't want to copy the markup for them on each page we create. So, let's create a `+layout.svelte` file in the root of our `routes` folder we can use as a template, and add some content to it:

```html
<nav>
  <ul>
    <li>
      <a href="/">Home</a>
    </li>
    <li>
      <a href="/list">To-Do list</a>
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

Some rudimentary navigation with some basic styles. Of particular importance is the `<slot />` tag. This is _not_ [the slot you use with web components and shadow DOM]("https://css-tricks.com/encapsulating-style-and-structure-with-shadow-dom/#aa-including-content-from-the-light-dom"), but rather a Svelte feature indicating where to put our content. When a page renders, the page content will slide in where the slot is.

And now we have some navigation! We won't win any design competitions, but we're not trying to.

![Initial files](/sveltekit-intro/img3-root-layout.jpg)

### Nested layouts

What if we wanted all our admin pages to inherit the normal layout we just built and to also share some things common to all admin pages (but only admin pages)? No problem, we add another `+layout.svelte` file in our root `admin` directory, which will be inherited by everything underneath it. Let's do that and add this content:

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

We add a red banner indicating this is an admin page and then, like before, a `<slot />` denoting where we want our page content to go.

Our root layout from before renders. Inside of the root layout is a `<slot />` tag. The nested layout's content goes into the root layout's `<slot />`. And finally, the nested layout defines its own `<slot />`, into which the page content renders.

If you navigate to the admin pages, you should see the new red banner:

![Initial files](/sveltekit-intro/img4-nested-layout.jpg)

### Defining our data

OK, let's render some actual data — or at least, see how we can render some actual data. There's a hundred ways to create and connect to a database. This post is about SvelteKit though, not managing DynamoDB, so we'll "load" some static data instead. But, we'll use all the same machinery to read and update it that you'd use for real data. For a real web app, swap out the functions returning static data with functions connecting and querying to whatever database you happen to use.

Let's create a dirt-simple module in `lib/data/todoData.ts` that returns some static data along with artificial delays to simulate real queries. You'll see this `lib` folder imported elsewhere via `$lib`. This is a SvelteKit feature for that particular folder, and you can even [add your own aliases](https://kit.svelte.dev/docs/configuration#alias).

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

A function to return a flat array of our to-do items, a lookup of our tags, and a function to fetch a single to-do (we'll use that last one in our Details page).

### Loading our data

How do we get that data into our Svelte pages? There's a number of ways, but for now, let's create a `+page.server.js` file in our `list` folder, and put this content in it:

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

We've defined a `load()` function that pulls in the data needed for the page. Notice that we are _not_ `await`-ing calls to our `getTodos` and `getTags` async functions. Doing so would likely create a data loading waterfall as we wait for our to-do items to come in before loading our tags. Instead, we return the raw promises from `load`, and SvelteKit does the necessary work to `await` them.

So, how do we access this data from our page component? SvelteKit provides a `data` prop for our component with data on it. We'll access our to-do items and tags from it using a [reactive assignment](https://svelte.dev/docs#component-format-script-3-$-marks-a-statement-as-reactive).

Our List page component now looks like this.

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

And this should render our to-do items!

![List rendering](/sveltekit-intro/img6-list-rendering.jpg)

### Layout groups

Before we move on to the Details page and mutate data, let's take a peek at a really neat SvelteKit feature: **layout groups**. We've already seen nested layouts for all admin pages, but what if we wanted to share a layout between arbitrary pages at the same level of our file system? In particular, what if we wanted to share a layout between only our List page and our Details page? We already have a global layout at that level. Instead, we can create a new directory, but with a name that's in parenthesis, like this:

![Layout group](/sveltekit-intro/img5-layout-group.jpg)

We now have a layout group that covers our List and Details pages. I named it `(todo-management)` but you can name it anything you like. To be clear, this name will _not_ affect the URLs of the pages inside of the layout group. The URLs will remain the same; layout groups allow you to add shared layouts to pages without them all comprising the entirety of a directory in `routes`.

We _could_ add a `+layout.svelte` file and some silly `<div>` banner saying, "Hey we're managing to-dos". But let's do something more interesting. Layouts can define `load()` functions in order to provide data for all routes underneath them. Let's use this functionality to load our tags — since we'll be using our tags in our `details` page — in addition to the `list` page we already have.

In reality, forcing a layout group just to provide a single piece of data is almost certainly not worth it; it's better to duplicate that data in the `load()` function for each page. But for this post, it'll provide the excuse we need to see a new SvelteKit feature!

First, let's go into our `list` page's `+page.server.js` file and remove the tags from it.

```js
import { getTodos, getTags } from "$lib/data/todoData";

export function load() {
  const todos = getTodos();

  return {
    todos,
  };
}
```

Our List page should now produce an error since there is no `tags` object. Let's fix this by adding a `+layout.server.js` file in our layout group, then define a `load()` function that loads our tags.

```js
import { getTags } from "$lib/data/todoData";

export function load() {
  const tags = getTags();

  return {
    tags,
  };
}
```

And, just like that, our List page is rendering again!

#### We're loading data from multiple locations

Let's put a fine point on what's happening here:

- We defined a `load()` function for our layout group, which we put in `+layout.server.js`.
- This provides data for **all** of the pages the layout serves — which in this case means our List and Details pages. 
- Our List page also defines a `load()` function that goes in its `+page.server.js` file. 
- SvelteKit does the grunt work of taking the results of these data sources, merging them together, and making both available in `data`.

### Our Details page

We'll use our Details page to edit a to-do item. First, let's add a column to the table in our List page that links to the Details page with the to-do item's ID in the query string.

```html
<td><a href="/details?id={t.id}">Edit</a></td>
```

Now let's build out our Details page. First, we'll add a loader to grab the to-do item we're editing. Create a `+page.server.js` in `/details`, with this content:

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

Our loader comes with a `url` property from which we can pull query string values. This makes it easy to look up the to-do item we're editing. Let's render that to-do, along with functionality to edit it.

SvelteKit has wonderful built-in mutation capabilities, so long as you use forms. Remember forms? Here's our Details page. I've elided the styles for brevity.

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

We're grabbing the tags as before from our layout group's loader and the to-do item from our page's loader. We're grabbing the actual `tag` objects from the to-do's list of tag IDs and then rendering everything. We create a form with a hidden input for the ID and a real input for the title. We display the tags and then provide a button to submit the form.

If you noticed the `use:enhance`, that simply tells SvelteKit to use progressive enhancement and Ajax to submit our form. You'll likely always use that.

#### How do we save our edits?

Notice the `action="?/editTodo"` attribute on the form itself? This tells us where we want to submit our edited data. For our case, we want to submit to an `editTodo` "action."

Let's create it and add the following to the `+page.server.js` file we already have for Details (which currently has a `load()` function, to grab our to-do):

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

Form actions give us a `request` object, which provides access to our `formData`, which has a `get` method for our various form fields. We added that hidden input for the ID value so we could grab it here in order to look up the to-do item we're editing. We simulate a delay, call a new `updateTodo()` method, then redirect the user back to the `/list` page. The `updateTodo()` method merely updates our static data; in real life you'd run some sort of update in whatever datastore you're using.

```js
export async function updateTodo(id, newTitle) {
  const todo = todos.find(t => t.id == id);
  Object.assign(todo, { title: newTitle });
}
```

Let's try it out. We'll go to the List page first:

![Todo list](/sveltekit-intro/img6a-list-rendering.jpg)

Now let's click the Edit button for one of the to-do items to bring up the editing page in `/details`.

![Editing a todo](/sveltekit-intro/img6b-edit-before.jpg)

We're going to add a new title:

![Adding a new title](/sveltekit-intro/img6c-edit-during.jpg)

Now, click Save. That should get us back to our `/list` page, with the new to-do title applied.

![Adding a new title](/sveltekit-intro/img6d-edit-after.jpg)

How did the new title show up like that? It was automatic. Once we redirected to the `/list` page, SvelteKit automatically re-ran all of our loaders just like it would have done regardless. This is the key advancement that next-gen application frameworks, like SvelteKit, [Remix](https://remix.run), and [Next 13]("https://nextjs.org") provide. Rather than giving you a convenient way to render pages then wishing you the best of luck fetching whatever endpoints you might have to update data, they integrate data mutation alongside data loading, allowing the two to work in tandem.

A few things you might be wondering...

**This mutation update doesn't seem too impressive.** The loaders will re-run whenever you navigate. What if we hadn't added a redirect in our form action, but stayed on the current page? SvelteKit would perform the update in the form action, like before, but would **still** re-run all of the loaders for the current page, including the loaders in the page layout(s).

**Can we have more targeted means of invalidating our data?** For example, our tags never re-ran, so in real life we wouldn't want to re-query them. Yes, what I showed you is just the default forms behavior in SvelteKit. You can turn the default behavior off by [providing a callback to `use:enhance`](https://kit.svelte.dev/docs/form-actions#progressive-enhancement-use-enhance). Then SvelteKit provides manual [invalidation functions](https://kit.svelte.dev/docs/load#invalidation).

**Loading data on every navigation is potentially expensive, and unnecessary.** Can I cache this data like I do with tools like [`react-query`]("https://www.npmjs.com/package/react-query")? Yes, just differently. SvelteKit lets you set (and then it respects) the cache-control headers the web already provides. This, plus a [`Vary`]("https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary") on a custom header can give you targeted invalidation.

Everything we've done throughout this article uses static data and modifies values in memory. If you need to revert everything and start over, stop and restart the `npm run dev` Node process.

### Wrapping up

We've barely scratched the surface of SvelteKit, but hopefully you've seen enough to get excited about it. I can't remember the last time I've found web development this much fun. With things like bundling, routing, SSR, and deployment all handled out of the box, I get to spend more time coding than configuring.

Here are a few more resources you can use as next steps in your SvelteKit learning journey:

- [Announcing SvelteKit 1.0]("https://svelte.dev/blog/announcing-sveltekit-1.0") (Svelte Blog)
- [Beginner SvelteKit Course]("https://vercel.com/docs/beginner-sveltekit") (Vercel)
- [SvelteKit Documentation]("https://kit.svelte.dev/docs/introduction")