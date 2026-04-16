# Anchor

Content governance for UX professionals. Know who owns each part of your product's voice, when it was last reviewed, and what needs attention.

## Download

Download the latest version from the [Releases](https://github.com/tyler-lyman/anchor/releases) page.

## What is content governance?

Writing good content is the first problem. Keeping it good over time is the harder one.

Most products have a content model — a set of patterns covering empty states, error messages, onboarding flows, permission prompts. But nobody owns them. Nobody reviews them on a schedule. A new designer changes the tone of one component without realizing it contradicts three others. An error message written two years ago still reflects a product that no longer exists.

Anchor is built around the idea that content types should have owners, review cadences, and a clear health status. Not as a bureaucratic layer, but as a lightweight signal system that tells you what's current and what's drifted.

## What it does

Anchor gives UX teams a shared inventory of their content types — organized by workspace and section, each with an owner, a confidence score, a review schedule, and a space for open questions. A health dashboard surfaces what needs attention: past-due reviews, unowned content, low-confidence copy, and unanswered questions.

## Features

- Assign owners and review cadences to any content type
- Track confidence scores and flag content that needs a second look
- Log open questions with attribution and mark them resolved when closed
- Health indicators surface stale, unowned, or low-confidence content
- Review mode walks you through everything that needs attention in one session
- Everything lives as files on your computer. No accounts, no cloud

## Support

Anchor is free and always will be. If it's useful to you and you'd like to say thanks, you can buy me a coffee.

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
