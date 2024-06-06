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

![Union type](/typescript-tweet/img1.jpg)

## Wrapping up

I hope you've enjoyed this introduction to Drizzle. If you're not afraid of a little sql, it can make your life a lot easier.

Happy coding!
