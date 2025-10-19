import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

// @ts-ignore
import { imagePreviewBootstrap } from "next-blurhash-previews";

import "../styles/global.css";
import "../styles/code-highlighting-overrides.css";
import "../styles/fontawesome/css/all.min.css";
import "../styles/shiki-overrides.css";
import "../styles/blog-styles.css";

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
        {imagePreviewBootstrap}
        {children}

        <Scripts />
      </body>
    </html>
  );
}
