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

Rename is to .env, and then let's get it filled out. It needs a Claude Code token, and a GitHub token; the latter is needed for things like creating GitHub issues, and pull requests.

The instructions for the Claude token are self explanatory, and listed right there: just run `claude setup-token` in a terminal (NOT a Claude session).

For the GitHub token, head on over to [https://github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).

![GitHub token](/sandcastle/img-01-gh-token.jpg)

Give your token a name, expiration, etc. And for permissions, make **sure** you select what's below, at a minimum

![GitHub token](/sandcastle/img-02-gh-token-permissions.jpg)

Make sure contents pull requests and issues all have read/write permissions.

## Hello World

## Grabbing our GitHub issues

```bash
gh issue list \
  --state open \
  --limit 100 \
  --json number,title,body,labels,blockedBy
```

which produces

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
