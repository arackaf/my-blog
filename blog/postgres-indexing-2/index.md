---
title: More Fun with Postgres indexes
date: "2025-08-19T10:00:00.000Z"
description: Pushing our index knowledge to the next level, to get the most out of our database
---

Welcome to part 2 our exploration of Postgres indexes. Be sure to check out part 1 if you haven't already. We'll be picking up exactly where we left off.

We have the same books table as before, with about 90 million records in it.

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

This is hardly surprising; there's a lot of rows in our table, and finding the rows for that publisher takes a while, since Postgres has to scan the entire heap.

So we add an index on, for now, just publisher

```sql
CREATE INDEX idx_publisher ON books(publisher);
```

We can think of our index like this. It just helps us identify all the book entries by publisher. To get the rest of the info on the book, we go to the heap

![Publisher BTree](/postgres-indexing-2/img2-publisher-btree.png)

And now our same query is incredibly fast.

![Small publisher plan](/postgres-indexing-2/img3-small-publisher-query-plan.png)

Nothing surprising or interesting.

But now you need to run the same query, but on a different publisher, number 210537. This is the biggest publisher in the entire database, with over 2 million books. Let's see how our index fares.

```sql
explain analyze
select *
from books
where publisher = 210537
order by title
limit 10;
```

![Large publisher plan](/postgres-indexing-2/img4-large-publisher-plan.png)

Actually, our index wasn't used at all. Postgres just scanned the whole table, grabbing our publisher along the way, and then sorted the results to get the top 10. We'll discuss why a little later, as we did in the prior post, but the short of it is that the **random** heap accesses from reading so many entries off of an index would be expensive; Postgres decided the scan would be cheaper. These decisions are all about tradeoffs, and governed by statistics and cost estimates.

Previously though, we threw the "other" field into the INCLUDE() list, so the engine wouldn't have to leave the index to get the other field it needed. In this case, we're selecting _everything_. I said previously to be dilligent in avoiding unnecessary columns in the SELECT clause for just this reason, but here assume we actually do need all these columns.

We probably don't want to dump every single column into the INCLUDE list of the index: we'd basically just be re-defining our table into an index.

But why are we needing to read so many rows to begin with? We have a limit of 10 on our query. The problem, of course, is that we're ordering on title. And postgres needs to see all rows for a publisher (2 million rows in this case) in order to sort them, and grab the first 10.

What if we built an index on publisher, _and then_ title

```sql
CREATE INDEX idx_publisher_title ON books(publisher, title);
```

That would look like this

![Publisher and title index](/postgres-indexing-2/img5-publisher-title-index.png)

If Postgres were to search for a specific publisher, it could just seek down to the start of that publisher's books, and then read however many needed, right off the leaf nodes, couldn't it? There could be 2 million book entries in the leaf nodes, but Postgres could just read the first 10, and be guarenteed that they're the first 10, since that's how the index is ordered.

Let's try it.

![Publisher and title index](/postgres-indexing-2/img6-fast-search-large-pub.png)

We got the top 10 books, sorted, from a list of over 2 million in less than a single millisecond. Amazing!

## More publishers!

Now your boss comes to you and tells you you need the top 10 books, sorted alphabetically, as before, but over **either** publisher, combined. To be clear, the requirement is to take all books both publishers have published, combine them, then get the first ten, alphabetically.

Easy you say, assuredly, fresh off the high of seeing Postgres grab you that same data for your enormous publisher in under a millisecond.

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

Let's re-read my completely made-up, assumed chain of events Postgres would take, from above

> Postgres can search for each, one at a time, save the starting points of both, and then start reading forward on both, and sort of merge them together, taking the smaller title from either, until you have 10 books total.

It kind of reads like the Charlie meme from Always Sunny

![Charlie Meme](/postgres-indexing-2/always-sunny-meme.gif)

If your description of what the database will do sounds like something that would fit with this meme, you're probably overthinking things.

Postgres operates on very simple operations that it chains together. Index Scan, Gather Merge, Sort, Sequential Scan, etc.

## Searching multiple publishers

To be crystal clear, Postgres can absolutely search multiple keys from an index. Here's the execution plan for the identical query from a moment ago, but with two small publishers for the publisher id's, which each have just a few hundred books

![Multiple Publishers Query](/postgres-indexing-2/img8-multiple-small-publishers.png)

It did indeed do an index scan, on that same index. It just matched two values at once.

Rather than taking one path down the B Tree, it takes multiple paths down the B Tree, based on the multiple key value matches.

```bash
   Index Cond: (publisher = ANY ('{157595,141129}'::integer[]))
```

That gives us **all** rows for _either_ publisher. Then it needs to sort them, which it does next, followed by the limit.

Why does it need to sort them? When we have a _single_ publisher, we _know_ all values under that publisher are ordered.

_Look_ at the index.

![Multiple Publishers Query](/postgres-indexing-2/img9-single-publisher-read.png)

Imagine we searched for publisher 8. Postgres can go directly to the beginning of that publisher, and _just read_:

```bash
"Animal Farm"
"Of Mice and Men"
```

Look what happens when we search for _two_ publishers, 8 and also, now, 21

![Multiple Publishers Query](/postgres-indexing-2/img10-double-publisher-read.png)

We can't just start reading for those matched records. That would give us

```bash
"Animal Farm"
"Of Mice and Men"
"Lord of The Flies"
"The Catcher in The Rye"
```

The books under each publisher is ordered, but the overall list of matches is not. And again, Postgres operates on _simple_ operations. Elaborate meta descriptions like "well it'll just merge the matches from each publisher taking the less of the next entry from either until the limit is satisfied" won't show up in your execution plan, at least not directly.

