---
title: Wrangling useReducer, from action creators to typings
date: "2019-05-24T10:00:00.000Z"
description: A walk through of the various ways useReducer can be made more ergonomic, from simulating Redux-like action creators, to adding typings to vanilla `useReducer` via TypeScript.
---

`useReducer` is an outstanding construct for managing state in React applications; however, there can be situations in which passing around a dispatch function can be less convenient than a typical callback. This post will walk through ways of managing this. We'll look at wrapping dispatch actions into stand-alone functions which can be called with just the arguments they need; if you've used Redux, this will be familiar. We'll then discuss some issues with this, and look at a safer, simpler approach: adding static typings to your reducer (and concomitant dispatch function).

If you're new to `useReducer`, be sure to check out [my prior post on it](https://adamrackis.dev/state-and-use-reducer/).

This code in this post will often use TypeScript, especially at the end, when we start adding our own typings. If you're unfamiliar with TypeScript, _some_ of the code below may look unfamiliar.

## Our App state reducer

As usual with these posts, the code will all come from my Booklist project. For those new here, it's a side project I have that's helped me learn new web dev things (like React!), and also, incidentally, let's me track my own book collection—for whatever reason.

Anyway, this is what my appState reducer looks like. It's directly adapted from Redux, since this app was built with Redux originally, which I recently converted to hooks.

```typescript
function appReducer(state: AppState, action): AppState {
  switch (action.type) {
    case SET_PUBLIC_INFO:
      return {
        ...state,
        isPublic: true,
        publicName: action.publicName,
        publicBooksHeader: action.publicBooksHeader,
        publicUserId: action.userId
      };
    case RESET_PUBLIC_INFO:
      return {
        ...state,
        isPublic: false,
        publicName: "",
        publicBooksHeader: "",
        publicUserId: ""
      };
    case REQUEST_DESKTOP:
      return { ...state, showingDesktop: true, showingMobile: false };
    case REQUEST_MOBILE:
      return { ...state, showingDesktop: false, showingMobile: true };
    case SET_MODULE:
      return { ...state, module: action.module };
    case NEW_LOGIN:
      let { logged_in, userId } = isLoggedIn();
      return { ...state, isLoggedIn: !!logged_in, userId };
    case IS_OFFLINE:
      return { ...state, online: false };
    case IS_ONLINE:
      return { ...state, online: true };
    case SET_THEME:
      return { ...state, colorTheme: action.theme };
  }

  return state;
}
```

This reducer manages things like desktop vs mobile views, login state, if a publicly-available user's books are being viewed, online/offline status, etc.

In the Redux days we could, for free, wire up action creators, like this

```javascript
const requestDesktop = () => dispatch => {
  setDeviceOverride("desktop");
  dispatch({ type: REQUEST_DESKTOP });
};

const requestMobile = () => dispatch => {
  setDeviceOverride("mobile");
  dispatch({ type: REQUEST_MOBILE });
};

const setModule = module => ({ type: SET_MODULE, module });
const setPublicInfo = publicInfo => ({ type: SET_PUBLIC_INFO, ...publicInfo });
```

In the first two examples, the action creator returns a _function_, which is passed the dispatch function, which we can use as needed. And of course the second two are simpler action creators that just automate creation of our dispatch packets.

Without Redux, how can we get a similar, simple way of working with this reducer?

## A false profit: emulating Redux

Let's start out by just re-creating Redux's action creator api—or at least something very similar—from scratch, using closures and other fun JavaScript tricks. I'll say upfront that this approach adds a lot of complexity; some would say it adds too much complexity. But with popular projects on npm today which do similar things, it's worth looking at how it works. And of course you might decide this approach adds less complexity than claimed, and is worth the effort for the nicer api.

### And the first one now will later be last

We'll start by looking at the end result, so we can see what we're building, and then proceed to see how it's built. The goal is to have a single hook that wraps the reducer above, exposing the current state; the action creators; and the raw dispatch function, just in case. To be precise, we'll have the hook return an array containing those three things, in that order. The final hook looks like this

```typescript
export function useAppState(): [AppState, any, any] {
  //other actions elided for space
  let actions = { requestDesktop, requestMobile, setModule, setPublicInfo };
  let result = getStatePacket<AppState>(appReducer, initialState, actions);

  let colorTheme = result[0].colorTheme;
  useEffect(() => {
    localStorageManager.set("color-theme", colorTheme);
    document.body.className = colorTheme;
  }, [colorTheme]);

  return result;
}
```

