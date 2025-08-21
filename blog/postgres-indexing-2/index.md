---
title: More Fun with Postgres indexes
date: "2025-08-19T10:00:00.000Z"
description: Pushing our index knowledge to the next level, to get the most out of our database
---

Welcome to part 2 our exploration of Postgres indexes. Be sure to check out part 1 if you haven't already. We'll be picking up exactly where we left off.

We have the same books table as we did before, with about 90 million records in it.

## Filtering and sorting

Let's dive right in. Imagine you work for some manner of book distribution company. You're responsible a number of publishers, and need to query info on them. There's a little over a quarter million different publishers, with a _wide_ variance on number of books published by each, which we'll get into.

Let's start easy. You want to see the top 10 books, sorted alphabetically, for a single publisher.

```sql
explain analyze
select *
from books
where publisher = 157595
order by title
limit 10;
```

This publisher is actually tiny, and only has 65 books in it. Nonetheless, the query is quite slow to run, taking almost 4 seconds.

![Basic query execution plan](/postgres-indexing-2/img1-basic-publisher-query.png)

This is hardly surprising; there's a lot of rows in our table, and finding the rows for that publisher takes a while.

So we add an index on, for now, just publisher

```sql
CREATE INDEX idx_publisher ON books(publisher);
```

We can think of our index like this. It just helps us identify all the book entries by publisher. To get the rest of the info on the book, we go to the heap

![Publisher BTree](/postgres-indexing-2/img2-publisher-btree.png)

And now our same query is incredibly fast.

![Small publisher plan](/postgres-indexing-2/img3-small-publisher-query-plan.png)

Nothing surprising or interesting.

But now you need to run the same query, but on a different publisher, number 210537. This is the biggest publisher in the entire database, with over 2 million books published. Let's see how our index fares now

```sql
explain analyze
select *
from books
where publisher = 210537
order by title
limit 10;
```

![Large publisher plan](/postgres-indexing-2/img4-large-publisher-plan.png)

Actually, our index wasn't used at all. Postgres just scanned the whole table, grabbing our publisher along the way, and then sorted to get the top 10. We've seen this before.

Previously though, we threw the "other" field into the INCLUDE() list, so the engine wouldn't have to leave the index to get the other field it needed. In this case, we're selecting _everything_. I said previously to be dilligent in avoiding unnecessary columns in the SELECT clause for just this reason, but here assume we actually do need all these columns.

We probably don't want to dump every single column into the INCLUDE list of the index: we'd basically just be re-defining our table into an index.

But why are we needing to read so many rows to begin with? We have a limit of 10 on our query. The problem, of course, is that we're ordering on title. And postgres needs to see all rows for a publisher (2 million rows in this case) in order to sort them, and grab the first 10.

What if we built an index on publisher, _and then_ title

```sql
CREATE INDEX idx_publisher_title ON books(publisher, title);
```

That would look like this

![Publisher and title index](/postgres-indexing-2/img5-publisher-title-index.png)

If Postgres were to search for a specific publisher value, it could just read however many books it wanted to, right off the leaf nodes, couldn't it? There could be 2 million book entries in the leaf nodes, but Postgres could just read the first 10, and be guarenteed that they're the first 10, since that's how the index is ordered.

Let's try it.

![Publisher and title index](/postgres-indexing-2/img6-fast-search-large-pub.png)

We got the top 10 books, sorted, from a list of over 2 million in less than a single millisecond. Amazing!

## More publishers!

Now your boss comes to you and tells you you need the top 10 books, sorted alphabetically, as before, but over **either** publisher, combined. To be clear, the requirement is, take all books both publishers have published, combine them, then get the first ten, alphabetically.

Easy you say, assuredly, fresh off the high of seeing Postgres grab you that same data for your enormous publisher in under a ms.

You can put both publisher id's into an IN clause. Then, Postgres can search for each, one at a time, save the starting points of both, and then start reading forward on both, and sort of merge them together, taking the smaller title from either, until you have 10 books total.

Let's try it!

```sql
explain analyze
select *
from books
where publisher in (157595, 210537)
order by title
limit 10;
```

Which produces this

