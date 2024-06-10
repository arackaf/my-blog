---
title: Introducing Drizzle
date: "2024-06-01T10:00:00.000Z"
description: Introduction to Drizzle
---

This is a post about an exciting new object relational mapper (ORM) that's differet than any ORM I've used before—and I've used quite a few.

Knowing SQL is an essential skill for any software engineer (even if you're using a non-relational database now, sooner or later ...). But writing SQL directly can be tricky. The tooling is usually primitive, with only minimal auto-complete to guide you, and you invariably go through a process of running your query, correcting errors, and repeating until you get it right.

ORMs have existed for decades, with the intent of simplifying this process. Typically, you tell the ORM about the shape of your DB, and it exposes APIs to do typical things. If you have a books table in your DB, you might have an api along the lines of

```ts
const longBooks = books.find({ pages: { gt: 500 } });
```

Unfortunately this traditionally raised other problems. Devs would often struggle figuring out how to do non-trivial queries, and there were often performance foot-guns, such as the infamous [Select N + 1 problem](https://planetscale.com/blog/what-is-n-1-query-problem-and-how-to-solve-it).

## Why Drizzle is different

Drizzle takes what is, to my mind, a novel approach. Drizzle _does_ provide you a traditional ORM querying api, like what I showed above. But in addition to that, it _also_ provides an api that is, essentially, a layer of typing on top of SQL itself. So rather than what we saw above, we might query our books table like this

```ts
const longBooks = await db.select().from(books).where(gt(books.pages, 500));
```

It's more lines, but it's also much closer to actual SQL, and by extension easier to learn, more flexible, without the traditional ORM footguns.

Let's dive in and look closer. This post will take a brief overview of setting up Drizzle, and querying, and then do a deeper dive showing off some of its powerful abilities with this typed SQL querying api.

The docs [are here](https://orm.drizzle.team/docs/overview) if you'd like to look closer at anything.

NOTE:

Using Drizzle in general, and some of the advanced things we'll cover in this post requires at least a decent knowlegde of SQL. If you've never, ever used SQL, you might struggle with a few of the things we discuss later on. That's expected. Skim and jump over sections as needed. If nothing else, hopefully this post will motivate you to look at SQL.

## Setting up the schema

Drizzle can't do much of anything if it doesn't know about your database. There's lots of utilities for showing Drizzle the structure (or schema) of your tables. We'll take a very brief look, but a more complete example can be found [here](https://github.com/arackaf/booklist/blob/master/svelte-kit/src/data/drizzle-schema.ts).

Drizzle supports Postgres, MySQL, and SQLite. The ideas are the same either way, but we'll be using MySQL.

Let's start to set up a table.

```ts
import { int, json, mysqlTable, varchar } from "drizzle-orm/mysql-core";

export const books = mysqlTable("books", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("userId", { length: 50 }).notNull(),
  isbn: varchar("isbn", { length: 25 }),
  pages: int("pages"),
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
  isbn: varchar("isbn", { length: 25 }),
  pages: int("pages"),
  authors: json("authors"),
});
```

And now we have an authors field in each book. But the type assigned might not be what you want. Right now if you check, you'll see that the `authors` property on each book is `unknown`. This makes sense: JSON can have just about any structure. Fortunately, if you know your json column will have a predictable shape, you can specify it, like this

```ts
export const books = mysqlTable("books", {
  id: int("id").primaryKey().autoincrement(),
  userId: varchar("userId", { length: 50 }).notNull(),
  isbn: varchar("isbn", { length: 25 }),
  pages: int("pages"),
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

Note the [Partial](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype) type. We're taking in any number of these filters—possibly none of them. Whichever filters are passed, we want them to be additive; we want them combined with `and`. We've seen `and` already, and it can take the result of calls to `eq`, `lt`, and [lots of others](https://orm.drizzle.team/docs/operators). We'll need to create an array of all of these filters, and Drizzle gives us a parent type that can hold any of them: `SQLWrapper`.

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

Nothing new, yet. This is the same filter we saw before with authors.

Speaking of authors, let's add that query next. But let's make the author check a little more realistic. It's not a varchar column, it holds json values, which themselves are strings of arrays. MySQL gives us a way to search json - we use the [`->>` operator](https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#operator_json-inline-path). This takes a json column, and evaluates a _path_ on it. So if you had objects in there, you'd pass string paths to get properties out. We just have an array of strings, so our path is `$`, which is the actual values in the array. And the string comparrisons when we're filtering on JSON columns like this is no longer case sensitive, so we'll want to use the LOWER function in MySQL.

Typically, with traditional ORM's you'd scramble to the docs to look for an equivalent to the `->>` operator, as well as the LOWER function. Drizzle does something better, and gives us a nice escape hatch to just write SQL directly in situations like this. Let's implement our author filter

```ts
async function searchBooks(args: SearchPacket) {
  const searchConditions: SQLWrapper[] = [];
  if (args.title) {
    searchConditions.push(like(books.title, `%${args.title}%`));
  }
  if (args.author) {
    searchConditions.push(
      sql`LOWER(${books.authors}->>"$") LIKE ${`%${args.author.toLowerCase()}%`}`
    );
  }
}
```

Note the `sql` tagged template literal. It lets us put arbitrary SQL in for one-off operations that may not be implemented in the ORM. Before moving on, let's take a quick peak at the SQL generated by this

```
{
  sql: 'select `id`, `userId`, `authors`, `title`, `isbn`, `pages` from `books` where (`books`.`userId` = ? and LOWER(`books`.`authors`->>"$") LIKE ?) order by `books`.`id` desc limit ?',
  params: [ '123', '%gould%', 10 ]
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

nothing new or interesting. Now let's look at the `subjects` filter. We can pass in an array of subject ids, and we want to filter books that have that subject. The relationship between books and subjects is stored in a separate table, `booksSubjects`. This table simply has rows with an id, a book id, and a subject id (and also the userId for that book, to make other queries easily). So if book 12 has subject 34, there'll be a row with bookId of 12, and subjectId of 34.

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

That was our last filter. Now we can just pipe our filters in, to execute the query we put together

```ts
async function searchBooks(args: SearchPacket) {
  const searchConditions: SQLWrapper[] = [];
  if (args.title) {
    searchConditions.push(like(books.title, `%${args.title}%`));
  }
  if (args.author) {
    searchConditions.push(
      sql`LOWER(${books.authors}->>"$") LIKE ${`%${args.author.toLowerCase()}%`}`
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
              inArray(booksSubjects.subject, args.subjects)
            )
          )
      )
    );
  }

  const result = await db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), ...searchConditions))
    .orderBy(desc(books.id))
    .limit(10);
}
```

The ability to treat SQL queries as typed function calls that can be combined arbitratily is what really makes Drizzle shine in my opinion.

## Digging deeper

We could end the blog post here. But I do want to really make Drizzle shine, but putting it through a much more complex query. You might never need, or want to write queries like this; my purpose in including this section is to show that you can, if you ever need to.

With that out of the way, let's write a query to get aggregate info about our books. We want our most, and least popular subject(s), and how many books we have with those subjects. We also want to know any unused subjects, as well as that same info about tags (which we haven't talked about). And also the total number of books we have overall. Maybe display them in a screen like this.

![Aggregate screen](/drizzle/img3-aggregarte-screen.jpg)

To keep this section manageable we'll see what just the total book counts, and the most and least subjects looks like. The other pieces are variations on that theme, and you can see the finished product [here](https://github.com/arackaf/booklist/blob/master/svelte-kit/src/data/user-summary.ts).

Let's look at some of the SQL for this, and how to write it with Drizzle.

### Number of books per subject

In SQL we can group things together with GROUP BY.

```sql
SELECT
    subject,
    count(*)
FROM books_subjects
GROUP BY subject
```

Now our SELECT list, rather than pulling items from a table, is now pulling from a (conceptual) lookup table. We (conceptually) have a bunch of buckets stored by subject id. So we can select those subject id's, as well as aggregate info from the buckets themselves, which we do with the `count(*)`. This selects each subject, and the number of books under that subject.

And it works

![Group by](/drizzle/img4-group-by.jpg)

But we want the most, and least popular subjects. SQL also has what are called window functions. We can, on the fly, sort these buckets in some order, and then ask questions about the data, sorted in that way. We basically want the subject(s) with the highest, or lowest number of books, including ties. It turns out [RANK](https://dev.mysql.com/doc/refman/8.4/en/window-function-descriptions.html#function_rank) is exactly what we want. Let's see how this works

```sql
SELECT
    subject,
    count(*) as count,
    RANK() OVER (ORDER BY count(*) DESC) MaxSubject,
    RANK() OVER (ORDER BY count(*) ASC) MinSubject
FROM books_subjects
WHERE userId = '123'
GROUP BY subject
```

We ask for the rank of each row, when the whole result set is sorted in whatever way we describe.

![Rank](/drizzle/img5-rank.jpg)

It's a little mind bendy at first, so don't worry if this looks a little weird. The point is to show how well Drizzle can simplify SQL for us, not to be a deep dize into SQL, so let's move on.

We want the subjects with a MaxSubject of 1, or a MinSubject of 1. We can't use WHERE for this, at least not directly. The solution in SQL is to turn this query into a virtual table, and query _that_. It looks like this

```SQL
SELECT
    t.subject id,
    CASE WHEN t.MinSubject = 1 THEN 'MinSubject' ELSE 'MaxSubject' END as label,
    t.count
FROM (
    SELECT
        subject,
        count(*) as count,
        RANK() OVER (ORDER BY count(*) DESC) MaxSubject,
        RANK() OVER (ORDER BY count(*) ASC) MinSubject
    FROM books_subjects
    WHERE userId = '123'
    GROUP BY subject
) t
WHERE t.MaxSubject = 1 OR t.MinSubject = 1
```

And it works

![Rank](/drizzle/img5-rank-2.jpg)

### Moving this along.

We won't show tags, since it's basically idential except we hit a books_tags table, instead of books_subjects. We also won't show unused subjects (or tags), which is also very similar, except we use a NOT EXISTS query.

The query to get the total number of books looks like this

```SQL
SELECT count(*) as count
FROM books
WHERE userId = '123'
```

but let's add some columns _just_ to get it in the same structure as our subjects queries

```SQL
SELECT
    0 id,
    'Books Count' as label,
    count(*) as count
FROM books
WHERE userId = '123'
```

and now, since these queries return the same structure, let's combine them into one big query. We use UNION for this.

```SQL
SELECT *
FROM (
    SELECT
        t.subject id,
        CASE WHEN t.MinSubject = 1 THEN 'MinSubject' ELSE 'MaxSubject' END as label,
        t.count
    FROM (
        SELECT
            subject,
            count(*) as count,
            RANK() OVER (ORDER BY count(*) DESC) MaxSubject,
            RANK() OVER (ORDER BY count(*) ASC) MinSubject
        FROM books_subjects
        GROUP BY subject
    ) t
    WHERE t.MaxSubject = 1 OR t.MinSubject = 1
) subjects
UNION
    SELECT
        0 id,
        'Books Count' as label,
        count(*) as count
    FROM books
    WHERE userId = '123';
```

And it works!

![Rank](/drizzle/img6-union-query.jpg)

But this is gross to write manually, and even grosser to maintain. There's a lot of pieces here, and there's no (good) way to break this apart, and manage separately. SQL is ultimately text, and you can, of course, generate these various pieces of text with different functions in your code, and then concatenate them together. But that's fraught with difficulty, too. It's easy to get small details wrong when you're pasting strings of code together. And believe it or not, this query is much simpler than much of what I've seen.

## The Drizzle way

Ok let's see what this looks like in Drizzle. Remember that initial query to get each subject, with its count, and rank? Here it is in Drizzle

```ts
const subjectCountRank = () =>
  db
    .select({
      subject: booksSubjects.subject,
      count: sql<number>`COUNT(*)`.as("count"),
      rankMin: sql<number>`RANK() OVER (ORDER BY COUNT(*) ASC)`.as("rankMin"),
      rankMax: sql<number>`RANK() OVER (ORDER BY COUNT(*) DESC)`.as("rankMax"),
    })
    .from(booksSubjects)
    .where(eq(booksSubjects.userId, userId))
    .groupBy(booksSubjects.subject)
    .as("t");
```

Drizzle supports grouping, and it even has an `as` function to alias a query, and enable it to be _queried from_. Let's do that next

```ts
const subjectsQuery = () => {
  const subQuery = subjectCountRank();

  return db
    .select({
      label:
        sql<string>`CASE WHEN t.rankMin = 1 THEN 'MIN Subjects' ELSE 'MAX Subjects' END`.as(
          "label"
        ),
      count: subQuery.count,
      id: subQuery.subject,
    })
    .from(subQuery)
    .where(or(eq(subQuery.rankMin, 1), eq(subQuery.rankMax, 1)));
};
```

We stuck our query to get the ranks in a function, and then we just called that function, and queried from its result. SQL is feeling a lot more like normal coding!

The query for the total book count is simple enough

```ts
db
  .select({ label: sql<string>`'All books'`, count: sql<number>`COUNT(*)`, id: sql<number>`0` })
  .from(books)
  .where(eq(books.userId, userId)),
```

Hopefully won't be too surprised to learn that Drizzle has a `union` function, to union queries together. Let's see it all together

```ts
const dataQuery = union(
  db
    .select({
      label: sql<string>`'All books'`,
      count: sql<number>`COUNT(*)`,
      id: sql<number>`0`,
    })
    .from(books)
    .where(eq(books.userId, userId)),
  subjectsQuery()
);
```

Which generates this SQL for us

```sql
(select 'All books', COUNT(*), 0 from `books` where `books`.`userId` = ?)
union
(select CASE WHEN t.rankMin = 1 THEN 'MIN Subjects' ELSE 'MAX Subjects' END as `label`, `count`, `subject`
 from (select `subject`,
              COUNT(*)                             as `count`,
              RANK() OVER (ORDER BY COUNT(*) ASC)  as `rankMin`,
              RANK() OVER (ORDER BY COUNT(*) DESC) as `rankMax`
       from `books_subjects`
       where `books_subjects`.`userId` = ?
       group by `books_subjects`.`subject`) `t`
 where (`rankMin` = ? or `rankMax` = ?))
```

Basically the same thing we did before, but with a few more parens, plus some userId filtering I left off for clarity.

This post is already too long, so I left off the tags queries, and the unused subjects/tags queries, but if you're curious what they look like, the code is [all here](https://github.com/arackaf/booklist/blob/master/svelte-kit/src/data/user-summary.ts) and the final union looks like this

```ts
const dataQuery = union(
  db
    .select({
      label: sql<string>`'All books'`,
      count: sql<number>`COUNT(*)`,
      id: sql<number>`0`,
    })
    .from(books)
    .where(eq(books.userId, userId)),
  subjectsQuery(),
  unusedSubjectsQuery(),
  tagsQuery(),
  unusedTagsQuery()
);
```

Just more function calls thrown into the union.

### Flexibility

Some of you might wince seeing that many large queries all union'd together. Those queries are actually run one after the other on the MySQL box. But, for this project it's a small amount of data, and there's not multiple round trips over the network to do it: our MySQL engine just executes those queries one after the other.

But let's say you truly want them run in parallel, and you decide you're better off breaking that union apart, and sending N queries, with each piece, and putting it all together in application code. These queries are _already_ separate function calls. It would be fairly trivial to remove those calls from the union, and instead invoke them in isolation (and then modify your application code).

This kind of flexibility is what I love the most about Drizzle. Refactoring large, complex stored procedure has always been a pain with SQL. When you code it through Drizzle, though, it becomes much more like refactoring a typed programming language, like TypeScript or C#.

## Debugging queries

Before we really kick the tires and see what Drizzle can do, let's take a look at how easily Drizzle let's you debug your queries. Let's say the query from earlier didn't return what we expected, and we want to see the actual SQL being run. We can do that by **removing** the `await` from the query, and then calling `getSQL` on the result.

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
  params: [ '123', 150, '%Stephen Jay Gould%', 10 ]
}
```

`result.toSQL()` returned an object, with a `sql` field, with our query, and a `params` field with the parameters. As any ORM would, Drizzle parameterized our query, so fields with invalid characters wouldn't break anything. You can now run this query directly against your db to see what went wrong.

## Wrapping up

I hope you've enjoyed this introduction to Drizzle. If you're not afraid of a little sql, it can make your life a lot easier.

Happy coding!
