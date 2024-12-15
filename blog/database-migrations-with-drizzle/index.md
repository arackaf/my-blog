---
title: Drizzle Database Migrations
date: "2024-11-28T10:00:00.000Z"
description: An introduction to building applications with Fly.io
---

Drizzle ORM is an incredibly impressive [object-relational mapper](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping) (ORM). Like traditional ORMs, it offers a querying DSL for grabbing entire object graphs (imagine grabbing some tasks, along with comments on those tasks) from your database. But unlike traditional ORMs, it also exposes SQL itself, via a thin, strongly typed api. This allows you to write complex queries using things like `MERGE`, `UNION`, CTEs, and so on, but in a strongly typed api that looks incredibly similar to the SQL you already know (and hopefully love).

I wrote about Drizzle [previously](https://frontendmasters.com/blog/introducing-drizzle/). That post focused exclusively on the typed SQL api. This post will look at another drizzle feature: database migrations. Not only will Drizzle allow you to query your database via a strongly typed api, but it will also keep your object model and database in sync. Let's get started!

## Our database

Drizzle supports Postgres, MySQL, and SQLite. For this post we'll be using Postgres, but the idea is the same. If you'd like to follow along at home, I urge you to use Docker to spin up a Postgres db (or MySQL, if that's your preference). If you're completely new to Docker, it's not terribly hard to get it installed. Once it is, something like this

```bash
docker container run -e POSTGRES_USER=docker -e POSTGRES_PASSWORD=docker -p 5432:5432 postgres:17.2-alpine3.20
```

should get a Postgres instance up and running, that you can connect to on localhost, with a username and password of docker / docker. When you stop that process, your database will vanish into the ether. Restarting that same process will create a brand new Postgres instance with a completely clean slate, making this especially convenient for testing ... database migrations.

Incidentally, if you'd like to run a database that actually persists its data on your machine, you can just mount a volume.

```bash
docker container run -e POSTGRES_USER=docker -e POSTGRES_PASSWORD=docker -p 5432:5432 -v /Users/arackis/Documents/pg-data:/var/lib/postgresql/data postgres:17.2-alpine3.20
```

That does the same thing, while telling Docker to alias the directory in its image of `/var/lib/postgresql/data` (where Postgres stores its data) onto the directory on your laptop at `/Users/arackis/Documents/pg-data`. Obviously adjust the latter as desired.

## Setting up

We'll get an empty app up (npm init is all we need), and then install a few things

```bash
npm i drizzle-orm drizzle-kit pg
```

`drizzle-orm` is exactly what it sounds like. `drizzle-kit` is the Drizzle package that handles database migrations, which will be particularly relevant for this post. Lastly, `pg` are the Node Postgres drivers.

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

We tell Drizzle what kind of database we're using (Postgres), where to put the generated schema code (the drizzle-schema folder), and then of course some database connection info.

## Database first

Let's get started. Let's say we already have a database, and want to generate a Drizzle schema from it (if you want to go in the opposite direction, stay tuned).

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
    epic_id INT,
    user_id INT
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
    FOREIGN KEY (user_id)
    REFERENCES users (id);

ALTER TABLE tasks
    ADD CONSTRAINT fk_task_epic
    FOREIGN KEY (epic_id)
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

### Files generated

First and foremost, inside of the `drizzle-schema` folder there's now a `schema.ts` file with our Drizzle schema; here's a small sample of it.

```ts
import { pgTable, serial, varchar, foreignKey, integer, text, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial().primaryKey().notNull(),
  username: varchar({ length: 50 }),
  name: varchar({ length: 250 }),
  avatar: varchar({ length: 500 }),
});

export const tasks = pgTable(
  "tasks",
  {
    id: serial().primaryKey().notNull(),
    name: varchar({ length: 250 }),
    epicId: integer("epic_id"),
    userId: integer("user_id"),
  },
  table => {
    return {
      fkTaskUser: foreignKey({
        columns: [table.userId],
        foreignColumns: [users.id],
        name: "fk_task_user",
      }),
      fkTaskEpic: foreignKey({
        columns: [table.epicId],
        foreignColumns: [epics.id],
        name: "fk_task_epic",
      }),
    };
  }
);
```

The `users` entity is simple enough: a table with some columns. The `tasks` entity is a bit more interesting. It's also a table with some fields, but we can also see some foreign keys being defined.

In Postgres, foreign keys merely create a constraint that's checked on inserts and updates, to verify that a valid value is set, corresponding to a row in the target table. But it has no effect on application code, so you might wonder why Drizzle saw fit to bother creating it. Essentially, Drizzle will allow us to subsequently modify our schema in code, and generate an SQL file that will make equivalent changes in the database. For this to work, Drizzle needs to be aware of things like foreign keys, indexes, etc, so the schema in code, and the database are always truly in sync, and Drizzle knows what's missing, and needs to be created.

#### Relations

The other file Drizzle created is `relations.ts` and looks like this, in part

```ts
import { relations } from "drizzle-orm/relations";

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  epic: one(epics, {
    fields: [tasks.epicId],
    references: [epics.id],
  }),
  tasksTags: many(tasksTags),
}));

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
}));
```

This defines the relationships between tables (and is closely related to foreign keys). If you choose to use the Drizzle query api (the one that's _not_ SQL with types), Drizzle is capable of understanding that some tables have foreign keys into other tables, and allows you to pull down objects, with related objects in one fell swoop. For example, the tasks table has a `user_id` column in it, representing the user it's assigned to. With the relationship set up, we can write queries like this

```ts
const tasks = await db.query.tasks.findMany({
  with: {
    user: true,
  },
});
```

which will pull down all tasks, along with the user each is assigned to.

## Making changes

With the code generation above, we'd now be capable of _using_ Drizzle. But that's not what this post is about. See my last post on Drizzle, or even just the Drizzle docs for guides on using it. This post is all about database migrations. So far, we took an existing database, and scaffolded a valid Drizzle schema. Now let's run a script to add some things to the database, and see about updating our Drizzle schema.

We'll add a new column to tasks called `importance`, and we'll also add an index on the tasks column, on the epic_id column. This is unrelated to the foreign key we already have on this column. This is a traditional database index that would assist us in querying the tasks table on the epic_id table.

Here's the SQL script we'll run

```sql
CREATE INDEX idx_tasks_epic ON tasks (epic_id);

ALTER TABLE tasks
    ADD COLUMN importance INT;
```

After running that script on our db, we'll now run

```bash
npx drizzle-kit pull
```

and now we should see some updates

![Drizzle pull again](/drizzle-migrations/drizzle-pull-2.png)

and can see our schema getting updated in our git diffs

![Drizzle pull changes](/drizzle-migrations/drizzle-pull-diffs.png)

Note the new columns being added, and the new index being created. Again, the index will not affect our application code; it will just make our Drizzle schema a faithful representation of our database, so we can make changes on either side, and generate updates to the other. To that end, let's see about updating our code, and generating SQL to match those changes.

## Code first

Let's go the other way. Let's start with a Drizzle schema, and generate an SQL script from it. In order to get a Drizzle schema, let's just cheat and grab the schema.ts and relations.ts files Drizzle created above. We'll paste them into the drizzle-schema folder, and remove anything else Drizzle created: any snapshots, and anything in the meta folder Drizzle uses to track our history.

Next, since we want Drizzle to _read_ our schema files, rather than just generate them, we need to tell Drizzle where they are. We'll go back into our drizzle.config.ts file, and add this line

```json
schema: ["./drizzle-schema/schema.ts", "./drizzle-schema/relations.ts"],
```

Now we'll run

```bash
npx drizzle-kit generate
```

and voila, we have database assets being created

![Drizzle pull changes](/drizzle-migrations/drizzle-generate.png)

The resulting sql file is huge. Mine is named `0000_quick_wild_pack.sql` (Drizzle will add these silly names to make the files stand out) and looks like this, in part.

```sql
CREATE TABLE IF NOT EXISTS "epics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(250),
	"description" text,
	"due" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(250)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(250),
	"epic_id" integer,
	"user_id" integer
);
```

### Making a schema change

Now let's make some changes to our schema. Let's add that same `importance` column to our tasks table, add that same index on epicId, and then, for fun, let's tell Drizzle that our foreign key on userId should have an `ON DELETE CASCADE` rule, meaning that if we delete a user, the database will automatically delete all tasks assigned to that user. This would probably be an awful rule to add to a real issue tracking software, but it'll help us see Drizzle in action.

Here are the changes

![Drizzle pull changes](/drizzle-migrations/drizzle-update-schema.png)

And now we'll run `npx drizzle-kit generate`

![Drizzle pull changes](/drizzle-migrations/drizzle-generate-2.png)

And as before, drizzle generated a new sql file, this time called `0001_curved_warhawk.sql` which looks like this

```sql
ALTER TABLE "tasks" DROP CONSTRAINT "fk_task_user";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "importance" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "fk_task_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_epicId" ON "tasks" USING btree ("epic_id");
```

It added a column, overwrote the foreign key constraint we already had to add our CASCADE rule, and created our index on epic_id.

## Mixing and matching approaches

Make no mistake, you do not have to go all in on code-first, or database-first. You can mix and match approaches. You can scaffold a Drizzle schema from a pre-existing database using `drizzle-kit pull`, and then make changes to the code, and generate sql files to patch your database with the changes using `drizzle-kit generate`. Try it and see!

## Going further

Believe it or not, we're only scratching the surface of what drizzle-kit can do. If you like what you've seen so far, be sure to check out [the docs](https://orm.drizzle.team/docs/kit-overview).

## Concluding thoughts

Drizzle is an incredibly exciting ORM. Not only does it manage to add an impressive layer of static typing on top of SQL, allowing you to enjoy the power and flexibility of SQL with the type safety you already expect from TypeScript. But it also provides an impressive suite of commands for syncing your changing database with your ORM schema.

Happy Coding!
