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
import {
  int,
  datetime,
  tinyint,
  json,
  mysqlTable,
  varchar,
  longtext,
} from "drizzle-orm/mysql-core";

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

Alternatively, as expected, we can also narrow our select list

```ts
const result = await db
  .select({ id: books.id, isbn: books.isbn })
  .from(books)
  .orderBy(desc(books.id))
  .limit(1);
```

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

Let's run a non-trivial, but still basic query to see what Drizzle looks like in practice. Let's say we're looking to find some nice beach reading for the summer. We want to find books that belong to you (userId == "123"), and is either less than 150 pages, or was written by Stephan Jay Gould. We want the first ten, and we want them sort from most recently added to least recently added (the id key is auto-numbered, so we can sort on that for the same effect)

In SQL we'd do something like this

```sql
SELECT *
FROM books
WHERE userId = '123' AND (pages < 150 OR authors LIKE '%Stephen Jay Gould%')
ORDER BY id desc
LIMIT 10
```

With Drizzle we'd write this

```ts
const result = await db
  .select()
  .from(books)
  .where(
    and(
      eq(books.userId, userId),
      or(lt(books.pages, 150), like(books.authors, "%Stephen Jay Gould%"))
    )
  )
  .orderBy(desc(books.id))
  .limit(10);
```

which works

```
[
  {
    id: 1088,
    userId: '123',
    authors: [ 'Siry, Steven E' ],
    title: 'Greene: Revolutionary General (Military Profiles)',
    isbn: '9781574889130',
    pages: 144
  },
  {
    id: 828,
    userId: '123',
    authors: [ 'Morton J. Horwitz' ],
    title: 'The Warren Court and the Pursuit of Justice',
    isbn: '0809016257',
    pages: 144
  },
  {
    id: 506,
    userId: '123',
    authors: [ 'Stephen Jay Gould' ],
    title: 'Bully for Brontosaurus: Reflections in Natural History',
    isbn: '039330857X',
    pages: 544
  },
  {
    id: 412,
    userId: '123',
    authors: [ 'Stephen Jay Gould' ],
    title: "The Flamingo's Smile: Reflections in Natural History",
    isbn: '0393303756',
    pages: 480
  },
  {
    id: 356,
    userId: '123',
    authors: [ 'Stephen Jay Gould' ],
    title: "Hen's Teeth and Horse's Toes: Further Reflections in Natural History",
    isbn: '0393311031',
    pages: 416
  },
  {
    id: 319,
    userId: '123',
    authors: [ 'Robert J. Schneller' ],
    title: 'Cushing: Civil War SEAL (Military Profiles)',
    isbn: '1574886967',
    pages: 128
  }
]
```

The Drizzle version was actually a little bit longer. But we're not optimizing for fewest possible lines of code. The Drizzle version is typed, with autocomplete to guide you toward a valid query, and TypeScript to often warn you when you don't. The query is also a lot more composable. What do I mean by that?

## Putting queries together

Let's write something _slightly_ more advanced and _slightly_ more realistic. Let's code up a function that takes any number of search filters, and puts together a query. Here's what the filters look like

```ts
type SearchPacket = Partial<{
  title: string;
  author: string;
  maxPages: number;
  subjects?: number[];
}>;
```

