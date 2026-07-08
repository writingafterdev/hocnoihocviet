# Card

Surface container that groups related content into a distinct visual unit.

```jsx
<Card>
  <h3>Essay title</h3>
  <p>Some body text…</p>
</Card>

<Card variant="flat" padding="sm">
  <Badge variant="mid">5.5</Badge>
</Card>

<Card onClick={() => navigate('/essay/1')}>
  <p>Clickable essay card</p>
</Card>
```

## Variants
- `default` — white background, 1px border; for dashboard cards, modals
- `flat` — warm grey fill; for sidebar panels, code blocks, insets
- `outline` — transparent, border only; subtle groupings on white surfaces

## Padding
- `sm` 12px — dense information cards
- `md` 24px — standard content card (default)
- `lg` 32px — spacious hero card

## Notes
- Cards never have box-shadow in this system — use border only
- Passing `onClick` automatically adds pointer cursor and hover tint
