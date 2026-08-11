---
title: Vercel's AI SDK with Cloudflare Workers and Durable Objects
date: "2026-08-11T20:00:32.169Z"
description:
---

TODO

## Installation

```bash
npm i ai
```

Detailed info about your requests and spend by model

![api gateway](/ai-sdk/img-00-api-gateway.jpg)

As well as some breakdowns per api key you have configured.

![api gateway](/ai-sdk/img-00-api-gateway-2.jpg)

Generate an access key

![api gateway](/ai-sdk/img-00-api-gateway-access.jpg)

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