Note the [Partial](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype) type. We're taking in any number of these filters—possibly none of them. Whichever filters are passed, we want them to be additive; we want them combined with `and`. We've seen `and` already, and it can take the result of calls to `eq`, `lt`, and [lots of others](https://orm.drizzle.team/docs/operators). We'll need to create an array of all of these types, and Drizzle gives us a parent type for any of these filters: `SQLWrapper`.

Let's get started

```ts
async function searchBooks(args: SearchPacket) {
  const searchConditions: SQLWrapper[] = [];
}
```

We've got our array of filters. Now let's start filling it up

```ts
async function searchBooks(args: SearchPacket) {
  const searchConditions: SQLWrapper[] = [];
  if (args.title) {
    searchConditions.push(like(books.title, `%${args.title}%`));
  }
}
```

Nothing new, yet. This is the same title filter we saw before.

Let's make that author check a little more realistic. It's not a varchar column, it holds json values, which themselves are strings of arrays. MySQL gives us a way to search json arrays - we have to use the [`->>` operator](https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#operator_json-inline-path). This takes a json column, and evaluates a path on it. So if you had objects in there, you'd pass string paths to get properties out. We just have an array of strings, so our path is `$`. And the string comparrisons when we're filtering on JSON columns like this is no longer case sensitive, so we'll want to use the LOWER function in MySQL.

Typically, with traditional ORM's you'd scramble to the docs to look for an equivalent to the `->>` operator, as well as the LOWER function. Drizzle does something better, and gives us a nice escape hatch to just write SQL directly in situations like this. Let's implement our author filter

```ts
async function searchBooks(args: SearchPacket) {
  const searchConditions: SQLWrapper[] = [];
  if (args.title) {
    searchConditions.push(like(books.title, `%${args.title}%`));
  }
  if (args.author) {
    searchConditions.push(
      sql`LOWER(${
        books.authors
      }->>"$") LIKE ${`%${args.author.toLowerCase()}%`}`
    );
  }
}
```

Note the `sql` tagged template literal. It lets us put arbitrary SQL in there for one-off operations that may not be implemented in the ORM. Before moving on, let's take a quick peak at the SQL generated by this

```
{
  sql: 'select `id`, `userId`, `authors`, `title`, `isbn`, `pages` from `books` where (`books`.`userId` = ? and LOWER(`books`.`authors`->>"$") LIKE ?) order by `books`.`id` desc limit ?',
  params: [ '573d1b97120426ef0078aa92', '%gould%', 10 ]
}
```

Let's zoom in on the authors piece. What we entered as

```
sql`LOWER(${books.authors}->>"$") LIKE ${`%${args.author.toLowerCase()}%`}`
```

was transformed into

```
LOWER(`books`.`authors`->>"$") LIKE ?
```

Our search term was parameterized, however, Drizzle was smart enough to _not_ parameterize our column. I'm continuously impressed by small details like this. The maxPages piece is the same as before

```ts
if (args.maxPages) {
  searchConditions.push(lte(books.pages, args.maxPages));
}
```

nothing new or interesting. Now let's look at the `subjects` filter. We can pass in an array of subject ids, and we want to filter books that have that subject. The relationship between books and subjects is stored in a separate table, `booksSubjects`. This table simply has rows with an id, a book id, and a subject id. So if book 12 has subject 34, there'll be a row with bookId of 12, and subjectId of 34.

In SQL when we want to see if a given row _exists_ in some table, we use the [exists](https://dev.mysql.com/doc/refman/8.4/en/exists-and-not-exists-subqueries.html) keyword.

Drizzle does have an `exists` function for this very purpose. Let's move on with our function

```ts
async function searchBooks(args: SearchPacket) {
  const searchConditions: SQLWrapper[] = [];
  if (args.title) {
    searchConditions.push(like(books.title, `%${args.title}%`));
  }
  if (args.author) {
    searchConditions.push(
      sql`LOWER(${books.authors}->>"$") LIKE ${`%${args.author.toLowerCase()}%`}`,
    );
  }
  if (args.maxPages) {
    searchConditions.push(lte(books.pages, args.maxPages));
  }
  if (args.subjects?.length) {
    searchConditions.push(
      exists(
        db
          .select({ _: sql`1` })
          .from(booksSubjects)
          .where(
            and(
              eq(books.id, booksSubjects.book),
              inArray(booksSubjects.subject, args.subjects),
            ),
          ),
      ),
    );
  }
```

We can pass an `exists()` call right into our list of filters, just like with real SQL. The

```
_: sql`1`
```

is curious, but that's us just saying `SELECT 1` which is a common way of putting something into a SELECT list, even though we're not pulling back any data; we're just checking for existence. Lastly, the `inArray` Drizzle helper is how we generate an IN query. Here's what the generated sql looks like for this subjects query

```
select `id`, `userId`, `authors`, `title`, `isbn`, `pages` from `books` where (`books`.`userId` = ? and exists (select 1 from `books_subjects` where (`books`.`id` = `books_subjects`.`book` and `books_subjects`.`subject` in (?, ?)))) order by `books`.`id` desc limit ?
```

## Digging deeper

## Debugging queries

Before we really kick the tires and see what Drizzle can do, let's take a look at how easily Drizzle let's you debug your queries. Let's say the query from before didn't return what we expected, and we want to see the actual SQL being run. We can do that by **removing** the `await` from the query, and then calling `getSQL` on the result.

```ts
import { and, desc, eq, like, lt, or } from "drizzle-orm";

const result = db
  .select()
  .from(books)
  .where(
    and(
      eq(books.userId, userId),
      or(lt(books.pages, 150), like(books.authors, "%Stephen Jay Gould%"))
    )
  )
  .orderBy(desc(books.id))
  .limit(10);

console.log(result.toSQL());
```

which displays the following

```
{
  sql: 'select `id`, `userId`, `authors`, `title`, `isbn`, `pages` from `books` where (`books`.`userId` = ? and (`books`.`pages` < ? or `books`.`authors` like ?)) order by `books`.`id` desc limit ?',
  params: [ '573d1b97120426ef0078aa92', 150, '%Stephen Jay Gould%', 10 ]
}
```

`result.toSQL()` returned an object, with a `sql` field, with our query, and a `params` field with the parameters. As any ORM would, Drizzle parameterized our query, so fields with invalida characters wouldn't break anything. You can now run this query directly against your db to see what went wrong.

## Wrapping up

I hope you've enjoyed this introduction to Drizzle. If you're not afraid of a little sql, it can make your life a lot easier.

Happy coding!
