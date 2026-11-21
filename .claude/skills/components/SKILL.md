---
name: components
description: Conventions for React components in this project. Use when creating, editing, moving or reorganizing a component, or deciding which folder it belongs in.
---

# Components

## Placement

Keep a component close to where it is used.

- Used by one page: put it beside that `page.tsx`.
- Used by a layout or several pages in the same route group: put it in that group's `_components/` folder.
- Used only by another component: keep it beside that component.
- Used across route groups: put it in `app/_components/`.

Name the folder `_components`, so it is not confused with the page folders.

When moving a component, update the imports to relative paths and delete any folder left empty.

## Forms

Use `useActionState` for form submission instead of `useState` with `onSubmit`. Read values from `FormData`, return the error in the state, and use `isPending` for the loading state. Return the field values in the state and pass them as `defaultValue`, so a failed submit doesn't clear the form.

## API calls

Call the API through one shared API client (for example `app/lib/apiClient.ts`), not `fetch` directly. If there isn't one yet, create it instead of adding a direct `fetch`.

## Shared components

Make a shared component generic, not tied to the place that first needed it.

- Take content and variants as props. Don't hardcode text such as "Saved", or the meaning of one caller's data.
- Name props by what they are, not by one use: `text` and `state="success"`, not `saved`.
- Let the caller decide what to show; the component decides only how it looks and behaves.

For example, a `Message` component takes any `text` plus a `state` (`success`, `error`, `normal`), and a `Button` takes a `variant`.

## Buttons

Use the shared `Button` component (in `app/_components/`), never a raw `<button>`. It takes two separate props, so any shape can have any color:

- `variant` is the shape: `solid` (filled), `outline` (bordered), `link` (text only) or `plain` (inherits the surrounding text).
- `color` is the meaning: `accent` (the default), `neutral`, `danger` or `success`. `plain` ignores it.

Typical uses:

- `variant="solid"`: the main action of a form, such as Save or Submit.
- `variant="outline" color="neutral"`: every other button, such as Cancel.
- `color="danger"`: actions that delete or archive, in any variant, such as a red Delete link in a table row.

Don't add a variant for a color; add a color instead. `LinkButton` takes the same `variant` and `color`, and `ConfirmAction` passes them on as `triggerVariant` and `triggerColor`.

Add an `icon` prop for buttons that hold only an icon.

## Text

Use the shared `Text` component (in `app/_components/`) for headings and for text whose look repeats across the app, instead of a local class that sets `font-size`, `font-weight` or `color`. Like `Button`, it takes two separate props:

- `variant` is the size and weight, and picks a default tag:
  - `title`: page title, 2xl bold, `h1`.
  - `heading`: section heading, lg bold, `h2`.
  - `subheading`: smaller heading, base bold, `h3`.
  - `label`: small bold heading, sm bold, `span`.
  - `body`: normal text, base, `p`.
  - `small`: hints, help and empty-state lines, sm, `p`.
  - `caption`: tiny notes, xs, `span`.
  - `plain`: keeps the surrounding size and weight and only sets the color, `span`.
- `color` is the meaning: `inherit` (the default), `muted`, `accent`, `danger` or `success`.

Use `as` when the tag must differ from the variant's default, so the heading outline stays right: `<Text variant="heading" as="h3">` inside a dialog, `<Text as="li" variant="small" color="muted">` for an empty list row.

Typical uses:

- `<Text variant="small" color="muted">`: a hint under a form or table, or "No teams yet."
- `<Text variant="plain" color="muted">`: a muted word inside other text, such as "(platform)".

`className` is for placement only (margin, width, `white-space`), as with any shared component. Don't add a size or weight prop; add a variant. Keep a local class only for text with a look of its own, such as monospace keys and code, badges, chips, table cells and chart labels, and don't use `Text` inside `Button`, `Field`, `Table` or `Message`, which style their own text.

## Shared look

When two components need the same look, make a shared component that owns the markup and styles. Don't share a CSS module between components (see the css-modules skill).

Before writing raw elements, check for an existing shared component and use it, for example:

- Headings, hints and muted text: `Text` with a `variant` and `color`.
- Form fields: a `Field` (label and its control) with an `Input`.
- Pages: a `Page` with a `title`, and a `Loading` component as the `Suspense` fallback.
- Tables: a `Table` that takes `headers`, with an empty state.

If none exists and the look will repeat, create one.

## Props

Declare props as a separate `type Props = { ... }` above the component, in the same file. Don't inline them, and don't use names like `HeaderProps`.
