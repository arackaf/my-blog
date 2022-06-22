import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en" className="scheme3">
        <Head />
        <body className="line-numbers">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
