---
title: Inline image previews
date: "2022-04-15T10:00:00.000Z"
description: Like progressive jpeg's, but better—inline image previews 
---

Don't you hate it when you load a website / web app, some content displays, *and then* some images load, causing content to shift around. That's called [content reflow](https://developers.google.com/speed/docs/insights/browser-reflow) and it can be incredibly annoying. I've previously [written about](https://css-tricks.com/pre-caching-image-with-react-suspense/) solving this with React's Suspense. This solution prevents the UI from loading until the images come in. 

This solves the content reflow problem, but at the expense of performance. Wouldn't is be nice if we could have the best of both worlds, prevent conent reflow, while also not making the user wait for the images come in? This post will walk through one way to do just that. We'll talk about generating blurry image previews, and displaying them immediately, with the real images rendering over the preview whenever they happen to come in.

## So you mean progressive jpeg's?

You might be wondering if I'm about to talk about progressive jpeg's. Progressive jpegs are an alternate encoding that causes the images to initially render, full size, blurry, and then gradually refine the image as the data come in, until everything renders correctly. 

This seems like a great solution until you get into some of the details. Re-encoding your images as progressive jpeg's is reasonably straightforward; there are plugins for [Sharp](https://sharp.pixelplumbing.com/) that will handle that for you. Unfortunately, you still need to wait for *some* of your images bytes to come over the wire until even a blurry preview of your image displays, at which point your content will reflow, making room for the image's preview. You might look for some sort of event to indicate that an initial preview of the image has loaded, but none exist (come on, web platform), and the workarounds are ... [not ideal](https://stackoverflow.com/a/48372320/352552).

Let's look at two alternatives for this.

## Making our own previews

Most of us are used to using `<img />` tags by providing a `src` attribute that's a url to some places on the interenet, where our image exists. But we can also provide a Base64 encoding of an image, and just set that inline. We wouldn't *usually* want to do that, since those Base64 strings can get huge for images, and embedding them in our JS bundles can cause some serious bloat. But what if, when we're processing our images (to resize, adjust the quality, etc), we also make a low quality, blurry version of our image, and take the Base64 encoding of *that*. The size of that image (and the Base64 encoding) will be significantly smaller. We could save that preview string, put it in our JS bundle, and show that inline until our real image is done loading. 

This will cause a blurry preview of our image to show immediately, while the image loads. When the real image is done loading, we can hide the preview, and show the real image.

Let's see how.

### Generating our preview

I mentioned [Sharp](https://sharp.pixelplumbing.com/) before, which is outstanding, but it has some particular installation requirements which make it a little tricky to use in Lambda functions. It's absolutely solvable, don't get me wrong. But [Jimp](https://www.npmjs.com/package/jimp) with no dependencies on node-gyp, or similar, and can be used directly in cloud functions without any extra steps.

```js
function resizeImage(src, maxWidth, quality) {
  return new Promise<ResizeImageResult>(res => {
    Jimp.read(src, async function (err, image) {
      if (image.bitmap.width > maxWidth) {
        image.resize(maxWidth, Jimp.AUTO);
      }
      image.quality(quality);

      let preview;
      try {
        const previewImage = image.clone();
        previewImage.quality(25).blur(8);
        preview = await previewImage.getBase64Async(previewImage.getMIME());
      } catch (er) {
        return res({ STATUS: "error", previewGenerationError: true });
      }

      res({ STATUS: "success", image, preview });
    });
  });
}
```