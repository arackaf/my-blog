---
title: Making the most of Vercel's AI SDK with Cloudflare Durable Objects
date: "2027-09-05T20:00:32.169Z"
description:
---

I previously wrote about Vercel's AI SDK and AI Gateway [here](https://blog.master.dev/having-fun-with-vercels-ai-sdk-and-ai-gateway/). That post covered the basics of setting up an account in Vercel's AI Gateway (or directly in a provider of your choice); making requests against an AI model, and constraining the resulting data it sent back, to ensure you could use it in your application (if your database is expecting a field called `weight`, things won't work well if the LLM sends back that data in a field called `bodyweight`).

That post used an existing fitness tracker app I've been toying with. It set up a rudimentary UI for the user to provide the LLM with some reference workouts, and a prompt to produce new workouts based on the prompt, and the reference workouts (and underneath the reference list of exercises was also sent over). To keep things simple I set up a basic modal that simply showed a spinner while the request was being processed (which usually takes about 30 seconds, or even more). When the request finished, the workouts displayed, along with a save button if the user wanted to save them into their account.

The limitations of this UX should be obvious. If the user refreshed the page while the request was in flight, everything would be lost. If the user even refreshed the page after those results were in the modal, they'd also be lost. Granted, the latter is easily fixed. We could save those results into our own database for later recall. But this post will wrap everything together into one cohesive UI with on of my favorite infrastructure primitives: Cloudflare Durable Objects.

## Why Durable Objects

I previously wrote about Durable Objects [here](https://blog.master.dev/durable-objects-on-cloudflare/). The elevator pitch for DOs is that they're like a regular Cloudflare Worker, except instead of being being ephemeral, and spun up quickly to serve a request before dying off, they come with persistent storage (SQLite), and even have built-in web socket support.

You define a DO with a class, and then instantiate it with whatever unique IDs you want (one per user, or whatever you can imagine). Each one you spin up has its own dedicated SQLite database and collection of web socket connections.

This provides us all the missing primitives we need. When the user hits the "Generate" button to run their prompt, we run it _on_ the durable object, and save it to SQLite. When the request is finished, we use a web socket to _push_ the result to the user's browser. And if the user refreshes the page, we can hit up that same DO and ask it to query its SQLite db for current prompts, past prompts, etc.

I obviously won't show every line of code, but the repo is [here](https://github.com/arackaf/fitness-tracker). This is currently a work in progress in the feature/ai-workout-template-generation branch, but of course by the time you read this it might be in Main.

Let's get started.

## Our Durable Object definition

Here's an initial, incomplete segment of our Durable Object; the whole thing is about 250 lines, so we'll just show the important concepts.

```ts
export class WorkoutTemplateAIGenerationDO extends DurableObject {
  db: DrizzleSqliteDODatabase;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(initialWorkoutTemplateDDL);
    });

    this.db = drizzle(ctx.storage);
  }
}
```

I like to use Drizzle for my data access. It's basically a TypeScript api that very closely mirrors actual SQL, but with auto-complete and static typings to help prevent invalid queries. That's what this declares `db: DrizzleSqliteDODatabase;`

In the constructor I use the `ctx.blockConcurrencyWhile` helper to essentially lock this DO until the code in the callback is finished. This ensures the current DO will run my SQL migration script, if needed, and prevent any other requests from running while the DB is in an inconsistent state. I run it on every invocation, so the DDL is structured with things like `CREATE TABLE IF NOT EXISTS` to only create schema objects if they're not there already.

Then I instantiate the drizzle object.

## Setting up our web socket

I covered this in detail in my prior [Durable Objects post](https://blog.master.dev/durable-objects-on-cloudflare/), but to accept and set up web socket connections you need a fetch method which takes the raw request, inside of which we call some built-in Cloudflare utilities to establish, and save the connection.

```ts
fetch(request: Request): Response {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", {
      status: 426,
    });
  }

  // ...

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  this.ctx.acceptWebSocket(server);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });

}
```

### Sending web socket messages

To get all open sockets for this durable object, we call `this.ctx.getWebSockets()` and use the `send` method accordingly

```ts
sendMessage(payload: Object) {
  for (const socket of this.ctx.getWebSockets()) {
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      // The socket may have disconnected before Cloudflare observed it.
      socket.close(1011, "Unable to send message");
    }
  }
}
```

simple and humble.

## Running prompts and saving data

When the user wants to run a prompt, we can save a new session into our SQLite database

```ts
createSession(promptInfo: PromptInput): { id: number } {
  const result = this.db
    .insert(sessionTable)
    .values({
      name: "",
      createdAt: new Date().toISOString(),
    })
    .returning({ id: sessionTable.id })
    .all();

  const sessionId = result[0].id;

  // ...

  this.prompt(promptInfo)
    .then(promptResult => {
      // ...
    })
    .catch(() => {
      // ...
    })
    .finally(() => {
      this.sendUpdateForPromptId(sessionId, sessionPromptId);
    });

  return result[0];
}
```

The `prompt` method being called here is what interacts directly with the Vercel AI SDK.

```ts
export class WorkoutTemplateAIGenerationDO extends DurableObject {
  // ...
  async prompt(input: PromptInput): Promise<PromptResult> {
    const { workoutTemplates, prompt, exercises, model = "anthropic/claude-sonnet-4.6" } = input;

    try {
      const { output, usage, finalStep } = await generateText({
        instructions: systemPrompt(workoutTemplates, exercises),
        model,
        prompt: userPrompt(prompt, workoutTemplates),
        // ...
      });

      // ....
    } catch (err) {}
  }
}
```

See my [prior post](https://blog.master.dev/having-fun-with-vercels-ai-sdk-and-ai-gateway/) on the SDK for more details.

I'm deliberately leaving out some details, and in fact I'm probably showing too much code. Really just understand how these pieces fit together, and build whatever workflow works best for you

## Reading data

The `getSessions` method is an example of fetching data from our SQLite instance, to return back to our UI. Here we can pull up all sessions the user has ever started (whether in progress or complete). Note the lack of async or await; the SQLite api is synchronous, which is especially nice. Note also the lack of filters based on the current user.

```ts
getSessions() {
  const rows = this.db.select().from(sessionTable).all();
  return rows;
}
```

Recall that we create instances of these durable objects _per user_, based on their userId from our Authentication layer. This means each user's DO has _its own SQLite database_, and we can simply dump the table to get all sessions, or delete sessions at will. The user has access to everything in the Durable Object's DB because of how we've chosen to instantiate them. To access someone else's data they'd have to gain access to someone else's Durable Object, which they could only do by breaking our own authentication mechanism, in which case we'd have bigger problems!

## Interacting with our Durable Object

We can only call methods on our Durable Object from the server, not the browser. So if you're using TanStack, like I am, we'll need some server functions. First a helper to get a connection to a given user's durable object

```ts
export const getWorkoutTemplateAIGenerationDurableObject = async (context: AuthContext) => {
  const userId = await requireUserId(context);
  const { WorkoutTemplateAIGenerationDO } = env;
  const doId = WorkoutTemplateAIGenerationDO.idFromName(userId);
  return WorkoutTemplateAIGenerationDO.get(doId);
};
```

and then a server function interacting with our durable object might look something like this

```ts
export const loadAiSessionServerFn = createServerFn({ method: "POST" })
  .validator((payload: { sessionId: number }) => payload)
  .handler(async ({ data, context }) => {
    const durableObject = await getWorkoutTemplateAIGenerationDurableObject(context);
    const resultRaw = await durableObject.loadSession(data.sessionId);
    return doStrip(resultRaw);
  });
```

## Putting it all together

Once you understand how these pieces fit together you can clearly instruct your preferred agent and harness of choice to build whatever UX and workflow you'd like.

Mine looks something like this

## Parting thoughts

Vercel's AI SDK is a great tool for making model-agnostic requests. I've found Cloudflare's Durable Objects to be a fantastic platform for making the most of it. From its dedicated storage, to its built-in web socket support, it has tons of features that make implementing real use cases as straightforward as possible.

Happy Coding!

```

```
