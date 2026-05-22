import { DateFormatter } from "@/components/date-formatter";
import PostBody from "@/components/post-body";
import { BackArrow } from "@/components/svg/backArrow";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getPostContent = createServerFn().handler(async () => {
  return {
    post: {
      markdownContent: "",
      title: "Swift - Encoding and decoding `Any`",
      date: "2022-07-12T10:00:00.000Z",
      description: "How to encode and decode json with concrete types, which include dynamic pieces typed as `Any`",
      slug: "swift-codable-any",
    },
    content: "<p>Hello World</p>",
  };
});

export const Route = createFileRoute("/blog/$slug")({
  loader: async () => {
    const postContent = await getPostContent();
    return { postContent };
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { postContent } = Route.useLoaderData();
  const { post, content } = postContent;
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
