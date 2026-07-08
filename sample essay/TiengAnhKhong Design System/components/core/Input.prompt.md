# Input / Textarea

Text input controls for the essay submission flow and settings forms.

```jsx
<Input label="Your name" placeholder="e.g. Minh Anh" />
<Input label="Email" type="email" error="Please enter a valid email" />

<Textarea
  label="Your essay"
  placeholder="Write your IELTS Task 2 response here…"
  rows={14}
  wordCount={247}
  hint="Aim for 250–300 words for Task 2"
/>
```

## Notes
- Always pair with a `label` — never a placeholder-only field
- `wordCount` prop on Textarea shows a live counter beside the label
- Focus border turns full black (`--gray-900`); no blue/brand colour
- `error` and `hint` are mutually exclusive — error wins
