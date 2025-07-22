---
title: Blog post test
date: "2025-07-29T10:00:00.000Z"
description: How to encode and decode json with concrete types, which include dynamic pieces typed as `Any`
---

This is a new blog post

## Heading 1

Content in heading 1

### Heading 1a

Yooo

```ts
function foo(a: number, b: number): number {
  return a + b;
}
```

Check out that code

or this

```ts
async function getPuppeteerPage(browser: Browser) {
  const page = await browser.newPage();
  if (true) {
    await page.setRequestInterception(true);
    page.on("request", req => {
      const blockedResourceTypes = ["image", "stylesheet", "media", "font"];
      if (blockedResourceTypes.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  return page;
}
```

code 2

```javascript {lineNumbers}
x++;
x++;
x++;
x++;
x++;
x++;
x++;
x++;
x++;
x++;
x++;
x++;
x++;
x++;
```

big code

```javascript {lineNumbers}
function readBooks(variableString) {
  let variables = JSON.parse(variableString);
  let { page = 1, pageSize = 50, title_contains, sort } = variables;

  let predicate = null;
  let limit = pageSize;
  let skipAmount = (page - 1) * pageSize;
  let skip, cursorSkip;

  if (title_contains) {
    let searchRegex = new RegExp(escapeRegex(title_contains), "i");
    predicate = book => searchRegex.test(book.title);
    cursorSkip = 0;
    skip = skipAmount;
  } else {
    cursorSkip = skipAmount;
    skip = 0;
  }

  let sortField = sort ? Object.keys(sort)[0] : null;
  // No sort field will default to sorting by date added, which is the same as sorting by _id, given how
  // Mongo object ID's work.
  let idx = !sort || sortField == "_id" ? "dateAdded" : sortField == "pages" ? "pages" : "title_ci";
  let idxDir = sortField && sort[sortField] == -1 ? "prev" : void 0;

  return readTable("books", idx, {
    predicate,
    skip,
    cursorSkip,
    limit,
    idxDir,
  }).then(gqlResponse("allBooks", "Books", { Meta: { count: 12 } }));
}

function readTable(table, idxName = null, { predicate, idxDir, cursorSkip, skip, limit } = {}) {
  let open = indexedDB.open("books", 1);

  if (!predicate) {
    predicate = () => true;
  }

  return new Promise(resolve => {
    open.onsuccess = evt => {
      let db = open.result;
      let tran = db.transaction(table);
      let objStore = tran.objectStore(table);

      let tranCursor = idxName ? objStore.index(idxName).openCursor(null, idxDir) : objStore.openCursor(idxDir);
      let result = [];
      let skipped = 0;
      let hasSkipped = false;

      tranCursor.onsuccess = evt => {
        let cursor = evt.target.result;
        if (cursorSkip && !hasSkipped) {
          hasSkipped = true;
          return cursor.advance(cursorSkip);
        }
        if (!cursor) return resolve(result);

        let item = cursor.value;
        if (predicate(item)) {
          if (skip && skipped < skip) {
            skipped++;
          } else {
            result.push(item);
          }
          if (limit && result.length == limit) {
            return resolve(result);
          }
        }
        cursor.continue();
      };
    };
  });
}
```
