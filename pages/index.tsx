import Container from "../components/container";
import Layout from "../components/layout";
import { getAllPosts } from "../lib/api";
import Head from "next/head";
import Link from "next/link";

export default function Index({ allPosts }) {
  return (
    <>
      <Layout>
        <Head>
          <title>Adam Rackis's personal site and blog</title>
        </Head>
        <Container>
          <img src="../assets/home/avatar.jpeg" />
          <div>Hello</div>

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

            <pre>{JSON.stringify(allPosts, null, 2)}</pre>
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
