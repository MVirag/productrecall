// Inline SVG icons (Lucide-style outline: 24px grid, 2px round stroke, currentColor).
// Each severity level has its own shape so colour is never the only signal.
const NS = 'http://www.w3.org/2000/svg';

const SHAPES = {
  health: [['path', { d: 'M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86Z' }], ['path', { d: 'M12 8v4M12 16h.01' }]],
  allergy: [['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }], ['path', { d: 'M12 9v4M12 17h.01' }]],
  possible: [['path', { d: 'M12 2.5 20.5 7.25v9.5L12 21.5 3.5 16.75v-9.5Z' }], ['path', { d: 'M12 8v4M12 15.5h.01' }]],
  notacute: [['path', { d: 'M12 2.5 21.5 12 12 21.5 2.5 12Z' }], ['path', { d: 'M12 8v4l2.5 2' }]],
  unfit: [['circle', { cx: 12, cy: 12, r: 9.5 }], ['path', { d: 'M8 12h8' }]],
  unstated: [['rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 3 }], ['path', { d: 'M9.6 9.4a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .8-1 1.5M12 16.5h.01' }]],
  done: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'm9 12 2 2 4-4' }]],
  pin: [['path', { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' }], ['circle', { cx: 12, cy: 10, r: 3 }]],
  target: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 3 }]],
  'arrow-left': [['path', { d: 'm12 19-7-7 7-7M19 12H5' }]],
  share: [['path', { d: 'M12 15V3M8 7l4-4 4 4' }], ['path', { d: 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7' }]],
  external: [['path', { d: 'M15 3h6v6M10 14 21 3' }], ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }]],
  tag: [['path', { d: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z' }], ['circle', { cx: 7.5, cy: 7.5, r: 0.5 }]],
};

/** icon('health', { md: true }) -> <svg class="icon icon-md" aria-hidden="true">…</svg> */
export function icon(name, { md = false } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', md ? 'icon icon-md' : 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of SHAPES[name] || SHAPES.unstated) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}
