---
title: A Different Approach to GraphQL Caching
date: "2019-03-19T10:00:00.000Z"
description: A tour of GraphQL caching with micro-graphql-react.
---

GraphQL is an incredibly exciting innovation for web development. You specify your data, queries, and mutations in a statically typed way, and get an endpoint users can consume, requesting whatever slice of data they happen to need at any given moment. If you're old enough to remember OData, it's sort of like that, but good.

What makes GraphQL especially exciting is how standardized and structured the requests, and responses are. For example, a request (query) might look like this

```graphql
query getSubjects {
  allSubjects(name_contains: "History") {
    Subjects {
      _id
      name
    }
  }
}
```

while the response to that query might look like this

```json
{
  "data": {
    "allSubjects": {
      "Subjects": [
        {
          "_id": "573d1b97120426ef0078aa93",
          "name": "History"
        },
        {
          "_id": "583087e18d9110f200d29f5c",
          "name": "American History"
        },
        {
          "_id": "595c4c69c7a7831100692e26",
          "name": "Military History"
        },
        {
          "_id": "59594ef40ea2691100021550",
          "name": "English History"
        }
      ]
    }
  }
}
```

## Caching

Since the data come back in such a structured way, it's, in theory, feasible to keep track of things on the client side, and cache data as they come in, for future use. The old joke about the two difficult problems in computer science being cache invalidation and naming has some truth though; this is hard to get right.

I'll spend the rest of this post describing how existing GraphQL libraries approach this problem, the tradeoffs they incur, and then discuss my own GraphQL library (and the tradeoffs **it** incurrs). There's no silver bullet here. I created `micro-graphql-react` because the existing options didn't fit well for me, for what I need from a GraphQL library. It's likely others will have different requirements; I'll do my best to articulate what these tradeoffs are, so readers can best choose for themselves.

### Apollo

The crown jewel of the GraphQL ecosystem. Apollo will do some client-side massaging of your GraphQL queries, mainly to force the `__typename` metadata to come back for all your data. This allows them to analyze and cache every piece of data you get back. For example, let's say you run this query

```graphql
query getTasks {
  tasks(assignedTo: "Adam") {
    Tasks {
      id
      description
      assignedTo
    }
  }
}
```

and get back

```json
{
  "tasks": {
    "Tasks": [
      {
        "id": 1,
        "description": "Adam's Task 1",
        "assignedTo": "Adam"
      },
      {
        "id": 2,
        "description": "Adam's Task 2 ABC",
        "assignedTo": "Adam"
      }
    ]
  }
}
```

of course, in real life, Apollo would have changed your query to something like this

```graphql
query getTasks {
  tasks(assignedTo: "Adam") {
    Tasks {
      id
      description
      assignedTo
      __typename
    }
    __typename
  }
}
```

which would cause you to get back something like this

```json
{
  "tasks": {
    "Tasks": [
      {
        "id": 1,
        "description": "Adam's Task 1",
        "assignedTo": "Adam",
        "__typename": "Task"
      },
      {
        "id": 2,
        "description": "Adam's Task 2 ABC",
        "assignedTo": "Adam",
        "__typename": "Task"
      }
    ],
    "__typename": "TaskQueryResult"
  }
}
```

With this information, Apollo can do some amazing things. Later on, if you run something like this

```graphql
query getTask {
  task(id: 2) {
    Task {
      id
      description
      assignedTo
    }
  }
}
```

