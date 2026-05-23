import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function baseProps(props: IconProps) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function OlliveMark(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 4.5c3.8 0 6.5 2.5 6.5 6.2 0 4.8-4.1 8.8-9.3 8.8-2 0-3.7-.6-4.7-1.7" />
      <path d="M12 4.5c-3.8 0-6.5 2.5-6.5 6.2 0 2 1 3.8 2.8 5" />
      <path d="M9.8 7.7c2.4 0 4.1 1.6 4.1 4 0 3-2.6 5.5-5.8 5.5" />
      <path d="M8.8 14.4c-1.3-.7-2.2-2-2.2-3.6 0-2.4 1.8-4.2 4.5-4.2" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function MessageSquareIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5z" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 11.8 19.4 4 16 20l-4.6-5.2L4 11.8Z" />
      <path d="M11.4 14.8 19.4 4" />
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3.5 13.6 8l4.9 1.7-4.9 1.7L12 16l-1.6-4.6L5.5 9.7 10.4 8z" />
      <path d="M18.5 14.5 19.3 17l2.2.8-2.2.8-.8 2.5-.8-2.5-2.2-.8 2.2-.8z" />
      <path d="M5.5 15.5 6.1 17l1.4.5-1.4.5-.6 1.5-.5-1.5-1.5-.5 1.5-.5z" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 6h7" />
      <path d="M15 6h5" />
      <path d="M10 6a2 2 0 1 0 0 .01Z" />
      <path d="M4 18h5" />
      <path d="M13 18h7" />
      <path d="M10 18a2 2 0 1 0 0 .01Z" />
      <path d="M4 12h2" />
      <path d="M12 12h8" />
      <path d="M9 12a2 2 0 1 0 0 .01Z" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v5l3 2" />
    </svg>
  );
}

export function SidebarIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <path d="M9.5 5v14" />
    </svg>
  );
}
