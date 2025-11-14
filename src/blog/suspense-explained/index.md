---
title: Suspense Explained
date: "2019-11-14T10:00:00.000Z"
description: A walk through of the family of React features commonly all referred to as "Suspense"
---

React Suspense is a new way for React components to wait for something asynchronous. It can be difficult to understand its scope at first because it doesn’t replace any concrete, existing solution. It’s not a data fetching library, but a new, different way to think about asynchronous UI. This post is my attempt at explaining what problems it solves, with what primitives, which I'll take you through step by step, showing what they do, and how they're employed.

What this post is *not* is a quick guide to improving your application's data loading with Suspense. If that's all you want, just read the docs for the modern Suspense-enabled Relay, and go to work.

Again, the only goal of this post is to explain what problems Suspense solves, but from a *slightly* lower level than what the current Suspense docs have, which left me with a lot of unanswered questions. This is the introduction to Suspense I was looking for when I first started reading about it. I hope it's also useful to some of you!

## The Plan

As usual with these posts, the code will come from my Booklist project, which is a side project of mine that exists to help me to learn modern JS tools. You don't really know a dev library until you build something with it, and this is that something, for me. Needless to say, since the project is the product of my own efforts, in scarce free time, don't expect high quality (especially the design). But it's good enough to explore ideas, which is our goal.