Apollo can reach into its cache, see that your needed data are all present, and just return you the following, with no network requests needed (I'll omit the `__typename` values for simplicity)

```json
{
  "task": {
    "Task": {
      "id": 2,
      "description": "Adam's Task 2 ABC",
      "assignedTo": "Adam"
    }
  }
}
```

It gets even better, though. If you run a mutation like this

```graphql
mutation {
  updateTask(id: 1, description: "Adam's Task 2") {
    Task {
      id
      description
    }
  }
}
```

GraphQL will return the new task's values, and Apollo will update it's cache under the covers. Now, if you run

```graphql
query getTasks {
  tasks(assignedTo: "Adam") {
    Tasks {
      id
      description
      assignedTo
    }
  }
}
```

you'll get back

```json
{
  "tasks": {
    "Tasks": [
      {
        "id": 1,
        "description": "Adam's Task 1",
        "assignedTo": "Adam"
      },
      {
        "id": 2,
        "description": "Adam's Task 2",
        "assignedTo": "Adam"
      }
    ]
  }
}
```

again, without any network requests.

### Apollo's Tradeoff

The above may seem like perfection, but consider a similar starting point. This query:

```graphql
query getTasks {
  tasks(assignedTo: "Adam") {
    Tasks {
      id
      description
      assignedTo
    }
  }
}
```

with these results

```json
{
  "tasks": {
    "Tasks": [
      {
        "id": 1,
        "description": "Adam's Task 1",
        "assignedTo": "Adam"
      },
      {
        "id": 2,
        "description": "Adam's Task 2",
        "assignedTo": "Adam"
      }
    ]
  }
}
```

now, if the user runs _this_ mutation

```graphql
mutation {
  updateTask(id: 1, assignedTo: "Bob") {
    Task {
      id
      assignedTo
    }
  }
}
```

we're changing the `assignedTo` value, instead of the description. Apollo will update its normalized cache as before, updating that task's fields, as before, but this time modifying the `assignedTo` property, instead of the `description` property.

This means that later, if the user re-runs this query

```graphql
query getTasks {
  tasks(assignedTo: "Adam") {
    Tasks {
      id
      description
      assignedTo
    }
  }
}
```

they'll get back

```json
{
  "tasks": {
    "Tasks": [
      {
        "id": 1,
        "description": "Adam's Task 1",
        "assignedTo": "Adam"
      },
      {
        "id": 2,
        "description": "Adam's Task 2",
        "assignedTo": "Bob"
      }
    ]
  }
}
```

which is horribly wrong. We requested tasks assigned to `"Adam"`, but got back results assigned to `"Bob"`. What happened?

Well, Apollo inspected our query, and saw that it had a match for that same query, already, so it promptly returned it for us. The problem is, the mutation we ran happened to invalidate one of the results—but Apollo had no way of knowing that. Apollo has no way of knowing that changes to the `description` field on this task have no effect on the correctness of the results for this particular query, while changes to `assignedTo`, do. Of course we can just as easily imagine a query against the `description` field which would have the reverse problem: changes to `assignedTo` would have no affect on correctness, while changes to `description`, would.

Apollo has workarounds, of course. You can either update the specific results for a particular query (which requires you to match the query text, and the identical variable values), or you can blow away the entire cache.

## Urql

Urql is the creation of Bourbon connoisseur, professional Twitter Shit-poster, and one of my favorite people: Ken Wheeler. His is a considerable improvement on Apollo for solving this problem. Urql caches things more at the query level, and keeps track of what **types** are returned. If any data modifications are performed, he clears the cache for all queries that hold that type. For example, if you run

```graphql
mutation {
  updateTask(id: 1, assignedTo: "Bob") {
    Task {
      id
      assignedTo
    }
  }
}
```

with Urql, the metadata returned will show that a task was modified, and so **all** queries holding task results will be invalidated, and run against the network the next time they're run.

This completely solves the problems from above; however, even this approach is not perfect. For example, if you run

```graphql
query getTasks {
  tasks(assignedTo: "Fred") {
    Tasks {
      id
      description
      assignedTo
    }
  }
}
```

and get back

```json
{
  "tasks": {
    "Tasks": [],
    "__typename": "TaskQueryResult"
  }
}
```

Urql has no way of knowing that query holds Tasks, since it has no way of knowing what `TaskQueryResult` is. This means that if you run a mutation creating a task that's assigned to Fred, the mutation result will not be able to indicate that this particular query needs to be cleared.

Interestingly, this is actually a solveable problem with a build step. A build step would be able to manually introspect the entire GraphQL endpoint, and figure out that `TaskQueryResult` contains `Task` objects, and fix this problem.

## micro-graphql-react

`micro-graphql-react` was written with the assumption that managing cache invalidation transparently is a problem that's too difficult to solve. Instead, it's designed to make this easy to manage yourself. To be clear, there's no cache management out of the box. By default, mutations will not update previously cached query results at all. You can easily turn caching off entirely, but to get something intelligent working, like Apollo, you need to implement it yourself. Fortunately the structured nature of GraphQL makes this surprisingly easy—this is one of the many reasons I like GraphQL so much.

A side-effect of hte above is that unlike Apollo and Urql, this library does no client-side parsing of your queries (or mutations). This not only keeps the library tiny (2.8K min+gzip) but it also allows you to even omit the GraphQL querues themselves from your bundles, if you use something like [my generic-persistgraphql library](https://github.com/arackaf/generic-persistgraphql).

The remainder of this post will go over how `micro-graphql-react` handles some common use cases. It'll paint with broad strokes, so be sure to check out [the docs](https://github.com/arackaf/micro-graphql-react) if you want to see some more detail on anything. As usual, all the code samples herein are from [my booklist project](https://github.com/arackaf/booklist).

**Note** All of the code below was written for my particular application, based on what its GraphQL endpoint looks like. _Don't_ expect this code to work in your application, which will almost certainly have some differences in its GraphQL endpoint. In my particular case, my endpoint was created with my [`mongo-graphql-starter` project](https://github.com/arackaf/mongo-graphql-starter).

### Use case 1 - non-searched data

Let's start with data that is not filtered or searched. For the case of my booklist project, the hierarchical subjects which can be applied to books. Here, a query to fetch all the subjects is fired at startup, and then kept in sync as updates are made.

Here's what the application code looks like

```javascript
import AllSubjectsQuery from "graphQL/subjects/allSubjects.graphql";
import UpdateSubjectMutation from "graphQL/subjects/updateSubject.graphql";
import DeleteSubjectMutation from "graphQL/subjects/deleteSubject.graphql";

import { graphqlClient } from "./appRoot";

graphqlClient.subscribeMutation([
  {
    when: /updateSubject/,
    run: (op, res) =>
      syncUpdates(
        AllSubjectsQuery,
        res.updateSubject,
        "allSubjects",
        "Subjects"
      )
  },
  {
    when: /deleteSubject/,
    run: (op, res) =>
      syncDeletes(
        AllSubjectsQuery,
        res.deleteSubject,
        "allSubjects",
        "Subjects"
      )
  }
]);
```

I'm grabbing my graphql client (created elsewhere) and telling it that on any mutation that has a result set matching `/updateSubject/` to call my `syncUpdates` method, and similarly for `/deleteSubject/` and `syncDeletes`. Those subscriptions are global, and will span the applications lifetime; they make sure our cache is always correct.

For the finishing touch, let's see how we tell our query hook to sync up these these changes when relevant mutations happen

```javascript
let { loading, loaded, data } = useQuery(
  buildQuery(
    AllSubjectsQuery,
    { publicUserId, userId },
    {
      onMutation: {
        when: /(update|delete)Subject/,
        run: ({ refresh }) => refresh()
      }
    }
  )
);
```

The query hook (and render prop component) allow us to hook into mutations, and in the callback, provide methods to do things like hard reset the results, soft reset, or in this case, just refresh from what's already in the cache. Subscriptions run in order, so the global sync is guarenteed to run first.

#### That boierplate, tho!

If you're thinking that that amount of boilerplate, while not huge, still would not scale in a large web application, then take a step back, and look more broadly at. More specifically, replace any and all references to the word `"subject"`, no matter the casing, or plurality, with `X`. Then remove references to `AllSubjectsQuery` (the query that reads the subjects) with `Y`. It should look something like this

```javascript
graphqlClient.subscribeMutation([
  {
    when: /updateX/,
    run: (op, res) => syncUpdates(Y, res.update, "allX", "X")
  },
  { when: /deleteX/, run: (op, res) => syncDeletes(Y, res.delete, "allX", "X") }
]);

let { loading, loaded, data } = useQuery(
  buildQuery(
    Y,
    { publicUserId, userId },
    {
      onMutation: { when: /(update|delete)X/, run: ({ refresh }) => refresh() }
    }
  )
);
```

You've now got a prime refactoring opportunity. It would be straightforward to replace those two chunks of code with two function calls, passing in the query name (or even array of query names, if you need), and the type name.

_In fact_ - the beauty of hooks is how well they compose together. Those two global mutation handlers could absolutely be inside the hook (`onMutation` can take a single object, **or** an array of them). If your application is big enough to justify it, a custom hook like this would work fine

```javascript
//TODO: test this
const useSyncdQuery = (Query, Type, variables) => {
  let plural = Type + "s";
  return useQuery(
    buildQuery(Query, variables, {
      onMutation: [
        {
          when: new RegExp(`update${Type}`),
          run: (op, res) =>
            syncUpdates(Query, res.update, `all${plural}`, Plural)
        },
        {
          when: new RegExp(`delete${Type}`),
          run: (op, res) =>
            syncDeletes(Query, res.delete, `all${plural}`, Plural)
        },
        {
          when: new RegExp(`(update|delete)${Type}`),
          run: ({ refresh }) => refresh()
        }
      ]
    })
  );
};
```

And now anytimewe want to use a query that syncs up, we can just do

```javascript
let { loaded, data } = useSyncdQuery(AllSubjectsQuery, "Subject", {
  publicUserId,
  userId
});
```

### Use case 2 - soft resetting search results

Let's now look at a use case similar to the example I started with: running mutations against data that was searched, where the mutations may (or may not) invalidate the current search results. We'll assume that books can be searched for via any number of search filters, and sorted in any number of directions. As a result, it's exceedingly difficult to track all the ways in which modifying a book might cause it to either no longer show up in the current results, or even show up in a different place (ie sorted differently).

Let's assume that for any mutation on a book, we'll just clear the entire cache of book search results, but update the current results on the screen. So if you're searching all `History` books, but you change one of their subject's from `History` to `Literature` then the UI will change to reflect that, but the next time that search is run, a new network request will fire. This is a UI choice, and certainly subject to debate. Some might prefer the new network request fire immeidiately, with the recently updated book vanishing as soon as the new results come back. I happen to prefer the former, but the library supports either; check the docs for more info, and examples.

Here's the code we'll start with

```javascript
import GetBooksQuery from "graphQL/books/getBooks.graphql";

// ...

const variables = getBookSearchVariables(searchState);
const onBooksMutation = [
  {
    when: /updateBooks?/,
    run: ({ currentResults, softReset }, resp) => {
      syncResults(
        currentResults.allBooks,
        "Books",
        resp.updateBooks ? resp.updateBooks.Books : [resp.updateBook.Book]
      );
      softReset(currentResults);
    }
  },
  {
    when: /deleteBook/,
    run: ({ refresh }, res, req) => {
      syncDeletes(GetBooksQuery, [req._id], "allBooks", "Books");
      refresh();
    }
  }
];
const { data, loading, loaded, currentQuery } = useQuery(
  buildQuery(GetBooksQuery, variables, { onMutation: onBooksMutation })
);
```

This time, updates and deletions can only ever happen while the query hook is active, so those mutation subscriptions are placed right there. Here though, when an update or delete comes in, we sync it with the current results, that happen to be currently shown, while removing absolutely everything from cache, including those same current results; if the user runs a new query, then comes back, the query will re-fire. Of course, `softReset` is a helper that does just that. The code works, but as before, it's a bit cumbersome. But again as before, if this is a common use case in our application, we can refactor this reasonably easily. Let's see about making a custom hook that wraps `useQuery`, while performing this cache invalidation.

```javascript
//TODO: test this
const useSoftResetQuery = (Query, Type, variables) => {
  let plural = Type.toLowerCase() + "s";
  return useQuery(
    buildQuery(Query, variables, {
      onMutation: [
        {
          when: new RegExp(`update${plural}?`),
          run: ({ currentResults, softReset }, resp) => {
            syncResults(
              currentResults.allBooks,
              plural,
              resp[`update${plural}`]
                ? resp[`update${plural}`][plural]
                : resp[`update${Type}`][Type]
            );
            softReset(currentResults);
          }
        },
        {
          when: new RegExp(`delete${Type}`),
          run: ({ refresh }, res, req) => {
            syncDeletes(GetBooksQuery, [req._id], `all${plural}`, plural);
            refresh();
          }
        }
      ]
    })
  );
};
```

The code's hardly more readable, but it's not terribly complex, and it's code you'd write once, and re-use everywhere. Here's what the application code querying data with this cache strategy would now look like.

```javascript
const variables = getBookSearchVariables(searchState);

const { data, loading, loaded, currentQuery } = useSoftResetQuery(GetBooksQuery, "Book" variables);
```

You could drop that anywhere you needed data that respected this partular cache invalidation strategy.

The point of this library is not to figure out a way to solve the cache invalidation problem; the point of this library is to make it easy for you to solve the cache invalidation problem easily, yourself, in a way that's tailored to your own app.

### Don't overdo your abstractions

This library was designed to provide useful primitives, which can be tailored to your particular application. But don't overdo your abstractions. As always, try to wait until you have three identical pieces of code before you look to move them into one shared call. If you never get to three, it might mean your application is too small to bother (like my booklist project); or it might mean that you have a lot of special cases in your code, in which case a one-size-fit-all solution would never have suited you anyway. Of course, it might also mean that you have a lot of inconsistencies in your GraphQL endpoint naming scheme, which regardless you should look to standardize.

### Helpers implementaion

Let's check out `syncUpdates` and `syncDeletes`

<!-- prettier-ignore -->
```javascript
import { getDefaultClient } from "micro-graphql-react";
let graphqlClient = getDefaultClient();

export const syncUpdates = (cacheName, newResults, resultSet, arrName, options = {}) => {
  const cache = graphqlClient.getCache(cacheName);

  [...cache.entries].forEach(([uri, currentResults]) =>
    syncResults(currentResults.data[resultSet], arrName, newResults, options)
  );

  if (options.force) {
    graphqlClient.forceUpdate(cacheName);
  }
};

export const syncResults = (resultSet, arrName, newResults, { sort } = {}) => {
  const lookupNew = new Map(newResults.map(o => [o._id, o]));

  resultSet[arrName] = resultSet[arrName].concat();
  resultSet[arrName].forEach((o, index) => {
    if (lookupNew.has(o._id)) {
      resultSet[arrName][index] = Object.assign({}, o, lookupNew.get(o._id));
    }
  });
  const existingLookup = new Set(resultSet[arrName].map(o => o._id));
  resultSet[arrName].push(
    ...newResults.filter(o => !existingLookup.has(o._id))
  );
  return sort ? resultSet[arrName].sort(sort) : resultSet[arrName];
};

export const syncDeletes = (cacheName, _ids, resultSet, arrName, { sort } = {}) => {
  const cache = graphqlClient.getCache(cacheName);
  const deletedMap = new Set(_ids);

  [...cache.entries].forEach(([uri, currentResults]) => {
    let res = currentResults.data[resultSet];
    res[arrName] = res[arrName].filter(o => !deletedMap.has(o._id));
    sort && res[arrName].sort(sort);
  });
};
```

It's not the simplest code, but nor is it terribly complex. It's mosttly boring boilerplate that runs through result sets, updating what's needed. These are centralized helper methods used by my GraphQL hooks.
