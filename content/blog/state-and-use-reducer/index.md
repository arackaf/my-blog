---
title: Hooks, State, Closures, and useReducer
date: "2019-03-09T20:00:32.169Z"
description: A brief look at how useReducer can simplify your code, particularly with effects and closures.
---

For those of us coming from a Redux background, `useReducer` can seem deceptively complex and unnecessary. Between `useState` and context, it's easy to fall into the trap of thinking that a reducer adds unnecessary complexity for the majority of simpler use cases; however, it turns out `useReducer` can greatly simplify state management. Let's look at an example.

As with my other posts, this code is from my [booklist project](https://github.com/arackaf/booklist). The use case is that a screen allows users to scan in books. The ISBNs are recorded, and then sent to a rate-limited service that looks up the book info. Since the lookup service is rate limited, there's no way to guarentee your books will get looked up anytime soon, so a web socket is set up; as updates come in, messages are sent down the ws, and handled in the ui. The ws's api is dirt simple: the data packet has a `_messageType` property on it, with the rest of the object serving as the payload. Obviously a more serious project would design something sturdier.

With component classes, the code to set up the ws was straightforward: in `componentDidMount` the ws subscription was created, and in `componentWillUnmount` it was torn down. With this in mind, it's easy to fall into the trap of attempting the following with hooks

```javascript
const BookEntryList = props => {
  const [pending, setPending] = useState(0);
  const [booksJustSaved, setBooksJustSaved] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(webSocketAddress("/bookEntryWS"));

    ws.onmessage = ({ data }) => {
      let packet = JSON.parse(data);
      if (packet._messageType == "initial") {
        setPending(packet.pending);
      } else if (packet._messageType == "bookAdded") {
        setPending(pending - 1 || 0);
        setBooksJustSaved([packet, ...booksJustSaved]);
      } else if (packet._messageType == "pendingBookAdded") {
        setPending(+pending + 1 || 0);
      } else if (packet._messageType == "bookLookupFailed") {
        setPending(pending - 1 || 0);
        setBooksJustSaved([
          {
            _id: "" + new Date(),
            title: `Failed lookup for ${packet.isbn}`,
            success: false,
          },
          ...booksJustSaved,
        ]);
      }
    };
    return () => {
      try {
        ws.close();
      } catch (e) {}
    };
  }, []);

  //...
};
```

We put the ws creation in a `useEffect` call with an empty dependency list, which means it'll never re-fire, and we return a function to do the teardown. When the component first mounts, our ws is set up, and when the component unmounts, it's torn down, just like we would with a class component.

## The problem

This code fails horribly. We're accessing state inside the `useEffect` closure, but not including that state in the dependnecy list. For example, inside of `useEffect` the value of `pending` will absolutely always be zero. Sure, we might call `setPending` inside the `ws.onmessage` handler, which _will_ cause that state to update, and the component to re-render, but when it re-renders our `useEffect` will **not** re-fire (again, because of the empty dependency list)—as a result that closure will go on closing over the now-stale value for `pending`.

To be clear, using the Hooks linting rule, discussed below, would have caught this easily. More fundamentally, it's essential to break with old habits from the class component days. Do _not_ approach these depenedency lists from a `componentDidMount` / `componentDidUpdate` / `componentWillUnmount` frame of mind. Just because the class component version of this would have set up the web socket once, in `componentDidMount`, does _not_ mean you can do a direct translation into a `useEffect` call with an empty dependency list.

Don't overthink, and don't be clever: any value from your render function's scope that's used in the effect callback needs to be added to your dependency list: this includes props, state, etc. That said—

## The solution

While we _could_ add every piece of needed state to our `useEffect` dependency list, this would cause the web socket to be torn down, and re-created on every update. This would hardly be efficient, and might actually cause problems if the ws sends down a packet of initial state on creation, that might already have been accounted for, and updated in our ui.

If we look closer, however, we might notice something interesting. Every operation we're performaing is always in terms of prior state. We're always saying something like "incremenet the number of pending books," "add this book to the list of completed," etc. This is precisely where a reducer shines; in fact, **sending commands that project prior state to a new state is the whole purpose of a reducer**.

Moving this entire state management to a reducer would eliminate any references to local state within the `useEffect` callback; let's see how.

```javascript
function scanReducer(state, [type, payload]) {
  switch (type) {
    case "initial":
      return { ...state, pending: payload.pending };
    case "pendingBookAdded":
      return { ...state, pending: state.pending + 1 };
    case "bookAdded":
      return {
        ...state,
        pending: state.pending - 1,
        booksSaved: [payload, ...state.booksSaved],
      };
    case "bookLookupFailed":
      return {
        ...state,
        pending: state.pending - 1,
        booksSaved: [
          {
            _id: "" + new Date(),
            title: `Failed lookup for ${payload.isbn}`,
            success: false,
          },
          ...state.booksSaved,
        ],
      };
  }
  return state;
}
const initialState = { pending: 0, booksSaved: [] };

const BookEntryList = props => {
  const [state, dispatch] = useReducer(scanReducer, initialState);

  useEffect(() => {
    const ws = new WebSocket(webSocketAddress("/bookEntryWS"));

    ws.onmessage = ({ data }) => {
      let packet = JSON.parse(data);
      dispatch([packet._messageType, packet]);
    };
    return () => {
      try {
        ws.close();
      } catch (e) {}
    };
  }, []);

  //...
};
```

While slightly more lines, we no longer have multiple update functions, our `useEffect` body is much more simple and readable, and we no longer have to worry about stale state being trapped in a closure: all of our updates happen via dispatches against our single reducer. This also aids in testability, since our reducer is incredibly easy to test; it's just a vanilla JavaScript function. As Sunil Pai from the React team puts it, using a reducer helps separate reads, from writes. Our `useEffect` body now only worries about dispatching actions, which produce new state; before it was concerned with both reading existing state, and also writing new state.

Lastly, you may have noticed actions being to the reducer as an array, with the type in the 0th slot, rather than as an object with a `type` key. Either are allowed with useReducer; this is just a trick Dan Abramov showed me to reduce the boilerplate a bit :)

## Linting against errors like this

As I mentioned above, the wonderful folks on the React team have created a lint rule to help catch, and draw attention to the sorts of errors from the original code above. It's [located here](https://github.com/facebook/react/issues/14920), and works wonderfully—it very clearly caught the error above.

## What about functional setState()

Lastly, some of you may be wondering why, in the original code, I didn't just do this

```javascript
setPending(pending => pending - 1 || 0);
```

rather than

```javascript
setPending(pending - 1 || 0);
```

This would have indeed removed the closure problem, and worked fine for this particularly use case; however, the minute updates to `booksJustSaved` needed access to the value of `pending`, or vice versa, this solution would have broken down, leaving us right where we started. Moreover, I find the reucer version to be a bit cleaner, with the state management nicely separated in its own reducer function.

All in all, I think `useReducer()` is incredibly under-utilized at present. It's nowhere near as scary as you might think. Give it a try!

Happy coding!
