import { DateFormatter } from "@/components/date-formatter";
import { GithubIcon } from "@/components/svg/githubIcon";
import { TwitterIcon } from "@/components/svg/twitterIcon";

import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { FC, PropsWithChildren } from "react";

const getAllPosts = createServerFn().handler(async () => {
  return [
    {
      markdownContent: "",
      title: "Swift - Encoding and decoding `Any`",
      date: "2022-07-12T10:00:00.000Z",
      description: "How to encode and decode json with concrete types, which include dynamic pieces typed as `Any`",
      slug: "swift-codable-any",
    },
  ];
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Adam Rackis's personal site and blog",
      },
    ],
  }),
  loader: async () => {
    const allPosts = await getAllPosts();
    console.log({ postsValid: Array.isArray(allPosts) });
    return {
      posts: allPosts,
    };
  },
  component: App,
});

const PersonalLink: FC<PropsWithChildren<{ href: string }>> = ({ href, children }) => {
  return (
    <a href={href} className="flex items-center sm:gap-0.5 [&>:first-child]:w-4.5 [&_svg]:fill-(--link-color) sm:[&_svg]:h-4 [&_svg]:h-3.5">
      {children}
    </a>
  );
};

function App() {
  const { posts } = Route.useLoaderData();
  return (
    <div>
      <div className="blog-header flex mb-8">
        <div className="rounded-full overflow-hidden sm:w-[125px] sm:h-[125px] w-24 h-24 sm:min-w-[125px] sm:min-h-[125px] min-w-24 min-h-24">
          <img alt="Profile pic" className="rounded-full sm:w-[125px] sm:h-[125px] w-24 h-24" src="/assets/home/avatar.jpg" />
        </div>
        <div className="titles flex flex-col ml-2.5 justify-evenly">
          <div className="flex flex-col gap-1">
            <h1 className="leading-none text-xl sm:text-2xl md:text-3xl font-bold">Strangely Typed</h1>
            <h3 className="leading-none text-sm sm:text-lg md:text-xl font-bold">Software engineering blog by Adam Rackis</h3>
          </div>
          <div className="personal-links flex flex-col gap-1">
            <h4 className="leading-none sm:text-base text-sm">
              <PersonalLink href="https://twitter.com/AdamRackis">
                <span>
                  <TwitterIcon />
                </span>
                <span className="font-bold sm:text-base text-sm leading-none!">adamrackis</span>
              </PersonalLink>
            </h4>
            <h4 className="leading-none">
              <PersonalLink href="https://github.com/arackaf">
                <span>
                  <GithubIcon />
                </span>
                <span className="font-bold sm:text-base text-sm leading-none!">arackaf</span>
              </PersonalLink>
            </h4>
          </div>
        </div>
      </div>
      <div className="mb-8 flex flex-col gap-2">
        <p>Hi, I'm Adam 👋</p>
        <p>
          Welcome to my blog. I usually write about web development—the React or Svelte stacks in particular—or occasionally GraphQL, databases, or
          anything else I'm interested in.
        </p>
      </div>

      <div>
        {posts.map(post => (
          <div key={post.title} className="blog-list-item mb-8">
            <h1 className="leading-none text-2xl font-bold">
              <Link to="/blog/$slug" params={{ slug: post.slug }}>
                <span>{post.title}</span>
              </Link>
            </h1>
            <small className="text-sm italic">
              <DateFormatter dateString={post.date}></DateFormatter>
            </small>
            <p className="mt-1.5">{post.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
