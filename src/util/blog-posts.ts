import fs from "fs";
import { join } from "path";
import matter from "gray-matter";
import { ExternalPost, externalPosts } from "./outsidePosts";
import markdownToHtml from "./markdownToHtml";

const postsDirectory = join(import.meta.dirname, "../blog");

export function getPostSlugs() {
  return fs.readdirSync(postsDirectory);
}

export type Post = {
  title: string;
  date: string;
  description: string;
  slug: string;
  author: string;
  content: string;
  ogImage: string;
  coverImage: string;
};

const fields: (keyof Post)[] = ["title", "date", "description", "slug", "author", "content", "ogImage", "coverImage"];

export async function getPostBySlug(slug: string) {
  const realSlug = slug.replace(/\.md$/, "");
  const fullPath = join(postsDirectory, realSlug, `index.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content: markdownContent } = matter(fileContents);

  const content = await markdownToHtml(markdownContent || "");
  const items: Post = {} as Post;

  // Ensure only the minimal needed data is exposed
  fields.forEach((field) => {
    if (field === "slug") {
      items[field] = realSlug;
    }
    if (field === "content") {
      items[field] = content;
    }

    if (typeof data[field] !== "undefined") {
      items[field] = data[field];
    }
  });

  return items;
}

export async function getAllPosts() {
  const start = +new Date();
  const slugs = await getPostSlugs();
  const allPosts = await Promise.all(slugs.map((slug) => getPostBySlug(slug)));
  const end = +new Date();

  console.log(`getAllPosts took ${end - start}ms`);

  const posts: (Post | ExternalPost)[] = allPosts
    .concat(externalPosts as any)
    // sort posts by date in descending order
    .sort((post1, post2) => (post1.date > post2.date ? -1 : 1));
  return posts;
}
