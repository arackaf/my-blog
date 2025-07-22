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
