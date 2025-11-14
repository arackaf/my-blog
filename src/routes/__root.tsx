import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import globalStyles from "../styles/global.css?url";
import codeHighlightingStyles from "../styles/code-highlighting-overrides.css?url";
import blogPostStyles from "../styles/blog-styles.css?url";
import Meta from "@/components/Meta";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: globalStyles,
      },
      {
        rel: "stylesheet",
        href: codeHighlightingStyles,
      },
      {
        rel: "stylesheet",
        href: blogPostStyles,
      },
    ],
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
