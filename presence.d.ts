/**
 * Types for <lm-presence> 1.0.3 — https://likemiens.com/ui/presence/
 * Keep this file anywhere your tsconfig includes; it only adds global types for the element that
 * presence.js registers.
 */

interface LmPresencePerson {
  /** Keeps a face in place while the list changes. The name by default. */
  id?: string;
  /** Shown as is: "@walentina", "Anna Petrova". */
  name: string;
  /** Image URL. Initials on a tinted circle while it loads or if it fails. */
  avatar?: string;
  /** Background behind the initials. Picked from the name by default. */
  color?: string;
}

interface LmPresenceSelectDetail {
  people: LmPresencePerson[];
  count: number;
}

interface LmPresenceElement extends HTMLElement {
  /** Who is there, in order; the first get faces. Takes an array or JSON. */
  get people(): LmPresencePerson[];
  set people(value: LmPresencePerson[] | string);
  /** The head count shown, never below people.length. null: as many as people. */
  get count(): number;
  set count(value: number | null);
  /** Bubbles in the stack, +N included (1–6, default 2). */
  max: number;
  /** The second line: what they are doing. */
  activity: string | null;
  /** Replaces the line of names. */
  label: string | null;
  /** Any CSS colour: turns the ring on and tints it. */
  accent: string | null;
  /** Renders a link; lm-select fires first and can cancel the navigation. */
  href: string | null;
  layout: "stacked" | "inline" | null;
  /** Holds the look of an interaction, for previews and screenshots. */
  state: "hover" | "active" | "focus" | null;
  online: boolean;
  live: boolean;
  /** Renders a button and fires lm-select on click, Enter and Space. */
  interactive: boolean;
  disabled: boolean;
  loading: boolean;
}

interface LmPresenceConstructor {
  new (): LmPresenceElement;
  readonly prototype: LmPresenceElement;
  /** The version of presence.js on the page, "1.0.3". */
  readonly version: string;
}

interface CustomElementRegistry {
  get(name: "lm-presence"): LmPresenceConstructor | undefined;
}

interface HTMLElementTagNameMap {
  "lm-presence": LmPresenceElement;
}

interface HTMLElementEventMap {
  /** From <lm-presence interactive> or <lm-presence href>. Bubbles, composed, cancelable. */
  "lm-select": CustomEvent<LmPresenceSelectDetail>;
}
