/**
 * The sign-in page's background.
 *
 * Deliberately not an abstract blob field. The five columns of nodes are the
 * pipeline stages the app itself is built around — New, Contacted, Qualified,
 * Negotiation, Won — and the two travelling dashes are leads moving through
 * them. A login screen is the one page every user sees before they know what
 * the product does, so it may as well say something.
 *
 * Purely decorative, so the whole thing is `aria-hidden` and sits behind the
 * content with pointer events off. Nothing here is interactive and nothing
 * here is information a screen reader needs to hear about.
 *
 * Colours come from the palette already in use rather than new ones: the
 * sidebar's slate-900 base, blue-600 as primary, indigo and the purple the AI
 * surfaces use. The animation is defined in the Motion section of index.css
 * alongside everything else, which is also what makes it respect
 * `prefers-reduced-motion` for free.
 */

/** Node positions per stage column, in the 0-1000 x 0-600 viewBox. */
const STAGES: { x: number; ys: number[] }[] = [
  { x: 120, ys: [130, 300, 455] },
  { x: 320, ys: [90, 250, 400] },
  { x: 510, ys: [180, 340, 500] },
  { x: 700, ys: [120, 290, 430] },
  { x: 880, ys: [210, 380] },
];

/** A gentle S-curve between two points; straight lines look like a diagram. */
function link(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

/** Every stage-to-stage connection, so the mesh reads as a flow. */
const LINKS: string[] = STAGES.flatMap((stage, i) => {
  const next = STAGES[i + 1];
  if (!next) return [];
  return stage.ys.flatMap((y) =>
    next.ys
      // Only join nodes that are roughly level. Joining all of them turns the
      // panel into a lattice, which reads as noise rather than movement.
      .filter((ny) => Math.abs(ny - y) < 170)
      .map((ny) => link(stage.x, y, next.x, ny))
  );
});

/** Two complete left-to-right routes for the travelling dashes to follow. */
const ROUTES = [
  [
    link(120, 300, 320, 250),
    link(320, 250, 510, 180),
    link(510, 180, 700, 120),
    link(700, 120, 880, 210),
  ].join(' '),
  [
    link(120, 455, 320, 400),
    link(320, 400, 510, 340),
    link(510, 340, 700, 290),
    link(700, 290, 880, 380),
  ].join(' '),
];

export default function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 auth-panel-bg" />

      {/* Drifting colour, on three co-prime periods. */}
      <div className="auth-bloom auth-bloom-1" />
      <div className="auth-bloom auth-bloom-2" />
      <div className="auth-bloom auth-bloom-3" />

      {/* The dot mesh sits above the blooms so the texture stays crisp. */}
      <div className="absolute inset-0 auth-mesh" />

      <svg
        className="auth-graph"
        viewBox="0 0 1000 600"
        // `slice` so the graph fills the panel at any aspect ratio instead of
        // letterboxing into it.
        preserveAspectRatio="xMidYMid slice"
      >
        {LINKS.map((d, i) => (
          <path key={i} d={d} className="auth-graph-line" />
        ))}

        <path d={ROUTES[0]} className="auth-graph-signal" />
        <path d={ROUTES[1]} className="auth-graph-signal auth-graph-signal-2" />

        {STAGES.flatMap((stage) =>
          stage.ys.map((y) => (
            <circle
              key={`${stage.x}-${y}`}
              cx={stage.x}
              cy={y}
              r={3}
              className="auth-graph-node"
            />
          ))
        )}
      </svg>

      {/* Settles the bottom edge so the fine print stays readable over it. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950/60 to-transparent" />
    </div>
  );
}
