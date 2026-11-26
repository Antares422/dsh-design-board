const PATHS = {
  select: 'M5 3l14 7-6 2-2 6z',
  hand: 'M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-1a5 5 0 01-4-2l-3-4a1.5 1.5 0 012.3-1.9L8 14',
  text: 'M5 6h14M12 6v13',
  pen: 'M4 20l4-1 11-11a2.1 2.1 0 00-3-3L5 16z',
  expand: 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7',
  collapse: 'M4 14h6v6M10 14l-7 7M20 10h-6V4M14 10l7-7',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  back: 'M15 5l-7 7 7 7',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  send: 'M4 12l16-8-6 16-3-7z',
  eraser: 'M4.5 14.5l8-8a2 2 0 012.8 0l3.2 3.2a2 2 0 010 2.8L12 18.9H8zM8 18.9h11.5M8.2 11.2l5.6 5.6',
  palette: 'M12 3a9 9 0 100 18c1.6 0 2.1-1.1 1.6-2.3-.5-1.2.3-2.2 1.6-2.2H17a4 4 0 004-4c0-5-4-9.5-9-9.5zM7.5 11h.01M10 7.5h.01M14 7.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  close: 'M6 6l12 12M18 6L6 18',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  play: 'M8 5.5l11 6.5-11 6.5z',
  chevron: 'M6 9l6 6 6-6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  image: 'M4 5h16v14H4zM8.5 10.5a1 1 0 100-2 1 1 0 000 2M5 17l4.5-4.5L13 16l2-2 4 4',
  edit: 'M4 20l4-1 11-11a2.1 2.1 0 00-3-3L5 16zM14 6l3 3',
  folder: 'M3 7h7l2 2h9v10H3z',
  warning: 'M12 3L2.8 20h18.4L12 3zM12 9v5M12 17h.01',
}

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {name === 'rect' ? <rect x="4" y="6" width="16" height="12" rx="1.5" /> : <path d={PATHS[name]} />}
    </svg>
  )
}
