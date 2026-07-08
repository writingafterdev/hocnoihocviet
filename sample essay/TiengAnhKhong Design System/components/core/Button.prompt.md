# Button

Primary interactive element for all user actions — submit, navigate, confirm, dismiss.

```jsx
<Button variant="primary" size="md">Submit essay</Button>
<Button variant="secondary" size="md">Save draft</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="primary" loading>Analysing…</Button>
```

## Variants
- `primary` — black fill; use for the single dominant action per view
- `secondary` — white with border; secondary actions alongside a primary
- `ghost` — no border; tertiary actions, toolbar buttons
- `destructive` — muted clay red; destructive/irreversible actions

## Sizes
- `sm` 32px — compact UI, inline actions, table rows
- `md` 40px — default for forms and dialogs
- `lg` 48px — hero CTAs, prominent submit buttons

## Notes
- Never render two `primary` buttons adjacent; demote one to `secondary`
- `loading` prop replaces icon with spinner and disables click
- Letter-spacing is intentionally wide (`0.04em`) — do not override
