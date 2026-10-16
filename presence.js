/*!
 * <lm-presence> 1.0.3
 * Faces, a head count and what people are doing, in one chip.
 * Contract and playground: https://likemiens.com/ui/presence/
 * MIT License © Likemiens
 */
(() => {
  "use strict";
  if (!window.customElements || customElements.get("lm-presence")) return;

  // Values the element animates itself; registered, they interpolate instead of jumping.
  for (const [name, syntax, initialValue, inherits] of [
    ["--_lm-spread", "<number>", "0", true],
    ["--_lm-hole", "<length>", "0px", false],
    ["--_lm-turn", "<angle>", "0deg", false],
  ]) {
    try {
      CSS.registerProperty({ name, syntax, initialValue, inherits });
    } catch {}
  }

  const VERSION = "1.0.3";
  const POP = "cubic-bezier(.34, 1.45, .64, 1)";
  const AWAY = "cubic-bezier(.4, 0, 1, 1)";
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const WORDS = {
    en: {
      and: " & ",
      others: (n, count) => ` +${n} ${count === 1 ? "other" : "others"}`,
      people: (n, count) => `${n} ${count === 1 ? "person" : "people"}`,
      empty: "No one yet",
      online: "online",
      loading: "Loading",
    },
    ru: {
      and: " и ",
      others: (n) => ` и ещё ${n}`,
      people: (n, count) =>
        `${n} ${{ one: "человек", few: "человека", many: "человек" }[new Intl.PluralRules("ru").select(count)] ?? "человека"}`,
      empty: "Пока никого",
      online: "в сети",
      loading: "Загрузка",
    },
  };

  // 1234 → 1.2K, 56789 → 57K: the bubble has room for four or five characters.
  const compact = (n) =>
    n < 1000 ? String(n) : new Intl.NumberFormat("en", { notation: "compact", maximumSignificantDigits: 2 }).format(n);

  const initials = (name) => {
    const words = String(name).replace(/^@/, "").split(/[\s._-]+/).filter(Boolean);
    const first = (word) => (word ? Array.from(word)[0] : "");
    return (first(words[0]) + (words.length > 1 ? first(words.at(-1)) : "")).toUpperCase();
  };

  const hue = (name) => {
    let h = 7;
    for (const char of String(name)) h = (h * 31 + char.codePointAt(0)) % 360;
    return h;
  };

  const toPeople = (list) =>
    (Array.isArray(list) ? list : []).map((p) => (typeof p === "string" ? { name: p } : p)).filter((p) => p && typeof p === "object");

  const toCount = (value) => (value == null || value === "" || !Number.isFinite(+value) ? null : Math.max(0, Math.floor(+value)));

  // Names are shortened by measure, so "…" sits right against the next word instead of after a gap.
  const pen = document.createElement("canvas").getContext("2d");
  const clip = (text, room) => {
    if (pen.measureText(text).width <= room) return text;
    const chars = Array.from(text);
    let low = 0;
    let high = chars.length;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (pen.measureText(`${chars.slice(0, mid).join("")}…`).width <= room) low = mid;
      else high = mid - 1;
    }
    return `${chars.slice(0, low).join("").trimEnd()}…`;
  };

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };

  const enter = (face) =>
    face.animate(
      calm()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, scale: 0.4, filter: "blur(6px)" },
            { opacity: 1, scale: 1, filter: "blur(0)" },
          ],
      { duration: calm() ? 200 : 520, easing: calm() ? "ease-out" : POP },
    );

  const leave = (face) => {
    face.classList.remove("covered");
    face.classList.add("gone");
    face
      .animate([{ opacity: 1 }, calm() ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(4px)" }], {
        duration: 240,
        easing: AWAY,
        fill: "forwards",
      })
      .finished.then(
        () => face.remove(),
        () => face.remove(),
      );
  };

  // The old number leaves the way the count went, the new one comes in behind it.
  const roll = (bubble, current, text, up) => {
    const next = node("span", "num", text);
    bubble.append(next);
    current.classList.add("out");
    if (calm()) return current.remove();
    const shift = up ? 0.8 : -0.8;
    current
      .animate([{ translate: "0 0" }, { translate: `0 ${-shift}em`, opacity: 0, filter: "blur(2px)" }], {
        duration: 260,
        easing: AWAY,
        fill: "forwards",
      })
      .finished.then(
        () => current.remove(),
        () => current.remove(),
      );
    next.animate(
      [
        { translate: `0 ${shift}em`, opacity: 0, filter: "blur(2px)" },
        { translate: "0 0", opacity: 1, filter: "blur(0)" },
      ],
      { duration: 460, easing: POP },
    );
  };

  const EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c1.2-3.2 3.6-4.8 6.5-4.8s5.3 1.6 6.5 4.8"/></svg>`;

  const STYLE = `
    :host {
      --_h: var(--lm-presence-size, 56px);
      display: inline-block;
      vertical-align: top;
      max-width: 100%;
      -webkit-tap-highlight-color: transparent;
    }
    :host([hidden]), [hidden] { display: none !important; }

    .control {
      all: unset;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: minmax(var(--lm-presence-label-width, calc(var(--_h) * 1.9)), max-content);
      justify-items: center;
      max-width: 100%;
      font-size: max(12px, calc(var(--_h) * .2));
      line-height: 1.25;
      text-align: center;
      cursor: default;
      -webkit-user-select: none;
      user-select: none;
      --_e: cubic-bezier(.22, 1, .36, 1);
      --_pop: ${POP};
      --_a: var(--_accent, var(--lm-presence-accent, #8e8e93));
      --_p: 0px;
      --_d: calc(var(--_h) - 2 * var(--_p));
      --_o: calc(var(--_d) * .24);
      --_g: max(2px, calc(var(--_d) * .045));
      --_k: calc(var(--_d) * .12);
    }
    .has-ring { --_p: calc(var(--_h) * .08); }
    a.control[href], button.control { cursor: pointer; }

    .bubble {
      position: relative;
      display: block;
      width: calc(2 * var(--_p) + var(--_d) + (var(--_n, 1) - 1) * (var(--_d) - var(--_o)));
      height: var(--_h);
      margin-bottom: calc(var(--_h) * .14);
      border-radius: calc(var(--_h) / 2);
      transition: width .5s var(--_e), scale .5s var(--_pop), --_lm-spread .5s var(--_e);
    }

    /* The light of live is a layer of the ring's own background, so the rounded edge clips it: a blended
       child layer escaped the rounding in Chrome and left a square at the corner. */
    .ring {
      --_sheen: linear-gradient(#0000, #0000);
      position: absolute;
      inset: 0 calc((var(--_n, 1) - 1) * var(--_k) * var(--_lm-spread) / -2);
      border-radius: inherit;
      background: var(--_sheen), var(--lm-presence-ring, linear-gradient(160deg, var(--_a), oklch(from var(--_a) calc(.64 + l * .2) calc(c * .8) calc(h + 32))));
      opacity: 0;
      transition: opacity .3s;
    }
    .has-ring .ring { opacity: 1; }
    .is-live .ring {
      --_sheen: conic-gradient(from var(--_lm-turn), #fff0 0 58%, #ffffff70 80%, #fff0 93%);
      animation: lm-spin 2.4s linear infinite;
    }
    @keyframes lm-spin { to { --_lm-turn: 1turn; } }

    .face {
      --_lm-hole: 0px;
      position: absolute;
      left: var(--_p);
      top: var(--_p);
      box-sizing: border-box;
      width: var(--_d);
      height: var(--_d);
      display: grid;
      place-items: center;
      border-radius: 50%;
      overflow: hidden;
      background: var(--_bg, oklch(.86 .07 var(--_hue, 250)));
      color: oklch(.34 .08 var(--_hue, 250));
      translate: calc(var(--_i, 0) * (var(--_d) - var(--_o)) + (var(--_i, 0) - (var(--_n, 1) - 1) / 2) * var(--_k) * var(--_lm-spread)) 0;
      mask: radial-gradient(circle at calc(var(--_d) * 1.5 - var(--_o) + var(--_k) * var(--_lm-spread)) 50%, #0000 var(--_lm-hole), #000 calc(var(--_lm-hole) + .5px));
      transition: translate .5s var(--_e), --_lm-hole .45s var(--_e), left .4s var(--_e), top .4s var(--_e), width .4s var(--_e), height .4s var(--_e);
    }
    .face.covered { --_lm-hole: calc(var(--_d) / 2 + var(--_g)); }
    .face.gone { pointer-events: none; }
    .initials { font-size: calc(var(--_d) * .36); font-weight: 600; letter-spacing: -.01em; }
    .face img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity .3s;
    }
    .face.loaded img { opacity: 1; }
    .face.bare img, .face.broken img { display: none; }

    .more {
      background: var(--lm-presence-more-bg, oklch(.93 .006 270));
      color: var(--lm-presence-more-color, #1c1c1e);
      font-size: calc(var(--_d) * .38 * var(--_fit, 1));
      font-weight: 500;
      letter-spacing: -.02em;
      font-variant-numeric: tabular-nums;
    }
    .has-ring .more {
      background: var(--lm-presence-more-bg, oklch(from var(--_a) .93 .035 h));
      color: var(--lm-presence-more-color, oklch(from var(--_a) .22 .035 h));
    }
    .num { grid-area: 1 / 1; }
    .empty {
      background: none;
      border: 1.5px dashed color-mix(in oklab, currentColor 32%, transparent);
      color: color-mix(in oklab, currentColor 45%, transparent);
    }
    .empty svg { width: 44%; height: 44%; }

    .label, .status {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      contain: inline-size;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .label {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 1.25em;
      font-weight: 500;
    }
    .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .sep { flex: none; white-space: pre; }
    .status { color: var(--lm-presence-muted, color-mix(in oklab, currentColor 58%, transparent)); }
    .status.online { color: var(--lm-presence-online, light-dark(#18843c, #30d158)); }
    .bar {
      display: inline-block;
      width: 70%;
      height: .72em;
      border-radius: 1em;
      vertical-align: -.06em;
      background: color-mix(in oklab, currentColor 10%, transparent);
    }
    .status .bar { width: 48%; }

    .is-loading .ring {
      opacity: 1;
      background:
        linear-gradient(90deg, #0000 35%, color-mix(in oklab, currentColor 9%, transparent) 50%, #0000 65%) 0 0 / 300% 100% no-repeat,
        color-mix(in oklab, currentColor 9%, transparent);
      animation: lm-sweep 1.5s ease-in-out infinite;
    }
    @keyframes lm-sweep { from { background-position: 100% 0; } to { background-position: 0 0; } }

    /* is-hover, is-active and is-focus come from the state attribute: the same looks, held for a preview */
    .is-hover .bubble { --_lm-spread: 1; }
    @media (hover: hover) {
      .control:is(a[href], button:enabled):hover .bubble { --_lm-spread: 1; }
    }
    .control:is(a[href], button:enabled):active .bubble, .is-active .bubble {
      scale: .94;
      transition: width .5s var(--_e), scale .12s ease-out, --_lm-spread .5s var(--_e);
    }
    .control:focus-visible .bubble, .is-focus .bubble { outline: 2px solid var(--lm-presence-focus, #0c75f1); outline-offset: 3px; }
    .control:disabled, .control[aria-disabled="true"] { opacity: .45; }

    .is-inline {
      grid-template-columns: auto minmax(0, max-content);
      column-gap: calc(var(--_h) * .22);
      align-items: center;
      justify-items: start;
      text-align: start;
    }
    .is-inline .bubble { grid-row: span 2; margin: 0; }
    .is-inline :is(.label, .status) { contain: none; width: auto; max-width: 100%; }
    .is-inline .label { justify-content: flex-start; align-self: end; }
    .is-inline .status { align-self: start; }
    .is-inline .label:has(+ .status[hidden]) { grid-row: span 2; align-self: center; }

    @supports not (color: oklch(from red l c h)) {
      .ring { background: var(--_sheen), var(--lm-presence-ring, var(--_a)); }
      .has-ring .more { background: var(--lm-presence-more-bg, #fff); color: var(--lm-presence-more-color, #1c1c1e); }
    }
    @media (prefers-reduced-motion: reduce) {
      .bubble, .ring, .face { transition-duration: 0s !important; }
      .ring { animation-play-state: paused !important; }
    }
  `;

  const FLAGS = ["online", "live", "interactive", "disabled", "loading"];
  const TEXTS = ["activity", "label", "accent", "href", "layout", "state"];

  class LmPresence extends HTMLElement {
    static version = VERSION;
    static observedAttributes = ["people", "count", "max", "lang", ...FLAGS, ...TEXTS];
    static #connected = new Set();
    // a web font that arrives after the first paint changes every width: the names are measured again
    static {
      document.fonts?.addEventListener?.("loadingdone", () => {
        for (const element of LmPresence.#connected) element.#fit();
      });
    }

    #people = [];
    #count = null;
    #faces = new Map();
    #control = null;
    #bubble;
    #label;
    #status;
    #drawn = false;
    #queued = false;
    #resize = new ResizeObserver(() => this.#fit());

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${STYLE}</style>`;
      this.#bubble = node("span", "bubble");
      this.#bubble.setAttribute("part", "bubble");
      this.#bubble.setAttribute("aria-hidden", "true");
      const ring = node("span", "ring");
      ring.setAttribute("part", "ring");
      this.#bubble.append(ring);
      this.#label = node("span", "label");
      this.#label.setAttribute("part", "label");
      this.#status = node("span", "status");
      this.#status.setAttribute("part", "status");
      root.addEventListener("click", (event) => this.#select(event));
    }

    connectedCallback() {
      // values a framework set before the element was defined
      for (const key of ["people", "count", "max", ...FLAGS, ...TEXTS]) {
        if (Object.prototype.hasOwnProperty.call(this, key)) {
          const value = this[key];
          delete this[key];
          this[key] = value;
        }
      }
      this.#render();
      this.#resize.observe(this);
      LmPresence.#connected.add(this);
    }

    disconnectedCallback() {
      this.#resize.disconnect();
      LmPresence.#connected.delete(this);
    }

    attributeChangedCallback(name, _, value) {
      if (name === "people") {
        try {
          this.#people = toPeople(JSON.parse(value || "[]"));
        } catch {
          this.#people = [];
          console.warn("<lm-presence>: the people attribute is not valid JSON.", value);
        }
      }
      if (name === "count") this.#count = toCount(value);
      this.#schedule();
    }

    get people() {
      return this.#people;
    }
    set people(value) {
      try {
        this.#people = toPeople(typeof value === "string" ? JSON.parse(value || "[]") : value);
      } catch {
        this.#people = [];
        console.warn("<lm-presence>: people is not valid JSON.", value);
      }
      this.#schedule();
    }
    /** The head count shown: the count set, but never fewer than the people listed. */
    get count() {
      return Math.max(this.#count ?? 0, this.#people.length);
    }
    set count(value) {
      this.#count = toCount(value);
      this.#schedule();
    }
    get max() {
      return Math.min(Math.max(parseInt(this.getAttribute("max"), 10) || 2, 1), 6);
    }
    set max(value) {
      this.setAttribute("max", value);
    }

    #flag(name) {
      return this.hasAttribute(name) && this.getAttribute(name) !== "false";
    }

    #schedule() {
      if (this.#queued || !this.isConnected) return;
      this.#queued = true;
      queueMicrotask(() => {
        this.#queued = false;
        if (this.isConnected) this.#render();
      });
    }

    #render() {
      const loading = this.#flag("loading");
      const disabled = this.#flag("disabled");
      const people = this.#people;
      const total = this.count;
      const max = this.max;
      const lang = this.closest("[lang]")?.lang || document.documentElement.lang || "";
      const words = WORDS[/^ru\b/i.test(lang) ? "ru" : "en"];
      const number = new Intl.NumberFormat(words === WORDS.ru ? "ru" : "en");
      const style = getComputedStyle(this);
      const ring =
        !loading &&
        total > 0 &&
        Boolean(
          this.getAttribute("accent") ||
            style.getPropertyValue("--lm-presence-accent").trim() ||
            style.getPropertyValue("--lm-presence-ring").trim(),
        );

      // What goes into the bubble: faces, then the rest as +N.
      const slots = [];
      if (!loading && total === 0) slots.push({ key: "empty" });
      else if (!loading) {
        const fits = total <= max && people.length >= total;
        const shown = people.slice(0, fits ? total : max - 1);
        const used = new Set();
        for (const person of shown) {
          let key = `@${person.id ?? person.name ?? person.avatar ?? ""}`;
          while (used.has(key)) key += "'";
          used.add(key);
          slots.push({ key, person });
        }
        if (!fits) slots.push({ key: "more", rest: total - shown.length, plus: shown.length > 0 });
      }

      // A link, a button or plain text, whichever the attributes ask for.
      const kind = this.hasAttribute("href") ? "a" : this.#flag("interactive") ? "button" : "div";
      if (this.#control?.localName !== kind) {
        const control = node(kind, "control");
        control.setAttribute("part", "control");
        if (kind === "button") control.type = "button";
        control.append(this.#bubble, this.#label, this.#status);
        if (this.#control) this.#control.replaceWith(control);
        else this.shadowRoot.append(control);
        this.#control = control;
      }
      const control = this.#control;
      if (kind === "a") {
        if (disabled) {
          control.removeAttribute("href");
          control.setAttribute("role", "link");
          control.setAttribute("aria-disabled", "true");
        } else {
          control.href = this.getAttribute("href");
          control.removeAttribute("role");
          control.removeAttribute("aria-disabled");
        }
      }
      if (kind === "button") control.disabled = disabled;
      control.classList.toggle("has-ring", ring);
      control.classList.toggle("is-live", this.#flag("live"));
      control.classList.toggle("is-loading", loading);
      control.classList.toggle("is-inline", this.getAttribute("layout") === "inline");
      for (const state of ["hover", "active", "focus"]) control.classList.toggle(`is-${state}`, this.getAttribute("state") === state);
      const accent = this.getAttribute("accent");
      if (accent) control.style.setProperty("--_accent", accent);
      else control.style.removeProperty("--_accent");
      if (loading) control.setAttribute("aria-busy", "true");
      else control.removeAttribute("aria-busy");
      this.#bubble.style.setProperty("--_n", loading ? 2 : slots.length);

      const next = new Map();
      slots.forEach((slot, index) => {
        let face = this.#faces.get(slot.key);
        const fresh = !face;
        if (fresh) face = this.#face(slot);
        this.#fill(face, slot);
        face.style.setProperty("--_i", index);
        face.style.zIndex = index + 1;
        face.classList.toggle("covered", index < slots.length - 1);
        if (fresh) {
          this.#bubble.append(face);
          if (this.#drawn) enter(face);
        }
        next.set(slot.key, face);
      });
      for (const [key, face] of this.#faces) if (!next.has(key)) leave(face);
      this.#faces = next;

      // The names line: [text, shortens]; names give way, "&" and "+N others" do not.
      const names = people.map((p) => String(p.name ?? ""));
      const custom = this.getAttribute("label");
      const parts = custom
        ? [[custom, true]]
        : total === 0
          ? [[words.empty, true]]
          : !people.length
            ? [[words.people(number.format(total), total), true]]
            : total === 1
              ? [[names[0], true]]
              : total === 2 && people.length > 1
                ? [[names[0], true], [words.and, false], [names[1], true]]
                : [[names[0], true], [words.others(number.format(total - 1), total - 1), false]];
      this.#label.replaceChildren(
        ...(loading
          ? [node("span", "bar")]
          : parts.map(([text, shortens]) => {
              const span = node("span", shortens ? "name" : "sep", text);
              span.dataset.full = text;
              return span;
            })),
      );

      const online = this.#flag("online");
      const status = loading || total === 0 ? "" : this.getAttribute("activity") || (online ? words.online : "");
      this.#status.replaceChildren(loading ? node("span", "bar") : status);
      this.#status.hidden = !loading && !status;
      this.#status.classList.toggle("online", online && !loading);

      // Screen readers get the whole sentence, names unshortened; a static chip reads as one picture.
      if (kind === "div") control.setAttribute("role", "img");
      control.setAttribute("aria-label", loading ? words.loading : parts.map(([text]) => text).join("") + (status ? `, ${status}` : ""));

      this.#drawn = true;
      this.#fit();
    }

    #fit() {
      const spans = [...this.#label.children].filter((span) => span.dataset.full != null);
      for (const span of spans) span.textContent = span.dataset.full;
      const room = this.#label.clientWidth;
      // beside the faces the line takes the width it needs, so CSS alone shortens it there
      if (!spans.length || !room || this.getAttribute("layout") === "inline") return;
      const style = getComputedStyle(this.#label);
      pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if ("letterSpacing" in pen) pen.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      const names = spans.filter((span) => span.classList.contains("name"));
      const width = (span) => pen.measureText(span.dataset.full).width;
      const fixed = spans.filter((span) => !names.includes(span)).reduce((sum, span) => sum + width(span), 0);
      const widths = names.map(width);
      const total = widths.reduce((sum, value) => sum + value, 0);
      const budget = room - fixed - 1;
      if (total <= budget) return;
      // every name gives up room in proportion to its length, as flex-shrink would
      names.forEach((span, index) => {
        span.textContent = clip(span.dataset.full, (budget * widths[index]) / total);
      });
    }

    #face(slot) {
      const face = node("span", "face");
      face.setAttribute("part", "face");
      if (slot.key === "more") {
        face.classList.add("more");
        face.setAttribute("part", "more");
        face.append(node("span", "num"));
      } else if (slot.key === "empty") {
        face.classList.add("empty");
        face.innerHTML = EMPTY;
      } else {
        const img = node("img");
        img.alt = "";
        img.decoding = "async";
        img.draggable = false;
        img.setAttribute("part", "avatar");
        img.addEventListener("load", () => face.classList.add("loaded"));
        img.addEventListener("error", () => face.classList.add("broken"));
        face.append(node("span", "initials"), img);
      }
      return face;
    }

    #fill(face, slot) {
      if (slot.key === "more") {
        const text = (slot.plus ? "+" : "") + compact(slot.rest);
        face.style.setProperty("--_fit", [1, 1, 1, 0.84, 0.72][text.length] ?? 0.62);
        const current = face.querySelector(".num:not(.out)");
        const was = Number(face.dataset.rest || 0);
        face.dataset.rest = slot.rest;
        if (current.textContent === text) return;
        if (!this.#drawn || !current.textContent) current.textContent = text;
        else roll(face, current, text, slot.rest > was);
        return;
      }
      if (!slot.person) return;
      const { name = "", avatar, color } = slot.person;
      face.style.setProperty("--_hue", hue(name));
      if (color) face.style.setProperty("--_bg", color);
      else face.style.removeProperty("--_bg");
      face.querySelector(".initials").textContent = initials(name);
      const img = face.querySelector("img");
      if ((img.getAttribute("src") || "") !== (avatar || "")) {
        face.classList.remove("loaded", "broken");
        if (avatar) img.src = avatar;
        else img.removeAttribute("src");
      }
      face.classList.toggle("bare", !avatar);
    }

    #select(event) {
      const control = this.#control;
      if (!control || control.localName === "div" || this.#flag("disabled") || this.#flag("loading")) return;
      const proceed = this.dispatchEvent(
        new CustomEvent("lm-select", {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { people: this.#people, count: this.count },
        }),
      );
      if (!proceed) event.preventDefault();
    }
  }

  for (const name of FLAGS) {
    Object.defineProperty(LmPresence.prototype, name, {
      configurable: true,
      get() {
        return this.hasAttribute(name) && this.getAttribute(name) !== "false";
      },
      set(value) {
        this.toggleAttribute(name, Boolean(value) && value !== "false");
      },
    });
  }
  for (const name of TEXTS) {
    Object.defineProperty(LmPresence.prototype, name, {
      configurable: true,
      get() {
        return this.getAttribute(name);
      },
      set(value) {
        if (value == null || value === false) this.removeAttribute(name);
        else this.setAttribute(name, value);
      },
    });
  }

  customElements.define("lm-presence", LmPresence);
})();
