---
title: TanStack AI's Sandbox API
date: "2026-11-03T10:00:00.000Z"
description: Exploring fun use cases with TanStack AI's Sandbox API
---

TanStack AI is a fantastic SDK for integrating AI features into software applications. I've written about it [here](https://blog.master.dev/unlocking-ai-in-your-apps-with-tanstack-ai/), and [here](https://blog.master.dev/structured-output-with-tanstack-ai/). Those posts covered basic prompt-based requests; in particular, we provided some context, and asked AI to generate some workouts for us. We covered streaming, persistence, structured output.

This post is about doing actual agentic work through TanStack AI, via their Sandbox AI. Specifically, we'll see how we can use TanStack AI to drive Claude Code in a remote Sandbox to do work against a GitHub repo we specify, and then open a pull request. Why would you want to do this? Sometimes you're away from your computer, and might have some downtime with nothing better to do than get some tasks done.

I want to be clear: this is already possible with tools like T3, Codex, etc. You can pair your laptop and your phone, and drive the former from the latter. But your laptop needs to be up and running for that to work. Ideally you'd just have a PC set up and always on, with some simple Linux distro for this very purpose. But if you don't have that set up, and don't care to, what I'll show you in this post is a decent next-best alternative. It won't be nearly as fast, and you'll have to pay a small amount of money to providers like Vercel or Railway for use of the remote Sandboxes. But as an occasional fill-in, it's more than good enough in my opinion.

## Setup

There's a few sets of tokens you need here. We'll be using Claude Code in our sandbox, and we'll be connecting it to our GitHub so our repo's can be cloned, and PRs created.

Next let's get GitHub set up. Go over to https://github.com/settings/personal-access-tokens and generate a new token. Make sure you select "All Repositories" and then "Contents" and "Pull requests" with read/write access, and Metadata should auto-populate.

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

## Setting up for sandboxes

We'll be running code in a cloud sandbox. TanStack AI supports [a lot of different options](https://tanstack.com/ai/latest/docs/sandbox/providers#set-up-a-provider). We'll cover Vercel and Railway here, but of course check the docs if you want to use something else.

### Vercel setup

If you want to use Vercel, we'll need three new env vars.

First head over to your account settings page, which you can currently access from the bottom left

![Vercel account](/tanstack-ai-sandbox-runs/vercel-account-settings.jpg)

Click that top section with your name and email, then click the tokens link in the left nav. Create your token, and add it into this env var.

```
VERCEL_TOKEN="vcp_abc_xyz"
```

Next go to your Vercel team on the top left, then click on settings, and grab your team id

![Vercel team id](/tanstack-ai-sandbox-runs/vercel-team-id.jpg)

and copy it into a new env var

```
VERCEL_TEAM_ID="team_xyz"
```

Lastly, create whatever Vercel Project you want to associate with this work, hit the settings link, and then copy the project id.

![Vercel project id](/tanstack-ai-sandbox-runs/vercel-account-settings.jpg)

### Railway setup

For Railway, we need two values. First, for environment id, go to the project settings page, and click environments. It should look something like this

![Railway environment id](/tanstack-ai-sandbox-runs/railway-env.jpg)

It's a little wonky, but look at the url, and you should see something like this

```
?environmentId=abcd-efgh-ijkl
```

Grab that environmentId and put it in a new env var

```
RAILWAY_ENVIRONMENT_ID="abcd-efgh-ijkl"
```

Then, hit the tokens link on the same left navigation list, create yourself a token, and, as always, add it as a new env var

```
RAILWAY_TOKEN="c0903fad-4336-4f0f-a0bf-3edc7abcfc51"
```

## Wrapping up

TanStack AI's Sandbox api is a joy to use. It makes remote AI request execution a breeze. The flow, performance, and overal UX doesn't compare to Claude Code or Codex, but when you're away from your laptop, it gets the job done well.

Happy Coding!
