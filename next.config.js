const slugs = [
  "css-modules",
  "dynamo-introduction",
  "graphql-caching-and-micro",
  "new-beginnings",
  "offline-web-development",
  "redux-in-hooks",
  "state-and-use-reducer",
  "suspense-explained",
];

module.exports = {
  redirects() {
    return slugs.flatMap(s => {
      return [
        {
          source: `/${s}`,
          destination: `/blog/${s}`,
          permanent: true,
        },
        {
          source: `/${s}/`,
          destination: `/blog/${s}`,
          permanent: true,
        },
      ];
    });
  },
};
