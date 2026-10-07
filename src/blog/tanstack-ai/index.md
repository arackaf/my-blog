---
title: Unlocking AI in your apps with TanStack AI
date: "2026-10-07T10:00:00.000Z"
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

Messages have a role, and we format user prompts on the right in a nice blue bubble, since I lack the creative originality to think of a better ui here than what ChatGPT does.

### Running it

And now we can send a basic prompt, and not only will we get a response, and that response will be streamed as it comes in, just from TanStack api's right out of the box.

![Streaming](/tanstack-ai/basic-streaming.gif)

And of course you can keep the conversation goind. Our backend from before already takes the existing messages from the thread, and passes them along.

```ts
const { messages } = await request.json();

const stream = chat({
  adapter: vercelGatewayText("anthropic/claude-opus-5"),
  messages,
});
```

And of course the `useChat` hook will do the work of forwarding those messages. We can test this very easily by giving a follow-up prompt that's all but meaningless without the prior messages.

![Streaming](/tanstack-ai/with-context.gif)

## Persistence (and Resumability!)

Obviously if we refresh the page our prompt, and responses vanish into the void; nothing is saving of that, anywhere.

Let's fix that and add persistence.

TanStack AI handles persistence a bit differently than you might be expecting. It gives you a contract to satisfy in any way you want, in whatever database you want. And of course you're not expected to manually cobble together the needed schema definitions via DDL. TanStack AI actually gives you an [AI Skill to install](https://tanstack.com/ai/latest/docs/persistence/build-your-own-adapter#let-your-agent-write-it), and use that to generate all of the needed code. In fact, it's even well aware of Drizzle, and will happily generate the needed drizzle schema objects, and allow you to simply `npx drizzle-kit push` to generate the tables in your actual database. Or it'll just generate the needed tools against a raw database.

Here's a sample of the Drizzle-based persistence module it generated for me. It essentially one-shotted it

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

If using an AI skill to generate standard code that lives on in your repo, free for you to tweak seems crazy, just realize that if you substitue "CLI" for "AI skill" above, that's essentially how ShadCN works.

That said, I don't think this current AI skill is the final form of persistence code generation for TanStack AI, and personally I'd love to see this get replaced with a proper CLI. But for a new project, this is an outstanding solution for the time being.

Let's put this persistence code to good use!

### Adding middleware

Step one is adding our new persistence store to some middleware on the server. I know I haven't covered middleware yet, and won't be for this post, but TanStack AI supports a full middleware chain for processing, modifying, or in this case, persisting AI threads. We'll add it in our server route.

```ts
import { chat, chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import { reconstructChat, withPersistence } from "@tanstack/ai-persistence";

    POST: async ({ request }) => {
      const params = await chatParamsFromRequest(request);

      const stream = chat({
        adapter: vercelGatewayText("anthropic/claude-opus-5"),
        messages: params.messages,
        threadId: params.threadId,
        middleware: [withPersistence(persistence)],
        stream: true,
      });

      return toServerSentEventsResponse(stream);
    },
```

### Frontend changes

And now, on the frontend we need to send over a threadId, and tell our hook that we're using persistence

```ts
const { messages, sendMessage, isLoading } = useChat({
  connection: fetchServerSentEvents("/api/ai/chat-with-persistence"),
  persistence: true,
  threadId: "123",
});
```

Obviously for a real app we'd generate a meaningful (and unique!) threadId, but for now, "123" will work just fine. And now, when we run another prompt, and get results.

![Streaming](/tanstack-ai/persisted-prompt.jpg)

If we check our database, we can see our threads being saved!

![Streaming](/tanstack-ai/persisting.jpg)

But when we refresh, our page is empty. Why is the saved thread not being loaded for us?

## Adding a GET endpoint

Whatever backend endpoint we set up for our prompts is a POST, which TanStack AI will post to when submitting a new prompt. To load a prompt, we need to set up a GET handler at the same place, and use TanStack's helpers to load the thread in question (as the frontend will include the threadId with the request).

```ts
import { reconstructChat, withPersistence } from "@tanstack/ai-persistence";

  GET: async ({ request }) => {
    return reconstructChat(persistence, request, {
      // WITHOUT this, anyone who guesses a thread id gets the whole transcript.
      authorize: async (threadId, req) => ownsThread(req, threadId),
    });
  },
```

And with that, reloading the page re-renders the same thread you just saw above.

## Wrapping up

Hopefully this post has shown you some useful tools you can use in your own projects, and at work to write meaningful tests for your data access code.

The `@testcontainers` package will get Docker running right inside your Vitest tests. Spin up an empty database, use your existing data access utilities to make sure things work exactly as expected. And remember, more tests is absolutely not always better. Test the meaningful parts of your application, with non-trivial logic. Tests which verify every single basic CRUD operation are unlikely to add much value, and are very likely to slow your test suite down to a crawl.

Happy coding!
