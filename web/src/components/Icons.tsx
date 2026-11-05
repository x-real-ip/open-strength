type P = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const IconToday = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" />
  </svg>
);

export const IconProgram = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
    <path d="M8 8.5h8M8 12h8M8 15.5h5" />
  </svg>
);

export const IconProgress = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M4 19h16" />
    <path d="M5 15l4.5-4.5 3.5 3L19 7" />
    <path d="M15 7h4v4" />
  </svg>
);

export const IconCoach = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1-4.3A7.5 7.5 0 1 1 20 12.5z" />
  </svg>
);

export const IconProfile = ({ size = 24 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20c1.3-3.6 4.2-5.3 7.5-5.3s6.2 1.7 7.5 5.3" />
  </svg>
);

export const IconClose = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconCheck = ({ size = 22 }: P) => (
  <svg {...base(size)} strokeWidth={2.6}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const IconChevron = ({ size = 20 }: P) => (
  <svg {...base(size)} className="chev">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconBack = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconSwap = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M7 4L4 7l3 3M4 7h12M17 20l3-3-3-3M20 17H8" />
  </svg>
);
