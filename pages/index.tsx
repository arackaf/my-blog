import Container from "../components/container";
import { DateFormatter } from "../components/date-formatter";
import Layout from "../components/layout";
import { getAllPosts } from "../lib/api";
import Head from "next/head";
import Link from "next/link";

import { GithubIcon } from "../components/svg/githubIcon";
import { TwitterIcon } from "../components/svg/twitterIcon";

import { NextWrapper } from "next-blurhash-previews";
import { FC, PropsWithChildren } from "react";

const PersonalLink: FC<PropsWithChildren<{ href: string }>> = ({ href, children }) => {
  return (
    <a href={href} className="flex items-center sm:gap-0.5 [&>:first-child]:w-4.5 [&_svg]:fill-(--link-color) sm:[&_svg]:h-4 [&_svg]:h-3.5">
      {children}
    </a>
  );
};

export default function Index({ allPosts }) {
  return (
    <>
      <Layout>
        <Head>
          <title>Adam Rackis's personal site and blog</title>
        </Head>
        <Container>
          <section>
            <div className="blog-header flex mb-8">
              <div className="rounded-full overflow-hidden sm:w-[125px] sm:h-[125px] w-24 h-24">
                <NextWrapper sync={true} blurhash="L9Fhx14T144o5Q01~p-5lVD%x[tl" width="125" height="125">
                  <img alt="Profile pic" className="rounded-full sm:w-[125px] sm:h-[125px] w-24 h-24" src="/assets/home/avatar.jpg" />
                </NextWrapper>
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
                Welcome to my blog. I usually write about web development—the React or Svelte stacks in particular—or occasionally GraphQL, databases,
                or anything else I'm interested in.
              </p>
            </div>
          </section>

          <div>
            {allPosts.map(post => (
              <div key={post.title} className="blog-list-item mb-8">
                <h1 className="leading-none text-2xl font-bold">
                  {post.url ? (
                    <a href={post.url}>
                      {post.title} &nbsp;<i className="fad fa-external-link-alt"></i>
                    </a>
                  ) : (
                    <Link href={`blog/${post.slug}`}>{post.title}</Link>
                  )}
                </h1>
                <small className="text-sm italic">
                  <DateFormatter dateString={post.date}></DateFormatter>
                  {post.url ? <span> on {post.url.indexOf("css-tricks.com") >= 0 ? "css-tricks.com" : "Frontend Masters"}</span> : ""}
                </small>
                <p className="mt-1.5">{post.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </Layout>
    </>
  );
}

export async function getStaticProps() {
  const allPosts = getAllPosts(["title", "slug", "date", "description"]);

  return {
    props: { allPosts },
  };
}
