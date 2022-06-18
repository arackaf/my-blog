import "prismjs/themes/prism-tomorrow.css";
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "../styles/prism-overrides.css";
import "../styles/reset.css";
import "../styles/index.css";
import "../styles/app.scss";
import "../styles/header.scss";

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
