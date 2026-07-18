import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="m3 11 9-8 9 8v10h-6v-6H9v6H3Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

export function RadarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" fill="currentColor" r="2" />
      <path
        d="M12 12 18.5 6M3.5 12h3M17.5 12h3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </Icon>
  );
}

export function ReplayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M4 8V3m0 0h5M4 3l4 4a8 8 0 1 1-2 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

export function PulseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M2 12h5l2.5-7 4 14 2.5-7h6"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

export function ApiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 11v6M12 7.5v.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}
