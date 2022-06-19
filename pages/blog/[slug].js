import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import ErrorPage from "next/error";

import { post as postCssClass } from "../../styles/blog-styles.module.scss";

import markdownToHtml from "../../lib/markdownToHtml";
import { getPostBySlug, getAllPosts } from "../../lib/api";

import Container from "../../components/container";
import Layout from "../../components/layout";
import PostBody from "../../components/post-body";
import DateFormatter from "../../components/date-formatter";

export default function Post({ post, morePosts, preview }) {
  const router = useRouter();
  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />;
  }

  const { title, date } = post;

  return (
    <Layout preview={preview} className={postCssClass}>
      <Container>
        <Link href="/">
          <a className="back-link">
            <i className="fas fa-reply"></i> Adam's Blog
          </a>
        </Link>

        {router.isFallback ? (
          <h1>Loading…</h1>
        ) : (
          <>
            <Head>
              <title>{post.title} | Next.js Blog Example with</title>
              <meta property="og:image" content={post.ogImage.url} />
            </Head>

            <h1 className="post-title">{title}</h1>
            <div>
              <DateFormatter dateString={date} />
            </div>

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
