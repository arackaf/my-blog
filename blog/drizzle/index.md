---
title: Introducing Drizzle
date: "2024-06-01T10:00:00.000Z"
description: Introduction to Drizzle
---

This is a post about an object relational mapper (ORM), but an ORM that might be different than what you're used to. Knowing SQL is an essential skill for any software engineer (even if you're using a non-relational database now, sooner or later ...)

But writing SQL directly can be tricky. The tooling is usually primitive, with only minimal auto-complete to guide you, and you invariably go through a process of running your query, correcting errors, and repeating until you get it right.

ORMs have existed for decades, with the intent of simplifying this process. Typically, you tell the ORM about the shape of your DB, and it exposes APIs to do typical things. If you have a books table in your DB, you might have an api along the lines of

```ts
const longBooks = books.find({ pages: { gt: 500 } });
```

Unfortunately this traditionally raised other problems. Devs would often struggle figuring out how to do non-trivial queries. Beyond that, there were often performance foot-guns, such as the infamous [Select N + 1 problem](https://planetscale.com/blog/what-is-n-1-query-problem-and-how-to-solve-it).

## Why Drizzle is different

Drizzle takes what is, to my mind, a novel approach. Rather than providing you a custom querying api on top of your database, it simply adds a layer of typing on top of SQL itself. So rather than what we saw above, we might query our books table like this

```ts
const longBooks = await db.select().from(books).where(gt(books.pages, 500));
```

It's more lines, but it's also much closer to actual SQL, and by extension easier to learn, more flexible, without the traditional ORM footguns.

Let's dive in and look closer. This post will take a brief overview of setting up Drizzle, and querying, and then do a deeper dive showing off some of its powerful abilities. The docs [are here](https://orm.drizzle.team/docs/overview) if you'd like to look closer at anything.

NOTE:

Using Drizzle in general, and some of the advanced things we'll cover in this post require at least a decent knowlegde of SQL. If you've never, ever used SQL, you might struggle with a few of the things we discuss later on. That's expected. Skim and jump over sections as needed. If nothing else, hopefully this post will motivate you to learn SQL.

## Setting up the schema

Drizzle can't do much of anything if it doesn't know about your database. There's lots of utilities for declaring your tables, and the columns therein. We'll take a very brief look, but a more complete example can be found [here](https://github.com/arackaf/booklist/blob/master/svelte-kit/src/data/drizzle-schema.ts).

Drizzle supports Postgres, MySQL, and SQLite. The ideas are the same either way, but we'll be using MySQL.

Let's start to set up a table.

```ts
import { int, datetime, tinyint, json, mysqlTable, varchar, longtext } from "drizzle-orm/mysql-core";

export const books = mysqlTable("books", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("userId", { length: 50 }).notNull(),
});
```

We tell Drizzle about our columns (we won't show all of them here, to keep things brief), and their data types.

Now we can run queries

```ts
const result = await db.select().from(books).orderBy(desc(books.id)).limit(1);
```

This query returns an array of tiems matching the schema listed out for the books table

![First query](/drizzle/img1-first-query.jpg)

Note that the types of the columns match whatever we define in the schema. We won't go over every possible column type (check the docs), but let's briefly look at the json type

```ts
export const books = mysqlTable("books", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("userId", { length: 50 }).notNull(),
  authors: json("authors"),
});
```

And now we have an authors field in each book. But the type assigned might not be what you want. Right now if you check, you'll see that the `authors` property on each book is `unknown`. This makes perfect sense: JSON can have just about any structure. Fortunately, if you know your json column will have a predictable shape, you can specify it, like this

```ts
export const books = mysqlTable("books", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("userId", { length: 50 }).notNull(),
  authors: json("authors").$type<string[]>(),
});
```

And now, when we check, the `authors` property is of type `string[] | null`. If you were to mark the `authors` column as `notNull()` it would be typed as `string[]`. As you might expect, you can pass any type you'd like into the `$type` helper.

![Typed json](/drizzle/img2-typed-json.jpg)

## Query whirlwind tour

Let's run a non-trivial, but still basic query to see what Drizzle looks like in practice. Let's say we're looking to find some nice beach reading for the summer. We want to find books that belong to you (userId == "123"), and is either less than 250 pages, or was written by Stephan Jay Gould. We want the first ten, and we want them sort from most recently added to least recently added (the id key is auto-numbered, so we can sort on that for the same effect)

In SQL we'd do something like this

```sql
SELECT *
FROM books
WHERE userId = '123' AND (pages < 250 OR authors LIKE '%Stephen Jay Gould%')
ORDER BY id desc
LIMIT 10
```

## Wrapping up

I hope you've enjoyed this introduction to Drizzle. If you're not afraid of a little sql, it can make your life a lot easier.

Happy coding!
