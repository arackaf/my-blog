---
title: Inline image previews
date: "2022-04-15T10:00:00.000Z"
description: Inline Image Previews with Sharp, Blurhash, and Lambda Functions 
---

Don't you hate it when you load a website / web app, some content displays, *and then* some images load, causing content to shift around. That's called [content reflow](https://developers.google.com/speed/docs/insights/browser-reflow) and it can be incredibly annoying. I've previously [written about](https://css-tricks.com/pre-caching-image-with-react-suspense/) solving this with React's Suspense, which prevents the UI from loading until the images come in. 

This solves the content reflow problem, but at the expense of performance. The user is blocked from seeing any content until the images come in. Wouldn't is be nice if we could have the best of both worlds: prevent conent reflow, while also not making the user wait for the images to come in? This post will walk through generating blurry image previews, and displaying them immediately, with the real images rendering over the preview whenever they happen to come in.

## So you mean progressive jpeg's?

You might be wondering if I'm about to talk about [progressive jpegs](https://css-tricks.com/progressive-jpgs-a-new-best-practice/), which are an alternate encoding that causes images to initially render, full size, blurry, and then gradually refine as the data come in, until everything renders correctly. 

This seems like a great solution until you get into some of the details. Re-encoding your images as progressive jpeg's is reasonably straightforward; there are plugins for [Sharp](https://sharp.pixelplumbing.com/) that will handle that for you. Unfortunately, you still need to wait for *some* of your images' bytes to come over the wire until even a blurry preview of your image displays, at which point your content will reflow, making room for the image's preview. You might look for some sort of event to indicate that an initial preview of the image has loaded, but none exist (come on, web platform), and the workarounds are ... [not ideal](https://stackoverflow.com/a/48372320/352552).

Let's look at two alternatives for this.

## The libraries we'll be using

Before we start, I'd like to call out the versions of the libraries I'll be using for this post:

 - [Blurhash](https://www.npmjs.com/package/blurhash) version 1.1.5
 - [Sharp](https://www.npmjs.com/package/sharp) version 0.30.3

## Making our own previews

Most of us are used to using `<img />` tags by providing a `src` attribute that's a url to some place on the interenet, where our image exists. But we can also provide a Base64 encoding of an image, and just set that inline. We wouldn't *usually* want to do that, since those Base64 strings can get huge for images, and embedding them in our JS bundles can cause some serious bloat. But what if, when we're processing our images (to resize, adjust the quality, etc), we also make a low quality, blurry version of our image, and take the Base64 encoding of *that*. The size of that Base 64 image preview will be significantly smaller. We could save that preview string, put it in our JS bundle, and show that inline until our real image is done loading. 

This will cause a blurry preview of our image to show immediately, while the image loads. When the real image is done loading, we can hide the preview, and show the real image.

Let's see how.

### Generating our preview

I mentioned [Sharp](https://sharp.pixelplumbing.com/) before, which is outstanding, but it has some particular installation requirements which make it a little tricky, and non-performant to use in Lambda functions; more about that later. For now, let's look at [Jimp](https://www.npmjs.com/package/jimp), which has no dependencies on things like node-gyp, and can just be installed and used in a Lambda.

Here's a function (stripped of error handling and logging) that uses Jimp to process an image, resize it, and then creates a blurry preview of the image.

```js
function resizeImage(src, maxWidth, quality) {
  return new Promise<ResizeImageResult>(res => {
    Jimp.read(src, async function (err, image) {
      if (image.bitmap.width > maxWidth) {
        image.resize(maxWidth, Jimp.AUTO);
      }
      image.quality(quality);

      const previewImage = image.clone();
      previewImage.quality(25).blur(8);
      const preview = await previewImage.getBase64Async(previewImage.getMIME());

      res({ STATUS: "success", image, preview });
    });
  });
}
```

For this post, I'll be using this image

![Image preview](big-boy.jpeg)

And here's what the preview looks like 

![Image preview](data:image/jpeg;base64,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)


This is the base64 encoding

> data:image/jpeg;base64,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

Obviously this preview encoding isn't small, but then again neither is our image; smaller images will produce smaller previews. Measure and profile for your own use case to see how viable this solution is.

Now we can send that image preview down from our data layer, along with the actual image url, and of course any other related data. We can immediately display the image preview, and when the actual image loads, swap it out. Here's some (simplified) React code to do that.

```js
const Cover = ({ url, preview = "" }) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // make sure the image src is added after the onload handler
    if (imgRef.current) {
      imgRef.current.src = url;
    }
  }, [url, imgRef, preview]);

  return (
    <>
      <Preview loaded={loaded} preview={preview} />
      <img
        ref={imgRef}
        onLoad={() => setTimeout(() => setLoaded(true), 3000)}
        style={{ display: loaded ? "block" : "none" }}
      />
    </>
  );
};

const Preview: FunctionComponent<CoverPreviewProps> = ({ preview, loaded }) => {
  if (loaded) {
    return null;
  } else if (typeof preview === "string") {
    return <img key="book-preview" alt="Book cover preview" src={preview} style={{ display: "block" }} />;
  } else {
    return <PreviewCanvas preview={preview} loaded={loaded} />;
  }
};
```

Don't worry about the `PreviewCanvas` component, yet, and don't worry about the fact that things like a changing url aren't accounted for. 

Note that we set the image component's src after the onLoad handler, to ensure it fires. We show the preview, and when the real image loads, we swap it in.

## Improving things with Blurhash

The image preview we saw before might not be small enough to send down with our JS bundle; and these strings will not gzip well. Depending on how many of these images you have, this may or may not be good enough. But if you'd like to compress things even smaller, and you're willing to do a bit more work, there's a wonderful library called [Blurhash](https://blurha.sh/). 

Blurhash generates incredibly small previews using base 83 encoding. Base 83 encoding allows it to squeeze more information into fewer bytes, which is part of how it keeps the previews so small. 83 might seem like an arbitrary number, but [the readme](https://github.com/woltapp/blurhash#why-base-83) sheds some light on this

> First, 83 seems to be about how many low-ASCII characters you can find that are safe for use in all of JSON, HTML and shells.

> Secondly, 83 * 83 is very close to, and a little more than, 19 * 19 * 19, making it ideal for encoding three AC components in two characters.

Best of all, Blurhash is used in [a number of apps](https://github.com/woltapp/blurhash#users) you might have heard of, like Signal and Mastodon. 

Let's see it in action.

### Generating Blurhash previews

For this, we'll need to use the [Sharp](https://www.npmjs.com/package/sharp) library.

---

**Note**

To generate your blurhash previews, you'll likely want to run some sort of serverless function to process your images, and generate the previews. I'll be using AWS Lambda, but any alternative should work. Just be careful about maximum size limitations; the binaries Sharp installs add about 9MB to the serverless function's size.

To run this code in an AWS Lambda, you'll need to install the library like this 

```
install-deps": "npm i && SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm i --arch=x64 --platform=linux sharp
```

And of course make sure you're not doing any sort of bundling, to ensure all of the binaries are sent to your Lambda. This will affect the size of the Lambda deploy. Sharp alone will wind up being about 9MB, which won't be great for cold start times. For me, the code you'll see below is in a Lambda that just runs periodically, (without any UI waiting on it) generating Blurhash previews.

---

The docs for Blurhash are extremely lacking, but this code will look at the size of the image, and create a blurhash preview (again I've removed all error handling and logging, for clarity)

```js
import { encode, isBlurhashValid } from "blurhash";
const sharp = require("sharp");

export async function getBlurhashPreview(src) {
  const image = sharp(src);
  const dimensions = await image.metadata();

  return new Promise(res => {
    const { width, height } = dimensions;

    image
      .raw()
      .ensureAlpha()
      .toBuffer((err, buffer) => {
        const blurhash = encode(new Uint8ClampedArray(buffer), width, height, 4, 4);
        if (isBlurhashValid(blurhash)) {
          return res({ blurhash, w: width, h: height });
        } else {
          return res(null);
        }
      });
  });
}
```

Worth noting is the call to `ensureAlpha`. This ensures that each pixel has 4 bytes, for RGB, and Alpha. Jimp lacks this method, which is why we're using Sharp, here; if anyone knows otherwise, please drop a comment. Also note that we're saving not only the preview string, but also the dimensions of the image, which will make sense in a bit. 

The real work happens here

```js
const blurhash = encode(new Uint8ClampedArray(buffer), width, height, 4, 4);
```

We're caling blurhash's `encode` method, passing it our image, as well as the image's dimensions. The last two arguments are `componentX` and `componentY` which seem to (again the docs are extremely lacking, this is what I can tell from the code) control how many passes blurhash does on our image, adding more and more detail. The acceptable values are 1 to 9, inclusive, and from my own testing 4 is a sweet spot, that produces the best results.

Let's see what this produces for that same image

```json
{
  "blurhash" : "UAA]{ox^0eRiO_bJjdn~9#M_=|oLIUnzxtNG",
  "w" : 276,
  "h" : 400
}
```

That's incredibly small! The tradeoff is that *using* this preview is a bit more involved. Basically, we need to call blurhash's `decode` method, and render our image preview in a canvas tag. This is what the `PreviewCanvas` component was doing before, and why we were rendering it if the type of our preview was not a string, since our blurhash previews use an entire object, containing not only the preview string, but the image dimensions.

Ok, let's look at our `PreviewCanvas` component.

```js
const PreviewCanvas: FunctionComponent<CanvasPreviewProps> = ({ preview }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const pixels = decode(preview.blurhash, preview.w, preview.h);
    const ctx = canvasRef.current.getContext("2d");
    const imageData = ctx.createImageData(preview.w, preview.h);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }, [preview]);

  return <canvas ref={canvasRef} width={preview.w} height={preview.h} />;
};
```

Not too terribly much going on here. We're decoding our preview, and then calling some fairly specific Canvas api's.

Let's see what the image previews look like

https://codesandbox.io/s/blurhash-preview-6nh9li 


In a sense, it's less detailed than our previous previews. But I've also found them to be a bit smoother, and less pixelated; and of course they take up a tiny fraction of the size.

Test, and use what works best for you.

## Wrapping up

There are many ways to prevent content re-flow as your images load on the web. Preventing your UI from rendering at all until the images come in is one way. The downside is that your user winds up waiting longer for content. A good middleground is to immediately show a preview of the image, and just swap the real thing in when it's loaded. This post walked you through two ways of doing that: generating degraded, blurry versions of an image using a tool like Sharp, and using Blurhash to generate an extremely small, Base83 encoded preview.

Happy coding!