![Multiple Publishers Query](/postgres-indexing-2/img7-multiple-publishers.png)

_Sad Trombone_

Let's re-read the assumed chain of events Postgres would take, from above

> Postgres can search for each, one at a time, save the starting points of both, and then start reading forward on both, and sort of merge them together, taking the smaller title from either, until you have 10 books total.

It kind of reads like the Charlie meme from Always Sunny

![Charlie Meme](/postgres-indexing-2/always-sunny-meme.gif)

If your description of what the database will do sounds like something that would fit with this meme, you're probably overthinking things.

Postgres, at least as of this writing, operates on very simple operations that it chains together. Index Scan, Gather Merge, Sort, Sequential Scan, etc.

## Searching multiple publishers

To be crystal clear, Postgres can absolutely search multiple keys from an index. Here's the execution plan for the identical query from a moment ago, but with two small publishers for the publisher id's, which each have just a few hundred books

![Multiple Publishers Query](/postgres-indexing-2/img8-multiple-small-publishers.png)

It did indeed do an index scan, on that same index. It just matches two values at once.

Rather than taking one path down the B Tree, it accepts multiple passes, based on the multiple key value matches.

```bash
   Index Cond: (publisher = ANY ('{157595,141129}'::integer[]))
```

That gives us **all** rows for _either_ publisher. Then it needs to sort them, which it does next, followed by the limit.

Why does it need to sort them? When we have a _single_ publisher, we _know_ all values under that publisher are ordered.

_Look_ at the index. Imagine we just search for publisher 8. Postgres can go directly to that publisher, and _just read_: "Animal Farm" "Of Mice and Men" etc

![Multiple Publishers Query](/postgres-indexing-2/img9-single-publisher-read.png)

Look what happens when we search for _two_ publishers, 8 and also, now, 21

![Multiple Publishers Query](/postgres-indexing-2/img10-double-publisher-read.png)

We can't just start reading for those matched records. That would give us

```bash
"Animal Farm" "Of Mice and Men" "Lord of The Flies" The Catcher in The Rye"
```

The books under each publisher is ordered, but the overall list of matches is not. And again, Postgres operates on _simple_ operations. Elaborate meta descriptions like "well it'll just merge the matches from each publisher taking the less of the next entry from either until the limit is satisfied" won't show up in your execution plan, at least not directly.

### Why did the publisher id change the plan?

Before we make this query fast, let's briefly consider why our query's plan changed so radically between searching for two small publishers, vs an enormous publisher, and a small one.

As we discussed in part 1, Postgres tracks and uses the statistics about your data in order to craft the best execution plan it can. Here, when you searched for the large publisher, it realized that query would yield an enormous number of rows. That led it to decide that just reading through the heap directly would be faster than the large number of random heap reads from the index that would otherwise be required.

## Crafting a better query

You can absolutely have Postgres find the top 10 books in both publisher, and then put them together, sorted, and take the first 10 from there. You just have to be explicit about it.

```sql
explain analyze
with pub1 as (
    select * from books
    where publisher = 157595
    order by title limit 10
), pub2 as (
    select * from books
    where publisher = 210537
    order by title limit 10
)
select * from pub1
union
select * from pub2
order by title
limit 10;
```

This syntax

```sql
with pub1 as (
    select * from books
    where publisher = 157595
    order by title limit 10
)
```

is called a common table expression, or a CTE. It's basically a query that we define, and then query against later.

Let's run it!

The execution plan is long

![Multiple Publishers Query with cte](/postgres-indexing-2/img11-cte-append.png)

but it's fast. As you can see, it runs in less than half of a millisecond.

Always read these from the bottom

![Multiple Publishers Query with cte](/postgres-indexing-2/img11a-cte-append.png)

It's the same exact index scan from before, but on a single publisher, with a limit of 10. Postgres can seek to the right publisher, and just read 10.

Then it puts those lists together

```bash
   ->  Append  (cost=0.69..74.17 rows=20 width=1108) (actual time=0.063..0.126 rows=20 loops=1)
```

and then it sorts them

```bash
   ->  Sort  (cost=74.60..74.65 rows=20 width=1108) (actual time=0.151..0.153 rows=20 loops=1)
```

