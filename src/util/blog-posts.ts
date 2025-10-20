import fs from "fs";
import { join } from "path";
import matter from "gray-matter";
import { ExternalPost, externalPosts } from "./outsidePosts";
import markdownToHtml from "./markdownToHtml";

const postsDirectory = join(import.meta.dirname, "../blog");

export function getPostSlugs() {
  return fs.readdirSync(postsDirectory);
}

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

export async function getPostBySlug(slug: string): Promise<Post> {
  const metadata = await getPostMetadataBySlug(slug);
  const content = await markdownToHtml(metadata.markdownContent || "");
  return {
    ...metadata,
    content,
  };
}
export async function getPostMetadataBySlug(slug: string): Promise<PostMetadata> {
  const realSlug = slug.replace(/\.md$/, "");
  const fullPath = join(postsDirectory, realSlug, `index.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content: markdownContent } = matter(fileContents);

  const items: Post = {
    markdownContent,
  } as Post;

  // Ensure only the minimal needed data is exposed
  fields.forEach((field) => {
    if (field === "slug") {
      items[field] = realSlug;
    }

    if (typeof data[field] !== "undefined") {
      items[field] = data[field];
    }
  });

  return items;
}

export async function getAllPosts() {
  const slugs = await getPostSlugs();
  const allPosts = await Promise.all(slugs.map((slug) => getPostMetadataBySlug(slug)));

  const posts: (PostMetadata | ExternalPost)[] = allPosts
    .concat(externalPosts as any)
    // sort posts by date in descending order
    .sort((post1, post2) => (post1.date > post2.date ? -1 : 1));
  return posts;
}
