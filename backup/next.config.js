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
  async headers() {
    return [
      {
        source: "/(.*).(jpg|png|jpeg)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000",
          },
        ],
      },
    ];
  },
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
