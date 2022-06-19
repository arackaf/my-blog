import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import ErrorPage from "next/error";

import markdownToHtml from "../../lib/markdownToHtml";
import { getPostBySlug, getAllPosts } from "../../lib/api";

import Container from "../../components/container";
import Layout from "../../components/layout";
import PostBody from "../../components/post-body";
import PostHeader from "../../components/post-header";

export default function Post({ post, morePosts, preview }) {
  const router = useRouter();
  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />;
  }
  return (
    <Layout preview={preview}>
      <Container>
        <Link href="/">
          <a>Bloggggxa</a>
        </Link>
        {router.isFallback ? (
          <h1>Loading…</h1>
        ) : (
          <>
            <Head>
              <title>{post.title} | Next.js Blog Example with</title>
              <meta property="og:image" content={post.ogImage.url} />
            </Head>
            <PostHeader title={post.title} coverImage={post.coverImage} date={post.date} author={post.author} />
            <PostBody content={post.content} />
          </>
        )}
      </Container>
    </Layout>
  );
}

export async function getStaticProps({ params }) {
  const post = getPostBySlug(params.slug, ["title", "date", "slug", "author", "content", "ogImage", "coverImage"]);
  const content = await markdownToHtml(post.content || "");

  return {
    props: {
      post: {
        ...post,
        content,
      },
    },
  };
}

export async function getStaticPaths() {
  const posts = getAllPosts(["slug"]);

  return {
    paths: posts.map(post => {
      return {
        params: {
          slug: post.slug,
        },
      };
    }),
    fallback: false,
  };
}
