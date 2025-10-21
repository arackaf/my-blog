export type ExternalPost = {
  title: string;
  date: string;
  description: string;
  url: string;
};

export const externalPosts: ExternalPost[] = [
  {
    title: "Introducing Zustand",
    date: "2025-07-21T10:00:00.000Z",
    description: "A quick introduction to Zustand, a simple, fun and effective state management library for React",
    url: "https://frontendmasters.com/blog/introducing-zustand/",
  },
  {
    title: "Satisfies in TypeScript",
    date: "2025-07-03T10:00:00.000Z",
    description: "Some quick coverage of one of TypeScript's less commonly used features: satisfies",
    url: "https://frontendmasters.com/blog/satisfies-in-typescript/",
  },
  {
    title: "Introducing TanStack Start",
    date: "2024-12-18T10:00:00.000Z",
    description: "A high-level introduction to TanStack Start, featuring integration with react-query",
    url: "https://frontendmasters.com/blog/introducing-tanstack-start/",
  },
  {
    title: "Introducing Fly.io",
    date: "2024-12-12T10:00:00.000Z",
    description: "An introduction to the Fly.io platform",
    url: "https://frontendmasters.com/blog/introducing-fly-io/",
  },
  {
    title: "Drizzle Database Migrations",
    date: "2024-12-09T10:00:00.000Z",
    description: "Using Drizzle to manage and sync your database schema",
    url: "https://frontendmasters.com/blog/drizzle-database-migrations/",
  },
  {
    title: "Loading Data with TanStack Router: react-query",
    date: "2024-11-21T10:00:00.000Z",
    description: "Integrating TanStack Router with react-query for rich, fine-grained data loading",
    url: "https://frontendmasters.com/blog/tanstack-router-data-loading-2/",
  },
  {
    title: "Loading Data with TanStack Router: Getting Going",
    date: "2024-11-20T10:00:00.000Z",
    description: "Using TanStack Router's built-in features to load, and invalidate data",
    url: "https://frontendmasters.com/blog/tanstack-router-data-loading-1/",
  },
  {
    title: "Introducing TanStack Router",
    date: "2024-09-13T10:00:00.000Z",
    description: "An introduction to TanStack Router, showing type-safe routing",
    url: "https://frontendmasters.com/blog/introducing-tanstack-router/",
  },
  {
    title: "Java Optionals",
    date: "2024-08-30T10:00:00.000Z",
    description: "An introduction to Java Optionals",
    url: "https://frontendmasters.com/blog/java-optionals/",
  },
  {
    title: "Fine-Grained Reactivity in Svelte 5",
    date: "2024-08-14T10:00:00.000Z",
    description: "A deep dive into Svelte 5's fine-grained reactivity",
    url: "https://frontendmasters.com/blog/fine-grained-reactivity-in-svelte-5/",
  },
  {
    title: "Snippets in Svelte 5",
    date: "2024-08-07T10:00:00.000Z",
    description: "An introduction to Svelte 5 Snippets",
    url: "https://frontendmasters.com/blog/snippets-in-svelte-5/",
  },
  {
    title: "Introducing Svelte 5",
    date: "2024-07-19T10:00:00.000Z",
    description: "An introduction to Svelte 5, covering the basics: state, props and effects",
    url: "https://frontendmasters.com/blog/introducing-svelte-5/",
  },
  {
    title: "Introducing Drizzle",
    date: "2024-06-17T10:00:00.000Z",
    description: "An introduction to one of the more unique ORMs out there: Drizzle",
    url: "https://frontendmasters.com/blog/introducing-drizzle/",
  },
  {
    title: "Testing Types in TypeScript",
    date: "2024-06-04T10:00:00.000Z",
    description:
      "You already know you can unit test your code. But did you know that you can also unit test your advanced TypeScript types? This post walks you through it",
    url: "https://frontendmasters.com/blog/testing-types-in-typescript/",
  },
  {
    title: "Combining React Server Components with react-query for Easy Data Management",
    date: "2024-05-24T10:00:00.000Z",
    description: "An introduction to React Query Components, and how to use react-query to streamline data loading",
    url: "https://frontendmasters.com/blog/combining-react-server-components-with-react-query-for-easy-data-management/",
  },
  {
    title: "Prefetching When Server Loading Won’t Do",
    date: "2024-05-15T10:00:00.000Z",
    description: "A guide to prefetching data for when server rendering isn't feasible, and streaming isn't available",
    url: "https://frontendmasters.com/blog/prefetching-when-server-loading-wont-do/",
  },
  {
    title: "Using Auth.js with SvelteKit",
    date: "2024-04-29T10:00:00.000Z",
    description: "A guide to implementing authentication with Auth.js in SvelteKit",
    url: "https://frontendmasters.com/blog/using-nextauth-now-auth-js-with-sveltekit/",
  },
  {
    title: "Caching Data in SvelteKit",
    date: "2023-02-01T10:00:00.000Z",
    description: "A deep dive into the various ways data can be cached in SvelteKit",
    url: "https://css-tricks.com/caching-data-in-sveltekit/",
  },
  {
    title: "Getting Started With SvelteKit",
    date: "2023-01-23T10:00:00.000Z",
    description: "An introduction to SvelteKit, a Svelte-based application Meta Framework",
    url: "https://css-tricks.com/getting-started-with-sveltekit/",
  },
  {
    title: "Using Web Components With Next (or Any SSR Framework)",
    date: "2022-10-05T10:00:00.000Z",
    description: "A guide to using web components in application metaframeworks like Next",
    url: "https://css-tricks.com/using-web-components-with-next-or-any-ssr-framework/",
  },
  {
    title: "Introducing Shoelace, a Framework-Independent Component-Based UX Library",
    date: "2022-10-04T10:00:00.000Z",
    description: "An introduction to Shoelace, a web component-based, ux component library",
    url: "https://css-tricks.com/shoelace-component-frameowrk-introduction/",
  },
  {
    title: "Building Interoperable Web Components That Even Work With React",
    date: "2022-06-07T10:00:00.000Z",
    description: "An introduction to building web components, and then using them with JavaScript frameworks like Svelte and React",
    url: "https://css-tricks.com/building-interoperable-web-components-react/",
  },
  {
    title: "Inline Image Previews with Sharp, BlurHash, and Lambda Functions",
    date: "2022-05-19T10:00:00.000Z",
    description: "Displaying image previews with Base64 encoding, and Blurhash",
    url: "https://css-tricks.com/inline-image-previews-with-sharp-blurhash-and-lambda-functions/",
  },
  {
    title: "Syntax Highlighting (and More!) With Prism on a Static Site",
    date: "2022-05-04T10:00:00.000Z",
    description: "A deep dive on integrating Prism with Next.js for code highlighting",
    url: "https://css-tricks.com/syntax-highlighting-prism-on-a-next-js-site/",
  },

  {
    title: "Setting Up CloudFront to Host Your Web App",
    date: "2022-04-28T10:00:00.000Z",
    description: "Hosting your entire web app with AWS Cloudfront",
    url: "https://css-tricks.com/setting-up-cloudfront-to-host-your-web-app/",
  },
  {
    title: "Adding CDN Caching to a Vite Build",
    date: "2022-04-04T10:00:00.000Z",
    description: "Using AWS Cloudfront to serve static assets",
    url: "https://css-tricks.com/adding-cdn-caching-to-a-vite-build/",
  },
  {
    title: "Subsetting Font Awesome to Improve Performance",
    date: "2022-02-17T10:00:00.000Z",
    description: "How to pick only the Font Awesome icons you want for smaller bundles",
    url: "https://css-tricks.com/subsetting-font-awesome-to-improve-performance/",
  },

  {
    title: "Demystifying TypeScript Discriminated Unions",
    date: "2022-01-27T10:00:00.000Z",
    description: "Explaining TypeScript unions, and discriminated unions",
    url: "https://css-tricks.com/typescript-discriminated-unions/",
  },
  {
    title: "Making a Site Work Offline Using the VitePWA Plugin",
    date: "2022-01-18T10:00:00.000Z",
    description: "Diving deeper into Vite, and using the VitePWA plugin to improve your site's performance",
    url: "https://css-tricks.com/vitepwa-plugin-offline-service-worker/",
  },
  {
    title: "Adding Vite to Your Existing Web App",
    date: "2022-01-11T10:00:00.000Z",
    description: "A fun, painless introduction to Vite",
    url: "https://css-tricks.com/adding-vite-to-your-existing-web-app/",
  },
  {
    title: "React Suspense: Lessons Learned While Loading Data",
    date: "2021-11-09T10:00:00.000Z",
    description: "A deeper dive into data loading with Suspense",
    url: "https://css-tricks.com/react-suspense-lessons-learned-while-loading-data/",
  },
  {
    title: "Svelte for the Experienced React Dev",
    date: "2021-05-21T10:00:00.000Z",
    description: "A high-level introduction to Svelte, from the perspective of an experienced React developer",
    url: "https://css-tricks.com/svelte-for-the-experienced-react-dev/",
  },
  {
    title: "Coordinating Svelte Animations With XState",
    date: "2021-04-07T10:00:00.000Z",
    description: "An introduction to XState, for simplifying Svelte animation code",
    url: "https://css-tricks.com/coordinating-svelte-animations-with-xstate/",
  },
  {
    title: "Svelte and Spring Animations",
    date: "2021-01-08T10:00:00.000Z",
    description: "A deep dive into Svelte's spring animation features",
    url: "https://css-tricks.com/svelte-and-spring-animations/",
  },

  {
    title: "Integrating TypeScript with Svelte",
    date: "2020-12-28T10:00:00.000Z",
    description: "Manually adding TypeScript to a non-greenfield Svelte project",
    url: "https://css-tricks.com/integrating-typescript-with-svelte/",
  },
  {
    title: "Pre-Caching Images with React Suspense",
    date: "2020-09-21T10:00:00.000Z",
    description: "Using Suspense to block a component's rendering until its images have loaded",
    url: "https://css-tricks.com/pre-caching-image-with-react-suspense/",
  },
  {
    title: "How to Use CSS Grid for Sticky Headers and Footers",
    date: "2020-09-14T10:00:00.000Z",
    description: "A beginner friendly introduction to CSS Grid, with examples implementing sticky headers and footers",
    url: "https://css-tricks.com/how-to-use-css-grid-for-sticky-headers-and-footers/",
  },
  {
    title: "Making Sense of react-spring",
    date: "2020-08-20T10:00:00.000Z",
    description: "Understanding how react-spring works, and how to leverage it for common animation use cases",
    url: "https://css-tricks.com/making-sense-of-react-spring/",
  },
  {
    title: "Building Your First Serverless Service With AWS Lambda Functions",
    date: "2020-05-29T10:00:00.000Z",
    description: "A beginners introduction to the Serverless framework",
    url: "https://css-tricks.com/building-your-first-serverless-service-with-aws-lambda-functions/",
  },
  {
    title: "React Suspense in Practice",
    date: "2020-03-19T10:00:00.000Z",
    description: "A practical, hands-on tutorial to React Suspense",
    url: "https://css-tricks.com/react-suspense-in-practice/",
  },
  {
    title: "Making your web app work offline",
    date: "2017-12-07T10:00:00.000Z",
    description: "A gentle introduction to offline web development",
    url: "https://css-tricks.com/making-your-web-app-work-offline-part-1/",
  },
];
