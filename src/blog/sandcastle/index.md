```bash
gh issue list \
  --state open \
  --limit 100 \
  --json number,title,body,labels,blockedBy
```

which produces

```json
[
  {
    "blockedBy": {
      "nodes": [
        {
          "id": "I_kwDOTwhgQM8AAAABL7tDgA",
          "number": 7,
          "state": "OPEN",
          "title": "Two-column board UI for tickets",
          "url": "https://github.com/arackaf/render-atl-ai-sandbox/issues/7"
        }
      ],
      "totalCount": 1
    },
    "body": "## What to build\n\nWire up drag-and-drop on the ticket board so users can move cards between the \"To Do\" and \"Done\" columns to update a ticket's status.\n\n- Install `@dnd-kit/core` (no `@dnd-kit/sortable` — no within-column reordering)\n- Cards are draggable between columns\n- Dropping a card in a new column calls a new `updateTicketStatus` server function that accepts `{ id, status }` (narrow contract)\n- Optimistic update via TanStack Query mutation — card moves immediately on drop\n- On success: invalidate the tickets query (background refetch)\n- On failure: silent revert (no error UI for now)\n\n## Acceptance criteria\n\n- [ ] `@dnd-kit/core` is installed\n- [ ] Cards can be dragged between \"To Do\" and \"Done\" columns\n- [ ] Drop triggers `updateTicketStatus` server function with `{ id, status }`\n- [ ] `updateTicketStatus` updates the issue's status in the database\n- [ ] UI updates optimistically on drop\n- [ ] Tickets query is invalidated on successful mutation\n- [ ] Failed mutations silently revert the card to its original column\n\n## Blocked by\n\n- #7 — Two-column board UI for tickets",
    "labels": [
      {
        "id": "LA_kwDOTwhgQM8AAAACvX0ewQ",
        "name": "ready-for-agent",
        "description": "Fully specified, ready for an AFK agent",
        "color": "0E8A16"
      }
    ],
    "number": 8,
    "title": "Drag-and-drop status updates"
  },
  {
    "blockedBy": {
      "nodes": [
        {
          "id": "I_kwDOTwhgQM8AAAABL7tBhg",
          "number": 6,
          "state": "OPEN",
          "title": "Server functions and loader for tickets and epics",
          "url": "https://github.com/arackaf/render-atl-ai-sandbox/issues/6"
        }
      ],
      "totalCount": 1
    },
    "body": "## What to build\n\nThe index page renders a two-column Kanban-style board with columns for \"To Do\" and \"Done\". Ticket data comes from the route loader.\n\n- Two side-by-side columns, each with a header (\"To Do\" / \"Done\")\n- Tickets are split by their `status` field\n- Each card shows only the ticket title\n- No epic badges, no grouping, no special mobile layout\n- Styled with Tailwind CSS\n\n## Acceptance criteria\n\n- [ ] Index page displays two side-by-side columns labelled \"To Do\" and \"Done\"\n- [ ] Tickets are split into the correct column based on `status`\n- [ ] Each card displays only the ticket title\n- [ ] Styled with Tailwind utility classes\n\n## Blocked by\n\n- #6 — Server functions and loader for tickets and epics",
    "labels": [
      {
        "id": "LA_kwDOTwhgQM8AAAACvX0ewQ",
        "name": "ready-for-agent",
        "description": "Fully specified, ready for an AFK agent",
        "color": "0E8A16"
      }
    ],
    "number": 7,
    "title": "Two-column board UI for tickets"
  }
  // and so on
]
```