Our data loading will be done with my [micro-graphql-react](https://github.com/arackaf/micro-graphql-react) library, which provides some simple GraphQL React bindings. I've updated this library to have the pieces necessary to use Suspense, but of course any Suspense-ready library (and expect your favorite library to be updated soon, if it's not already) could be used instead.

## Our Use Case

Suspense is all about coordinating multiple async operations in a way that keeps your UI consistent. Let's explore what that means with an example. `booklist` unsurprisingly has a screen to display your books.

<img alt="Book list UI" width="1000" height="589" src="/suspense-explained/booklistView-sized.png" slot="image" />

The books are paged, but I also show the total count in the searched result set. Currently it's a single request that fetches the books, and the total, but let's pretend those two pieces of data are fetched with different queries—and for this blog post, I did split them out. As the current search changes, we fire off a new request to get our books, and a new request to get the total count for that result set. As each request is running, there's some sort of loading indicator in place. The books table has a subtle spinner overlaid, and the book count shows a small spinner next to it, while the next count total is fetching. Since they're distinct async operations, we have no control over which will finish first, or even how closely together they'll finish. That means the new books list may come in first, while the count for the previous search results continues to show, with a spinner next to it—or vice versa.

Coordinating these separate async operations in order to prevent this **inconsistent UI** is the point of what we're doing here.

## You may not need Suspense

Before I move on, I'd just like to note that, if your particular web app doesn't have multiple async operations running at the same time, which need to be coordinated, then **you may not need Suspense**. Please don't slog through this whole post, then take to social media to complain about how hard React now is. The same React you've been using will still work, and if you ever do need something like this, it's there.

## But first, that waterfall

Before we look at coordinating these requests, let's solve an unrelated problem: when we browse to this module (to view our books), our initial query does not fire until after the code for the books list component has loaded. This makes sense if we think about it. These queries are run from hooks called in our components, so the components' code needs to load (via rendering a component wrapped with `React.lazy`), before those queries can run. We can see this in the network tab: our queries don't run until after our code is done loading.

<img alt="Initial Waterfall" width="1000" height="168" src="/suspense-explained/initialWaterfall-sized.png" slot="image" />

The fix for this has absolutely nothing to do with Suspense, but it'll be extremely relevant later. We need to preload our query. Hopefully our data loading library has some sort of preload method that can kick off a data request ahead of time. For my GraphQL client, it's a `preload` method, so let's call that in our routing code. For this app and use case, the preloading happens to look like this

```typescript
export default function preload() {
  let variables = bookSearchVariablesFromCurrentUrl();
  graphqlClient.preload(GetBooksQuery, variables);
  graphqlClient.preload(GetBooksCountQuery, variables);
}
```

and after importing, and calling that function in our routing code when the books module becomes active, we see the waterfall vanish.

<img alt="Waterfall fixed" width="1000" height="201" src="/suspense-explained/initialWaterfallFixed-sized.png" slot="image" />

I'll stress, this has nothing to do with Suspense, or even React; this preloading is an essential part of the "render-as-you-fetch" pattern the React team promotes, with Suspense. But no matter what JS framework you're using, you should preload data as soon as you know you'll need it, even if your UI code isn't loaded yet.

## And now, Suspense

Ok let's get those two data requests in sync. First, let's wrap our module with a `Suspense` component, like this. Make sure your `<Suspense>` boundary is *above* any components which are reading data. That won't make a difference yet, but it'll affect `useTransition` in a bit.

```tsx
export default () => {
  return (
    <Suspense fallback={<h1>Loading, yo</h1>}>
      <MainBookModule />
    </Suspense>
  );
};
```

Now, as things are loading, we display the specified placeholder, which will not leave until everything is ready. The way we specify that we're waiting on something in userland is by throwing a promise. Components wrapped with `React.lazy` have their own, internal way of integrating with Suspense, but for userland, we handle it with a thrown promise.

A quick note, here. When you throw a promise, the identity of the promise should be consistent. So if you have query X, throw Promise P, a subsequent read for that same query should throw the same promise. Also, the very mechanism of throwing promises is an implementation detail, which may change. This should not affect application developers since in practice **all** of this low-level integration will be handled by your data fetching library. I'm explaining it only for you to get a decent idea of how things work.

So, to integrate with Suspense via `micro-graphql-react`, we'll use the `useSuspenseQuery` hook.

```typescript
const { data } = useSuspenseQuery<QueryOf<Queries["allBooks"]>>(
  buildQuery(GetBooksQuery, variables, { onMutation: onBooksMutation })
);
```

See the [micro-graphql-react docs](https://github.com/arackaf/micro-graphql-react) for more info, but `useSuspenseQuery` is a companion hook to `useQuery`. They're both for loading data via GraphQL queries, and have identical API's, except `useSuspenseQuery` throws a promise when used if, (and only if), the requested data are not ready. And now, lo and behold, our app does not activate until all of our data are ready. Our silly "Loading, yo" message will show when the component first mounts, if either piece of data are not ready.

Hooray!

But there's a problem. Two in fact. When we change our search parameters, our entire UI abruptly vanishes, to show that same "Loading, yo" from before.

We'd probably prefer to just show the current data, and then update it all when ready—perhaps with a subtle, inline spinner to show that new data are being loaded. The other problem is worse: we've introduced a new waterfall. On each update, each of our queries run serially.

<img alt="Another Waterfall" width="1000" height="140" src="/suspense-explained/incrementalWaterfall-sized.png" slot="image" />

This is because `useSuspenseQuery` is throwing a promise when encountered. That causes React to suspend rendering (get it - that's why it's called Suspense), until the requested data are ready. In this particular case, the two reads are nested beneath one another: the first query happens in a component that's above the component containing the other query. Normally React will try to render every possible branch of your component tree, even if a component suspends. So if you have

```tsx
<Component>
  <A />
  <B />
</Component>
```

and `A` and `B` both suspend, you will **not** get a waterfall. The code above, however, is more similar to `Component` suspending, and then `A` also suspending. So React cannot possible Render `A`, until `Component` is done—hence the waterfall.

There's two possible fixes. I could move the top read to be lower, deeper in the component tree, to where that data are actually **used**. Currently I was reading this data high in the component tree, and putting the results in context. If you've heard people say that with Suspense, you should read data as low as possible, only when used, this is a huge reason why.

The other fix, and the one I'll use here, to avoid refactoring, is the same as the fix for the original waterfall: preload. When our URL changes, just preload the new data we'll need, using the exact same preload method from before. If you're using any kind of decent routing library, you can likely do both of these preloads in one place, as your `<Route />` receives new match parameters. Since my app is *not* using a decent routing library, I'll just have to duplicate that function call; but that shortcoming is entirely due to my own bad architecture, and not React or Suspense

```typescript
useEffect(() => {
  return history.listen(() => {
    preload(); //preload before updating!
    const { searchState } = getCurrentHistoryState();
    dispatch(hashChanged(searchState));
  });
}, []);
```

And now our waterfall is gone

<img alt="Waterfall fixed" width="1000" height="141" src="/suspense-explained/incrementalWaterfallFixed-sized.png" slot="image" />

## useTransition

Now let's make the UX a little nicer. Wouldn't it be nice if, instead of setting our new state, and kicking off a render that suspended, triggering our `Suspense` boundary which removed our existing UI, we could, instead, tell React to start the new render, but "off to the side, in memory." What if we could tell React: fork my entire app to an in-memory copy, apply the state there, and then apply the new, updated UI to the screen when it's all ready, or after a specified amount of time has expired (whichever comes first). That's `what useTransition` does, and I'll explain it some more, don't worry.

Here's how we use it

```typescript
let [startTransition, isPending] = useTransition({
  timeoutMs: 3000
});

// ...

useEffect(() => {
  return history.listen(() => {
    // This line is needed due to a React bug that's already fixed in master. Ignore it
    unstable_runWithPriority(unstable_UserBlockingPriority, () => {
      startTransition(() => {
        preload(); //preload before updating!
        const { searchState } = getCurrentHistoryState();
        dispatch(hashChanged(searchState));
      });
    });
  });
}, []);
```

this tells React to start rendering this state change in a detached, in-memory copy of my app. If everything finishes, and stops suspending before the 3 second timeout, then cool, we'll update the UI then, with our new, consistent results. If it's not done within three seconds, then we'll apply it anyway, in it's suspended state, which will trigger the Suspense boundary's fallback ("Loading, yo").

The `isPending` does what it says, and we can use it to display some sort of local loading indicator. The difference is, *that* loading indicator will represent the loading state of *all* pending async operations. Again, that's what Suspense gives us: it allows us to coordinate multiple, separate async operations. Previously we would have to either co-locate these data requests somehow, and tie them together with `Promise.all`, or just fire them separately, and live with the possibility of an inconsistent UI, as the requests come back in a non-deterministic order.

Tweak that timeout amount as desired, and remember, you can use anything you want for the fallback display. The "Loading, yo" was silly and snarky; in practice you'll likely make it a shell of your actual UI, with a special message indicating how sorry you are that this search is taking so long.

## A warning on integrating this into existing applications

Remember, you don't have to add Suspense to existing code, and doing so *might* be more work than you think. When changing the code above to use Suspense api's, I noticed that my `<Suspense>` boundary (the ugly "Loading, yo" message) was being triggered at unexpected times. This happened because of state changes that were **not** wrapped in `startTransition`, which triggered new data loading. As you convert data reads to be Suspense ready, be *certain* to wrap **every** state change that triggers those reads with `startTransition`

## Where to, from here

Remember, you can place `<Suspense>` boundaries wherever you want. If a component suspends during rendering, React will render the fallback of the *first* Suspense boundary it can find, by walking *up* the tree from where the suspension happened. You can also use `useTransition` wherever you want, for any state change that involves async data loading (including lazy-loaded components created with `React.lazy`)

With that in mind, I'll briefly note that these same primitives will likely need to be integrated into whatever routing solution you're using. New route parameters will likely need to be set with `useTransition`, with some sort of soft spinner that can display over the old route, while the new one loads. Which of course means you'll need a `<Suspense />` boundary at the very top of your app, to handle route transitions that take longer than the specified timeout.

## Wrapping up

React Suspense provides some incredibly exciting primitives to help coordinate async actions, and improve the smoothness, and consistency of the user interfaces we build. It's never been a better time to be a React developer.

Happy Coding!
