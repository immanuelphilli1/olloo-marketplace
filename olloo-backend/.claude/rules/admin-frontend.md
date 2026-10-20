---
paths:
  - "resources/js/**/*.{ts,tsx}"
  - "resources/css/**/*.css"
---

# Admin frontend

No shared UI kit: pages use inline Tailwind (slate palette, `rounded-md border-slate-300` inputs, `bg-slate-900` primary). Shared pieces live in `@/Components` (`Pagination`, `TagsInput`, `CategoryTree`, `CategoryTreePicker`, `TagMultiSelect`). Form building blocks (`FormSection`, `Field`, `ErrorSummary`, `Switch`, `ImagePreview`, `Badge`, `focusFirstError`, `useUnsavedChangesWarning`, `slugify`) live in `@/Components/Form`; use them for new create/edit forms. Links via `useRoute()` from `@/utils/route` with named `admin.*` routes.

## Clickables
- Anything clickable (`button`, `Link` styled as button, `onClick`/`role="button"`, chips, tabs, toggle rows, `select`, checkbox labels) gets `cursor-pointer`; disabled gets `disabled:cursor-not-allowed`. Hover color alone is not enough.

## Create/edit forms
- Group by user task, not DB schema. Sections before steps: one page split into titled sections; stepper only for 3+ truly sequential stages; never tabs as a wizard.
- Labels above fields; placeholders are examples only; short helper text that prevents mistakes. Show/hide fields that a choice makes irrelevant instead of explaining "required if X".
- Two columns only for related pairs. One primary action.
- Validation (on submit, input preserved): field error under each input + red section marker + top summary `role="alert"` listing problems. Never toast-only. Error copy says how to fix it.
- Destructive actions confirm first (existing pattern: `confirm(...)` then `router.delete`).
