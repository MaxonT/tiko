---
title: Reminders and focus
description: Reminders that go off at a time or on a status change, and a focus timer with music.
---

A reminder is a small countdown cube next to the thing you are waiting for. The focus timer is a pomodoro capsule with music, for the work in between.

## Reminders

### Add a reminder

Pick the reminder tool (`R`) and click a card, sticky note, text or module, or right-click one and choose **Add reminder**. It attaches beside the element, moves with it and goes away with it. A reminder on an empty spot stays on its own.

### Set when it goes off

Click the cube to note what you are waiting for and set when it goes off:

| Type | Example |
|---|---|
| In a while | `15m`, `1h 30m` |
| A day and time | `tomorrow 10:00`, `fri 9:00` |
| A date | `25.10.2026 15:00` |

- **Suggestions** finish what you start: `3` offers 3 minutes, 3 hours or 3 days, `tu` offers Tuesday at a few hours, `15:` offers 15:00 and 15:30. Each shows when it goes off; click one, or press `Tab` to take the first and keep typing.
- **Repeat:** clock reminders can repeat every day, on weekdays or every week.
- **On a status change:** on a task card, pick **When the status changes**. The reminder goes off as soon as the board sees the task leave its current status.

### When it goes off

- **While tiko is open:** a browser notification and a chime.
- **While the board was closed:** reminders that went off are listed when you open it.
- **Every reminder on the board** is listed under the button left of the sync indicator.

Reminders can also be set through the [API](../api/#reminders).

## Focus timer

A pomodoro capsule at the top of the screen, with a chime and a browser notification at the end of each round:

| Round | Length |
|---|---|
| Focus | 25 minutes |
| Break | 5 minutes |
| Long break, after every fourth round | 15 minutes |

- **Color:** the capsule warms from green to raspberry as the time runs out.
- **Lengths** are adjustable, and the countdown survives a reload.
- **Hide it** from the main menu.

### Music

Under the timer sits a small player with seven built-in lofi tracks (CC0) or your own audio files, kept in your browser and never uploaded. Music pauses on breaks unless you turn that off.
