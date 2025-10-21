import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const allPaths = [
  "/blog/swift-codable-any",
  "/blog/dynamo-introduction",
  "/blog/suspense-explained",
  "/blog/redux-in-hooks",
  "/blog/css-modules",
  "/blog/graphql-caching-and-micro",
  "/blog/state-and-use-reducer",
  "/blog/offline-web-development",
  "/blog/new-beginnings",
];

const config = defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        filter: ({ path }) => path === "/", // || allPaths.includes(path),
      },
    }),
    nitro({ config: { preset: "node-server" } }),
    viteReact(),
  ],
});

export default config;
