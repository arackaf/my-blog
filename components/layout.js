import Meta from "../components/meta";
import { Nav } from "./nav";

export default function Layout({ children }) {
  return (
    <>
      <Meta />
      <main>
        <Nav />
        <article>
          {/* <div style={{ backgroundColor: "blue" }}></div> */}
          <section>{children}</section>
          {/* <div style={{ backgroundColor: "red" }}></div> */}
        </article>
      </main>
    </>
  );
}
