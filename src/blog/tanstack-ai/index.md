---
title: Unlocking AI in your apps with TanStack AI
date: "2026-10-07T10:00:00.000Z"
description: Introduction to TanStack AI
---

TanStack AI is the latest offering from the TanStack universe. It's an ecosystem of AI libraries that together allow you to add virtually any AI features you can imagine into your apps. Like other TanStack libraries, it's fully featured, and _extremely_ strongly typed.

This will be a two-part post introducing some of the basic, common features you're most likely to reach for in everyday applications. Future posts will go further and use TanStack AI to do things like spin up agents.

Part 1 will cover basic setup and AI requests, streaming, persistence and resumability. I know that sounds like a lot, but honestly TanStack makes this stuff incredibly simple, and borderline turnkey, so we'll cover this ground fairly quickly.

Part 2 will get into structured output, also with streaming.

All code samples from both parts are in [this repo](https://github.com/arackaf/tanstack-ai-blog-post).

Let's get started!

## Setting up

Let's install some packages

```
npm i @tanstack/ai @tanstack/ai-react
```

and since I love routing all my AI requests through _one_ gateway, no matter who owns the model being used, let's also install the adapter for Vercel's AI Gateway

```
npm i @tanstack/ai-vercel-gateway
```

and then to make requests actually work, we'll need an entry in our .env file

```
AI_GATEWAY_API_KEY="xyz"
```

## Our first backend

You'll want a plain old API endpoint to send your AI prompts into, even if you're using TanStack Start, which I am; we'll be using Server Routes, rather than Server Functions.

Here's the simplest possible endpoint for sending AI prompts over to the model of our choice.

```ts
import { chat, toJsonResponse } from "@tanstack/ai";
import { vercelGatewayText } from "@tanstack/ai-vercel-gateway";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai/chat-no-streaming")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = await request.json();

        const stream = await chat({
          adapter: vercelGatewayText("anthropic/claude-opus-5"),
          messages,
          stream: false,
        });

        return toJsonResponse(stream);
      },
    },
  },
});
```

Let's see how to process that on the frontend.

## Our frontend

Unsurprisingly TanStack ships bindings for most UI frameworks. Since I'm using TanStack Start, I'll of course use the React bindings.

```ts
import { fetchJson, useChat } from "@tanstack/ai-react";
```

We get a hook, and then an adapter for responses. Let's fire it up

```ts
const { messages, sendMessage, isLoading } = useChat({
  connection: fetchJson("/api/ai/chat-no-streaming"),
});
```

It couldn't be simpler. We have an array of current messages, a function to send a new prompt, and an `isLoading` indicator. Let's wire up a basic UI (or have our agent do it).

```tsx
function BasicChat() {
  const [prompt, setPrompt] = useState("");

  const { messages, sendMessage, isLoading } = useChat({
    connection: fetchJson("/api/ai/chat-no-streaming"),
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

Messages have a role, and we format user prompts on the right in a nice blue bubble, since I lack the creative originality to think of a better UI than what ChatGPT does.

### Running it

And now we can send a basic prompt, and get a response.

![Chat](/tanstack-ai/basic-chat.jpg)

And of course you can keep the conversation going. Our backend from before already takes the existing messages from the thread, and passes them along.

```ts
const { messages } = await request.json();

const stream = chat({
  adapter: vercelGatewayText("anthropic/claude-opus-5"),
  messages,
});
```

The `useChat` hook will do the work of forwarding those messages. We can test this very easily by giving a follow-up prompt that's all but meaningless without the prior messages.

![Streaming](/tanstack-ai/chat-with-context.jpg)

## Adding streaming

It's not ideal having our UI wait until the entire message is back before showing anything. Anyone who's used ChatGPT has seen AI models _stream_ responses to you, so you can start reading immediately, while the model continues to stream the rest of the message in.

Let's add that here. The changes we have to make are surprisingly trivial.

Here's our new backend endpoint.

```ts
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { vercelGatewayText } from "@tanstack/ai-vercel-gateway";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai/chat-streaming")({
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

Note that we _removed_ `stream: false` and changed our return value to this

```ts
return toServerSentEventsResponse(stream);
```

TanStack gives us everything we need to establish an SSE\* stream that pipes our prompt results to the frontend as it's generated.

\*server-sent events - they're like WebSockets, but only one way, from the server to the client

On the frontend we'll grab a new import

```ts
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
```

and tweak our hook like so

```ts
const { messages, sendMessage, isLoading } = useChat({
  connection: fetchServerSentEvents("/api/ai/chat-streaming"),
});
```

It couldn't be simpler. And now our UI streams.

![Streaming](/tanstack-ai/chat-with-streaming.gif)

## Persistence (and Resumability!)

Obviously if we refresh the page our prompt, and responses vanish into the void; nothing is saving any of that, anywhere.

Let's fix that and add persistence.

First, a new package

```
npm i @tanstack/ai-persistence
```

TanStack AI handles persistence a bit differently than you might be expecting. It gives you a contract to satisfy however you'd like, in whatever database you want. And of course you're not expected to manually cobble together the needed schema definitions via DDL.

TanStack AI actually gives you an [AI Skill to install](https://tanstack.com/ai/latest/docs/persistence/build-your-own-adapter#let-your-agent-write-it), which should generate all of the needed code. In fact, it's even aware of Drizzle, and will happily generate the needed Drizzle schema objects, allowing you to just `npx drizzle-kit push` to generate the tables in your actual database. Or it can generate the needed stores against a raw database.

Here's a sample of the Drizzle-based persistence module it one-shotted for me.

```ts
import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";
import { defineAIPersistence } from "@tanstack/ai-persistence";
import type { SQL } from "drizzle-orm";
import type { ChatPersistence, InterruptRecord, InterruptStore, MessageStore, MetadataStore, RunRecord, RunStore } from "@tanstack/ai-persistence";

import { chatInterrupts, chatMetadata, chatRuns, chatThreads } from "#/drizzle/schema";
import { db, type DB } from "#/data/db";

// Records omit absent optionals so they compare cleanly against the reference
// in-memory backend.
function mapRun(row: typeof chatRuns.$inferSelect): RunRecord {
  return {
    runId: row.runId,
    threadId: row.threadId,
    status: row.status,
    startedAt: row.startedAt,
    ...(row.finishedAt != null ? { finishedAt: row.finishedAt } : {}),
    ...(row.error != null
      ? {
          error: {
            message: row.error,
            ...(row.errorCode != null ? { code: row.errorCode } : {}),
          },
        }
      : {}),
    ...(row.usageJson != null ? { usage: row.usageJson } : {}),
    ...(row.sandboxKey != null ? { sandboxKey: row.sandboxKey } : {}),
    ...(row.detachedSince != null ? { detachedSince: row.detachedSince } : {}),
    ...(row.cancelRequested != null ? { cancelRequested: row.cancelRequested } : {}),
    ...(row.driverEpoch != null ? { driverEpoch: row.driverEpoch } : {}),
    ...(row.parentRunId != null ? { parentRunId: row.parentRunId } : {}),
    ...(row.subagentRunId != null ? { subagentRunId: row.subagentRunId } : {}),
    ...(row.name != null ? { name: row.name } : {}),
  };
}

function mapInterrupt(row: typeof chatInterrupts.$inferSelect): InterruptRecord {
  return {
    interruptId: row.interruptId,
    runId: row.runId,
    threadId: row.threadId,
    status: row.status,
    requestedAt: row.requestedAt,
    payload: row.payloadJson,
    ...(row.resolvedAt != null ? { resolvedAt: row.resolvedAt } : {}),
    ...(row.responseJson != null ? { response: row.responseJson } : {}),
  };
}

function createMessageStore(db: DB): MessageStore {
  // ....
}

// ...

/** The four chat state stores backed by the app's Drizzle database. */
export const persistence: ChatPersistence = defineAIPersistence({
  stores: {
    messages: createMessageStore(db),
    runs: createRunStore(db),
    interrupts: createInterruptStore(db),
    metadata: createMetadataStore(db),
  },
});
```

If using an AI skill to generate code that lives in your repo for you to tweak seems crazy, just remember: substitute "CLI" for "AI skill" and you're basically left with ShadCN.

That said, I don't think this current AI skill is the final form of persistence code generation for TanStack AI, and personally I'd love to see this get replaced with a proper CLI. But for a new project, this is an outstanding solution for the time being.

Let's put this persistence code to good use!

### Adding middleware

Step one is adding our new persistence store as middleware on the server. I know I haven't covered middleware yet, and won't be for this post, but TanStack AI supports a full middleware chain for processing, modifying, or in this case, persisting AI threads. We'll add it in our server route.

We'll also forward along any threadId or runId passed from the frontend. This will allow the frontend to request a persisted thread, or even resume an interrupted thread—more on that soon.

```ts
import { chat, chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import { reconstructChat, withPersistence } from "@tanstack/ai-persistence";

    POST: async ({ request }) => {
      const params = await chatParamsFromRequest(request);

      const stream = chat({
        adapter: vercelGatewayText("anthropic/claude-opus-5"),
        messages: params.messages,
        threadId: params.threadId,
        runId: params.runId,
        middleware: [withPersistence(persistence)],
      });

      return toServerSentEventsResponse(stream);
    },
```

### Frontend changes

On the frontend we need to send over a threadId and tell our hook that we're using persistence

```ts
const { messages, sendMessage, isLoading } = useChat({
  connection: fetchServerSentEvents("/api/ai/chat-with-persistence"),
  persistence: true,
  threadId: "123",
});
```

Obviously for a real app we'd generate a meaningful (and unique!) threadId, but for now, "123" will work just fine. Now when we run a prompt and get results, we can check our database and see our threads being saved!

![Streaming](/tanstack-ai/persisting.jpg)

But when we refresh, our page is empty. Why is the saved thread not being loaded for us in the UI?

## Adding a GET endpoint

Whatever backend endpoint we set up for our prompts is a POST, which TanStack AI will post to when submitting a new prompt. To load a saved thread, we need to set up a GET handler at the same place, and use TanStack's helpers to load the thread in question (the frontend will include the threadId with the request).

```ts
import { reconstructChat, withPersistence } from "@tanstack/ai-persistence";

  GET: async ({ request }) => {
    return reconstructChat(persistence, request, {
      // WITHOUT this, anyone who guesses a thread id gets the whole transcript.
      authorize: async (threadId, req) => true,
    });
  },
```

Obviously fill in the authorize callback with actual verification logic, but otherwise, with that, reloading the page re-renders the same thread you just saw above.

If you'd like to render a loading indicator while the existing thread is being loaded from persistence, use the `isHydrating` boolean returned from the `useChat` hook.

## Resumability

What happens if we refresh the page _while_ the response is being generated? Right now that causes the SSE stream to disconnect, and our results are lost completely. To fix this, we need to make our response stream resumable by buffering the results into an in-memory stream, on the server, and check that in the GET endpoint, before just returning what's in our database.

Unsurprisingly, TanStack makes this easy.

First we'll modify our POST handler like this

```ts
import { chat, chatParamsFromRequest, toServerSentEventsResponse, memoryStream, resumeServerSentEventsResponse } from "@tanstack/ai";

  POST: async ({ request }) => {
    const params = await chatParamsFromRequest(request);

    const stream = chat({
      adapter: vercelGatewayText("anthropic/claude-opus-5"),
      messages: params.messages,
      threadId: params.threadId,
      runId: params.runId,
      middleware: [withPersistence(persistence)],
    });

    return toServerSentEventsResponse(stream, {
      durability: { adapter: memoryStream(request) },
    });
  },
```

That causes our output to be buffered into a memory stream. And now we can consult that memory stream when loading a thread in our GET handler

```ts
  GET: async ({ request }) => {
    const durability = memoryStream(request);
    if (durability.resumeFrom() !== null) {
      return resumeServerSentEventsResponse({ adapter: durability });
    }

    return reconstructChat(persistence, request, {
      // WITHOUT this, anyone who guesses a thread id gets the whole transcript.
      authorize: async (threadId, req) => true,
    });
  },
```

NOTE:

Be sure to repeat whatever security check you (hopefully) added in the authorize callback before resuming anything from that memory stream.

It's a surprisingly small amount of boilerplate, and of course it's incredibly flexible if you ever wanted to tweak anything.

And now, when we refresh the page mid-response, it resumes where it left off, and keeps going.

![Streaming](/tanstack-ai/with-interrupt.gif)

NOTE

For this demo we're using an in-memory stream, which works great locally (or if you're connecting to something like a CloudFlare DurableObject, with a consistent identity). In production you may want a durable stream backend so that resuming works across server instances and restarts.

## Wrapping up

TanStack AI is an incredibly exciting addition to the growing list of AI tools out there. We got basic prompting set up, with persistence, and resumability without much effort at all. And yet we've barely scratched the surface of what this library is capable of.

Stay tuned for part two where we'll dive into structured output, and future posts where we'll go even deeper.

Happy coding!
