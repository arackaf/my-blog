---
title: Introducing Solo
date: "2026-09-11T20:00:32.169Z"
description:
---

## Introduction

Solo is one of my favorite new tools. I heard about recently it for the first time from its creator, Aaron Francis, while at a conference he was emceeing.

Solo's website describes it as a Meta-harness for coding agents, but in my opinion that doesn't do this project justice. Solo to me is a control panel for whatever project I'm working on. It's the home to any terminals I might need, with common commands preloading into dedicated their own terminal, with the option to auto-start. And yes, of course AI is deeply integrated: you can launch agents, and what's especially neat is that Solo provides it's own MCP that can provide your agents access to your various tasks and terminals to help it debug problems you may run into.

Let's take a look!

## Solo

I won't walk you through installing this software, or adding a project. It'll make some best guesses on which commands you'll likely want. Tweak as desired (you can always adjust later) and create it.

Here's what mine looks like for a fitness tracking application I've been messing around with.

![project setup](/solo/img-00-main-ui.jpg)

This is a TanStack Start web application, and as you can see I've got two commands (basically a terminal embedded in Solo) actively running running: my dev web server, and Postgres running via Docker.

As you hover over those commands you'd see buttons to stop, start or restart any of these comments. Obviously you can click any of these commands and see that terminal's output in the main Solo window. In the image above you can see my dev server visible.

And obviousky you can edit these commands anytime

![project setup](/solo/img-00a-edit-command.jpg)

## Starting Agents

So far all I've shown is an app that manages multiple terminals in one convenient place, with common commands pre-set.

It's 2026, so obviously you want to see about AI integration. Naturally you can start agents in Solo; there's even a dedicated section for it, which you can see in the image above. There's no shortage of shortcuts and UI commands for this, but just hit command-t and type "agent"

![project setup](/solo/img-01a-new-agent.jpg)

Don't worry, Solo supports virtually any agent you've ever heard of; only Claude and Codex show up here because that's all I bothered to set up.

Once you start an agent, it's living as normal right inside Solo, just like you're used to.

![project setup](/solo/img-01b-agent.jpg)

Nothing changes for you as the user.

## Wrapping up

Solo is a superb tool for managing multiple processes, agents, and connecting everything together seamlessly. The process management alone is nice, but the built-in MCP support for improved debugging really makes this tool a favorite of mine.
