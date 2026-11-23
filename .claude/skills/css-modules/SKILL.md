---
name: css-modules
description: Styling conventions for Next.js apps that use CSS Modules (no Tailwind). Use when adding or changing styles, colors, sizes, dark mode, focus or hover states, or a component's className.
---

# CSS Modules

Style with plain CSS Modules and CSS variables. Don't add Tailwind, utility class strings, inline `style` objects or a CSS-in-JS library.

## Files

- A component's styles go in a file named after it, beside it: `Header.tsx` → `Header.module.css`, `page.tsx` → `page.module.css`, `layout.tsx` → `layout.module.css`.
- Import it as `styles` and use it only in that component: `import styles from "./Header.module.css"`.
- Don't import one component's module into another component. When several components share a look, make a shared component that owns the styles (`Input`, `Field`, `Table`, `Page`), placed by the components skill. Next.js orders CSS by import order, so a module imported from many places makes the order unpredictable.
- Inside CSS, reuse a class from another file with `composes: name from "./other.module.css";` rather than copying its rules.
- `composes` must be in a top-level rule, never inside `@layer` or another nested rule (Turbopack fails to build). Put it in its own rule outside the layer, and the extra declarations in `@layer components`.

## Global CSS

- The app has one global stylesheet, `app/globals.css`, imported only in the root layout. It holds the layer order, the tokens, the reset and `body`. Don't add component styles there.
- Declare the layers first: `@layer reset, components;`. The reset goes in `@layer reset`.

## Classes

- Name classes in camelCase by what the element is (`header`, `headerFallback`, `status`), not how it looks (`flexRow`, `red`).
- Combine classes with a template string: ``className={`${styles.input} ${className}`}``.
- Every selector needs at least one local class. `:global(.dark) .icon` works; a selector with only `:global(...)` fails to build.
- Style children from a parent class when they all look the same, such as `.head th` or `.page > h2`, instead of a class on each child.
- Style states with selectors, not extra classes: `:focus-visible`, `:disabled`, `[aria-current="page"]`.

## Components that take className

- Wrap the component's styles in `@layer components { ... }`. Unlayered styles always beat layered ones, so the caller's class wins whatever order the CSS loads in.
- The caller's class is for placement only (width, flex, margin, alignment). It must not restyle the component; add a prop or variant instead (`variant`, `compact`, `icon`).

## Tokens

Use the variables from `globals.css` for every color, font size, line height, spacing step, radius and shadow. Write a literal only for one-off layout sizes such as a sidebar width.

- Colors: semantic names (`--surface`, `--muted`, `--danger`), not palette names (`--slate-500`).
- Write every color value as hex (`#0f172b`, or `#0000001a` with alpha). No `oklch()`, `rgb()`, `hsl()` or `color-mix()`; precompute a mix and write its hex.
- Type: `--text-*` with its matching `--leading-*`, always set together. For headings, hints and muted text, use the shared `Text` component (see the components skill) instead of writing these in a module.
- Spacing: `--space-N` is N × 0.25rem. For a value between steps, use `calc()` on a token, such as `calc(var(--space-1) * 1.5)`.
- Radius: `--radius-sm` for inputs and buttons, `--radius-md` for cards and tables, `--radius-lg` for large panels, `--radius-full` for pills.

When a new value is needed in more than one place, add a token to `:root` instead of repeating the literal.

## Dark mode

- Dark mode is a `.dark` class on `<html>` that sets `color-scheme: dark`.
- Define each color once with `light-dark(light, dark)` in `:root`. Don't write a second `.dark { ... }` list of colors.
- One-off colors in a module use `light-dark()` too.
- Use `:global(.dark) .myClass` only for things that aren't colors, like showing a different icon.

## Focus and hover

- Never remove the focus outline without a visible replacement. The reset gives every element a `:focus-visible` outline; a component may restyle it but must keep it clearly visible.
- Use `:focus-visible`, not `:focus`.
- Put `:hover` rules inside `@media (hover: hover)` so they don't stick on touch screens.

## Types

The `typescript-plugin-css-modules` plugin in `tsconfig.json` gives class-name autocomplete and typo warnings in the editor. VS Code must use the workspace TypeScript version for it to load.

## Checking

CSS order can differ between `next dev` and `next build`. After changing shared components or layers, run `next build` and check the result.

## Finding what exists

- Tokens live in `app/globals.css`; read its `:root` before choosing a color or size.
- Shared styled components (such as `Button`, `Text`, `Input`, `Field`, `Page`, `Table`) live in `_components/` folders, placed by the components skill. Look there before styling a raw element.
