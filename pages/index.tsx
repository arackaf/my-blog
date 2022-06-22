import Container from "../components/container";
import { DateFormatter } from "../components/date-formatter";
import Layout from "../components/layout";
import { getAllPosts } from "../lib/api";
import Head from "next/head";
import Link from "next/link";

import styles from "../styles/root-styles.module.scss";
const { title: titleStyles, list: listStyles } = styles;

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
              <img src="../assets/home/avatar.jpeg" />
              <div className="titles">
                <h1>Strangely Typed</h1>
                <h3>Software engineering blog by Adam Rackis</h3>
                <div>
                  <h4>
                    <a href="https://github.com/arackaf">
                      <i className="fab fa-twitter"></i> adamrackis
                    </a>
                  </h4>
                  <h4>
                    <a href="https://twitter.com/AdamRackis">
                      <i className="fab fa-github"></i> arackaf
                    </a>
                  </h4>
                </div>
              </div>
            </div>
            <div className="blog-intro">
              <p>Hi, I'm Adam 👋</p>
              <p>
                Welcome to my blog. I usually write about web development—the React or Svelte stacks in particular—or occasionally GraphQL, databases,
                or anything else I'm interested in at the time.
              </p>
            </div>
          </section>

          <div className={listStyles}>
            {allPosts.map(post => (
              <div className="blog-list-item">
                <h3>
                  {post.url ? (
                    <a>{post.title}</a>
                  ) : (
                    <Link href={`blog/${post.slug}`}>
                      <a>{post.title}</a>
                    </Link>
                  )}
                </h3>
                <small>
                  <DateFormatter dateString={post.date}></DateFormatter>{" "}
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
