import "prismjs/themes/prism-tomorrow.css";
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "prismjs/plugins/line-highlight/prism-line-highlight.css";
import "../styles/prism-overrides.css";
import "../styles/reset.css";
import "../styles/index.css";
import "../styles/header-footer.scss";

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
