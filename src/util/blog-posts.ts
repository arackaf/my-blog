import matter from "gray-matter";

export const getAllBlogPosts = () => {
  const allPosts: Record<string, any> = import.meta.glob("../blog/**/*.md", { query: "?raw", eager: true });

  return Object.entries(allPosts).reduce(
    (result, [key, module]) => {
      const paths = key.split("/");
      const slug = paths.at(-2)!;

      result[slug] = module.default;
      return result;
    },
    {} as Record<string, string>,
  );
};

export type PostMetadata = {
  title: string;
  date: string;
  markdownContent: string;
  description: string;
  slug: string;
  author: string;
  ogImage: string;
  coverImage: string;
};

export type Post = PostMetadata & {
  content: string;
};

const fields: (keyof Post)[] = ["title", "date", "description", "slug", "author", "ogImage", "coverImage"];

export function getPostMetadataFromContents(slug: string, fileContents: string): PostMetadata {
  const { data, content: markdownContent } = matter(fileContents);

  const items: Post = {
    markdownContent,
  } as Post;

  // Ensure only the minimal needed data is exposed
  fields.forEach(field => {
    if (field === "slug") {
      items[field] = slug;
    }

    if (typeof data[field] !== "undefined") {
      items[field] = data[field];
    }
  });

  return items;
}
