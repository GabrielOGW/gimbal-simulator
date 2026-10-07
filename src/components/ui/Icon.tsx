import type { SVGProps } from "react";

const paths = {
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm10 2-4.35-4.35",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  reset: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  target: "M12 2v4M12 18v4M2 12h4M18 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  download: "M12 3v12m0 0-4-4m4 4 4-4M4 19h16",
  upload: "M12 15V3m0 0L8 7m4-4 4 4M4 19h16",
  save: "M5 3h11l3 3v15H5zM8 3v5h7M8 21v-7h8v7",
  folder: "M3 6h6l2 2h10v11H3z",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  move: "M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3",
  rotate: "M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5",
  camera: "M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  wand: "M15 4V2M15 10V8M11 6h2M17 6h2M4 20 14 10M18 14l1 1M19 9h0",
  center: "M12 3v18M5 8l-3 4 3 4M19 8l3 4-3 4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5",
  alert: "M12 3 2 21h20zM12 10v5M12 18v.5",
  check: "M5 12l5 5L20 7",
  chevron: "M6 9l6 6 6-6",
  new: "M6 3h9l5 5v13H6zM14 3v6h6",
  gimbal: "M12 21v-5M9 21h6M12 16a2 2 0 0 0 2-2V9M6 9h12M6 9v4M18 9v4M9 5h6v4H9z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
