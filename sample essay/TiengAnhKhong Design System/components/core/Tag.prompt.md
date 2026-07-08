# Tag

Compact label for IELTS criterion categories or essay topic tags.

```jsx
<Tag criterion="TA" />
<Tag criterion="CC" />
<Tag criterion="LR" />
<Tag criterion="GRA" />
<Tag>Opinion essay</Tag>
<Tag>Argument</Tag>
```

## Criterion codes
| Code | Criterion | Colour |
|------|-----------|--------|
| `TA` | Task Achievement | Blue |
| `CC` | Coherence & Cohesion | Purple |
| `LR` | Lexical Resource | Green |
| `GRA` | Grammatical Range & Accuracy | Brown |

## Notes
- Criterion colours are fixed and meaningful — do not customise
- For neutral topic tags (Opinion essay, Process essay…) omit `criterion`
- Tags are display-only; for interactive filtering use a button-group
