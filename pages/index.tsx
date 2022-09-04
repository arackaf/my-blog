import Container from "../components/container";
import { DateFormatter } from "../components/date-formatter";
import Layout from "../components/layout";
import { getAllPosts } from "../lib/api";
import Head from "next/head";
import Link from "next/link";
import Image from "next/future/image";

import { GithubIcon } from "../components/svg/githubIcon";
import { TwitterIcon } from "../components/svg/twitterIcon";

import styles from "../styles/root-styles.module.scss";
const { title: titleStyles, list: listStyles, avatar: avatarStyles } = styles;

import AvatarImg from "../public/assets/home/avatar.jpg";

import { NextWrapper } from "next-blurhash-previews";

export default function Index({ allPosts }) {
  return (
    <>
      <Layout>
        <Head>
          <title>Adam Rackis's personal site and blog</title>
        </Head>
        <Container>
          <section className={titleStyles}>
            <div className="blog-header">
              <span>
                <NextWrapper sync={true} blurhash="L9Fhx14T144o5Q01~p-5lVD%x[tl" width="125" height="125">
                  <Image src={AvatarImg} height={125} width={125} loading="eager" />
                </NextWrapper>
              </span>
              <div className="titles">
                <h1>Strangely Typed</h1>
                <h3>Software engineering blog by Adam Rackis</h3>
                <div className="personal-links">
                  <h4>
                    <a href="https://twitter.com/AdamRackis">
                      <span>
                        <TwitterIcon />
                      </span>
                      <span>adamrackis</span>
                    </a>
                  </h4>
                  <h4>
                    <a href="https://github.com/arackaf">
                      <span>
                        <GithubIcon />
                      </span>
                      <span>arackaf</span>
                    </a>
                  </h4>
                </div>
              </div>
            </div>
            <div className="blog-intro">
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
                    <Link href={`blog/${post.slug}`}>
                      <a>{post.title}</a>
                    </Link>
                  )}
                </h3>
                <small>
                  <DateFormatter dateString={post.date}></DateFormatter>
                  {post.url ? <span> on css-tricks.com</span> : ""}
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