### Why did the publisher id change the plan?

Before we make this query fast, let's briefly consider why our query's plan changed so radically between searching for two small publishers, vs an enormous publisher, and a small one.

As we discussed in part 1, Postgres tracks and uses the statistics about your data in order to craft the best execution plan it can. Here, when you searched for the large publisher, it realized that query would yield an enormous number of rows. That led it to decide that simply scanning through the heap directly would be faster than the large number of random i/o that would be incurred from following an enormous number matches in the index's leaf nodes, over to the corresponding locations on the heap. Random i/o is bad, and Postgres will usually try to avoid it.

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
union all
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

The execution plan is beautiful

![Multiple Publishers Query with cte](/postgres-indexing-2/img11-cte-append.png)

and it's fast. As you can see, it runs in less than a fifth of a millisecond; it runs in 0.186ms, but who's counting.

Always read these from the bottom

![Multiple Publishers Query with cte](/postgres-indexing-2/img11a-cte-append.png)

It's the same exact index scan from before, but on a single publisher, with a limit of 10, run twice. Postgres can seek to the right publisher, and just read 10 for the first publisher, and then repeat for the second publisher.

Then it puts those lists together

Remember the silly, contrived Postgres operation I made up before?

> and then start reading forward on both, and sort of merge them together, taking the smaller title from either, until you have 10 books total.

You're not going to believe this, but that's exactly what the Merge Append on line 2 does

```bash
   ->  Merge Append  (cost=1.40..74.28 rows=20 width=111) (actual time=0.086..0.115 rows=10 loops=1)
```

You can achieve amazing things with modern databases if you know just how to structure your queries _just_ right.

## How does this scale?

Obviously you won't want to be writing queries like this manually, by hand. Presumably you'd have application code taking a list of publisher ids, and constructing something like this. How will it perform as you add more and more publishers?

I've explored this very idea on larger production sets of data (much larger than what we're using here). I found that, somewhere around a _thousand_ ids, the performance does break down. But not because there's too much data to work with. The _execution_ of those queries, with even a thousand id's, took only a few hundred ms. But the _Planning Time_ started to take many, many seconds. It turns out having Postgres parse through a thousand CTEs, and put a plan together takes time.

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

We query against our ids table, and then use the ugly `cross join lateral` expression as a neat trick to run our normal books query, but with access to the publisher value in the ids CTE. The value in the ids CTE is, of course, the publisher id. So we've achieved what we want: we're essentially, conceptually looping through those id's, and then running our fast query on each.

`lateral` is the key term in there. Think of (American) football, where a lateral is a sideways pass. Here, the lateral keyword allows us to "laterally" reference the `ids.id` value from the expression right beside it.

That coaxes Postgres to run it's normal index scan, followed by a read of the next 10 rows. That happens once for each id. That whole meta-list will then contain (up to) 10 rows for each publisher, and then this

```sql
select *
from results
order by title
limit 10;
```

re-sorts, and takes the first 10.

In my own experience this scales fabulously. Even with a few thousand ids I couldn't get this basic setup to take longer than half a second, even on a much larger table than we've been looking at here.

### Let's run it!

Let's see what this version of our query looks like

![Multiple Publishers Query with cte](/postgres-indexing-2/img12-cross-join.png)

Still a small fraction of a millisecond, but ever so slightly slower; this now runs in 0.207ms. And the execution plan is a bit longer and more complex.

```bash
   ->  Nested Loop  (cost=0.69..81.19 rows=20 width=111) (actual time=0.042..0.087 rows=20 loops=1)
```

A nested loop join is a pretty simple (and _usually_ pretty slow) join algorithm. It just takes each value in the one list, and then applies it to each value in the second list. In this case though, it's taking values from a static list, and applying them against an incredibly fast query.

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

But gone is our nice Merge Append, replaced with a normal sort. The reason is, we replaced discrete CTEs which each produced separate, identically sorted outputs, which the planner could identify, and apply a Merge Append to. Merge Append works on multiple, independently sorted streams of data. Instead, this is just regular join, which produces one stream of data, and therefore needs to be sorted.

But this is no tragedy. The query runs in a tiny fraction of a **milli**second, and will not suffer planning time degradation like the previous CTE version would, as we add more and more publisher id's. Plus, the sort is over just N\*10 records, where N is the number of publishers. It would take a catastrophically large N to wind up with enough rows where Postgres would struggle to sort them quickly, especially since the limit of 10 would allow it to do an efficient top-N heapsort, like we saw in part 1.

## Stepping back

The hardest part of writing this post is knowing when to stop. I could easiy write as much content again: we haven't even gotten into joins, and how indexes can help there, or even materialized views. This is an endless topic, and one that I enjoy. But this post is probably already too long, and I don't want to make it more so.

The one theme throughout can probably be summed up as so: understand _how_ your data are stored, and _craft_ your queries to make the best use possible of this knowledge. If you're not sure exactly how to craft your queries to do this, then use your knowledge of how indexes work, and what you want your queries to accomplish to ask an _extremely_ specific question to your favorite AI model. It's very likely to _at least_ get you closer to your answer. Often times knowing _what_ to ask is half the battle.

And of course if your data are not stored how you need it, then change how your data are stored. Indexes are the most common way, which we've discussed here. Materialized views would be the next power tool to consider, when needed. But that's a topic for another day.

## Parting thoughts

Hopefully these posts have taught you a few things about querying, query tuning, and crafting the right index for the right situation. These are skills that can have a huge payoff in achieving palpable performance gains that your users will notice.

Happy querying!
