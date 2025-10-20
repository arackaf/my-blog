import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

// @ts-ignore
import { imagePreviewBootstrap } from "next-blurhash-previews";

import css1 from "../styles/global.css?url";
import css2 from "../styles/code-highlighting-overrides.css?url";
import css3 from "../styles/fontawesome/css/all.min.css?url";
import css4 from "../styles/shiki-overrides.css?url";
import css5 from "../styles/blog-styles.css?url";
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
        href: css1,
      },
      {
        rel: "stylesheet",
        href: css2,
      },
      {
        rel: "stylesheet",
        href: css3,
      },
      {
        rel: "stylesheet",
        href: css4,
      },
      {
        rel: "stylesheet",
        href: css5,
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
        {imagePreviewBootstrap}

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
