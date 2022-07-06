import "prismjs/themes/prism-tomorrow.css";
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "../styles/prism-overrides.css";
import "../styles/reset.css";
import "../styles/index.css";
import "../styles/app.scss";
import "../styles/header.scss";
import "../styles/fontawesome/css/all.min.css";

import "../components/ImageWithPreview";
import Head from "next/head";
import { ImagePreviewBootstrap } from "../components/ImageWithPreview";

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <ImagePreviewBootstrap />

      <Component {...pageProps} />
    </>
  );
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ["uikit-image"]: any;
    }
  }
}
