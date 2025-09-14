import Container from "../components/container";
import { DateFormatter } from "../components/date-formatter";
import Layout from "../components/layout";
import { getAllPosts } from "../lib/api";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";

import { GithubIcon } from "../components/svg/githubIcon";
import { TwitterIcon } from "../components/svg/twitterIcon";

import styles from "../styles/root-styles.module.scss";
const { title: titleStyles, list: listStyles, avatar: avatarStyles } = styles;

import AvatarImg from "../public/assets/home/avatar.jpg";

import { NextWrapper } from "next-blurhash-previews";
import { FC, PropsWithChildren } from "react";

const PersonalLink: FC<PropsWithChildren<{ href: string }>> = ({ href, children }) => {
  return (
    <a href={href} className="flex items-start [&>:first-child]:w-4.5 [&>:first-child]:mr-0.5 [&_svg]:fill-(--link-color) [&_svg]:h-4">
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
          <section className={titleStyles}>
            <div className="blog-header flex mb-8">
              <span>
                <NextWrapper sync={true} blurhash="L9Fhx14T144o5Q01~p-5lVD%x[tl" width="125" height="125">
                  <Image alt="" src={AvatarImg} height={125} width={125} loading="eager" />
                </NextWrapper>
              </span>
              <div className="titles flex flex-col ml-2.5 py-2.5">
                <h1>Strangely Typed</h1>
                <h3>Software engineering blog by Adam Rackis</h3>
                <div className="personal-links">
                  <h4>
                    <PersonalLink href="https://twitter.com/AdamRackis">
                      <span>
                        <TwitterIcon />
                      </span>
                      <span>adamrackis</span>
                    </PersonalLink>
                  </h4>
                  <h4>
                    <PersonalLink href="https://github.com/arackaf">
                      <span>
                        <GithubIcon />
                      </span>
                      <span>arackaf</span>
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

          <div className={listStyles}>
            {allPosts.map(post => (
              <div key={post.title} className="blog-list-item">
                <h3>
                  {post.url ? (
                    <a href={post.url}>
                      {post.title} &nbsp;<i className="fad fa-external-link-alt"></i>
                    </a>
                  ) : (
                    <Link href={`blog/${post.slug}`}>{post.title}</Link>
                  )}
                </h3>
                <small>
                  <DateFormatter dateString={post.date}></DateFormatter>
                  {post.url ? <span> on {post.url.indexOf("css-tricks.com") >= 0 ? "css-tricks.com" : "Frontend Masters"}</span> : ""}
                </small>
                <p>{post.description}</p>
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
