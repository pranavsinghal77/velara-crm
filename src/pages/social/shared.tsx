import { Instagram, Facebook, Linkedin, Twitter } from 'lucide-react';
import type { Platform } from './types';
import { PLATFORM_CONFIG } from './platforms';

export function PlatformIcon({ p, size = 12 }: { p: Platform; size?: number }) {
  if (p === 'IG') return <Instagram style={{ width: size, height: size }} />;
  if (p === 'FB') return <Facebook  style={{ width: size, height: size }} />;
  if (p === 'LI') return <Linkedin  style={{ width: size, height: size }} />;
  if (p === 'X')  return <Twitter   style={{ width: size, height: size }} />;
  return <span style={{ fontSize: size * 0.8, fontWeight: 700, lineHeight: 1 }}>W</span>;
}

export function PlatformBadge({ p }: { p: Platform }) {
  const cfg = PLATFORM_CONFIG[p];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${cfg.iconBg}`}>
      <PlatformIcon p={p} size={9} />
      {p}
    </span>
  );
}
