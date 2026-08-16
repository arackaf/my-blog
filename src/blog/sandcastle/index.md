---
title: Introducing Sandcastle
date: "2026-08-10T20:00:32.169Z"
description:
---

## Introduction

This is a post about an AI Agent Orchestration tool called Sandcastle. What is AI orchestration? The short answer is that it's the process of getting multiple agents to work on things at the same time. If you're wondering why you need a tool for that, well, read on.

## Why do I need a tool to run multiple agents

Let's say you have 4 issues that can be implemented simultaneously. You might wonder why you can just spin up 4 different terminals, start Claude in each, write your prompts and hit enter. That would work, sort of. But think about your version control system. At the end of the day, git is working off of your file system. Any changes you make to any files are reflected immediately as unstaged. Yes any, or all of those agents can create branches, but you can only have one branch checked out at any given time. Basically, those agents will all be stepping on each other.

That said, there's a git feature that predates ai by a generation, and is designed to solve this very problem: workstrees. Workstrees have existed in git for over 10 years, but I'll be honest, I'd never even heard of them before AI. Back when we were writing our code manually life was simple: check out a branch, do work, commit and push. Then potentially switch to a different branch. Rinse, and repeat. You have one working directory which has one branch open at any given time.

### What are git worktrees

Worktrees allow you to have multiple working directories of your repo checked out on disc at any given time. These separate working directories can each have their own branch checked out therein.

This is obviously a fantastic solution for orchestrating AI agents to work on things in parallel.

