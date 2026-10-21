# AGENTS.md

Notes for coding agents adding `<lm-presence>` to a project; people read [README.md](README.md). It is a custom element that shows who is here in one chip: faces and +N in a bubble, a line of names, a line of activity. One classic script, `presence.js` (v1.0.3), no dependencies, MIT; `presence.d.ts` adds global types.

## Install

- Any page: `<script src="https://cdn.jsdelivr.net/gh/Likemiens/presence@v1.0.3/presence.js" defer></script>`, then `<lm-presence>` anywhere. Unpinned and always latest: `https://likemiens.com/ui/presence/presence.js`.
- Bundler: `npm i github:Likemiens/presence`, then `import "@likemiens/presence";` once. It registers the tag and exports nothing; the types come with the import.

## Contract

| Attribute = property | Type | Default |
|---|---|---|
| `people` | `Person[]`, JSON in the attribute | `[]` |
| `count` | `number \| null`, never below `people.length` | `people.length` |
| `max` | `1`–`6`, bubbles including +N | `2` |
| `activity` | `string`, the second line | — |
| `label` | `string`, replaces the names | the names |
| `accent` | CSS colour, turns the ring on | — |
| `layout` | `"stacked" \| "inline"` | `"stacked"` |
| `online` `live` `interactive` `disabled` `loading` | boolean | off |
| `href` | URL, renders a link; wins over `interactive` | — |
| `state` | `"hover" \| "active" \| "focus"`, a held look for previews | — |
| `lang` | `ru` or `ru-*` gives Russian words, anything else English | nearest `[lang]` |

```ts
type Person = { id?: string; name: string; avatar?: string; color?: string };
```

- Event `lm-select`: `CustomEvent<{ people: Person[]; count: number }>`, bubbles, composed, cancelable. Fires on a click (mouse or keyboard), only with `interactive` or `href`, never while `disabled` or `loading`. `preventDefault()` stops the link.
- CSS: `--lm-presence-size` (56px, everything scales with it), `--lm-presence-accent`, `--lm-presence-ring`, `--lm-presence-more-bg`, `--lm-presence-more-color`, `--lm-presence-muted`, `--lm-presence-online`, `--lm-presence-focus`, `--lm-presence-label-width`.
- Parts: `control bubble ring face avatar more label status`.
- Faces: when everyone is listed and `count ≤ max`, all get faces; otherwise at most `max − 1` faces, then +N.

## Recipes

React 19, safe with server rendering:

```jsx
import { useEffect, useRef } from "react";

export function Presence({ people = [], onSelect, ...props }) {
  const ref = useRef(null);
  useEffect(() => { import("@likemiens/presence"); }, []); // browser only; registers <lm-presence> once
  useEffect(() => {
    const chip = ref.current;
    const select = (event) => onSelect?.(event.detail);
    chip.addEventListener("lm-select", select);
    return () => chip.removeEventListener("lm-select", select);
  }, [onSelect]);
  // a JSON string works before and after the element is defined
  return <lm-presence ref={ref} people={JSON.stringify(people)} {...props} />;
}
```

Vue 3: `isCustomElement: (tag) => tag.startsWith("lm-")` in the Vue compiler options, `import "@likemiens/presence"` in main.js before `mount()`, then `<lm-presence :people="people" :count="total" interactive @lm-select="open($event.detail)" />`.

Live updates from a socket:

```js
const chip = document.querySelector("lm-presence");
socket.addEventListener("message", (event) => {
  const room = JSON.parse(event.data); // { people: [{ id, name, avatar }], total }
  chip.people = room.people;           // a new array; faces with the same id stay put
  chip.count = room.total;             // same tick as people: one redraw
});
```

## Gotchas

- A classic script, not an ES module: no exports. It touches `window` as soon as it runs, so with SSR (Next.js, Nuxt) import it in the browser only.
- Until the script has run, frameworks can only set attributes, and an array becomes `"[object Object]"`: a console warning and no people. Import it before the first render, or pass `people` as a JSON string.
- In HTML, single quotes around the JSON: `people='[{"name": "@kai"}]'`. Invalid JSON gives an empty list and a console warning.
- Booleans: present means on, `"false"` means off.
- `count` never shows fewer than the people listed. For fewer faces, lower `max` or trim `people`.
- Faces are keyed by `id`, else `name`, else `avatar`. Without stable ids, a renamed person leaves and comes back.
- `live` is drawn on the ring: without `accent` (or a ring from CSS) it shows nothing.
- Whether there is a ring is decided when the chip renders: `--lm-presence-accent` or `--lm-presence-ring` added later by a class does not turn it on. Switch the ring at runtime with the `accent` attribute.
- `lang` is read from the nearest `[lang]` when the chip renders. To switch languages live, set `lang` on the element.
- On a dark page set `color-scheme: dark`, or the online green keeps its light-page shade.

## Don't

- Don't change `chip.people` in place (`push`, `splice`): nothing redraws. Assign a new array.
- Don't style inner classes or `--_*` variables: they are private. Use `--lm-presence-*` and `::part()`.
- Don't wrap the chip in `<button>` or `<a>`, and don't put click handlers on a plain chip: set `interactive` or `href`. Without them it is one image to screen readers, out of the tab order.
- Don't use `state` for real interactions; it only holds a look for screenshots.
- Don't load two copies expecting the newer to win: the first one to register `lm-presence` stays.
