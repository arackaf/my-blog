---
title: Introducing Zustand
date: "2025-07-05T10:00:00.000Z"
description: An introduction to Zustand, a small but powerful state management library for React
---

## Fun introduction to Zustand

Zustand is a minimal, but fun and effective state management library. It's somewhat weird for me to write an introductory blog post on a tool that's over 5 years old, and pretty popular. But it's popular for a reason, and there's almost certainly more devs who aren't familiar with it than are; so if you're in the former group, hopefully this post will be the concise and impactful introduction you didn't know you needed.

The code for everything in this post is on [my github](https://github.com/arackaf/zustand-sandbox).

## Getting started

We'll look at a toy app, that does the minimal possible amount of work so we can focus on the state management. The app is a basic shell of a task management library. It shows a (static) like of tasks, there's a button to add a new task, a heading showing the number of tasks, and then a component to change the ui view between three options.

Moreover, the same app was written 3 times, once using vanilla React context for state, once using Zustand simply but non-idiomatically, and then a third version using Zustand more properly, so we can see some of the performance benefits it offers.

![image](/zustand/img1-app.png)

Each of the 3 apps is identical, except for the label just above the Add New Task button.

Each app is broken down more or less identically to this.

```tsx
function App() {
  console.log("Rendering App");

  return (
    <div className="m-5 p-5 flex flex-col gap-2">
      <VanillaLabel />
      <AddNewTask />
      <TasksCount />
      <TasksHeader />
      <Filter />
      <TasksBody />
    </div>
  );
}
```

It's probably more components than needed, but it'll help us inspect render performance.

### The state we need

Our state payload for this app will be an array of tasks, and a method to update the tasks; the current ui view being displayed, and a function to update it; and a current filter, with, of course, a method to update it.

Obviously those values can all simply be declared as various pieces of state, and then passed down the component tree as needed. This is simple and it works, but the excessive amount of prop passing, often referred to as "prop drilling," can get annoying pretty quickly. There's many ways of avoiding this, from state management libraries like Zustand, Redux, MobX, etc; to regular old React context.

For this post, we'll first see what this looks like using React context, and then we'll see how Zustand can simplify things, while improving performance in the process.

## The vanilla version

There's a very good argument to be made that React's context feature was not designed to be a state management library; but that hasn't stopped many devs from trying. In order to avoid excessive prop drilling, while avoiding _yet another_ external dependency, devs will often put the state needed for a certain part of their UI into context, and then access it lower in the component tree, as needed.

Our app here has its entire state stored like this, but that's just a product of how unrealistically small it is.

Ok let's get started. First we have to declare our context

```ts
const TasksContext = createContext<TasksState>(null as any);
```

Then we need a _component_ that renders a _Provider_ for that context, while declaring, and then passing in the actual state

```ts
export const TasksProvider = ({ children }: { children: ReactNode }) => {
  console.log("Rendering TasksProvider");

  const [tasks, setTasks] = useState<Task[]>(dummyTasks);
  const [currentView, setCurrentView] = useState<TasksView>("list");
  const [currentFilter, setCurrentFilter] = useState<string>("");

  const value: TasksState = {
    tasks,
    setTasks,
    currentView,
    setCurrentView,
    currentFilter,
    setCurrentFilter,
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
};
```

The logging `console.log("Rendering TasksProvider");` is present in every component in all versions of this app, so we can inspect re-renders.

Notice how we have to declare each piece of state with `useState` (or `useReducer`)

```ts
const [tasks, setTasks] = useState<Task[]>(dummyTasks);
const [currentView, setCurrentView] = useState<TasksView>("list");
const [currentFilter, setCurrentFilter] = useState<string>("");
```

and then splice it together in our big state payload, and then render our context provider

```tsx
const value: TasksState = {
  tasks,
  setTasks,
  currentView,
  setCurrentView,
  currentFilter,
  setCurrentFilter,
};

return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
```

To _get_ the current context value in a component that wants to use it, we call the `useContext` hook, and pass in the context object we declared above. To simplify this, it's not uncommon to build a simple hook for just this purpose

```ts
export const useTasksContext = () => {
  return useContext(TasksContext);
};
```

and now components can grab whatever slice of state they need

```ts
const { currentView, tasks, currentFilter } = useTasksContext();
```

### What's the problem?

This code is _fine_. It's simple enough. And it works. I'll be honest though, as someone who works with code like this a lot, the boilerplate can become annoying pretty quickly. We have to declare each piece of state with the normal React primitives (useState, useReducer), and then also integrate it into our context payload (and typings). It's not the worst thing to deal with; it's just annoying.

Another downside of this code is that _all_ consumers of this context will always rerender anytime _any_ part of the context changes, even if that particular component is not using the part of the context that just changed. We can see that with the logging that's in these components.

For example, changing the current ui view rerenders everything, even though only the task header, and task body read that state

![image](/zustand/img2-context-rerender.png)

## Introducing Zustand

As we said, Zustand is a minimal, but powerful state management library. To create a piece of state, Zustand gives you a `create` method

```ts
import { create } from "zustand";
```

It's easier to show this, than to describe it

```ts
export const useTasksStore = create<TasksState>(set => ({
  tasks,
  setTasks: (arg: Task[] | ((tasks: Task[]) => Task[])) => {
    set(state => {
      return {
        tasks: typeof arg === "function" ? arg(state.tasks) : arg,
      };
    });
  },
  currentView: "list",
  setCurrentView: (newView: TasksView) => set({ currentView: newView }),
  currentFilter: "",
  setCurrentFilter: (newFilter: string) => set({ currentFilter: newFilter }),
}));
```

We give Zustand a function that takes a `set` function. Zustand will call this function and pass a set callback, and you return your state. The result of the create function will be a react hook that you use to _read_ your state.

Your state is free to use the `set` function however you want in order to update your state.

Notice our updating functions like

```ts
setCurrentView: (newView: TasksView) => set({ currentView: newView }),
```

By default `set` will take what we return, and _integrate it_ into the state that's already there. So we can just return the pieces that have changed, and Zustand will handle the update.

Naturally there's an override: if we pass `true` for the second argument to `set`, then what we return will overwrite the existing state in its entirety. So

```ts
clear: () => set({}, true);
```

Would wipe our state, and replace it with an empty object; use this cautiously!

### Reading our state

To read our state in the components which need it, we just ... call the hook that was returned from `create`, which would be `useTasksStore` from above. We _could_ read our state in the same way we read our context above

**
CALLOUT
This is actually not the best way to use Zustand - stay tuned for a better way to use this api
**

```ts
const { currentView, tasks, currentFilter } = useTasksStore();
```

This will work, and behave exactly like our context example before.

This means changing the current UI view will again re-render all components that read _anything_ from the Zustand store, whether related to this piece of state, or not.

![image](/zustand/img3-zustand-default-rerender.png)

## The correct way to read state

It's easy to miss in the docs the first time you read them, but when reading from your zustand store, you shouldn't do this

```ts
const { yourFields } = useTasksStore();
```

Zustand is well optimized, and will cause the component with the call to `useTasksStore` to only re-render when the _result_ of the hook call changes. By default it returns an object with your entire state. And when you change any piece of your state, the surrounding object will of course have to be recreated by Zustand, and will no longer match.

Instead, you pass a selector argument into `useTasksStore`, in order to _select_ the piece of state you want. The simplest usage would look like this

```ts
const currentView = useTasksStore(state => state.currentView);
const tasks = useTasksStore(state => state.tasks);
const currentFilter = useTasksStore(state => state.currentFilter);
```

Now our call returns only our `currentView` value in the first line, or our `tasks` array, or `currentFilter` in our second, and third lines respectively.

If you don't like having those multiple calls, you're free to use Zustand's `useShallow` helper

```ts
import { useShallow } from "zustand/react/shallow";

// ...
const { tasks, setTasks } = useTasksStore(
  useShallow(state => ({
    tasks: state.tasks,
    setTasks: state.setTasks,
  }))
);
```

The `useShallow` hook lets us return an object with the state we want, and will trigger a re-render only if a shallow check on the properties in this object changes.

If you want to save a few lines of code, you're also free to return an array with useShallow

```ts
const [tasks, setTasks] = useTasksStore(useShallow(state => [state.tasks, state.setTasks]));
```

which does the same thing.

The zustand-optimized version of the app only uses the `useTasksStore` hook with a selector function, which means we can observer our improved re-rendering.

So changing the current UI view will only rerender the components that use the ui view part of the state.

![image](/zustand/img4-zustand-optimized.png)

Obviously for a trivial app like this it doesn't matter, but for a large app at scale this can be beneficial, especially for users on slower devices.

## Odds and ends

The full docs are [here](https://github.com/pmndrs/zustand). Zustand has a delightfully small surface areas, so I'd urge you to just read the docs if you're curious.

That said, there's a few features worth calling out here

### Async friendly

Zustand doesn't care where or when your `set` function is called. You're free to have async methods in your store, which call `set` after a fetch.

The docs offer this example

```ts
const useFishStore = create(set => ({
  fishies: {},
  fetch: async pond => {
    const response = await fetch(pond);
    set({ fishies: await response.json() });
  },
}));
```

### Reading state inside your store, but outside of set

We already know that we can call `set(oldState => newState)` but what if we need (or just want) to read the _current_ state inside one of our actions?

It turns out out create also has a second argument, `get`, that you can reference for this very purpose

```ts
export const useTasksStore = create<TasksState>((set, get) => ({
```

And now you can do something like this

```ts
clearEvenTasks: () => {
  const oddTasks = get().tasks.filter((_, index) => index % 2 === 0);
  set({ tasks: oddTasks });
},
```

### Reading state outside of React components

Zustand gives you back a react _hook_ from `create`. But what if you want to read your state outside of a React component? Zustand attaches a `getState()` method directly onto your hook, which you can call anywhere

```ts
useEffect(() => {
  setTimeout(() => {
    console.log("Can't call a hook here");
    const tasks = useTasksStore.getState().tasks;
    console.log({ tasks });
  }, 1000);
}, []);
```

### Pushing further

Zustand also supports manual, fine-grained subscriptions; bindings for vanilla JavaScript, with no React at all; and integrates well with immutable helpers like Immer; and some other, more advanced goodies, we won't try to cover here. Check out the docs if this post has sparked your interest!

## Concluding thoughts

Zustand is a wonderfully simple, frankly fun library to use to manage state management in React. And as an added bonus, it can also improve your render performance.

Happy Coding!
