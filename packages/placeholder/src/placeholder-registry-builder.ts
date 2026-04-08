import type {
  PlaceholderDefinition,
  PlaceholderItem,
  PlaceholderMutation,
  PlaceholderRegistry,
} from "./types";
import { PlaceholderBuilder } from "./placeholder-builder";

// ─── Mutation engine ──────────────────────────────────────────────────────────

function applyMutations(
  items: ReadonlyArray<PlaceholderItem>,
  mutations: PlaceholderMutation[],
  placeholderName: string
): PlaceholderItem[] {
  let result = [...items];

  for (const mutation of mutations) {
    switch (mutation.op) {

      case "append": {
        _assertUniqueId(result, mutation.item.id, placeholderName, "append");
        result = [...result, mutation.item];
        break;
      }

      case "prepend": {
        _assertUniqueId(result, mutation.item.id, placeholderName, "prepend");
        result = [mutation.item, ...result];
        break;
      }

      case "insertAfter": {
        const idx = _requireIndex(result, mutation.afterId, placeholderName, "insertAfter");
        _assertUniqueId(result, mutation.item.id, placeholderName, "insertAfter");
        result = [
          ...result.slice(0, idx + 1),
          mutation.item,
          ...result.slice(idx + 1),
        ];
        break;
      }

      case "insertBefore": {
        const idx = _requireIndex(result, mutation.beforeId, placeholderName, "insertBefore");
        _assertUniqueId(result, mutation.item.id, placeholderName, "insertBefore");
        result = [
          ...result.slice(0, idx),
          mutation.item,
          ...result.slice(idx),
        ];
        break;
      }

      case "remove": {
        _requireIndex(result, mutation.id, placeholderName, "remove");
        result = result.filter((item) => item.id !== mutation.id);
        break;
      }

      case "hide": {
        _requireIndex(result, mutation.id, placeholderName, "hide");
        result = result.map((item) =>
          item.id === mutation.id ? { ...item, visible: false } : item
        );
        break;
      }

      case "show": {
        _requireIndex(result, mutation.id, placeholderName, "show");
        result = result.map((item) =>
          item.id === mutation.id ? { ...item, visible: true } : item
        );
        break;
      }

      case "replace": {
        const idx = _requireIndex(result, mutation.id, placeholderName, "replace");
        result = [
          ...result.slice(0, idx),
          mutation.item,
          ...result.slice(idx + 1),
        ];
        break;
      }
    }
  }

  return result;
}

function _requireIndex(
  items: PlaceholderItem[],
  id: string,
  placeholderName: string,
  op: string
): number {
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) {
    throw new Error(
      `PlaceholderRegistry.configure("${placeholderName}"): ` +
      `operation "${op}" references unknown item id "${id}". ` +
      `Known ids: [${items.map((i) => i.id).join(", ")}]`
    );
  }
  return idx;
}

function _assertUniqueId(
  items: PlaceholderItem[],
  id: string,
  placeholderName: string,
  op: string
): void {
  if (items.some((item) => item.id === id)) {
    throw new Error(
      `PlaceholderRegistry.configure("${placeholderName}"): ` +
      `operation "${op}" failed — item id "${id}" already exists in the placeholder.\n` +
      `Existing item ids: [${items.map((i) => i.id).join(", ")}]\n` +
      `Solutions:\n` +
      `  - Use "replace" to swap an existing item: { op: "replace", id: "${id}", item: { ... } }\n` +
      `  - Use a different id for the new item\n` +
      `  - Use "hide" to hide the existing item first, then "append" a new one with a different id`
    );
  }
}

// ─── Registry factory ─────────────────────────────────────────────────────────

/**
 * Constructs a PlaceholderRegistry from a frozen definitions map and a
 * mutable working copies map. Extracted so both build() and branch() can
 * produce registries without duplicating logic.
 */
function buildRegistry(
  definitions: ReadonlyMap<string, PlaceholderDefinition>,
  workingCopies: Map<string, PlaceholderItem[]>
): PlaceholderRegistry {
  function configure(
    placeholderName: string,
    mutations: PlaceholderMutation[]
  ): PlaceholderRegistry {
    const current = workingCopies.get(placeholderName);
    if (!current) {
      throw new Error(
        `PlaceholderRegistry.configure: unknown placeholder "${placeholderName}". ` +
        `Known placeholders: [${[...definitions.keys()].join(", ")}]`
      );
    }
    workingCopies.set(placeholderName, applyMutations(current, mutations, placeholderName));
    return registry;
  }

  function branch(): PlaceholderRegistry {
    // Deep-copy the working copies so mutations on the branch never affect
    // the original registry or any sibling branch. The definitions map is
    // shared (it is read-only) — only the mutable working copies are cloned.
    const branchedCopies = new Map<string, PlaceholderItem[]>(
      [...workingCopies.entries()].map(([name, items]) => [name, [...items]])
    );
    return buildRegistry(definitions, branchedCopies);
  }

  function resolve(placeholderName: string): ReadonlyArray<PlaceholderItem> {
    const items = workingCopies.get(placeholderName);
    if (!items) {
      return [];
    }
    return items.filter((item) => item.visible);
  }

  const registry: PlaceholderRegistry = {
    configure,
    branch,
    resolve,
    get definitions() {
      return definitions;
    },
  };

  return registry;
}

// ─── PlaceholderRegistryBuilder ───────────────────────────────────────────────

export class PlaceholderRegistryBuilder {
  private _placeholders = new Map<string, PlaceholderDefinition>();

  add(builderOrDefinition: PlaceholderBuilder | PlaceholderDefinition): this {
    const definition =
      builderOrDefinition instanceof PlaceholderBuilder
        ? builderOrDefinition.build()
        : builderOrDefinition;

    if (this._placeholders.has(definition.name)) {
      throw new Error(
        `PlaceholderRegistryBuilder: duplicate placeholder name "${definition.name}".`
      );
    }

    this._placeholders.set(definition.name, definition);
    return this;
  }

  build(): PlaceholderRegistry {
    const definitions = new Map(this._placeholders) as ReadonlyMap<string, PlaceholderDefinition>;

    // Working copies start as shallow copies of each definition's item list.
    // These are the arrays that configure() mutates.
    const workingCopies = new Map<string, PlaceholderItem[]>(
      [...definitions.entries()].map(([name, def]) => [name, [...def.items]])
    );

    return buildRegistry(definitions, workingCopies);
  }
}