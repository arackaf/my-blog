import React, { FunctionComponent } from "react";

import { useRouter } from "next/router";

export const Nav = () => {
  return (
    <header>
      <nav>
        <ul>
          <Link text="Home" uri="/" />
          <Link text="Blog" uri="/blog" />
          <Link text="Favorite books" uri="/favorite-books" />
        </ul>
      </nav>
    </header>
  );
};

interface LinkProps {
  text: string;
  uri: string;
}

const Link: FunctionComponent<LinkProps> = ({ text, uri }) => {
  const routeInfo = useRouter();
  return <li>{routeInfo.asPath === uri ? <span>{text}</span> : <a href={uri}>{text}</a>}</li>;
};
