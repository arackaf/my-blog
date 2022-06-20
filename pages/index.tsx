import Container from "../components/container";
import Layout from "../components/layout";
import { getAllPosts } from "../lib/api";
import Head from "next/head";
import Link from "next/link";

import styles from "../styles/root-styles.module.scss";
const { title: titleStyles } = styles;

export default function Index({ allPosts }) {
  return (
    <>
      <Layout>
        <Head>
          <title>Adam Rackis's personal site and blog</title>
        </Head>
        <Container>
          <section className={titleStyles}>
            <div className="blog-name">
              <img src="../assets/home/avatar.jpeg" />
              <div>
                <h1>Adam's Blog</h1>
                <h3>(workshopping the name)</h3>
              </div>
            </div>
            <p>Hi, I'm Adam 👋</p>
            <p>
              Welcome to my blog. I usually write about web development—the React or Svelte stacks in particular—or occasionally GraphQL, databases,
              or anything else I'm interested in at the time.
            </p>
          </section>

          <div>
            {allPosts.map(post => (
              <div>
                <h3>
                  <Link href={`blog/${post.slug}`}>
                    <a>{post.title}</a>
                  </Link>
                </h3>
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
