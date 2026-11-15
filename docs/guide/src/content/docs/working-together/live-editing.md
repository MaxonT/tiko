---
title: Live editing
description: See who is on a board, how changes from several people merge, and what happens when the connection drops.
---

Everyone who has a shared board open sees each other's changes as they happen. Viewers see them live too.

## See who is here

- **Avatars:** the top bar shows an avatar for everyone else who has the board open: their initials on their own color. Hover one for the name. Someone whose tab sits in the background stays there. A closed tab leaves at once; one that goes silent without closing leaves after about a minute and a half.
- **Cursors:** each person's cursor carries the same small avatar, so you can tell at a glance who is doing what. The name shows next to it for a moment when they arrive.
- **Selections:** an element someone else has selected gets an outline in their color with their avatar on its corner. Take it as "busy": two people changing the same thing at once do not merge.
- **Movement:** an element someone is dragging moves on your screen while they drag it, and other changes glide into place instead of jumping. With reduced motion turned on in the system, they jump.

## What merges

- Changes to different elements never collide.
- Changes to different parts of one element both stay: one person moves a sticky note while another rewrites it.
- When two people change the same thing at the same moment, such as the text of one sticky note or the contents of one Gantt, the later change wins.
- Deleting wins over editing: if someone deletes an element you are changing, it is gone for both of you.
- If a frame is deleted while someone drops a card into it, the card stays on the board where it was dropped.

Task data is not part of this: each person's cards show what their own tracker token allows.

## Undo

Undo and redo go through your own changes only. Pressing `⌘Z` (`Ctrl+Z`) never takes back what someone else did.

## Your view is yours

Pan and zoom are kept per person in the browser. A board you have not opened in this browser opens fitted to its content.

## When the connection drops

| What happened | What you see | What to do |
|---|---|---|
| A blip | "Reconnecting…" at the top right | Keep working. When the connection is back, your changes and everyone else's merge, with nothing doubled and nothing lost. |
| Down for 30 seconds or more, with changes of yours | "Not saved yet. Changes are kept in this tab." The browser asks before you close the tab. | Keep the tab open until it connects. |
| Never connected | The board opens view-only with "Live connection unavailable. Viewing the last saved version." and keeps trying. | On a self-hosted instance behind your own reverse proxy, the proxy usually does not pass WebSockets; see [Configuration](../../configuration/#behind-your-own-reverse-proxy). |

A board is editable once its live connection is up, which normally takes a moment.

## When your access changes

- **Your role changes:** the open board follows at once: view-only when you become a viewer, editable again when you become an editor.
- **You lose access:** tiko takes you to [Home](../../home/) and says "You no longer have access to this board."
- **You are signed out:** signing out everywhere, a password change or a disabled account closes the board and asks you to sign in.

## A full board

Up to 30 browser tabs can have one board open at the same time. The next one opens view-only with "This board is full right now." and gets in when a place frees up.
