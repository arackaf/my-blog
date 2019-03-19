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

Urql is the creation of Bourbon connoisseur, professional Twitter Shit-poster, and one of my favorite people: Ken Wheeler. His is a considerable improvement on Apollo. Urql caches things more at the query level, and keeps track of what **types** are returned. If any data modifications are performed, he clears the cache for all queries that hold that type. For example, if you run

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
