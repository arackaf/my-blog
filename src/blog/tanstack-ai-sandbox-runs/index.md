---
title: TanStack AI's Sandbox API
date: "2026-11-03T10:00:00.000Z"
description: Exploring fun use cases with TanStack AI's Sandbox API
---

TanStack AI is a fantastic SDK for integrating AI features into software applications. I've written about it [here](https://blog.master.dev/unlocking-ai-in-your-apps-with-tanstack-ai/), and [here](https://blog.master.dev/structured-output-with-tanstack-ai/). Those posts covered basic prompt-based requests; in particular, we provided some context, and asked AI to generate some workouts for us. We covered streaming, persistence, structured output.

This post is about doing actual agentic work through TanStack AI, via their Sandbox API. Specifically, we'll see how we can use TanStack AI to drive Claude Code in a remote Sandbox to do work against a GitHub repo we specify, and then open a pull request. Why would you want to do this? Sometimes you're away from your computer with some downtime, and nothing better to do than get some tasks done.

I want to be clear: this is already possible with tools like T3, Codex, etc. You can pair your laptop and your phone, and drive the former from the latter. But your laptop needs to be up and running for that to work. Ideally you'd just have a PC set up and always on, with some simple Linux distro for this very purpose. But if you don't have that set up, and don't care to, what I'll show you in this post is a decent next-best alternative. It won't be nearly as fast, and you'll have to pay a small amount of money to providers like Vercel or Railway for use of the remote Sandboxes. But as an occasional fill-in, it's more than good enough in my opinion.

## Our use case

