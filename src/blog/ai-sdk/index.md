---
title: Intro to Vercel's AI SDK and AI Gateway
date: "2026-08-11T20:00:32.169Z"
description:
---

We've all used AI tooling like Claude Code and Cursor to help us write code for a job, side project, etc. This is a post about integrating AI directly into software using Vercel's AI SDK.  

Vercel's AI SDK is a TypeScript utility that makes it simple to run AI requests inside of a software application, so you can integrate the results. It's model agnostic, so you can run prettu much anything you like best, from Claude Sonnet to GPT 5.

Chat bots have been done too many times (arguably once is too many) so for this post we'll do something a little different: we'll use AI to help us create fitness workouts. We'll prompt it clearly, give it some reference material, and most importantly, constrain its resulting format and structure, so we can easily make use of the results, and save these workouts in our own database, for future use. 

## Installation

Installation is simple enough, and Vercel managed to do a genuinely impressive job at getting a good npm package name here.

```bash
npm i ai
```

Before we get into actually making our requests, you need to run them against someone actually hosting the model you want to use. To start, let's use the lowest friction option: Vercel's AI Gateway. So let's [head on over there](https://vercel.com/adam-rackis/~/ai-gateway).

Next, we'll need to generate an api access key

![api gateway](/ai-sdk/img-00-api-gateway-access.jpg)

Detailed info about your requests and spend by model

![api gateway](/ai-sdk/img-00-api-gateway.jpg)

As well as some breakdowns per api key you have configured.

![api gateway](/ai-sdk/img-00-api-gateway-2.jpg)


and once you have it, add it as an environment variable like so

```
AI_GATEWAY_API_KEY="vck_xyz"
```

## Using providers directly

The ai-sdk comes with instructions for setting up just about [any provider](https://ai-sdk.dev/providers/ai-sdk-providers) you can think of. For this post, let's look at [using Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic).

### Using Anthropic

```bash
npm i @ai-sdk/anthropic
```

Add your env variable

```
ANTHROPIC_API_KEY="sk-ant-xyz"
```

```ts
import { anthropic } from "@ai-sdk/anthropic";
```

Then pick the model you want to use. Take advantage of the nice auto-complete the api gives you.

![Pick your model](/ai-sdk/img-02-anthropic-models-auto-complete.jpg)

We'll use sonnet 4.5 again, as before.

```ts
const claudeSonnet45Model = anthropic("claude-sonnet-4-5");
```

Let's whip up a simple test for using Anthropic directly, now

```ts
export const runVercelAiSdkWithAnthropic = createServerFn({
  method: "GET",
}).handler(async ({ data }) => {
  try {
    const { text } = await generateText({
      model: claudeSonnet45Model,
      prompt: `Give me a basic chest workout`,
    });

    console.log("Anthropic result", { text });
  } catch (error) {
    console.error("Error using Vercel AI SDK", { error });
  }
});
```

And it works!

![Pick your model](/ai-sdk/img-03-anthropic-result.jpg)

And of course we're not using Vercel's AI Gateway, so if you want to track costs, head over to [https://platform.claude.com/settings/keys](Anthropic's console) and see what you're api key is getting billed against.

![Pick your model](/ai-sdk/img-04-anthropic-console.jpg)

## Parting thoughts

Vercel's AI SDK is an incredibly slick api for running requests against an AI model. The output validation is a wonderful feature for ensuring that you get the output you're expecting, and the whole thing integrates wonderfully with Cloudflare Workers and Durable Objects.

Happy Coding!
