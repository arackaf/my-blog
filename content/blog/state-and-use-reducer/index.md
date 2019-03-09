---
title: Hooks, State, Closures, and useReducer
date: "2019-03-09T20:00:32.169Z"
description: A brief look at how useReducer can simplify your code, particularly with effects and closures.
---

For those of us coming from a Redux background, `useReducer` can seem deceptively complex and unnecessary. Between `useState` and context, it's easy to fall into the trap of thinking that a reducer adds unnecessary complexity for the majority of simpler use cases; however, it turns out `useReducer` can greatly simplify state management. Let's look at an example.

As with my other posts, this code is from my [booklist project](https://github.com/arackaf/booklist). The use case is that a screen allows users to scan in books. The ISBNs are recorded, and then sent to a rate-limited service that looks up the book info. Since the lookup service is rate limited, there's no way to guarentee your books will get looked up anytime soon, so a web socket is set up; as updates come in, messages are sent down the ws, and handled in the ui. The ws's api is dirt simple: the data packet has a `_messageType` property on it, with the rest of the object serving as the payload; obviously a more serious project would design something sturdier.

With component classes, the code to set up the ws was straightforward: in `componentDidMount` the ws subscription was created, and in `componentWillUnmount` it was torn down. With this in mind, it's easy to fall into the trap of attempting the following with hooks

```javascript
const BookEntryList = props => {
  const [pending, setPending] = useState(0);
  const [booksJustSaved, setBooksJustSaved] = useState([]);

  let ws = null;

  useEffect(() => {
    ws = new WebSocket(webSocketAddress("/bookEntryWS"));

    ws.onmessage = ({ data }) => {
      let packet = JSON.parse(data);
      if (packet._messageType == "initial") {
        setPending(packet.pending);
      } else if (packet._messageType == "bookAdded") {
        setPending(pending - 1 || 0);
        setBooksJustSaved([packet].concat(booksJustSaved));
      } else if (packet._messageType == "pendingBookAdded") {
        setPending(+pending + 1 || 0);
      } else if (packet._messageType == "bookLookupFailed") {
        setPending(pending - 1 || 0);
        let entry = {
          _id: "" + new Date(),
          title: `Failed lookup for ${packet.isbn}`,
          success: false,
        };
        setBooksJustSaved([entry].concat(booksJustSaved));
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

We put the ws creation in a `useEffect` call with an empty dependency list, which means that it'll never re-fire, and we return a function to do the teardown. When the component first mounts, our ws is set up, and when the component unmounts, it's torn down, just like we would with a class component.

## The problem

This code fails horribly, of course. We're accessing state inside the `useEffect` closure, but not including that state in the dependnecy list. For example, inside of `useEffect` the value of `pending` will absolutely always be `0`. Sure, we might call `setPending` inside the `ws.onmessage` handler, which _will_ cause that state to update, and the component to re-render, but when it re-renders our `useEffect` will **not** re-fire (again, because of the empty dependency list)—as a result that closure will go on closing over the now-stale value for `pending`

## The solution

While we _could_ add every piece of needed state to our `useEffect` dependency list, this would cause the web socket to be torn down, and re-created on every update. This would hardly be efficient, and might actually cause some problems if the ws sends down a packet of initial state on creation, that might already have been accounted for, and updated.

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
        booksSaved: [payload].concat(state.booksSaved),
      };
    case "bookLookupFailed":
      let failure = {
        _id: "" + new Date(),
        title: `Failed lookup for ${payload.isbn}`,
        success: false,
      };
      return {
        ...state,
        pending: state.pending - 1,
        booksSaved: [failure].concat(state.booksSaved),
      };
  }
  return state;
}

const BookEntryList = props => {
  const [{ pending, booksSaved }, dispatch] = useReducer(scanReducer, {
    pending: 0,
    booksSaved: [],
  });

  let ws = null;

  useEffect(() => {
    ws = new WebSocket(webSocketAddress("/bookEntryWS"));

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

While slightly more lines, we no longer have multiple update functions, and we no longer have to worry about stale state being trapped in a closure. All of our updates happen via dispatches against our single reducer.

Lastly, you may have noticed me sending my actions to the reducer as an array, with the type in the 0th slot, rather than as an object with a `type` key. Either are allowed with useReducer; this is just a trick Dan Abramov showed me to reduce the boilerplate a bit :)

Happy coding!
