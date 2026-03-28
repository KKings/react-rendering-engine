This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

# Placeholder System

The placeholder system lets shared UI packages define **ordered, named sequences of components** that brands can add to, remove from, reorder, or replace — without touching the shared package.

It composes with the slot/factory pattern: a placeholder manages *sequence*, a slot manages *what renders at a position*. Both can be used together or independently.

---

## Table of Contents

- [Core concepts](#core-concepts)
- [Item kinds](#item-kinds)
- [API reference](#api-reference)
- [Setting up a registry](#setting-up-a-registry)
- [Rendering](#rendering)
  - [Server placeholders](#server-placeholders)
  - [Client placeholders](#client-placeholders)
- [PlaceholderProvider](#placeholderProvider)
- [Factory integration](#factory-integration)
  - [ComponentFactory and FactoryProvider](#componentfactory-and-factoryprovider)
  - [Branch isolation](#branch-isolation)
  - [FactoryRendererContext](#factoryrenderercontext)
- [Configuring per page](#configuring-per-page)
- [Mutations reference](#mutations-reference)
- [Known issues and pitfalls](#known-issues-and-pitfalls)
- [Why the server/client split](#why-the-serverclient-split)
- [Decision guide](#decision-guide)

---

## Core concepts

| Concept | Description |
|---|---|
| **Placeholder** | A named, ordered list of items. Defined once in the shared package. |
| **Item** | A single entry in the list — a component, a slot reference, or a divider. |
| **Registry** | Holds all placeholder definitions. Produced by `PlaceholderRegistryBuilder`. |
| **Branch** | A per-request isolated copy of the registry. Mutations apply to the branch, never to the shared singleton. |
| **Mutation** | An operation (append, remove, replace, hide, etc.) applied to a branch's item sequence. |
| **Factory** | Resolves which component renders for a named slot — default or brand override. |
| **Factory branch** | An isolated factory instance with its own empty override registry. Overrides on a branch never affect the parent factory or other branches. |

---

## Item kinds

### `"component"` — direct component

Renders a specific component with fixed props. The component can be eager (always bundled) or lazy (code-split on demand).

```ts
{
  kind: "component",
  id: "product-image",        // unique within the placeholder
  visible: true,
  component: () => import("./ProductImage"),   // lazy — excluded from shared bundle
  props: { url: "...", width: 300, height: 150 },
}
```

> **Server only.** `ComponentItem` carries a function (the lazy thunk). Functions cannot cross the server/client boundary. Use `ComponentItem` only in server placeholders rendered by `PlaceholderRendererServer`. See [Known issues](#known-issues-and-pitfalls).

### `"slot"` — factory slot reference

Delegates rendering to the factory. The factory resolves the brand override or the default at render time, and owns lazy loading and Suspense.

```ts
{
  kind: "slot",
  id: "add-to-cart",
  visible: true,
  slotName: "add-to-cart",     // must match a slot name in the factory contract
  props: { productId: "123", price: 99.99, initialStock: 5 },
}
```

Slot items are serialisable — they can be passed from a Server Component to a Client Component safely.

### `"divider"` — structural separator

No component, no props. Renders an `<hr>` by default or a custom `dividerComponent` if provided.

```ts
{
  kind: "divider",
  id: "primary-secondary-divider",
  visible: true,
}
```

Dividers are serialisable.

---

## API reference

### `PlaceholderBuilder`

Fluent builder for a single placeholder's default item sequence.

```ts
new PlaceholderBuilder("placeholder-name")
  .description("Human-readable description for documentation")
  .component<Props>("item-id", componentOrThunk, props)
  .slot<Props>("item-id", "factory-slot-name", props)
  .divider("item-id")
  .build()
```

### `PlaceholderRegistryBuilder`

Assembles placeholders into a sealed registry.

```ts
const registry = new PlaceholderRegistryBuilder()
  .add(new PlaceholderBuilder("name")...)
  .build();
```

### `PlaceholderRegistry`

The sealed object returned by `.build()`.

| Method | Description |
|---|---|
| `branch()` | Returns an isolated copy. Use in page components before calling `configure()` — never mutate the shared singleton directly. |
| `configure(name, mutations[])` | Applies mutations to the working copy. Each placeholder's mutations are applied independently — a failure in one does not abort others. |
| `resolve(name)` | Returns the current ordered, visible item list. |
| `definitions` | Read-only snapshot of all registered placeholder definitions. |

### `PlaceholderProvider`

Server Component. Creates a per-request registry branch and stores `registry`, `serverFactory`, and `ClientRenderer` in `React.cache` so descendant renderers need no props.

All three factory-related props are required:

```tsx
<PlaceholderProvider
  registry={placeholderRegistry}
  serverFactory={serverFactory}
  ClientRenderer={PlaceholderRenderer}
  configure={{ ... }}           // optional — mutations applied to the branch
  clientPlaceholders={[...]}    // optional — names pre-resolved for client context
>
  {children}
</PlaceholderProvider>
```

### `PlaceholderRendererServer`

Async Server Component. Renders all item kinds server-side. All props are optional when used inside a `PlaceholderProvider` — reads `registry`, `serverFactory`, and `ClientRenderer` from `React.cache`.

```tsx
{/* Inside PlaceholderProvider — only placeholderName needed */}
<PlaceholderRendererServer placeholderName="product-main" />

{/* Without PlaceholderProvider — all props required */}
<PlaceholderRendererServer
  placeholderName="product-main"
  registry={pageRegistry}
  serverFactory={serverFactory}
  ClientRenderer={PlaceholderRenderer}
/>
```

> **Critical:** `PlaceholderRendererServer` is an async Server Component. It must **never** be placed inside a `"use client"` component. A client boundary prevents Server Components from functioning as RSC inside that subtree. See [Known issues](#known-issues-and-pitfalls).

### `PlaceholderRenderer`

`"use client"` component produced by `createPlaceholderRenderer(factory)`. Renders `SlotItem` and `DividerItem` kinds. Does not accept `ComponentItem` — pass serialisable items only.

The renderer reads from `FactoryRendererContext` when available (set by `FactoryProvider`), falling back to the factory it was created with. This allows `ComponentFactory` branch overrides to apply within their subtree without affecting other render sites.

```tsx
// Application layer — bind once to clientFactory
// packages/ui/components/PlaceholderRenderer.tsx
"use client";
import { createPlaceholderRenderer } from "@/packages/placeholder";
import { clientFactory } from "@/packages/ui/client-factory";

export const PlaceholderRenderer = createPlaceholderRenderer(clientFactory);
```

### `ComponentFactory`

`"use client"` component. Registers brand slot overrides on a **factory branch** and provides it via `FactoryRendererContext` so `PlaceholderRenderer` instances inside its subtree use the override.

Uses `clientFactory.branch()` rather than the singleton directly — overrides are scoped to the wrapped subtree and never affect other render sites.

```tsx
// components/ComponentFactory.tsx
"use client";
import { clientFactory } from "@/packages/ui/client-factory";
import { FactoryProvider } from "@/packages/factory/components/FactoryProvider";

export default function ComponentFactory({ children }) {
  const branch = clientFactory.branch();
  return (
    <FactoryProvider
      factory={branch}
      overrides={{
        "add-to-cart": () => import("./client/AddToCart"),
      }}
    >
      {children}
    </FactoryProvider>
  );
}
```

### `filterSerializableItems(items)`

Strips `ComponentItem` entries (which carry functions) from an item list, leaving only `SlotItem` and `DividerItem`. Use before passing items from a Server Component to a Client Component.

---

## Setting up a registry

Define the registry once in the shared UI package. This file has no `"use client"` directive — it is a server module.

```ts
// packages/ui/placeholder-registry.ts
import { PlaceholderBuilder, PlaceholderRegistryBuilder } from "@/packages/placeholder";
import type { AddToCartProps } from "./client/AddToCart/types";

export const placeholderRegistry = new PlaceholderRegistryBuilder()

  .add(
    new PlaceholderBuilder("product:main")
      .description("Main content area of the product detail page")
      // ComponentItem — server-rendered, lazy thunk resolved by PlaceholderRendererServer
      .component(
        "product-image",
        () => import("./server/ProductImage"),
        {}
      )
      // SlotItem — factory resolves which component renders here
      .slot("product-description", "product-description", {})
  )

  .add(
    new PlaceholderBuilder("product:sidebar")
      .description("Sidebar action area on the product detail page")
      // SlotItem — serialisable, factory resolves the component
      .slot<AddToCartProps>(
        "add-to-cart",
        "add-to-cart",
        { productId: "", price: 0, initialStock: 0 }
      )
      .divider("sidebar-divider")
  )

  .build();
```

> **The registry is a module singleton.** Never call `configure()` on it directly from a page component. Always use `PlaceholderProvider`'s `configure` prop, or call `branch()` and configure the branch. See [Known issues](#known-issues-and-pitfalls).

---

## Rendering

### Server placeholders

Use `PlaceholderRendererServer` for placeholders that contain `ComponentItem` entries, server slots, or a mix. It is an async Server Component that handles all item kinds correctly.

```tsx
// app/products/[id]/page.tsx
import { PlaceholderProvider } from "@/packages/placeholder/components/PlaceholderProvider";
import { PlaceholderRendererServer } from "@/packages/placeholder/components/PlaceholderRendererServer";
import { PlaceholderRenderer } from "@/packages/ui/components/PlaceholderRenderer";
import { placeholderRegistry } from "@/packages/ui/placeholder-registry";
import { serverFactory } from "@/packages/ui/server-factory";

export default async function ProductPage({ params }) {
  const { id } = await params;

  return (
    <PlaceholderProvider
      registry={placeholderRegistry}
      serverFactory={serverFactory}
      ClientRenderer={PlaceholderRenderer}
      configure={{
        "product:main": [
          {
            op: "replace",
            id: "product-description",
            item: {
              kind: "component",
              id: "product-description",
              component: () => import("@/components/server/BrandProductDescription"),
              props: {},
              visible: true,
            },
          },
        ],
      }}
    >
      <PlaceholderRendererServer placeholderName="product:main" />
    </PlaceholderProvider>
  );
}
```

Item routing inside `PlaceholderRendererServer`:

- `"component"` → awaits the lazy thunk server-side, renders the RSC in the tree
- `"slot"` in `serverFactory` → resolved via `serverFactory.resolveServer()`
- `"slot"` not in `serverFactory` → passed to `ClientRenderer` for client-side rendering
- `"divider"` → passed to `ClientRenderer` or renders a default `<hr>`

### Client placeholders

`PlaceholderRendererServer` handles client slots automatically — it passes them to `ClientRenderer` without any manual filtering needed. You do not need a separate `PlaceholderRenderer` call for most cases.

If you need `PlaceholderRenderer` directly from inside a `"use client"` component, filter first:

```tsx
"use client";
import { usePlaceholderItems, usePlaceholderRenderer } from
  "@/packages/placeholder/components/PlaceholderClientProvider";

export function SidebarClient() {
  // Reads from PlaceholderClientProvider context — no props needed
  const PlaceholderRenderer = usePlaceholderRenderer();
  const items = usePlaceholderItems("product:sidebar");
  return <PlaceholderRenderer items={items} />;
}
```

---

## PlaceholderProvider

`PlaceholderProvider` wires the entire placeholder system for a page or layout in one place. It:

1. Creates a per-request registry branch — mutations are isolated, the singleton is never touched
2. Stores `registry`, `serverFactory`, and `ClientRenderer` in `React.cache` — descendants need no props
3. Pre-resolves client placeholder items and stores them in React context via `PlaceholderClientProvider`

```tsx
<PlaceholderProvider
  registry={placeholderRegistry}
  serverFactory={serverFactory}
  ClientRenderer={PlaceholderRenderer}
  configure={{
    "product:sidebar": [
      { op: "append", item: { kind: "divider", id: "brand-divider", visible: true } },
    ],
  }}
  clientPlaceholders={["product:sidebar"]}
>
  {children}
</PlaceholderProvider>
```

All three factory props are required — `PlaceholderProvider` has no static imports of application-specific factories, making it reusable as a library component across projects.

### Provider setup checklist

- Place `PlaceholderProvider` in a Server Component (page, layout, or async RSC) — `React.cache` only works server-side
- Pass `registry`, `serverFactory`, and `ClientRenderer` — all required
- Pass `configure` for page-level mutations — applied to the branch before any child renders
- List placeholder names in `clientPlaceholders` only if client components need to read them via `usePlaceholderItems()`
- Do not nest `PlaceholderProvider` inside a `"use client"` component

---

## Factory integration

### ComponentFactory and FactoryProvider

`ComponentFactory` is a `"use client"` wrapper that registers brand overrides for client slots. It uses `clientFactory.branch()` to create an isolated factory instance, then passes it to `FactoryProvider`. This scopes the overrides to the wrapped subtree.

`FactoryProvider` does two things:

1. Calls `factory.register(slot, thunk, "async")` for each override before children render
2. Sets `FactoryRendererContext` so `PlaceholderRenderer` instances inside the subtree use the branch

**Important:** `ComponentFactory` must not be a parent of `PlaceholderRendererServer`. Server Components cannot function inside a client boundary. See [Known issues](#known-issues-and-pitfalls).

### Branch isolation

`clientFactory.branch()` creates an isolated factory that shares the slot contract (definitions) but has its own empty override registry and lazy cache. This is the mechanism that allows one part of the page to use a brand override while another uses the default:

```
clientFactory (singleton, no overrides)
  └── .branch() → branch (empty registry)
        └── branch.register("add-to-cart", BrandOverride)
              → branch renders BrandOverride
              → clientFactory still renders default (unaffected)
```

Without `branch()`, registering an override on `clientFactory` directly would affect every `PlaceholderRenderer` in the app, including those that should use the default.

### FactoryRendererContext

`PlaceholderRenderer` reads from `FactoryRendererContext` when rendering slot items. `FactoryProvider` sets this context to the branch factory. This is what connects `ComponentFactory`'s override to the `ClientRenderer` that `PlaceholderRendererServer` delegates client slots to.

When a slot item is rendered:
- **Inside `ComponentFactory`** → `FactoryRendererContext` has the branch → branch override used
- **Outside `ComponentFactory`** → no `FactoryRendererContext` → base `clientFactory` used → default rendered

---

## Configuring per page

Brands add page-specific mutations via `PlaceholderProvider`'s `configure` prop:

```tsx
<PlaceholderProvider
  registry={placeholderRegistry}
  serverFactory={serverFactory}
  ClientRenderer={PlaceholderRenderer}
  configure={{
    "product:sidebar": [
      {
        op: "append",
        item: {
          kind: "component",
          id: "loyalty-points",
          component: () => import("@/components/server/LoyaltyPoints"),
          props: { productId: id },
          visible: true,
        },
      },
    ],
  }}
>
  {children}
</PlaceholderProvider>
```

When mutations depend on runtime data, create a branch explicitly and pass it as the `registry` prop:

```tsx
// Via branch() — useful when mutations depend on fetched data
export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await fetchProduct(id);

  const pageRegistry = placeholderRegistry.branch();

  if (product.isSale) {
    pageRegistry.configure("product:main", [
      {
        op: "prepend",
        item: {
          kind: "component",
          id: "sale-banner",
          component: () => import("./SaleBanner"),
          props: { discount: product.discount },
          visible: true,
        },
      },
    ]);
  }

  return (
    <PlaceholderProvider
      registry={pageRegistry}
      serverFactory={serverFactory}
      ClientRenderer={PlaceholderRenderer}
    >
      <PlaceholderRendererServer placeholderName="product:main" />
    </PlaceholderProvider>
  );
}
```

---

## Mutations reference

All mutations target items by `id`, not by index. This ensures mutations remain correct if the shared package reorders its default sequence.

| Operation | Description | Required fields |
|---|---|---|
| `append` | Add an item at the end | `item` |
| `prepend` | Add an item at the start | `item` |
| `insertAfter` | Add an item after a named item | `afterId`, `item` |
| `insertBefore` | Add an item before a named item | `beforeId`, `item` |
| `replace` | Swap a named item in-place | `id`, `item` |
| `remove` | Permanently remove a named item | `id` |
| `hide` | Make a named item invisible (preserves position) | `id` |
| `show` | Make a hidden item visible again | `id` |

```ts
pageRegistry.configure("product:sidebar", [
  // Add brand component after the add-to-cart slot
  { op: "insertAfter", afterId: "add-to-cart", item: { kind: "component", id: "loyalty-badge", ... } },

  // Hide the default divider without removing it
  { op: "hide", id: "sidebar-divider" },

  // Replace the default description with a brand version
  { op: "replace", id: "product-description", item: { kind: "component", id: "product-description", ... } },
]);
```

> Mutations are applied in order. Each operation sees the result of all previous operations in the same `configure()` call. Each placeholder's mutations are independent — a failure in one placeholder does not abort mutations for others.

---

## Known issues and pitfalls

### 1. Never call `configure()` on the shared singleton from a page

```ts
// ✗ WRONG — module scope, runs once, mutates the shared singleton
const registry = placeholderRegistry.configure("product:sidebar", [...]);

// ✗ WRONG — inside the component but still mutates the shared singleton
export default function Page() {
  placeholderRegistry.configure("product:sidebar", [...]);
}
```

Both cause the same problem: on the second prerender pass (Next.js prerenders each static param separately), appending `product-image` again hits the duplicate id guard because the first pass already mutated the singleton. In production with concurrent requests, mutations bleed across users.

```ts
// ✓ CORRECT — use PlaceholderProvider's configure prop (branches internally)
<PlaceholderProvider configure={{ "product:sidebar": [...] }}>

// ✓ CORRECT — branch() gives an isolated copy, original untouched
const pageRegistry = placeholderRegistry.branch();
pageRegistry.configure("product:sidebar", [...]);
```

### 2. `replace` target id must exist in the placeholder definition

`replace` targets an item by `id`. If the id does not exist in the current item list, the mutation throws and **all subsequent mutations in the same `configure()` call are skipped**. This is the most common cause of partial placeholder rendering.

```ts
// ✗ WRONG — "product-description" does not exist in product:sidebar
placeholderRegistry.configure("product:sidebar", [
  { op: "append", item: { id: "loyalty-badge", ... } },   // succeeds
  { op: "replace", id: "product-description", item: ... }, // throws — wrong placeholder
  // loyalty-badge is now in the list but that is the only item
]);

// ✓ CORRECT — ensure the id exists in the PlaceholderBuilder for that placeholder
// If "product-description" is in "product:main", configure "product:main" instead
```

Check your `PlaceholderBuilder` definition when a `replace` mutation appears to be ignored — the item id in the mutation must match an id added via `.component()`, `.slot()`, or `.divider()` in that placeholder's builder.

### 3. `PlaceholderRendererServer` must not be inside a `"use client"` parent

`PlaceholderRendererServer` is an async Server Component. Nesting it inside a `"use client"` component makes it unreachable as an RSC — the client boundary prevents Server Components from functioning as RSC inside that subtree.

```tsx
// ✗ WRONG — ComponentFactory is "use client", PlaceholderRendererServer
//           cannot function as an RSC inside it
<ComponentFactory>
  <PlaceholderRendererServer placeholderName="product:sidebar" />
</ComponentFactory>

// ✓ CORRECT — PlaceholderRendererServer stays in the server tree
<PlaceholderRendererServer placeholderName="product:sidebar" />
// ComponentFactory is used separately for its FactoryRendererContext,
// not as a parent of the server renderer
```

### 4. Do not pass `ComponentItem` to `PlaceholderRenderer`

`PlaceholderRenderer` is `"use client"`. `ComponentItem` contains a function (the lazy thunk). Functions cannot be serialised across the server/client boundary.

```tsx
// ✗ WRONG — ComponentItem contains a function, will throw at runtime
const items = placeholderRegistry.resolve("product:main");
<PlaceholderRenderer items={items} />

// ✓ CORRECT — PlaceholderRendererServer handles ComponentItems server-side
<PlaceholderRendererServer placeholderName="product:main" />
```

### 5. Do not use the `use` prefix for server utility functions

`React.cache` is not a hook. Functions that call `React.cache` must not start with `use` — the React linting rules treat any function starting with `use` as a hook and will error when called from an async function.

```ts
// ✗ WRONG — linter throws "React Hook cannot be called in an async function"
export function usePlaceholderRegistry() { ... }

// ✓ CORRECT — plain function name, no hook semantics
export function getPlaceholderRegistry() { ... }
```

### 6. `register()` warning during SSR is a known false positive

`FactoryProvider` is `"use client"` but React evaluates client components on the server during SSR. This means `factory.register()` runs server-side (where `window === undefined`), triggering a warning intended to catch genuinely problematic server-module registration.

If the warning fires during SSR of `FactoryProvider`, it is a **false positive**. The override thunk is written inside a `"use client"` module and is a genuine lazy split point — the bundle output will be correct. You can verify by checking that only the override (not the default) appears in the JS bundle for that slot.

The warning fires at module-scope RSC evaluation — the genuinely problematic case. If you see it fire consistently and your bundle contains both default and override, the thunk has been written in a server module and needs to be moved to a `"use client"` file.

### 7. Item ids must be unique within a placeholder

Duplicate ids throw at `configure()` time. Use `replace` to swap an existing item — not `remove` followed by `append` with the same id.

```ts
// ✗ WRONG — remove + append with same id throws on the append
{ op: "remove", id: "loyalty-badge" },
{ op: "append", item: { id: "loyalty-badge", ... } },

// ✓ CORRECT — replace operates on the existing position
{ op: "replace", id: "loyalty-badge", item: { id: "loyalty-badge", ... } },
```

### 8. `PlaceholderProvider` must be a Server Component

`React.cache` only works server-side. Placing `PlaceholderProvider` inside a `"use client"` component means `React.cache` has no request scope and `getPlaceholderRegistry()` will throw for all descendants.

```tsx
// ✗ WRONG
"use client";
export function Layout({ children }) {
  return <PlaceholderProvider registry={...} serverFactory={...} ClientRenderer={...}>{children}</PlaceholderProvider>;
}

// ✓ CORRECT — no "use client" directive
export function Layout({ children }) {
  return <PlaceholderProvider registry={...} serverFactory={...} ClientRenderer={...}>{children}</PlaceholderProvider>;
}
```

### 9. Do not register client slot overrides from server modules

Any `() => import("...")` thunk written in a server module is statically analysed by Turbopack/Webpack at build time, resolving it as a client reference and bundling it eagerly alongside the default — both end up in the same chunk.

Thunks for client slot overrides must be written inside `"use client"` modules:

```ts
// ✗ WRONG — thunk in server module, both default and override bundled together
// packages/ui/some-server-file.ts  (no "use client")
factory.register("add-to-cart", () => import("./BrandAddToCart"), "async");

// ✓ CORRECT — thunk in client module, genuine lazy split point
// components/ComponentFactory.tsx  ("use client")
const branch = clientFactory.branch();
branch.register("add-to-cart", () => import("./client/AddToCart"), "async");
```

---

## Why the server/client split

React's App Router enforces a hard boundary between Server Components and Client Components with specific serialisation rules that directly affect how placeholders work.

### What can cross the boundary

When a Server Component passes props to a `"use client"` component, those props are serialised into the RSC payload. Only certain value types survive this:

| Type | Can cross? |
|---|---|
| Strings, numbers, booleans, null | ✓ |
| Plain objects and arrays of the above | ✓ |
| `SlotItem` (id, slotName, props, visible) | ✓ |
| `DividerItem` (id, visible) | ✓ |
| Functions (including lazy thunks) | ✗ |
| `ComponentItem` (contains a function) | ✗ |
| React context values | ✗ |
| Factory or registry instances | ✗ |

### Why `ComponentItem` is server-only

A `ComponentItem` carries a `component` field that is either a `ComponentType` or a `() => Promise<{default: ComponentType}>` thunk — both are functions. Functions cannot be serialised. `PlaceholderRendererServer` resolves this by awaiting the thunk before the boundary. The resolved JSX becomes part of the RSC tree and streams to the client as rendered HTML.

### Why React context does not work across the boundary

Context set by a Server Component is not readable by Client Components. `PlaceholderProvider` solves this with two mechanisms:

- **Server side** — `React.cache` scopes the branch to the current render pass. Server Component descendants call `getPlaceholderRegistry()`, `getPlaceholderServerFactory()`, and `getPlaceholderClientRenderer()` to read the values without prop drilling.
- **Client side** — `PlaceholderClientProvider` receives pre-resolved serialisable items as props and stores them in React context. Client Component descendants call `usePlaceholderItems()` and `usePlaceholderRenderer()` to read them.

The registry, factory, and renderer instances never cross the boundary — only the resolved `SlotItem[]` and `DividerItem[]` arrays do, since those are plain serialisable data.

---

## Decision guide

**Use `PlaceholderRendererServer` when:**
- The placeholder contains `ComponentItem` entries (server components with lazy thunks)
- The placeholder contains server factory slots
- You want one renderer to handle mixed item kinds automatically
- Always the correct default choice — handles all item kinds

**Use `PlaceholderRenderer` directly when:**
- You are inside a `"use client"` component reading from `usePlaceholderItems()`
- Always pair with `filterSerializableItems()` if items come from outside the provider context

**Use `PlaceholderProvider` when:**
- Multiple placeholders are rendered across a page tree
- You want to avoid passing `registry`, `serverFactory`, and `ClientRenderer` to every renderer
- You have client components that need to read placeholder items via `usePlaceholderItems()`

**Use `branch()` on the registry directly when:**
- Mutations depend on runtime data (fetched product, user session, feature flags)
- You need to pass the mutated registry explicitly to a single renderer

**Use `ComponentFactory` when:**
- A client slot needs a brand override that should apply within a specific subtree only
- The override must not affect other placements of the same slot on the page
- Always ensure `PlaceholderRendererServer` is outside the `ComponentFactory` wrapper