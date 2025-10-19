import Document, { Html, Head, Main, NextScript } from "next/document";
import { imagePreviewBootstrap } from "next-blurhash-previews";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en" className="scheme3">
        <Head />
        <body className="line-numbers">
          {imagePreviewBootstrap}
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
