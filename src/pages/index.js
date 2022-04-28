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
    const posts = data.allMarkdownRemark.edges.filter(n => n.node.fields.slug !== "/typescript-rtti/");
    const posts = data.allMarkdownRemark.edges.filter(n => n.node.fields.slug !== "/suspense-data-fetching/");

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
                title: "Svelte for the Experienced React Dev",
                date: "May 21, 2021",
                description: "A high-level introduction to Svelte, from the perspective of an experienced React developer"
              },
              fields: {
                slug: "https://css-tricks.com/svelte-and-spring-animations/"
              }
            }
          },
          {
            node: {
              external: true,
              frontmatter: {
                title: "Coordinating Svelte Animations With XState",
                date: "April 7, 2021",
                description: "An introduction to XState, for simplifying Svelte animation code"
              },
              fields: {
                slug: "https://css-tricks.com/svelte-and-spring-animations/"
              }
            }
          },
          {
            node: {
              external: true,
              frontmatter: {
                title: "Svelte and Spring Animations",
                date: "Jan 8, 2021",
                description: "A deep dive into Svelte's spring animation features"
              },
              fields: {
                slug: "https://css-tricks.com/svelte-and-spring-animations/"
              }
            }
          },
          {
            node: {
              external: true,
              frontmatter: {
                title: "Integrating TypeScript with Svelte",
                date: "Dec 28, 2020",
                description: "Manually adding TypeScript to a non-greenfield Svelte project"
              },
              fields: {
                slug: "https://css-tricks.com/integrating-typescript-with-svelte/"
              }
            }
          },
          {
            node: {
              external: true,
              frontmatter: {
                title: "Pre-Caching Images with React Suspense",
                date: "Sept 21, 2020",
                description: "Using Suspense to block a component's rendering until its images have loaded"
              },
              fields: {
                slug: "https://css-tricks.com/pre-caching-image-with-react-suspense/"
              }
            }
          },
          {
            node: {
              external: true,
              frontmatter: {
                title: "How to Use CSS Grid for Sticky Headers and Footers",
                date: "Sept 14, 2020",
                description: "A beginner friendly introduction to CSS Grid, with examples implementing sticky headers and footers"
              },
              fields: {
                slug: "https://css-tricks.com/how-to-use-css-grid-for-sticky-headers-and-footers/"
              }
            }
          },
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

      if (!posts.find(p => p.node.fields && p.node.fields.slug == "https://css-tricks.com/react-suspense-lessons-learned-while-loading-data/")) {
        const index = posts.findIndex(p => p.node && p.node.fields && p.node.fields.slug == "/dynamo-introduction/");

        if (index >= 0) {
          posts.splice(
            index,
            0,
            {
              node: {
                external: true,
                frontmatter: {
                  title: "Demystifying TypeScript Discriminated Unions",
                  date: "Jan 17, 2022",
                  description: "Explaining TypeScript unions, and discriminated unions"
                },
                fields: {
                  slug: "https://css-tricks.com/typescript-discriminated-unions/"
                }
              }
            },
            {
              node: {
                external: true,
                frontmatter: {
                  title: "Making a Site Work Offline Using the VitePWA Plugin",
                  date: "Jan 18, 2022",
                  description: "Diving deeper into Vite, and using the VitePWA plugin to improve your site's performance"
                },
                fields: {
                  slug: "https://css-tricks.com/vitepwa-plugin-offline-service-worker/"
                }
              }
            },
            {
              node: {
                external: true,
                frontmatter: {
                  title: "Adding Vite to Your Existing Web App",
                  date: "Jan 11, 2022",
                  description: "A fun, painless introduction to Vite"
                },
                fields: {
                  slug: "https://css-tricks.com/adding-vite-to-your-existing-web-app/"
                }
              }
            },

            {
              node: {
                external: true,
                frontmatter: {
                  title: "React Suspense: Lessons Learned While Loading Data",
                  date: "Nov 9, 2021",
                  description: "A deeper dive into data loading with Suspense"
                },
                fields: {
                  slug: "https://css-tricks.com/react-suspense-lessons-learned-while-loading-data/"
                }
              }
            }
          );
        }
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
              <small>
                {node.frontmatter.date}
                {node.external ? <span> on css-tricks.com</span> : null}
              </small>
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
