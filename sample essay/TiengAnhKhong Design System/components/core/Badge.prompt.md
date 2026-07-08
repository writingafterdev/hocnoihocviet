# Badge

Compact inline label for scores, states, and categories. Not interactive.

```jsx
<Badge variant="score">Band 7</Badge>
<Badge variant="high">7.5</Badge>
<Badge variant="mid">5.5</Badge>
<Badge variant="low">3.0</Badge>
<Badge variant="default">Draft</Badge>
```

## Variants
- `score` — black/cream; for prominent overall band numbers
- `high` — green tint; bands 7–9
- `mid` — amber tint; bands 5–6
- `low` — clay tint; bands 1–4
- `default` — neutral grey; states like "Draft", "Submitted"
- `outline` — bordered, no fill; subtle categorisation

## Notes
- Use `size="sm"` inside prose or table cells; `size="md"` standalone
- Never use Badge for interactive actions — use Button or Tag instead
