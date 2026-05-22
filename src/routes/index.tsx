import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getAllPosts = createServerFn().handler(async () => {
  return [
    {
      markdownContent: "",
      title: "Swift - Encoding and decoding `Any`",
      date: "2022-07-12T10:00:00.000Z",
      description: "How to encode and decode json with concrete types, which include dynamic pieces typed as `Any`",
      slug: "swift-codable-any",
    },
  ];
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const allPosts = await getAllPosts();
    console.log({ postsValid: Array.isArray(allPosts) });
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
      <div className="mb-8 flex flex-col gap-2">
        <p>Hi, I'm Adam 👋</p>
        <p>
          Welcome to my blog. I usually write about web development—the React or Svelte stacks in particular—or occasionally GraphQL, databases, or
          anything else I'm interested in.
        </p>
      </div>

      <div>
        {posts.map(post => (
          <div key={post.title} className="blog-list-item mb-8">
            <h1 className="leading-none text-2xl font-bold">
              <Link to="/blog/$slug" params={{ slug: post.slug }}>
                <span>{post.title}</span>
              </Link>
            </h1>
            <small className="text-sm italic">{post.date}</small>
            <p className="mt-1.5">{post.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
