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

Use the shared `Button` component (in `app/_components/`), never a raw `<button>`. Give it variants such as:

- `primary`: the main action of a form, such as Save or Submit.
- `secondary`: every other button, such as Cancel or Remove.

Add an `icon` prop for buttons that hold only an icon.

## Shared look

When two components need the same look, make a shared component that owns the markup and styles. Don't share a CSS module between components (see the css-modules skill).

Before writing raw elements, check for an existing shared component and use it, for example:

- Form fields: a `Field` (label and its control) with an `Input`.
- Pages: a `Page` with a `title`, and a `Loading` component as the `Suspense` fallback.
- Tables: a `Table` that takes `headers`, with an empty state.

If none exists and the look will repeat, create one.

## Props

Declare props as a separate `type Props = { ... }` above the component, in the same file. Don't inline them, and don't use names like `HeaderProps`.
