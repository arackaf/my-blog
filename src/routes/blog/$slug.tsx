import { DateFormatter } from "@/components/date-formatter";
import PostBody from "@/components/post-body";
import { BackArrow } from "@/components/svg/backArrow";
import { getAllBlogPosts, getPostMetadataFromContents } from "@/util/blog-posts";
import markdownToHtml from "@/util/markdownToHtml";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

export const getPostContent = createServerFn()
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const postContentLookup = getAllBlogPosts();

    if (!postContentLookup[data.slug]) {
      throw new Error(`Post not found: ${data.slug}`);
    }

    const post = {
      ...getPostMetadataFromContents(data.slug, postContentLookup[data.slug]),
    };
    const content = await markdownToHtml(post.markdownContent);

    return { post: { ...post, markdownContent: "" }, content };
  });

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    return getPostContent({ data: { slug: params.slug } });
  },
  head: ({ params }) => {
    return {
      meta: [
        {
          title: `${params.slug} | Adam Rackis's blog`,
        },
      ],
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { post, content } = Route.useLoaderData();
  const { title, date } = post;

  return (
    <div className="post">
      <h4>
        <Link to="/" className="back-link">
          <BackArrow height="18" />
          <span>Adam's Blog</span>
        </Link>
      </h4>

      <h1>{title}</h1>
      <div className="post-date mb-4">
        <DateFormatter dateString={date} />
      </div>

      <PostBody content={content} />
    </div>
  );
}
