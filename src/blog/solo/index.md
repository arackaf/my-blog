---
title: Introducing Solo
date: "2026-09-11T20:00:32.169Z"
description:
---

## Introduction

Solo is one of my favorite new tools. I heard about recently from its creator, Aaron Francis, while at a conference he was emceeing.

Solo's website describes it as a Meta-harness for coding agents, but in my opinion that doesn't do this project justice. Solo to me is a control panel for whatever project I'm working on, with deep AI integration (naturally). It's the home to any terminals I might need, with common commands preloading into thier own dedicated slots in Solo, with the option to auto-start. And again, AI is deeply integrated: you can launch agents, and what's especially neat is that Solo provides it's own MCP that can provide your agents access to your various tasks and terminals to help it debug problems you're having.

Let's take a look!

## Solo

I won't walk you through installation, or adding a project. It'll make some best guesses on which commands you'll likely want. Tweak as desired (you can always adjust later) and create it.

Here's what mine looks like for a fitness tracking application I've been messing with.

![project setup](/solo/img-00-main-ui.jpg)

This is a TanStack Start web application, and as you can see I've got two commands (basically a terminal embedded in Solo) running: my dev web server, and Postgres via Docker.

As you hover over those commands you'd see buttons to stop, start or restart any of these comments. Obviously you can click any of these commands and see that terminal's output in the main Solo window. In the image above you can see my dev server.

And obviously you can edit these commands anytime

![project setup](/solo/img-00a-edit-command.jpg)

## Starting Agents

So far all I've shown is an app that manages multiple terminals in one convenient place, with common commands pre-set.

But it's 2026, so obviously you want to see the AI integration. Naturally you can start agents in Solo; there's even a dedicated section for it, which you can see in the image above. There's no shortage of shortcuts and UI commands for this, but just hit command-t and type "agent"

![project setup](/solo/img-01a-new-agent.jpg)

Don't worry, Solo supports virtually any agent you've ever heard of; only Claude and Codex show up here because that's all I bothered to set up.

Once you start an agent, it's living as normal right inside Solo, just like you're used to.

![project setup](/solo/img-01b-agent.png)

Nothing changes for you as the user. Well, for the most part. Solo adds some UX niceties. As your agent works, and you start having pending changes in your repo, Solo will show you all pending diffs next to the Agent's normal output, via split screen (if you're on a large enough monitor).

![project setup](/solo/img-01c-agent-with-changes.jpg)

## Solo's Built-in MCP

I moved kind of fast above because I wanted to get to the more interesting AI pieces. I mentioned earlier that Solo has built-in MCP which allows your agents to inspect (among other things) your other commands, and their outputs to help debug problems.

Let's try it out. I'll stop my database process.

![project setup](/solo/img-02a-stopped-db.jpg)

Obviously nothing will work now.

![project setup](/solo/img-02b-errors-in-dev-server.jpg)

As a control, before I touch Solo's MCP, let's make sure this is not something a vanilla Claude agent would be able to easily debug. When I ask it why I have errors in my dev server, it starts taking steps to start the dev server, and reproduce.

![project setup](/solo/img-02c-bad-prompt-debug.jpg)

I'd prefer it just look at my existing output, along with neighboring commands.

## Enabling MCP

The MCP section in Solo has a dirt simple section to enable it for whatever agent you happen to use. It gives you a bash command, or if that's too much, a nice fat "Run" button that executes the needed command.

![project setup](/solo/img-03-setup-mcp.jpg)

Find your harness of choice and smash that Run button, and it should show as installed

![project setup](/solo/img-04-solo-claude-installed.jpg)

## Using Solo's MCP

When we try to debug the same problem with the same prompt, unfortunately nothing really changes

![project setup](/solo/img-05a-bad-prompt-with-mcp.jpg)

If you want to engage Solo's MCP, you need to be a bit more specific in your prompt

![project setup](/solo/img-05b-solo-mcp-debug.jpg)

### Adding a skill

Like any software engineer I tend to be lazy, and would prefer to not have to manually tell it to "hey use Solo's MCP to blah blah" every time I want it to. A skill is a nice way to wrap that bit of functionality up.

At time of writing, Skills have sort of gotten a bad name, with devs dumping way too many of them in their repo, flooding context windows, potentially affecting skill selection quality, etc. But a skill that's **manually invoked only** can avoid those issues, and essentially serve as a subrouting for wrapping common functionality (like any function we're used to writing).

Here's the skill I whipped up

```
---
name: solo-debug
description: Debug this application using Solo MCP
disable-model-invocation: true
---

# Solo Debug

Use the Solo MCP tools to inspect the processes already running
for this project.

1. Inspect recent output and errors.
2. Use those process outputs to help diagnose what's being asked.
3. Do not start new processes unless necessary.
```

Note the line

```
disable-model-invocation: true
```

that prevents models from invoking it on thier own.

I put that in `.claide/skills/solo-debug/SKILL.md` and with that, I can now just do /solo-debug and type my original prompt

![project setup](/solo/img-07-solo-use-debug-skill.jpg)

## There's so much more

I'm about to wrap this post up, but if you're feeling underwhelmted with Solo, I promise I'm barely scrating the surface. Solo also supports scratchpads and todos, which of course can integrate with your agents. And there's entire [ai orchestration workflows](https://soloterm.com/docs/workflows/agent-orchestration). There's even guides on [building better daily workflows](https://soloterm.com/docs/workflows/daily-operating-patterns).

## Wrapping up

Solo is a superb tool for managing multiple processes, agents, and connecting everything together seamlessly. The process management alone is nice, but the built-in MCP support for improved debugging really makes this tool a favorite of mine. And this is before we even scratched the surface of some of the deeper ai workflows it supports.
