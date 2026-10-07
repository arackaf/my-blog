---
title: Unlocking AI in your apps with TanStack AI
date: "2026-10-05T10:00:00.000Z"
description: Introduction to TanStack AI
---

TanStack AI is the latest offering from the TanStack universe. It's an ecosystem of AI-libraries that together allow you to add virtually any AI features you can imagine into your apps. Like other TanStack libraries, it's fully features, and extremely strongly typed.

This will be a two-part post will introduce some of the more basic, common features you're more likely to reach for in every day applications. Future posts will push the limits and use TanStack AI to spin up agents.

Part 1 will cover basic setup and AI requests, streaming, persistence and resumability. I know that sounds like a lot, but honestly TanStack makes this stuff incredibly simple, and borderline turnkey, so we'll cover this ground fairly quickly.

Part 2 will get into structured output, also with streaming.

Let's get started!

## Setting up

Let's install some packages we'll be needing

```
npm i @tanstack/ai @tanstack/ai-react
```

and since I love putting my AI requests through _one_ gateway, no matter who owns the model in question, let's also install the helper for Vercel's AI Gateway

```
npm i @tanstack/ai-vercel-gateway
```

## Our first backend

You'll want a plain old API endpoint to send your AI prompts into. Even if you're using TanStack Start, which I am. We'll be using Server Routes, rather than Server Functions.

Here's the simplest possible endpoint for sending AI prompts up to the model of our choice.

```ts
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { vercelGatewayText } from "@tanstack/ai-vercel-gateway";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = await request.json();

        const stream = chat({
          adapter: vercelGatewayText("anthropic/claude-opus-5"),
          messages,
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});
```

Note the return value

```ts
return toServerSentEventsResponse(stream);
```

TanStack gives us all the tools we need to establish a nice SSE stream that pipes our prompt result to the frontend as it comes back from the model.

Let's see how to process that on the frontend.

## Our frontend

Unsurprisingly TanStack ships bindings for most UI frameworks. Since I'm using TanStack Start, I'll of course use the React bindings.

```ts
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
```

We get a hook, and then an adapter for that SSE event stream. Let's fire it up

```ts
const { messages, sendMessage, isLoading } = useChat({
  connection: fetchServerSentEvents("/api/ai/chat"),
});
```

It couldn't be simpler. We have an array of current messages, a function to send a new prompt, and an isLoading indicator. Let's wire up a basic UI (or have our agent do it).

```tsx
function BasicChat() {
  const [prompt, setPrompt] = useState("");

  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchServerSentEvents("/api/ai/chat"),
  });

  // ...

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Basic Chat</h1>

      <div className="flex flex-col gap-4">
        {messages.map(message =>
          message.role === "user" ? (
            <div key={message.id} className="w-1/2 self-end rounded-2xl bg-blue-100 px-4 py-2">
              {message.parts.map((part, index) => (part.type === "text" ? <p key={index}>{part.content}</p> : null))}
            </div>
          ) : (
            <div key={message.id} className="w-full">
              {message.parts.map((part, index) => (part.type === "text" ? <p key={index}>{part.content}</p> : null))}
            </div>
          ),
        )}
        {isLoading && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
      </div>
      {/* ... */}
    </div>
  );
}
```

## Wrapping up

Hopefully this post has shown you some useful tools you can use in your own projects, and at work to write meaningful tests for your data access code.

The `@testcontainers` package will get Docker running right inside your Vitest tests. Spin up an empty database, use your existing data access utilities to make sure things work exactly as expected. And remember, more tests is absolutely not always better. Test the meaningful parts of your application, with non-trivial logic. Tests which verify every single basic CRUD operation are unlikely to add much value, and are very likely to slow your test suite down to a crawl.

Happy coding!
