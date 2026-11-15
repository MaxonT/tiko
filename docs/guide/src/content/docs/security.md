---
title: Security
description: Sign-in, the first password, people and roles, board sharing, and what tiko stores and talks to.
---

tiko asks for a sign-in on everything except two health checks:

| What | How it is reached |
|---|---|
| Pages and the app's API | A username and password |
| The API under `/api/v1/` | A personal [API key](../api-keys/) |
| `/metrics` | The server admin, or a monitoring system that sends `TIKO_METRICS_TOKEN`; see [Monitoring](../monitoring/) |
| `/health` and `/ready` | Open |

## The first password

The first account is `admin`. Where its password comes from depends on how tiko was installed:

| Installed with | Where the password is |
|---|---|
| The one-line installer | `TIKO_PASSWORD` in `.env` in the tiko folder. Commands for each system are in [Lost the password](../install/#lost-the-password). |
| Docker Compose by hand, `TIKO_PASSWORD` empty | Printed once to the API log (`docker compose logs api \| grep 'tiko password'`) and saved to `data/password` |
| Railway | `TIKO_PASSWORD` in the `api` service's Variables |
| Render | `TIKO_PASSWORD` in the `tiko-api` service's Environment |

That password sat in a log, a file or a hosting variable, so the first sign-in asks for a new one before anything else.

- **Until you set it**, the API answers every other request with 403 `password_change_required`. Signing out is the only other way off that screen.
- **Once it is set**, tiko deletes `data/password`, and `TIKO_PASSWORD` is no longer read.
- **Later changes:** your name and username in **Settings → Profile**, your password in **Settings → Security**.

## Signing in

- **Sessions** last 30 days in a browser. Changing your password signs out your other devices; **Sign out everywhere** in **Settings → Security** signs out all of them.
- **Storage:** passwords are kept as salted scrypt hashes, and sessions as hashes of their tokens.
- **Wrong passwords:** after 10 for one username in 15 minutes, sign-in for that username pauses until the window passes.
- **HTTPS:** use it on the open internet. Railway and Render give you HTTPS.

## People

Two roles keep the people who use tiko apart from the person who runs it:

| Role | What it does | Where |
|---|---|---|
| **Workspace admin** | Sets the task source, sharing and Planning; invites people and makes them admin or member | **Settings → Workspace**, **Settings → People** |
| **Server admin** | The first account. Updates tiko, sets Privacy, manages accounts; the only one who can disable an account or make a password reset link | **Settings → Server**, **Settings → Accounts** |

The first account has both roles, so on a server you run alone nothing changes.

### Invite people

A workspace admin opens **Settings → People** and presses **Invite**, which gives a link to send in a chat. The link works once and expires in 7 days. The person picks a username, a name and a password and is signed in. tiko sends no mail.

An account is in one workspace at a time. Someone already in a workspace who opens an invite is told so.

### Change or remove a person

From a person's menu a workspace admin makes them admin or member, or removes them from the workspace. A removed person:

- keeps their account and can still sign in, but sees no boards until an invite brings them back. Opening an invite while signed in joins with the same account;
- hands their boards to the admin who removed them, with their other members kept, boards in their trash too;
- loses their tracker tokens and cached tasks, and their open boards close at once.

The workspace always keeps at least one active admin: the last one cannot become a member, be removed or be disabled.

### Accounts and password resets

The server admin sees every account in **Settings → Accounts**. From an account's menu they:

- **disable** it: the person is signed out at once and cannot sign in. The server admin cannot be disabled;
- **create a password reset link** that works once within 24 hours.

Only the hash of a link's token is stored, so a link is shown once. Unused links are listed under **Open links** and can be revoked.

:::tip[The server admin forgot their password]
In the tiko folder run `docker compose exec api python -m app.reset_password admin` (or the username) and open the printed link on your tiko address.
:::

### Hand tiko over

Whoever deploys tiko can hand the workspace over: invite the business owner **As admin**, then make yourself a member. To hand over the server too, give them the first account and let them change its username and password. Set the tracker in the environment first (`TIKO_TRACKER`, `JIRA_BASE_URL`) so it stays as deployed.

## Sharing boards

A board belongs to the person who made it. The three ways to share one are side by side in [Working together](../working-together/#share-a-board).

- **Owner:** adds people as **Can edit** or **Can view**, removes them, makes someone else the owner, or gives a role to **Everyone in this workspace**. Only the owner moves a board to the trash or changes who has access; the owner and a workspace admin restore it from the trash.
- **Editors** change the board and its name.
- **Viewers** see it with a **View only** badge: no toolbar, nothing moves or changes, and the server refuses their saves.
- **Admins** act as owner on every board, so a board is never stranded when its owner is disabled. Boards nobody shared with them are under **Other boards** on [Home](../home/#grid-and-list) and in the board menu.
- **Hidden boards:** a board you cannot open is not in your list, and its link answers as if it did not exist.
- **Welcome board:** each new person gets their own once.

The live connection of a shared board ([Live editing](../working-together/live-editing/)) uses the same sign-in as the pages. It checks the role on the server for every change and accepts only pages served from tiko's own address. It closes at once when a person is disabled, signs out everywhere, is removed from the workspace or loses access to the board.

A board is private until its owner turns on a [public link](../working-together/#share-a-public-link). A link shows that one board view-only, without its people and without task data from a tracker, and opens no other route. An admin can switch public links off in **Settings → Sharing**.

Each person connects their own tracker token in **Settings → My tracker**, and task data is fetched and cached per person. A shared board never shows you a task your own tracker access does not allow.

## What tiko stores

- **Your boards, settings and account:** username, name and password hash.
- **Each person's tracker token**, encrypted with `TIKO_SECRET_KEY` and kept with the URL it was entered for. It is never sent back to the browser, written to logs or sent to another URL.
- **A cached copy of each card:** key, summary, status, type, assignee, priority and last update, kept apart for each person.

## What tiko talks to

| Where | Why | Turn it off |
|---|---|---|
| The tracker URL you configure | Tasks for the cards | — |
| The GitHub API | The latest tiko release; no data about you or your boards is sent | `UPDATE_CHECK=false` |
| The usage stats collector, once a day | A few counts with no personal data; every field is in [Usage stats](../privacy/) | `TIKO_USAGE_STATS=false`, or **Settings → Privacy** |

Fonts and icons ship with the app.

:::caution[The updater controls Docker]
With one-click updates on, the `updater` service mounts the Docker socket, which gives it control of Docker on the host. It is off unless the installer turned it on or `COMPOSE_PROFILES=updater` is set, and it publishes no port. It answers only requests with the token in `data/updater-token`, which the `api` container sends when the server admin starts an update, and it replaces the `api` and `web` containers. See [Updates](../updates/#what-the-updater-is).
:::

## Report a vulnerability

Report vulnerabilities privately as described in [SECURITY.md](https://github.com/tiko-run/tiko/blob/main/SECURITY.md), not in a public issue.
