---
title: Introducing Fly.io
date: "2024-11-28T10:00:00.000Z"
description: An introduction to building applications with Fly.io
---

Drizzle ORM is an incredibly impressive [object-relational mapper](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping) (ORM). Like traditional ORMs, it offers a querying DSL for grabbing entire object graphs (imagine grabbing some tasks, along with comments on those tasks) from your database. But unlike traditional ORMs, it also exposes SQL itself, via a thin, strongly typed api. This allows you to write complex queries using things like `MERGE`, `UNION`, CTEs, and so on, but in a strongly typed api that looks incredibly similar to the SQL you already know.

I wrote about Drizzle [previously](https://frontendmasters.com/blog/introducing-drizzle/). That post focused exclusively on the typed SQL api, so if you're like to learn more, be sure to check that out. This post focuses on another drizzle feature: database migrations. Not only will Drizzle allow you to query your database via a strongly typed api, but it will also keep your object model and database in sync. Let's get started!

## Our database

Drizzle supports Postgres, MySQL, and SQLite. For this post we'll be using Postgres, but the idea is the same either way. If you'd like to follow along at home, I urge you to use Docker to spin up a Postgres (or MySQL, if that's your preference). If you're completely new to Docker, it's not terribly hard to get installed. Once it is, something like this

```bash
docker container run -e POSTGRES_USER=docker -e POSTGRES_PASSWORD=docker -p 5432:5432 postgres:17.2-alpine3.20
```

should get a Postgres instance up and running, that you can connect to on localhost, with a username and password of docker / docker. When you stop that process, your database will vanish into the ether. Restarting that same process will create a brand new Postgres instance with a completely clean slate, making this especially convenient for testing ... database migrations.

Incidentally, if you'd like to run a database that actually persists its data on your machine, you can just mount a volume.

```bash
docker container run -e POSTGRES_USER=docker -e POSTGRES_PASSWORD=docker -p 5432:5432 -v /Users/arackis/Documents/pg-data:/var/lib/postgresql/data postgres:17.2-alpine3.20
```

That does the same thing, while telling Docker to alias the directory in its image of `/var/lib/postgresql/data` (where Postgres stores its data) onto the directory on your laptop at `/Users/arackis/Documents/pg-data`. Obviously adjust the latter as desired.

## Configuring Drizzle

Let's start by adding a `drizzle.config.ts` to the root of our project

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle-schema",
  dbCredentials: {
    database: "jira",
    host: "localhost",
    port: 5432,
    user: "docker",
    password: "docker",
    ssl: false,
  },
});
```

We tell Drizzle what kind of database we're doing to be using (Postgres), tell it where to put the generated schema code (the drizzle-schema folder), and then of course some database connection info.

## Database first

Let's get started. Let's say you already have a database, and you want to generate a Drizzle schema from there (if you want to go in the opposite direction, stay tuned).

To create our initial database, I've put together a script, which I'll put here in its entirety.

```sql
CREATE DATABASE jira;

\c jira

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50),
    name VARCHAR(250),
    avatar VARCHAR(500)
);

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(250),
    epicId INT,
    userId INT
);

CREATE TABLE epics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(250),
    description TEXT,
    due DATE
);

CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(250)
);

CREATE TABLE tasks_tags (
    id SERIAL PRIMARY KEY,
    task INT,
    tag INT
);

ALTER TABLE tasks
    ADD CONSTRAINT fk_task_user
    FOREIGN KEY (userId)
    REFERENCES users (id);

ALTER TABLE tasks
    ADD CONSTRAINT fk_task_epic
    FOREIGN KEY (epicId)
    REFERENCES epics (id);

ALTER TABLE tasks_tags
    ADD CONSTRAINT fk_tasks_tags_tag
    FOREIGN KEY (tag)
    REFERENCES tags (id);

ALTER TABLE tasks_tags
    ADD CONSTRAINT fk_tasks_tags_task
    FOREIGN KEY (task)
    REFERENCES tasks (id);
```

We'll put together a basic database for an hypothetical Jira clone. We have tables for users, epics, tasks and tags, along with various foreign keys connecting them. Assuming you have `psql` installed (can be installed via libpq), you can execute that script from the command line

```bash
PGPASSWORD=docker psql -h localhost -p 5432 -U docker -f database-creation-script.sql
```

And now, with this command

```bash
npx drizzle-kit pull
```

we tell Drizzle to look at our database, and generate a schema from it.

![Drizzle pull](/drizzle-migrations/drizzle-pull.png)

## Concluding thoughts

Drizzle is an incredibly exciting ORM. Not only does it manage to add an impressive layer of static typing on top of SQL, allowing you to enjoy the power and flexibility of SQL with the type safety you already expect from TypeScript. But it also provides an impressive suite of commands for syncing your changing database with your ORM schema.

Happy Coding!
