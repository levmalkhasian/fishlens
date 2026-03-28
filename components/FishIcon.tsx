export default function FishIcon({ size = 16, className = "", transparent = false }: { size?: number; className?: string; transparent?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
    >
      {!transparent && <rect width="32" height="32" fill="#008080" />}
      <rect x="4" y="12" width="4" height="4" fill="#000080" />
      <rect x="4" y="16" width="4" height="4" fill="#000080" />
      <rect x="8" y="8" width="4" height="4" fill="#000080" />
      <rect x="8" y="12" width="4" height="4" fill="#c0c0c0" />
      <rect x="8" y="16" width="4" height="4" fill="#c0c0c0" />
      <rect x="8" y="20" width="4" height="4" fill="#000080" />
      <rect x="12" y="8" width="4" height="4" fill="#000080" />
      <rect x="12" y="12" width="4" height="4" fill="#c0c0c0" />
      <rect x="12" y="16" width="4" height="4" fill="#c0c0c0" />
      <rect x="12" y="20" width="4" height="4" fill="#000080" />
      <rect x="16" y="8" width="4" height="4" fill="#000080" />
      <rect x="16" y="12" width="4" height="4" fill="#c0c0c0" />
      <rect x="16" y="16" width="4" height="4" fill="#c0c0c0" />
      <rect x="16" y="20" width="4" height="4" fill="#000080" />
      <rect x="20" y="12" width="4" height="4" fill="#000080" />
      <rect x="20" y="16" width="4" height="4" fill="#000080" />
      <rect x="24" y="8" width="4" height="4" fill="#000080" />
      <rect x="24" y="12" width="4" height="4" fill="#000080" />
      <rect x="24" y="16" width="4" height="4" fill="#000080" />
      <rect x="24" y="20" width="4" height="4" fill="#000080" />
      <rect x="10" y="12" width="4" height="4" fill="#000000" />
      <rect x="10" y="12" width="2" height="2" fill="#ffffff" />
    </svg>
  );
}
