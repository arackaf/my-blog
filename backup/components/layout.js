import Meta from "./meta";

export default function Layout({ children, className = "" }) {
  return (
    <>
      <Meta />
      <main className="flex flex-col max-w-[708px] mx-auto px-4">
        <article className={className}>
          <section>{children}</section>
        </article>
      </main>
    </>
  );
}