I have a dirt-simple web app [here](https://github.com/arackaf/tanstack-ai-sandboxes-blog-post). It has pages for different programming languages, with brief descriptions of each. And I have some admin pages that let me add features by prompting to a remote sandbox that's running Claude Code, with GitHub access enabled.

The app has admin pages for Vercel and Railway, and each has no problem cloning our repo, branching, adding the feature and opening a PR.

Let's take a look!

## Setup

There are a few tokens you need here. We'll be using Claude Code in our sandbox, and we'll be connecting it to GitHub so our repo can be cloned, and PRs can be created.

Let's get GitHub set up first. Go over to [https://github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens) and generate a new token. Make sure you either select "All Repositories" or "Only select repositories" (and select what you want to provide access to). Then, for permissions, choose "Contents" and "Pull requests" with read/write access, and Metadata should auto-populate.

![Alt text](/tanstack-ai-sandbox-runs/github-token.jpg)

Generate the token and copy it into this environment var

```
GH_TOKEN="github_pat_abc_xyz"
```

Next, head over to the [Anthropic console](https://platform.claude.com/settings/keys)

![Alt text](/tanstack-ai-sandbox-runs/anthropic-console.png)

and do similarly, then copy that key into a new env var

```
ANTHROPIC_API_KEY="sk-ant-xyz-abc"
```

## Setting up our sandboxes

We'll be running code in a cloud sandbox. TanStack AI supports [a lot of different options](https://tanstack.com/ai/latest/docs/sandbox/providers#set-up-a-provider). We'll cover Vercel and Railway here, but of course check the docs if you want to use something else.

### Vercel setup

If you want to use Vercel, we'll need three new env vars.

First, head over to your account settings page, which you can access from the bottom left.

![Vercel account](/tanstack-ai-sandbox-runs/vercel-account-settings.jpg)

Click that top section with your name and email, then click the tokens link in the left nav. Create your token, and add it into this env var.

```
VERCEL_TOKEN="vcp_abc_xyz"
```

Next, go to your Vercel team on the top left, then click on settings, and grab your team id

![Vercel team id](/tanstack-ai-sandbox-runs/vercel-team-id.jpg)

and copy it into a new env var

```
VERCEL_TEAM_ID="team_xyz"
```

Lastly, create whatever Vercel project you want to associate with this work, hit the settings link, and then copy the project id.

![Vercel project id](/tanstack-ai-sandbox-runs/vercel-project-id.jpg)

and add it

```
VERCEL_PROJECT_ID="prj_kBL24CmynuMNcclr4k5s55lqg2xf"
```

### Railway setup

For Railway, we need two values. First, for the environment ID, go to the project settings page, and click environments. It should look something like this

![Railway environment id](/tanstack-ai-sandbox-runs/railway-env.jpg)

It's a little wonky, but look at the URL, and you should see something like this

```
?environmentId=abcd-efgh-ijkl
```

Grab that environmentId and put it in a new env var

```
RAILWAY_ENVIRONMENT_ID="abcd-efgh-ijkl"
```

Then, hit the tokens link on the same page in the left navigation list, create yourself a token, and, as always, add it as a new env var

```
RAILWAY_TOKEN="c0903fad-4336-4f0f-a0bf-3edc7abcfc51"
```

## Creating our sandboxes

If you've read my prior posts on TanStack AI, almost everything is the same as before. Persistence, resumability with a memory stream, etc are all the same. The main difference is, rather than routing our request to, e.g., Vercel's AI Gateway, we'll be providing a sandbox to the `chat` function for our request to run in. That sandbox will have access to Claude Code and our GitHub (via the setup we did above). This allows it to clone our repo, do work, and open pull requests.

We'll take a look at Vercel and Railway sandboxes, and then put it to work.

### Vercel sandbox

Here's my code for creating a Vercel sandbox

```ts
import { createSecrets, defineSandbox, defineWorkspace, githubRepo } from "@tanstack/ai-sandbox";
import { vercelSandbox } from "@tanstack/ai-sandbox-vercel";

export const sandboxVercel = defineSandbox({
  id: "repo-agent",
  provider: vercelSandbox({}),
  workspace: defineWorkspace({
    source: githubRepo({ repo: "arackaf/tanstack-ai-sandboxes-blog-post" }),
    setup: [
      "sudo npm install -g @anthropic-ai/claude-code",

      "sudo dnf install -y 'dnf-command(config-manager)'",
      "sudo dnf config-manager --add-repo https://cli.github.com/packages/rpm/gh-cli.repo",
      "sudo dnf install -y gh",

      "npm install",
    ],
    secrets: createSecrets({
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      GH_TOKEN: process.env.GH_TOKEN ?? "",
    }),
    instructions:
      "Accomplish the user's request and create a pull request. To publish work: run `gh auth setup-git` once, then `git push -u origin <branch>` and `gh pr create`. GH_TOKEN is already in the environment.",
  }),
  lifecycle: { reuse: "thread" },
});
```

Our setup contains a few more steps than we'll see with Railway, since the default Vercel container does not come equipped with the GitHub CLI or Claude Code, so we have to load that ourselves.

```ts
lifecycle: { reuse: "thread" },
```

tells TanStack to reuse the same sandbox within the same threadId (on the same server instance), so follow-up prompts and clarifications should maintain context.

### Railway sandbox

Railway is pretty similar, but with less setup, since their sandbox image comes with more batteries included.

```ts
import { createSecrets, defineSandbox, defineWorkspace, githubRepo } from "@tanstack/ai-sandbox";
import { railwaySandbox } from "@tanstack/ai-sandbox-railway";

export const sandboxRailway = defineSandbox({
  id: "repo-agent",
  provider: railwaySandbox({}),
  workspace: defineWorkspace({
    source: githubRepo({
      repo: "arackaf/tanstack-ai-sandboxes-blog-post",
    }),
    setup: ["npm install"],
    secrets: createSecrets({
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
      GH_TOKEN: process.env.GH_TOKEN ?? "",
    }),
    instructions:
      "Accomplish the user's request and create a pull request. To publish work: run `gh auth setup-git` once, then `git push -u origin <branch>` and `gh pr create`. GH_TOKEN is already in the environment.",
  }),
  lifecycle: { reuse: "thread" },
});
```

## Making requests

With all that set up, everything else is the same. If you've read my prior posts on TanStack AI, you now have pretty much everything you need to run code inside of a sandbox, with access to your GitHub. Here's what my call to `chat` in my API endpoint looks like.

```ts
const stream = chat({
  adapter: claudeCodeText("claude-opus-4-8"),
  messages,
  threadId,
  runId,
  middleware: [withPersistence(chatPersistence), withSandbox(sandboxVercel)],
});
```

The sandbox is simply a new middleware entry.

If you want to see the full code, the repo [is here](https://github.com/arackaf/tanstack-ai-sandboxes-blog-post).

## Putting it to use

Let's make a feature request on the Vercel route.

![Vercel prompt](/tanstack-ai-sandbox-runs/vercel-prompt.jpg)

and we can see the actual sandbox if we go to our Vercel dashboard

![Vercel sandbox](/tanstack-ai-sandbox-runs/vercel-sandbox-running.jpg)

and eventually we can see the PR created

![Vercel sandbox](/tanstack-ai-sandbox-runs/vercel-pr.jpg)

## Cleaning up

You'll probably want to provide some way to clean up the resources that were created. That sandbox object we created has a destroy method. And you'll also want to remove the relevant rows from the persistence db. Here's what my Vercel cleanup looks like

```ts
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { db } from "../drizzle/db";
import { chatRuns, chatThreads } from "../drizzle/schema";
import { sandboxVercel } from "#/lib/vercel-sandbox";

export const deleteVercelSession = createServerFn({ method: "POST" })
  .validator((data: { threadId: string }) => data)
  .handler(async ({ data }) => {
    const { threadId } = data;
    const runs = await db.select({ runId: chatRuns.runId }).from(chatRuns).where(eq(chatRuns.threadId, threadId));

    try {
      console.log("Deleting threadId " + threadId + " ...");
      for (const run of runs) {
        await sandboxVercel.destroy({ runId: run.runId, threadId });
      }
      await db.delete(chatRuns).where(eq(chatRuns.threadId, threadId));
      await db.delete(chatThreads).where(eq(chatThreads.threadId, threadId));
      console.log("Deleted");
    } catch (error) {
      console.log("error deleting vercel sandbox\n\n", error);
    }
  });
```

Railway is identical except, of course, we call `destroy` on `sandboxRailway`.

**NOTE**

As of this writing, the Vercel cleanup provided by `@tanstack/ai-sandbox-vercel` isn't quite ... effective. The sandbox is only stopped, not deleted, and any disk snapshots are not deleted either. Hopefully this will be fixed soon, but whip up a cleanup script using the Vercel API if you plan to use it.

Railway does not have this problem. That said, disk checkpoints are not deleted in Railway, but you're not charged for these.

## Wrapping up

TanStack AI's Sandbox API is a joy to use. It makes remote AI request execution a breeze. The flow, performance, and overall UX doesn't compare to Claude Code or Codex, but when you're away from your laptop, it gets the job done well.

Happy coding!