That hook will then be called in one place, with the result placed on context. Then any component that needs access to this app state can grab it from context.

```javascript
const [{ colorTheme }, actions, dispatch] = useContext(AppContext);
```

### Hook it up!

Everything above hinges on `getStatePacket`, so let's turn there.

```typescript
export function getStatePacket<T>(
  reducer,
  initialState,
  actions?
): [T, any, any] {
  let [state, dispatch] = useReducer(reducer, initialState);
  let newDispatch = useCallback(
    val => {
      if (typeof val === "object") {
        dispatch(val);
      } else if (typeof val === "function") {
        val(dispatch, () => state);
      } else throw "Fuck off";
    },
    [state, dispatch]
  );

  return useMemo(
    () => [
      state,
      actions ? makeActionCreators(newDispatch, actions) : {},
      dispatch
    ],
    [state]
  ) as any;
}
```

This function wraps our dispatch so a function (or "thunk") can be dispatched. That's what allowed `requestDesktop` and `requestMobile` to work, above. If our new dispatch is passed an object, we dispatch it, and are done. If a function is dispatched, we _call_ the function, passing it both the original dispatch function, as well as a function that returns the current state (Redux called this `getState`).

A quick note: `getState` will not return the "correct" state, by which I mean, if, inside your thunk, you call `dispatch(someAction)`, you cannot, synchronously, then call `getState()` and expect to see an updated result reflecting what you just dispatched. This is not a flaw in the code above, but rather central to how React updates state. tl;dr - the synchronous updates from Redux were nice, but they may not play well in a Suspense-enable world.

While it's cool that we can now dispatch a function, we still don't have a way to _just call_ those action creators, and have their results dispatched, automatically. Let's turn there, next.

### Wire the action creators

The only remaining piece is re-shaping our action creators so they can work with our dispatch function. We basically need to take each action creator, and add a level of indirection on top of it. So for each function, `f`, we need to make a new function that takes any and all `args` it was passed, and have it call `dispatch(f(args))`.

This is what allowed some of our action creators to be defined as higher ordered functions.

```javascript
const requestDesktop = () => dispatch => {
```

