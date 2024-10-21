import React, { useEffect } from "react";

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
import { DateFormatter } from "../../components/date-formatter";
import { BackArrow } from "../../components/svg/backArrow";

export default function Post({ post, morePosts, preview }) {
  const router = useRouter();
  if (!router.isFallback && !post?.slug) {
    return <ErrorPage statusCode={404} />;
  }

  useEffect(() => {
    for (const img of document.querySelectorAll("img")) {
      if (img.parentElement.tagName === "A") {
        continue;
      }

      const referenceParent = img.parentElement;

      const anchor = document.createElement("a");
      anchor.href = img.src.replace(/\-sized\./, ".");

      const slotValue = img.getAttribute("slot");
      if (slotValue) {
        anchor.setAttribute("slot", img.getAttribute("slot"));
        img.removeAttribute("slot", "");
      }
      anchor.target = "_blank";

      referenceParent.insertBefore(anchor, img);
      anchor.appendChild(img);
    }
  }, []);

  const { title, date } = post;

  return (
    <Layout preview={preview} className={postCssClass}>
      <Container>
        <h4>
          <Link href="/" className="back-link">
            <BackArrow height="18" />
            <span>Adam's Blog</span>
          </Link>
        </h4>

        {router.isFallback ? (
          <h1>Loading…</h1>
        ) : (
          <>
            <Head>
              <title>{post.title} | Next.js Blog Example with</title>
              <meta property="og:image" content="/assets/home/avatar.jpeg" />
            </Head>

            <h1>{title}</h1>
            <div className="post-date">
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
    paths: posts
      .filter(post => post.slug)
      .map(post => {
        return {
          params: {
            slug: post.slug,
          },
        };
      }),
    fallback: false,
  };
}
