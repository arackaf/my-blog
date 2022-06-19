import Meta from "../components/meta";
import { Nav } from "./nav";

export default function Layout({ children, className = "" }) {
  return (
    <>
      <Meta />
      <main>
        <Nav />
        <article className={className}>
          {/* <div style={{ backgroundColor: "blue" }}></div> */}
          <section>{children}</section>
          {/* <div style={{ backgroundColor: "red" }}></div> */}
        </article>
      </main>
    </>
  );
}
