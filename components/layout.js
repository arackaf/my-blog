import Meta from "../components/meta";
import { Nav } from "./nav";

export default function Layout({ children, className = "" }) {
  return (
    <>
      <Meta />
      <main className="flex flex-col max-w-[704px] mx-auto px-4">
        <Nav />
        <article className={className}>
          <section>{children}</section>
        </article>
      </main>
    </>
  );
}
