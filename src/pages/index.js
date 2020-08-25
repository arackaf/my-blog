import React from "react";
import { Link, graphql } from "gatsby";

import Bio from "../components/bio";
import Layout from "../components/layout";
import SEO from "../components/seo";
import { rhythm } from "../utils/typography";

class BlogIndex extends React.Component {
  render() {
    const { data } = this.props;
    const { title: siteTitle, subtitle } = data.site.siteMetadata;
    const posts = data.allMarkdownRemark.edges;

    if (!posts.find(p => p.node.fields && p.node.fields.slug == "https://css-tricks.com/making-your-web-app-work-offline-part-1/")) {
      posts.push({
        node: {
          external: true,
          frontmatter: {
            title: "Making your web app work offline",
            date: "December 7, 2017",
            description: "A gentle introduction to offline web development"
          },
          fields: {
            slug: "https://css-tricks.com/making-your-web-app-work-offline-part-1/"
          }
        }
      });
    }

    if (!posts.find(p => p.node.fields && p.node.fields.slug == "https://css-tricks.com/react-suspense-in-practice/")) {
      const index = posts.findIndex(p => p.node && p.node.fields && p.node.fields.slug == "/suspense-explained/");

      if (index >= 0) {
        posts.splice(
          index,
          0,
          {
            node: {
              external: true,
              frontmatter: {
                title: "Making Sense of react-spring",
                date: "Aug 20, 2020",
                description: "Understanding how react-spring works, and how to leverage it for common animation use cases"
              },
              fields: {
                slug: "https://css-tricks.com/making-sense-of-react-spring/"
              }
            }
          },
          {
            node: {
              external: true,
              frontmatter: {
                title: "Building Your First Serverless Service With AWS Lambda Functions",
                date: "May 29, 2020",
                description: "A beginners introduction to the Serverless framework"
              },
              fields: {
                slug: "https://css-tricks.com/building-your-first-serverless-service-with-aws-lambda-functions/"
              }
            }
          },
          {
            node: {
              external: true,
              frontmatter: {
                title: "React Suspense in Practice",
                date: "March 19, 2020",
                description: "A practical, hands-on tutorial to React Suspense"
              },
              fields: {
                slug: "https://css-tricks.com/react-suspense-in-practice/"
              }
            }
          }
        );
      }
    }

    return (
      <Layout location={this.props.location} title={siteTitle} subtitle={subtitle}>
        <SEO title="Adam Reacts" keywords={[`blog`, `javascript`, `react`, `graphql`]} />
        <Bio />
        {posts.map(({ node }) => {
          const title = node.frontmatter.title || node.fields.slug;
          return (
            <div key={node.fields.slug}>
              <h3
                style={{
                  marginBottom: rhythm(1 / 4)
                }}
              >
                {node.external ? (
                  <a href={node.fields.slug} style={{ boxShadow: `none`, textDecoration: "none" }}>
                    {title} <i class="fad fa-external-link"></i>
                  </a>
                ) : (
                  <Link
                    style={{
                      boxShadow: `none`,
                      textDecoration: "none"
                    }}
                    to={node.fields.slug}
                  >
                    {title}
                  </Link>
                )}
              </h3>
              <small>{node.frontmatter.date}</small>
              <p
                dangerouslySetInnerHTML={{
                  __html: node.frontmatter.description || node.excerpt
                }}
              />
            </div>
          );
        })}
      </Layout>
    );
  }
}

export default BlogIndex;

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
        subtitle
      }
    }
    allMarkdownRemark(sort: { fields: [frontmatter___date], order: DESC }) {
      edges {
        node {
          excerpt
          fields {
            slug
          }
          frontmatter {
            date(formatString: "MMMM DD, YYYY")
            title
            description
          }
        }
      }
    }
  }
`;
