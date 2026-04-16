# Anchor

Content governance for UX professionals. Know who owns your content model, when it was last reviewed, and what needs attention.

## Download

Download the latest version from the [Releases](https://github.com/tyler-lyman/anchor/releases) page.

## What is content governance?

Writing good content is the first problem. Keeping it good over time is the harder one.

Most UX teams have a content model — a set of patterns covering empty states, error messages, onboarding flows, permission prompts. But nobody owns them. Nobody reviews them on a schedule. A new designer changes the tone of one component without realizing it contradicts three others. An error message written two years ago still reflects a product that no longer exists.

Content governance is the practice of treating your content model like a living system: assigning owners, setting review cadences, and tracking what's current versus what's drifted. Anchor is built around that idea. Not as a bureaucratic layer, but as a lightweight signal system that tells you what's healthy and what needs work.

## What it does

Anchor gives UX teams a shared inventory of their content types — organized by workspace and section, each with an owner, a confidence score, a review schedule, and a space for open questions. A health dashboard surfaces what needs attention: past-due reviews, unowned content, low-confidence copy, and unanswered questions. Review mode walks you through everything at once so nothing gets missed.

## Features

- Assign owners and review cadences to any content type
- Confidence scores flag copy that needs a second look
- Log open questions with attribution and resolve them when closed
- Health indicators surface stale, unowned, or low-confidence content at a glance
- Review mode walks through everything that needs attention in one session
- Everything lives as files on your computer. No accounts, no cloud

## Support

Anchor is free and always will be. If it's useful to you and you'd like to say thanks, you can buy me a coffee. No pressure either way.

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/tyly)

## Running locally

```
npm install
npm run electron-dev
```

## Building a distributable

```
npm run dist-mac
```
