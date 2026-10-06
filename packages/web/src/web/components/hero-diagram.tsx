const CENTER = { x: 300, y: 160 };
const BOX = { w: 134, h: 32 };

const NODES = [
  { label: "Entity", x: 300, y: 48 },
  { label: "Subject", x: 511, y: 125 },
  { label: "Evidence", x: 430, y: 251 },
  { label: "Relationships", x: 170, y: 251 },
  { label: "Usefulness", x: 89, y: 125 },
];

/** Literal diagram of what gets checked: five dimensions around the page itself. */
export function HeroDiagram() {
  return (
    <>
      <p className="visually-hidden">
        Diagram: five checks — Entity, Subject, Evidence, Relationships and Usefulness — each
        connected by a thin line to a central node labelled “this page”.
      </p>
    <svg className="hero-diagram" viewBox="0 22 600 266" aria-hidden="true" focusable="false">
      <g>
        {NODES.map((node) => (
          <line
            key={`spoke-${node.label}`}
            className="spoke"
            x1={CENTER.x}
            y1={CENTER.y}
            x2={node.x}
            y2={node.y}
          />
        ))}
      </g>
      <g>
        {NODES.map((node) => (
          <g key={node.label}>
            <rect
              className="node-box"
              x={node.x - BOX.w / 2}
              y={node.y - BOX.h / 2}
              width={BOX.w}
              height={BOX.h}
              rx="2"
            />
            <text className="node-label" x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central">
              {node.label}
            </text>
          </g>
        ))}
      </g>
      <g>
        <rect
          className="node-core"
          x={CENTER.x - 62}
          y={CENTER.y - 21}
          width={124}
          height={42}
          rx="2"
        />
        <text
          className="core-label"
          x={CENTER.x}
          y={CENTER.y}
          textAnchor="middle"
          dominantBaseline="central"
        >
          this page
        </text>
      </g>
    </svg>
    </>
  );
}
