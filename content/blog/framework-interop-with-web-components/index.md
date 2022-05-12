---
title: Sharing code between frameworks, using web components
date: "2019-05-13T10:00:00.000Z"
description: Using web components to share code between frameworks
---

Those of us who've been web developers for more than a few years have almost certainly written code for the web in more than one Framework. With all the choices out there—React, Svelte, Vue, Angular, Solid—it's all but inevitable. One of the more frustrating things we have to deal with when working across frameworks is re-defining all of those low-level ui components: buttons, tab, dropdowns, etc. Those ui components that we need, and want to look and behave a particular way, but ultimately aren't directly related to whatever we're building.

What's particularly frustrating is that we'll typically have them defined in one framework, say React, but then need to rewrite them in Svelte if we want to build something in Svelte. Or Vue. Or Solid. And so on. Wouldn't it be better if we could define these low-level ui components once, in a framework-agnostic way, and then re-use them between frameworks? Of course it would, and we can; web components are how. This post will walk you through it.

## Web Components: what are they.

Web Components are essentially html elements that you define yourself, from the ground up. We'll walk through the process in a bit, but essentially you'll define a JavaScript class, inherit it from `HTMLElement` (there are other options), and then define whatever properties, attributes and styles the web component has, and of course the markup it will ultimately display to your users when rendered.

## Web Components: what they're good at, and what they're not

