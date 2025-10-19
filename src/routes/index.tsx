import { getAllPosts } from "@/util/blog-posts";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: async () => {
    const allPosts = getAllPosts(["title", "slug", "date", "description"]);
    return {
      posts: allPosts,
    };
  },
  component: App,
});

function App() {
  const { posts } = Route.useLoaderData();
  return (
    <div>
      <div className="flex flex-col gap-2">
        {posts.map((p) => (
          <span>{p.title}</span>
        ))}
      </div>
    </div>
  );
}
