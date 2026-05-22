import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import Meta from "@/components/Meta";

export const Route = createRootRoute({
  head: () => ({
    links: [],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Meta />

        <main className="flex flex-col max-w-[708px] mx-auto px-4">
          <article>
            <section>
              <div className="mt-4 sm:mt-10">{children}</div>
            </section>
          </article>
        </main>

        <Scripts />
      </body>
    </html>
  );
}