But if you think this is the part of the post where I get into the git commands necessary to use Workstrees, things have already evolved past that. There are tools that happily and elegantly manages these things for you, and this is a post about one of them: [Sandcastle](https://github.com/mattpocock/sandcastle).

## Setting expectations

If you're imagining a high-level tool that will magically do amazing things for you out of the box, please understand that this is a low-level primitive. It performs some low-level tasks extremely well, allowing you to put together your own workflow, for your own project, as needed.

And with that, let's get started.

## Installation

Here's [the docs](https://github.com/mattpocock/sandcastle).

Install it into your project via

```
npm install --save-dev @ai-hero/sandcastle
```

Then run

```
npx @ai-hero/sandcastle init
```

to kick off the setup.

![sandcastle setup](/sandcastle/img-00-sandcastle-setup.jpg)

and if you let it, it'll set up the default Docker image. This is the image Sandcastle will use to run your agents (if you select the Docker sandbox) to ensure isolation between each other.

![sandcastle setup done](/sandcastle/img-00-sandcastle-setup-done.jpg)

## Looking around

Let's see what was created for us. You should see a .sandcastle folder, inside of which there should be a .env.example file. Mine looks like this

```
# Claude Code OAuth token — get one by running `claude setup-token` on your host.
# Lets the agent use your Claude subscription instead of an API key.
CLAUDE_CODE_OAUTH_TOKEN=
# Or use an Anthropic API key instead — uncomment and fill in:
# ANTHROPIC_API_KEY=
# GitHub personal access token — the agent uses it to read and manage GitHub Issues
# Create a fine-grained token: https://github.com/settings/personal-access-tokens/new
# Required repository permissions: Issues (Read and write) and Metadata (Read)
GH_TOKEN=
```

Rename it to .env, and then let's get it filled out. It needs a Claude Code token, and a GitHub token; the latter is needed for things like creating GitHub issues, and pull requests.

The instructions for the Claude token are self explanatory, and listed right there: just run `claude setup-token` in a terminal (NOT a Claude session).

For the GitHub token, head on over to [https://github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).

![GitHub token](/sandcastle/img-01-gh-token.jpg)

Give your token a name, expiration, etc. And for permissions, make **sure** you select what's below, at a minimum

![GitHub token](/sandcastle/img-02-gh-token-permissions.jpg)

Make sure contents pull requests and issues all have read/write permissions.

## Hello World

The simplest possible way to run Sandcastle is via the sample `main.ts` file that was scaffolded. It looks like this by default.

```ts
import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// Blank template: customize this to build your own orchestration.
// Run this with: npx tsx .sandcastle/main.ts
// Or add to package.json scripts: "sandcastle": "npx tsx .sandcastle/main.ts"

await run({
  agent: claudeCode("claude-opus-4-6"),
  sandbox: docker(),
  promptFile: "./.sandcastle/prompt.md",
});
```

Here's the prompt.md file that was generated

```
# Context

<!-- Use !`command` to pull in dynamic context. Commands run inside the sandbox. -->
<!-- Example: !`git log --oneline -10` or !`gh issue list --state open --label Sandcastle --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` -->

# Task

<!-- Describe what the agent should do. -->

# Done

<!-- When the task is complete, output <promise>COMPLETE</promise> to signal early termination. -->

```

To get things working, I'll put this into the `Task` section

```
Add a new `add.ts` file that exports a single function called `add` that takes two numbers, and returns their sum.
```

And now I can run

```
npx tsx .sandcastle/main
```

which will hopefully look something like this

```
  ---->npx tsx .sandcastle/main
[Agent] Started on branch temp
  tail -f .sandcastle/logs/temp.log
```

and hopefully there will be a new `add.ts` file with something like this inside of it

```ts
export function add(a: number, b: number): number {
  return a + b;
}
```

## Building something useful

Obviously being able to type a prompt into a markdown file and run it with a tsx command is useless on its own; you can just type the prompt directly into Claude Code (or whatever harness you like).

But being able to run a prompt with a single line of TypeScript is an incredibly valuable primitive on which we can build some cool workflows. If we can run a single prompt with a single function call, then we can easily run multiple prompts in parallel, and with Sandcastle handling worktree creation we won't have to worry about file conflicts. In fact, using the Docker Sandbox option will provide even further isolation, beyond just git working directories.

Let's build a script that sniffs out all open github issues, allows the user to choose which ones to execute, and for those chosen, spin off parallel agents.

## Grabbing our GitHub issues

Getting the github issues is easy; there's a cli for that. This command

```bash
gh issue list \
  --state open \
  --limit 100 \
  --json number,title,body,labels,blockedBy
```

will produce something like this.

```json
[
  {
    "blockedBy": {
      "nodes": [
        {
          "id": "I_kwDOTwhgQM8AAAABL7tDgA",
          "number": 7,
          "state": "OPEN",
          "title": "Two-column board UI for tickets",
          "url": "https://github.com/arackaf/render-atl-ai-sandbox/issues/7"
        }
      ],
      "totalCount": 1
    },
    "body": "## What to build\n\nWire up drag-and-drop on the ticket board so users can move cards between the \"To Do\" and \"Done\" columns to update a ticket's status.\n\n- Install `@dnd-kit/core` (no `@dnd-kit/sortable` — no within-column reordering)\n- Cards are draggable between columns\n- Dropping a card in a new column calls a new `updateTicketStatus` server function that accepts `{ id, status }` (narrow contract)\n- Optimistic update via TanStack Query mutation — card moves immediately on drop\n- On success: invalidate the tickets query (background refetch)\n- On failure: silent revert (no error UI for now)\n\n## Acceptance criteria\n\n- [ ] `@dnd-kit/core` is installed\n- [ ] Cards can be dragged between \"To Do\" and \"Done\" columns\n- [ ] Drop triggers `updateTicketStatus` server function with `{ id, status }`\n- [ ] `updateTicketStatus` updates the issue's status in the database\n- [ ] UI updates optimistically on drop\n- [ ] Tickets query is invalidated on successful mutation\n- [ ] Failed mutations silently revert the card to its original column\n\n## Blocked by\n\n- #7 — Two-column board UI for tickets",
    "labels": [
      {
        "id": "LA_kwDOTwhgQM8AAAACvX0ewQ",
        "name": "ready-for-agent",
        "description": "Fully specified, ready for an AFK agent",
        "color": "0E8A16"
      }
    ],
    "number": 8,
    "title": "Drag-and-drop status updates"
  },
  {
    "blockedBy": {
      "nodes": [
        {
          "id": "I_kwDOTwhgQM8AAAABL7tBhg",
          "number": 6,
          "state": "OPEN",
          "title": "Server functions and loader for tickets and epics",
          "url": "https://github.com/arackaf/render-atl-ai-sandbox/issues/6"
        }
      ],
      "totalCount": 1
    },
    "body": "## What to build\n\nThe index page renders a two-column Kanban-style board with columns for \"To Do\" and \"Done\". Ticket data comes from the route loader.\n\n- Two side-by-side columns, each with a header (\"To Do\" / \"Done\")\n- Tickets are split by their `status` field\n- Each card shows only the ticket title\n- No epic badges, no grouping, no special mobile layout\n- Styled with Tailwind CSS\n\n## Acceptance criteria\n\n- [ ] Index page displays two side-by-side columns labelled \"To Do\" and \"Done\"\n- [ ] Tickets are split into the correct column based on `status`\n- [ ] Each card displays only the ticket title\n- [ ] Styled with Tailwind utility classes\n\n## Blocked by\n\n- #6 — Server functions and loader for tickets and epics",
    "labels": [
      {
        "id": "LA_kwDOTwhgQM8AAAACvX0ewQ",
        "name": "ready-for-agent",
        "description": "Fully specified, ready for an AFK agent",
        "color": "0E8A16"
      }
    ],
    "number": 7,
    "title": "Two-column board UI for tickets"
  }
  // and so on
]
```

## Writing our script

AI wrote this script for me, but I'll show you the high points, and then show the entirety at the end. This is just what I thought would be useful; obviously you can put these primitives together however you'd like.

We can write that github cli command from Node

```ts
const output = execFileSync("gh", ["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title,body,blockedBy"], {
  encoding: "utf8",
});
```

And we probably want to filter to issues that are _not_ blocked by other, open issues

```ts
const availableIssues = issues.filter(issue => !issue.blockedBy?.nodes?.some(blocker => blocker.state === "OPEN"));
```

This library

```ts
import { checkbox } from "@inquirer/prompts";
```

has a nice CLI prompt UI, so we can write something like this

```ts
const selectedIssueIds = await checkbox({
  message: "Select issues to implement:",
  choices: availableIssues.map(issue => ({
    name: issue.title,
    value: issue.number,
  })),
});
```

And then we can fire off our agents using the same `run` method we saw before

```ts
Promise.all(
  selectedIssueIds.map(async issueId => {
    run({
      agent: claudeCode("claude-opus-4-6"),
      sandbox: docker(),
      prompt: `Implement gh issue ${issueId}. Commit your changes and push to origin. Open a PR.`,
      branchStrategy: {
        type: "branch",
        branch: `agent/gh-issue-${issueId}`,
        baseBranch: "main",
      },
      logging: {
        type: "stdout",
        verbose: false,
      },
    })
      .then(resp => `${sep}\n\nIssue ${issueId} completed:\n\n${resp}\n\n${sep}\n\n`)
      .catch(error => `${sep}\n\nIssue ${issueId} failed: ${error}\n\n${sep}\n\n`);
  }),
).then(() => {
  console.log("All issues completed");
});
```

But with some added instructions on branching, and creation of pull requests.

When we run this script it looks like this

![sandcastle setup](/sandcastle/img-03-ticket-select.jpg)

and we can of course select tickets

![sandcastle setup](/sandcastle/img-03-ticket-select-2.jpg)

and then fire it off

![sandcastle setup](/sandcastle/img-04-running.jpg)

And when it's done we should see pull requests created

![sandcastle setup](/sandcastle/img-06-prs.jpg)

## The whole script

Here's the entire script. Remember, this should be (at most) your starting point, for crafting a workflow tailored to your own needs.

```ts
import { run, claudeCode } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

import { execFileSync } from "node:child_process";
import { checkbox } from "@inquirer/prompts";

type Issue = {
  number: number;
  title: string;
  body: string;
  blockedBy: {
    nodes: {
      number: number;
      title: string;
      state: string;
    }[];
  };
};

const output = execFileSync("gh", ["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title,body,blockedBy"], {
  encoding: "utf8",
});

const issues: Issue[] = JSON.parse(output);

const availableIssues = issues.filter(issue => !issue.blockedBy?.nodes?.some(blocker => blocker.state === "OPEN"));

const selectedIssueIds = await checkbox({
  message: "Select issues to implement:",
  choices: availableIssues.map(issue => ({
    name: issue.title,
    value: issue.number,
  })),
});

const sep = "------------------------------------";

Promise.all(
  selectedIssueIds.map(async issueId => {
    run({
      agent: claudeCode("claude-opus-4-6"),
      sandbox: docker(),
      prompt: `Implement gh issue ${issueId}. Commit your changes and push to origin. Open a PR.`,
      branchStrategy: {
        type: "branch",
        branch: `agent/gh-issue-${issueId}`,
        baseBranch: "main",
      },
      logging: {
        type: "stdout",
        verbose: false,
      },
    })
      .then(resp => `${sep}\n\nIssue ${issueId} completed:\n\n${resp}\n\n${sep}\n\n`)
      .catch(error => `${sep}\n\nIssue ${issueId} failed: ${error}\n\n${sep}\n\n`);
  }),
).then(() => {
  console.log("All issues completed");
});
```

## Wrapping up

Sandcastle is a wonderful library for crafting agentic workflows. It provides you incredibly useful promotives you can compose together however you need, based on your own workflow.
