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
