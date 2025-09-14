import Meta from "../components/meta";
import { Nav } from "./nav";

export default function Layout({ children, className = "" }) {
  return (
    <>
      <Meta />
      <main className="flex flex-col max-w-2xl mx-auto px-4 sm:px-0">
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
