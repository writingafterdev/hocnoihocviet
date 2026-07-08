# ScoreRing

Circular ring gauge for IELTS band scores (0–9 scale). Colour-codes automatically based on the score level.

```jsx
<ScoreRing score={7.5} label="Overall" size={96} />
<ScoreRing score={6.0} label="Task Achievement" size={72} />
<ScoreRing score={5.5} label="Lexical Resource" size={72} />
<ScoreRing score={4.0} label="Grammar" size={72} />
```

## Colour logic
- **7–9** → sage green (`--score-high`)
- **5–6** → amber (`--score-mid`)
- **1–4** → clay (`--score-low`)

## Props
- `size` defaults to `80`px — use `96` for the overall band hero, `64–72` for criterion sub-scores
- `strokeWidth` defaults to `5`px; increase proportionally for larger rings
- `label` renders below the ring in secondary text

## Notes
- Score must be a number; supports 0.5 increments as IELTS uses half-bands
- Ring animates on mount via CSS transition
