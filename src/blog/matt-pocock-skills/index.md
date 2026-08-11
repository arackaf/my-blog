---
title: Introducing AI Skills for Real Engineers
date: "2026-08-09T20:00:32.169Z"
description:
---

AI is an undeniable force in software engineering right now. These tools are trivial to use: tell it what to do, and it does it. But as easy as these tools are to start using, they can be tricky to use _well_.

This is a post about "AI Skills for Real Engineer" which is a suite of ai "skills" (the kind you install into your ai harness) created by Matt Pocock. These skills exist to help you make AI tooling more effecitve. I've found them to be straightforward to use, and very impactful.

We'll take a brief tour through a few of these skills which I think most clearly shows the kind value they can add to almost any software dev's workflow, no matter what you're working on. If you'd like to learn more, the main docs [are here](https://github.com/mattpocock/skills).

## Installation

I'll assume you're using Claude Code (see the docs for other harnesses). To install just run

```
claude plugins install mattpocock-skills
```

If that fails with something like `"mattpocock-skills" not found in any marketplace`,

![xzibit meme](/pocock-skills/img-00-marketplace-error.jpg)

try clearing your claude code marketplace cache (yes, really). This command will do just that

```
claude plugins marketplace update
```

## A skill to help you use the skills

The docs for these skills are pretty clear, but you might still have some questions. Believe it or not there's a skill that helps you understand what the other skills do.

![xzibit meme](/pocock-skills/img-00-xzibit.jpg)

Let's check it out. Imagine you read the docs and you're not quite sure what the difference between the `/grilling` and `/grill-me` skills is. You can just fire up the /ask-matt skill, and ask it

![ask-matt skill](/pocock-skills/img-02-ask-matt.jpg)

Ok let's actually put these skills to work. Let's start by getting things set up for an individual project.

## Project setup

Many of these skills will do things like create tickets, or even documentation like ADRs. To get those, and other things set up, the first thing you should do in a new project is run the `/setup-matt-pocock-skills`.

![skills setup](/pocock-skills/img-01-setup.jpg)

This is where we configure these skills on where to create issues, where to create ADRs, and so on. It's a simple thing, but it's a nice touch to help these other skills run more smoothly.

## Producing clear requirements with /grill-me

Anyone who's used LLMs for coding knows that clear, detailed prompts are essential. Missing details are anathema for effective AI use. If you leave AI to assume thingsy you've left out of your prompt, you might be disappointed in the result. Tools like Claude Code do have a plan mode, and LLMs in general will happily accept things like "did I miss anything" at the end of your feature description.

But the /grill-me spec formalizes all that, and takes it to the next level.

To get started, just do /grill-me and describe your feature.

![skills setup](/pocock-skills/img-03-grill-start.jpg)

It'll analyze your prompt, and come up with some surprisingly detailed questions. As you answer those, you'll likely be greeted with some follow-ups

![skills setup](/pocock-skills/img-03-grill-continue.jpg)

and so on, until your model has what it needs.

![skills setup](/pocock-skills/img-03-grill-conclude.jpg)

## Implementing (now or later)

At this point your session and context should have everything needed to implement your feature. You can absolutely feel free to tell Claude something like "looks good build it."

Or if for whatever reason you're not ready for this feature to be implemented right this second—perhaps you have 2 or 3 other AI-generated PRs to test and review, perhaps you have two other agents building things right this second, and were just using that waiting time to spec the next thing—then read on.

### Saving work for later with /to-spec

If you'd like to take the entirety of the current conversation and context and turn it into a single issue for later, you can use the `/to-spec` skill. Just call it up, and let the skill do the rest. It'll even try to add some tests, and check with you about the appropriate testing boundaries.

![skills setup](/pocock-skills/img-05-to-spec.jpg)

### Saving work for later with /to-tickets

What if the feature you just designed is big. Humans work best with small, well-defined tasks, and AI agents are no different. You'll likely get better results if you avoid letting your context window get flooded with content you wouldn't otherwise need.

Inside that same conversation you just had, via the `/grill-me` skill, you can just call up the `/to-tickets` skill, and break that feature into multiple issues.

![to-tickets](/pocock-skills/img-04-to-tickets-proposed.jpg)

It'll even be smart enough to block tickets as needed, based on what depends on what. Naturally you can make any tweaks to the proposed result you'd like

![to-tickets](/pocock-skills/img-04-to-tickets-adjust.jpg)

Once you're happy, tell it so, and it'll do it's thing

![to-tickets done](/pocock-skills/img-04-to-tickets-final.jpg)

and you'll wind up with a nicely filled out board.

![to-tickets done](/pocock-skills/img-04-to-tickets-result.jpg)

## Parting thoughts

I hope you find these AI skills as useful as I do. They can really help refine, and clarify your ideas to clear, actionable specs your LLM can execute most effectively on.

Happy Coding!