To be crystal clear, it's not literally doing the imagined

> and then start reading forward on both, and sort of merge them together, taking the smaller title from either, until you have 10 books total.

I made up before. It's just taking the top 10 from each, combining them, and then sorting the (up to) 20 records, and taking the top 10.

But sorting 20 records in memory is a light lunch for Postgres; as you can see, it took 0.3ms.

## How does this scale?

Obviously you won't want to be writing queries like this manually, by hand. Presumably you'd have application code taking a list of publisher ids, and constructing something like this. How will it perform as you add more and more publishers?

I've explored this very idea on larger production sets of data? I found that, somewhere around a _thousand_ ids, the performance does break down. But not because there's too much data to work with. The execution of those queries, with even a thousand id's, took only a few hundred ms. But the _Planning Time_ started to take many, many seconds. It turns out having Postgres parse through a thousand CTEs takes time.

## Version 2

We're onto something, for sure. But can we take a list of ids, and force them into individual queries that match on that specific id, with a limit, and then select from the overall bucket of results? Exactly like before, but without having to manually cobble together a CTE for each id?

When there's a will, there's a way.

```sql
explain analyze
with ids as (
    select * from (
      values (157595), (210537)
    ) t(id)
), results as (
    select bookInfo.*
    from ids
    cross join lateral (
      select *
      from books
      where publisher = ids.id
      order by title
      limit 10
    ) bookInfo
)
select *
from results
order by title
limit 10;
```

Let's walk through this.

Our `ids` CTE

```sql
with ids as (
    select * from (
      values (157595), (210537)
    ) t(id)
)
```

Basically defines a psuedotable that has one column, with two rows. The rows have values of our publisher ids for the sole column: 157595 and 210537.

```sql
values (157595), (210537)
```

But if it's a table, how do we query against the column? It needs to have a name. That's what this syntax is

```sql
t(id)
```

we gave that column a name of `id`.

The `results` CTE is where the real work happens

```sql
results as (
    select bookInfo.*
    from ids
    cross join lateral (
      select *
      from books
      where publisher = ids.id
      order by title
      limit 10
    ) bookInfo
)
```

We query against our ids table, and then that ugly cross join later expression is just a trick to run our normal books query, but with access to the publisherId. `lateral` is the key term in there. Think of (American) football, where a lateral is a sideways pass. Here, we're allowed to "laterally" reference the `ids.id` value from the expression right beside it.

That coaxes Postgres to run it's normal index scan, followed by a read of the next 10 rows. That happens once for each id. That whole meta-list will then contain (up to) 10 rows for each publisher id, and then this

```sql
select *
from results
order by title
limit 10;
```

re-sorts, and takes the first 10.

In my own experience this scales fabulously. With with a few thousand ids I couldn't get this basic setup to take longer than half a second, even on a much larger table than we've been looking at here.

### Let's run it!

Let's see what this version of our query looks like

![Multiple Publishers Query with cte](/postgres-indexing-2/img12-cross-join.png)

Still a small fraction of a second, and also a much smaller, simpler plan. And we have a new operation in here.

```bash
   ->  Nested Loop  (cost=0.69..81.19 rows=20 width=111) (actual time=0.042..0.087 rows=20 loops=1)
```

A nested loop join is a pretty simple (and usually pretty slow) join algorithm. It just takes each value in the one list, and then applies it to each value in the second list.

The left side of the join is each id from that static table we built

```bash
  ->  Values Scan on "*VALUES*"  (cost=0.00..0.03 rows=2 width=4) (actual time=0.001..0.002 rows=2 loops=1)
```

The right side is our normal (_fast_) query that we've seen a few times now

```bash
   ->  Limit  (cost=0.69..40.48 rows=10 width=111) (actual time=0.024..0.037 rows=10 loops=2)
      ->  Index Scan using idx_publisher_title on books  (cost=0.69..2288.59 rows=575 width=111) (actual time=0.023..0.034 rows=10 loops=2)
         Index Cond: (publisher = "*VALUES*".column1)
```

and above that we do our normal sort.

##