For these, calling `dispatch(f(args))` returns that inner function taking dispatch as the first argument (and `getState` as the second, although it's not used here). _This_ function is what will be called in `getStatePacket`, in the `else if (typeof val === "function")` branch.

After all that build-up, the end result is relatively boring.

```javascript
export function makeActionCreators(dispatch, fns) {
  return Object.entries(fns).reduce((hash, [name, fn]) => {
    hash[name] = (...args) => dispatch(fn(...args));
    return hash;
  }, {});
}
```

We loop through each action creator, and create a new function that forwards its arguments to the original function, takes the result, and passes it to dispatch. If the result is itself a new function, ie a thunk, `getStatePacket` will call it, and pass in dispatch. If that result is just an object, then `getStatePacket` will just dispatch it and be done.

If `Object.entries` seems scary, know that it's basically just `Object.keys`, except it _also_ gives you the corresponding values. If `reduce` seems scary, know that that's normal. If you're not well familiar with `Array.prototype.reduce`, I'd highly recommend you read through [the docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), and practice with it. It's one of the most versatile, useful tools you can have in your toolbox.

### Warning

Did you catch how our action creators were re-created every time the reducer's state changed? This was essential to prevent stale closures; but it also means it needs to be present in any dependency lists. For example, if you call one of these action creators in `useEffect` (which is very likely), then you'll need to be sure you add the action creator itself to the dependency list.

It's also worth noting that re-binding all of these functions on every state change will incur a performance cost. It's likely this cost will be small, but it's also possible this cost can become noticeable in hot paths, if this pattern is used a lot.

## Re-thinking our life choices

Let's step back for a moment and remember what our original goal was: to make dealing with our reducer easier. Some people, myself included, find it easier to work with an action creator, than a raw dispatch function, since they're essentially typed for free. With action creators, our editor will tell us every action creator there is (via autocompletion when importing), and it'll tell us which arguments they take, often with types inferred automatically (or added manually, when needed).

But can we get these same benefits without all the overhead we saw above? It turns out we can come pretty close. But first, let's make a quick tweak to our reducers in general.

### Tweaking our reducer

Dan Abramov was nice enough to share this tip with me me: your reducer doesn't _have_ to dispatch an object; you're allowed to dispatch an array. This allows you to do things like

```javascript
dispatch(["ADD_TODO", { id: 1, title: "Write Blog" }]);
```

as opposed to

```javascript
dispatch({ type: "ADD_TODO", value: { id: 1, title: "Write Blog" } });
```

I've found this to be a nice idiom to work with, so let's stick with it.

### Our new reducer

To keep things simple, let's start with a fresh, smaller reducer, that'll let us focus on the typings we'll gradually add.

```javascript
const initialState = {
  x: 1,
  y: 2,
  z: 3,
  str: "Hello"
};

function myReducer(state, [type, payload]) {
  switch (type) {
    case "SET_X":
      return { ...state, x: payload };
    case "SET_Y":
      return { ...state, y: payload };
    case "SET_Z":
      return { ...state, z: payload };
    case "SET_STR":
      return { ...state, str: payload };
  }
}
```

It doesn't do anything useful, but that's ok; we're only interested in seeing how to add typings.

### Type the return value

Let's start by typing the shape of the state returned by the reducer. We do this by adding a return type to the reducer, like so

```javascript
function myReducer(state, [type, payload]): typeof initialState {
```

Now, when we use this reducer, TypeScript will tell us what fields are on our returned state.

![Typed reducer state](/redux-in-hooks/stateFromReducer.png)

That was the easy part. Let's turn to our dispatch function, and see how we can get it to communicate its actions to TypeScript, and to us. Don't worry, this won't be terribly difficult, either.

### Type the dispatch function

The key to typing our dispatch function is to provide a typing for each action that can be dispatched, and then assigning the payload to the union of all of them. The code will hopefully explain this more clearly than I can

```typescript
type actions =
  | ["SET_X", number]
  | ["SET_Y", number]
  | ["SET_Z", number]
  | ["SET_STR", string];

function myReducer(state, [type, payload]: actions): typeof initialState {
  // as before
}
```

`actions` is a type—the union of all possible actions. If it seems like too much work to add a different type tuple for each possible switch branch, keep in mind that before we were adding a whole new **function** for each switch branch.

Now, when we start to dispatch an action, we'll get a nice autocomplete on the action names.

![Typed action names](/redux-in-hooks/typedDispatch.png)

Unfortunately, VS Code isn't quite, yet, up to the task of providing auto-complete info on the payload.

![No auto-complete on payload](/redux-in-hooks/typedDispatchLimitation.png)

But you can always jump to the reducer definition and quickly peak at the types, and regardless, if you use it wrong, TypeScript will tell you.

![Typed payload](/redux-in-hooks/typedDispatchCheckingCorrectly.png)

### What about thunk dispatches?

Remember when we could create an action creator as a higher ordered function, which allowed us to wrap multiple dispatches up in one package? Let's say we wanted a function that would dispatch a new value to X, wait a second, then dispatch a second value to X. Without the mechanism to wrap and auto-dispatch thunks, how close can we get to those same ergonomics? Pretty close. Just drop the HoF, and pass dispatch as your first argument.

```javascript
const staggeredSetX = (dispatch, x1, x2) => {
  dispatch(["SET_X", x1]);
  setTimeout(() => {
    dispatch(["SET_X", x2]);
  }, 1000);
};
```

Of course `dispatch` is implicitly typed as `any`, now. If we want the same autocomplete as before, we can type it with our `actions` type, like so

```typescript
const staggeredSetX = (dispatch: (packet: actions) => any, x1, x2) => {
  dispatch(["SET_X", x1]);
  setTimeout(() => {
    dispatch(["SET_X", x2]);
  }, 1000);
};
```

And now we can just call that function, and pass `dispatch` in manually.

```typescript
const Widget: FunctionComponent<{}> = () => {
  const [state, dispatch] = useReducer(myReducer, initialState);

  staggeredSetX(dispatch, 3, 4);

  //rest of component
};
```

## Wrapping up

So there you have it. `useReducer` can be paired with some abstractions to simulate a Redux-like api, at the expense of complexity, and potential perf implications. Or a dash of TypeScript can get you something almost as nice, with a much lower cost. I'd recommend the latter, but try both and see for yourself.

Happy Coding!
