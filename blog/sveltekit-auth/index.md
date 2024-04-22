---
title: Using NextAuth with SvelteKit
date: "2024-04-16T10:00:00.000Z"
description: An introduction to next-auth, with SvelteKit
---

SvelteKit is an exciting, somewhat recent application framework for shipping performant web applications with Svelte. I've previously written an introduction on it [here](https://css-tricks.com/getting-started-with-sveltekit/), as well as a deeper dive on data handling and caching [here](https://css-tricks.com/caching-data-in-sveltekit/).

For this post we'll see how to integrate next-auth into a SvelteKit app. It might seem surprising to hear that next-auth can work with SvelteKit, but next-auth has gotten popular enough that much of it has been split into a framework-agnostic package of [@auth/core](https://www.npmjs.com/package/@auth/core).

For this post we'll cover the basic config for `@auth/core`: we'll add a Google Provider, and configure our sessions to persist in DynamoDB.

The code for everything [is here](https://github.com/arackaf/sveltekit-next-auth-post), but you won't be able to run it without setting up your own Google Application credentials, as well as a Dynamo table (which we'll get into).

## The initial setup

We'll build the absolute minimum skeleton app needed to demonstrate authentication. We'll have our root layout read whether the user is logged in, and show a link to content that's limited to logged in users, and a logout button if so; or a login button if not. We'll also set up an auth check with redirect in the logged-in content in case the user browses to our root url when logged in (which they usually will).

Let's create a SvelteKit project if we don't have one already, using the insutructions [here](https://kit.svelte.dev/docs/creating-a-project). Chose "Skeleton Project" when prompted.

Now let's install some packages we'll be using

```
npm i @auth/core @auth/sveltekit
```

Let's create a top-level layout that will use our auth data. First, our server loader, in a file named `+layout.server.ts`. This will hold our logged-in state, which for now is always false.

```ts
export const load = async ({ locals }) => {
  return {
    loggedIn: false,
  };
};
```

Now let's make the actual layout, in `+layout.svelte` with some basic markup

```html
<script lang="ts">
	import type { PageData } from './$types';
	import { signIn, signOut } from '@auth/sveltekit/client';

	export let data: PageData;
	$: loggedIn = data.loggedIn;
</script>

<main>
	<h1>Hello there! This is the shared layout.</h1>

	{#if loggedIn}
		<div>Welcome!</div>
		<a href="/logged-in">Go to logged in area</a>
		<br />
    <br />
		<button on:click={() => signOut()}>Log Out</button>
	{:else}
		<button on:click={() => signIn('google')}>Log in</button>
	{/if}
	<section>
		<slot />
	</section>
</main>
```

There should be a root `+page.svelte` file that was generated when you scaffolded the project, with something like this in there

```html
<h1>This is the home page</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the SvelteKit docs</p>
```

Feel free to just leave it.

Next, we'll create a route called `logged-in`. Create a folder in `routes` called `logged-in` and create a `+page.server.ts` which for now will always just redirect you out.

```ts
import { redirect } from "@sveltejs/kit";

export const load = async ({}) => {
  redirect(302, "/");
};
```

Now let's create the page itself, in `+page.svelte` and add some markup

```html
<h3>This is the logged in page</h3>
```

And that's about it. I've omitted some styles for brevity. Check out the GitHub repo to see everything.

## Adding Auth

Let's get started with the actual authentication. We'll take things step by step.

First, create an environment variable in your .env file called `AUTH_SECRET` and set it to a random string that's at least 32 characters. If you're looking to deploy this to Vercel, be sure to add your environment variable in your project's settings.

Next, create a `hooks.server.ts` (or .js) file directly under `src`. The docs for this file [are here](https://kit.svelte.dev/docs/hooks#server-hooks), but it essentially allows you to add application-wide wide side effects. Authentication easily falls under this, which is why we configure it here.

Now let's start integrating next-auth. We'll start with a very basic config

```ts
import { SvelteKitAuth } from "@auth/sveltekit";
import { AUTH_SECRET } from "$env/static/private";

const auth = SvelteKitAuth({
  providers: [],
  session: {
    maxAge: 60 * 60 * 24 * 365,
    strategy: "jwt",
  },

  secret: AUTH_SECRET,
});

export const handle = auth.handle;
```

We tell next-auth to store our authentication info in a jwt token, and configure a max age for the session as 1 year. We provide our secret, and a (currently empty) array of providers.

## Adding our provider

Providers are what perform the actual authentication of a user. There's a very, very long list of options to choose from, which are [listed here](https://authjs.dev/reference/core/providers). For our purposes, we'll use Google. First, we'll need to create application credentials. So head on over to the [Google Developers console](https://console.cloud.google.com/apis/dashboard). Click on credentials, and then "Create Credentials"

![Create Credentials Button](/sveltekit-auth/img1-create-credentials.jpg)

Click it, then choose "OAuth Client ID." Choose web application, and give your app a name.

![Create Credentials](/sveltekit-auth/img2-create-credentials.jpg)

For now, leave the other options empty, and click Create.

![Create Credentials](/sveltekit-auth/img3-credentials.jpg)

Before closing that modal, grab the client id, and client secret values, and paste them into environment variables for your app

```
GOOGLE_AUTH_CLIENT_ID=....
GOOGLE_AUTH_SECRET=....
```

Now let's go back into our hooks.server.ts file, and import our new environment variables

```ts
import { AUTH_SECRET, GOOGLE_AUTH_CLIENT_ID, GOOGLE_AUTH_SECRET } from "$env/static/private";
```

and then add our provider

```ts
	providers: [
		GoogleProvider({
			clientId: GOOGLE_AUTH_CLIENT_ID,
			clientSecret: GOOGLE_AUTH_SECRET
		})
	],
```

and then export our auth handler as our hooks handler.

```ts
export const handle = auth.handle;
```

Note that if you had other handlers you wanted SvelteKit to run, you can use the sequence helper:

```ts
import { sequence } from "@sveltejs/kit/hooks";

export const handle = sequence(otherHandleFn, auth.handle);
```

Unfortunately if we try to login now, we're greeted by an error

![Login error](/sveltekit-auth/img4-bad-login.jpg)

Clicking error details provides some more info

![Invalid redirect](/sveltekit-auth/img5-redirect-url.jpg)

We need to tell Google that this redirect url is in fact valid. So we'll go back to our Google Developer Console, and open the credentials we just created, and add this url in the redirect urls section.

![Redirect url](/sveltekit-auth/img6-add-redirect-url.jpg)

And now, after saving (and possibly waiting a few seconds) we can click login, and see a list of our google accounts available, and pick the one we want to log in with

![Login working](/sveltekit-auth/img7-login.jpg)

Choosing one of the accounts should log you in, and bring you right back to the same page you were just looking at.

## So you've successfully logged in, now what?

Being logged in is by itself useless without some way to check logged in state, in order to change content and grant access accordingly. Let's go back to our layout's server loader

```ts
export const load = async ({ locals }) => {
  return {
    loggedIn: false,
  };
};
```

We previously pulled in that `locals` property. Next-auth adds a `getSession` method to this, which allows us to grab the current authentication, if any. We just logged in, so let's grab the session and see what's there

```ts
export const load = async ({ locals }) => {
  const session = await locals.getSession();
  console.log({ session });

  return {
    loggedIn: false,
  };
};
```

For me, this logs the following

![Login working](/sveltekit-auth/img8-session.jpg)

All we need right this second is a simple boolean indicating whether the user is logged in, so let's send down a boolean on whether the user object exists

```ts
export const load = async ({ locals }) => {
  const session = await locals.getSession();
  const loggedIn = !!session?.user;

  return {
    loggedIn,
  };
};
```

and just like that, our page updates

![Logged in ui](/sveltekit-auth/img9-logged-in.jpg)

The link to our logged-in page still doesn't work, since it's still always redirecting. We _could_ run the _same_ code we did before, and call `locals.getSession` to see if the user is logged in. But we already did that, and stored the `loggedIn` property in our layout's loader. This makes it available to any routes underneath. So let's grab it, and conditionally redirect based on its value.

```ts
import { redirect } from "@sveltejs/kit";

export const load = async ({ parent }) => {
  const parentData = await parent();

  if (!parentData.loggedIn) {
    redirect(302, "/");
  }
};
```

And now our logged-in page works

![Logged in ui](/sveltekit-auth/img10-logged-in-page.jpg)

## Persisting our authentication

We could end this post here. Our authentication works, and we integrated it into application state. Sure, there's a myriad of other auth providers (GitHub, Facebook, Twitter, etc), but those are just variations on the same theme (plus now might not be a good time to start depending on Twitter infrastructure ...).

But one topic we haven't discussed is authentication persistence. Right now our entire session is stored in a JWT, on our user's machine. This is convenient, but it does offer some downsides, namely that this data could be stolen. An alternative is to persist our users' sessions in an external database. [This post](https://www.openidentityplatform.org/blog/stateless-vs-stateful-authentication) discusses the various tradeoffs, but most of the downsides of stateful (ie, stored in a database) solutions are complexity, and the burden of having to reach out to an external storage to grab session info. Fortunately, next-auth removes the complexity burden for us. As far as perf concerns, we can choose a storage mechanism that's known for being fast and effective: in our case we'll look at DynamoDB.

### Adapters

The mechanism by which next-auth persists our authentication sessions is [database adapters](https://authjs.dev/getting-started/database). As before, there are many to choose from; we'll use [DynamoDB](https://authjs.dev/getting-started/adapters/dynamodb). Compared to providers, the setup for database adapters is a bit more involved, and a bit more tedious. In order to keep the focus of this post on next-auth, we won't walk through setting up each and every key field, ttl setting, and gsi—to say nothing of AWS credentials if you don't have them already. If you've never used Dynamo and are curious, I wrote an introduction [here](https://adamrackis.dev/blog/dynamo-introduction). If you're not really interested in Dynamo, this section will show you the basics of setting up database adapters, which you can apply to any of the (many) others you might prefer to use.

That said, if you're interested in implementing this yourself, the [adapter docs](https://authjs.dev/getting-started/adapters/dynamodb#advanced-usage) provide CDK and CloudFormation templates for the Dynamo table you need, or if you want a low-dev-ops solution, it even lists out the keys, ttl and gsi structure [here](https://authjs.dev/getting-started/adapters/dynamodb#default-schema), which is pretty painless to just set up.

We'll assume you've got your DynamoDB instance set up, and look at the code to connect it. First, we'll install some new libraries

```
npm i @auth/dynamodb-adapter @aws-sdk/lib-dynamodb @aws-sdk/client-dynamodb
```

First, make sure your dynamo table name, as well as your AWS credentials are in environment variables

Now we'll go back to our hooks.server.ts file, and whip up some boilerplate (which, to be honest, it mostly copied right from the docs).

```ts
import { GOOGLE_AUTH_CLIENT_ID, GOOGLE_AUTH_SECRET, AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, DYNAMO_AUTH_TABLE, AUTH_SECRET } from "$env/static/private";

import { DynamoDB, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDBAdapter } from "@next-auth/dynamodb-adapter";
import type { Adapter } from "@auth/core/adapters";

const dynamoConfig: DynamoDBClientConfig = {
  credentials: {
    accessKeyId: AMAZON_ACCESS_KEY,
    secretAccessKey: AMAZON_SECRET_KEY,
  },

  region: "us-east-1",
};

const client = DynamoDBDocument.from(new DynamoDB(dynamoConfig), {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});
```

and now we add our adapter to our auth config

```ts
  adapter: DynamoDBAdapter(client, { tableName: DYNAMO_AUTH_TABLE }) as Adapter,
```

and now, after logging out, and logging back in, we should see some entries in our DynamoDB instance

![Dynamo working](/sveltekit-auth/img11-saving-in-dynamo.jpg)

## Authentication hooks

auth-core provides a number of callbacks you can hook into, if you want to do some custom processing.

The `signIn` callback is invoked, predictably, after a successful login. It's passed an account object from whatever provider was used, Google in our case. One use case with this callback could be to optionally look up, and sync legacy user metadata you might have stored for your users before switching over to OUath authentication with established providers.

```ts
async signIn({ account }) {
  const userSync = await getLegacyUserInfo(account.providerAccountId);
  if (userSync) {
    account.syncdId = userSync.sk;
  }

  return true;
},
```

The `jwt` callback gives you the ability to store additional info in the authentication token (you can use this regardless of whether you're using a database adapter). It's passed the (possibly mutated) account object from the `signIn` callback.

```ts
async jwt({ token, account }) {
  token.userId ??= account?.syncdId || account?.providerAccountId;
  if (account?.syncdId) {
    token.legacySync = true;
  }
  return token;
}
```

We're setting a single `userId` onto our token that's either the syndId we just looked up, or the `providerAccountId` already attached to the provider account. If you're curious about the `??=` operator, that's the [nullish coalescing assignment operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_assignment).

Lastly, the `session` callback gives you an opportunity to shape the session object that's returned when your application code calls `locals.getSession()`

```ts
async session({ session, user, token }: any) {
  session.userId = token.userId;
  if (token.legacySync) {
    session.legacySync = true;
  }
  return session;
}
```

now our code could look for the `legacySync` property, to discern that a given login has already sync'd with a legacy account, and therefore know not to ever prompt the user about this.

## Extending the types

Let's say we do extand the default session type, like we did above. Let's see how we can tell TypeScript about the things we're adding. Basically, we need to use a TypeScript feature called interface merging. We essentially re-declare an interface that already exists, add stuff, and then TypeScript does the grunt work of merging (hence the name) the _original type_ along with the changes we've made.

Let's see it in action. Go to the `app.d.ts` file SvelteKit adds to the root src folder, and add this

```ts
import { DefaultSession } from "@auth/core/types";

declare module "@auth/core/types" {
  interface Session {
    userId: string;
    legacySync: boolean;
    user: DefaultSession["user"];
  }
}
```

We have to put the interface in the right module, and then we add what we need to add.

The astute among you might wonder why we have to re-add the user object. It's already defined in the original type, so we shouldn't have to add it again. At time of writing I'm seeing odd behavior, where svelte-check reports an error if I don't add it, here. Oddly enough, just _importing_ `DefaultSession` is enough to make the error go away, like this

```ts
import { DefaultSession } from "@auth/core/types";

declare module "@auth/core/types" {
  interface Session {
    userId: string;
    legacySync: boolean;
  }
}
```

which is incredibly weird. So I just opted to be explicit, and re-add a property I shouldn't have to add.

## Wrapping up

We've covered a broad range of topics in this post. We've seen how to set up Next auth in a SvelteKit project using the new `@auth/core` library. We saw how to set up providers, adapters, and then took a look at various callbacks that allow us to customize our authentication flows.

Best of all, the tools we saw will work with SvelteKit, or Next, so if you're already an experienced Next user, a lot of this was probably familiar. If not, much of what you saw will be portable to Next if you ever find yourself using that.
