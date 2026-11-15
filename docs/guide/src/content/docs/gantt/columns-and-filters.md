---
title: Columns, filters and views
description: Show fields as columns, filter the rows and save filters as views.
---

:::note[Needs Planning]
Planning is on in a new tiko, and always on on the [public demo](https://demo.tiko.run). An instance set up before keeps the switch where it was; an admin turns it on in **Settings → Stages and people**.
:::

## Columns

With Planning on, a Gantt can show fields as columns between the task titles and the timeline: Priority, Size, Team, or any field of your own, such as Quarter or Budget code.

- **Show or hide a field:** click **+** at the end of the column headers, or type a new one. A Gantt shows up to 6 columns.
- **Fill a cell:** type a value straight into it, up to 100 characters. `Enter` or a click elsewhere saves it, `Esc` keeps the old one.
- **Inherit from the parent:** an empty cell shows the parent row's value in gray. Type a value to override it for that row and its children; clear it to inherit again.

### Fields

Fields belong to the whole tiko, so every Gantt can show the same ones. Values live in the rows of each Gantt and never go to the tracker.

- **Rename fields or add your own** in **Settings → Stages and people → Fields**.
- **Archiving** a field of your own keeps the values in the rows.
- **Priority, Size and Team** can be renamed but stay.

## Filters and views

With Planning on, a strip above the Gantt filters its rows by any field or by person.

- **Add a filter:** click **+ Filter**, pick a field or **Person**, then tick the values. Click a chip to change its values, or its **×** to drop it.
- **Matching:** values of one field match any of them; different fields must all match. A value such as "Q4, Q1" matches each part.
- **Inherited values** count, so a child matches its parent's Quarter. The parents of matching rows stay visible.
- **Team** also matches rows where a person of that team has a stage, so you can see where a team takes part across other teams' tasks.

The filters belong to the Gantt, like its scale.

### Save a view

**Save as view** stores the filters under a name for the whole tiko. Every Gantt lists saved views as pills above its rows: click a pill to apply it, click it again to show every task. Delete views in **Settings → Stages and people → Views**.
