import { DateFormatter } from "@/components/date-formatter";
import PostBody from "@/components/post-body";
import { BackArrow } from "@/components/svg/backArrow";
import { getPostBySlug } from "@/util/blog-posts";
import markdownToHtml from "@/util/markdownToHtml";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post: any = getPostBySlug(params.slug, ["title", "date", "slug", "author", "content", "ogImage", "coverImage"]);
    const content = await markdownToHtml(post.content || "");

    return {
      post: {
        ...post,
        content,
      },
    };
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
  const { post } = Route.useLoaderData();
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

      <PostBody content={post.content} />
    </div>
  );
}
