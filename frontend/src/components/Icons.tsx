// Lucide ikonkalari — https://lucide.dev/icons
// Inline SVG ko'rinishida (qo'shimcha dependency talab qilmaydi).
import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export const Icon = {
  Search: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  FileText: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>
  ),
  BookOpen: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
  ),
  ChevronLeft: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="m15 18-6-6 6-6" /></svg>
  ),
  ChevronRight: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="m9 18 6-6-6-6" /></svg>
  ),
  ZoomIn: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6" /><path d="M8 11h6" /></svg>
  ),
  ZoomOut: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6" /></svg>
  ),
  X: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  ),
  AlertTriangle: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
  ),
  CheckCircle: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
  ),
  Info: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
  ),
  Ban: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>
  ),
  Globe: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
  ),
  Save: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></svg>
  ),
  Share: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.59 13.51 6.83 3.98" /><path d="m15.41 6.51-6.82 3.98" /></svg>
  ),
  RadioTower: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" /><path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5" /><circle cx="12" cy="9" r="2" /><path d="M16.2 4.8c2 2 2.26 5.11.8 7.47" /><path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1" /><path d="M9.5 18h5" /><path d="m8 22 4-11 4 11" /></svg>
  ),
  RefreshCw: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
  ),
  Home: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
  ),
  Library: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></svg>
  ),
  Bot: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
  ),
  ClipboardList: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg>
  ),
  History: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
  ),
  User: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  Wrench: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" /></svg>
  ),
  BarChart3: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
  ),
  Users: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><path d="M16 3.128a4 4 0 0 1 0 7.744" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><circle cx="9" cy="7" r="4" /></svg>
  ),
  Hourglass: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></svg>
  ),
  Plus: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
  ),
  Trash2: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M10 11v6" /><path d="M14 11v6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
  ),
  StatusDot: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" /></svg>
  ),
  Zap: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z" /></svg>
  ),
  XCircle: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
  ),
  Inbox: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
  ),
  FolderOpen: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" /></svg>
  ),
  Book: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" /></svg>
  ),
  BookMarked: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M10 2v7.751a.25.25 0 0 0 .407.195l2.28-1.834a.5.5 0 0 1 .627 0l2.28 1.834A.25.25 0 0 0 16 9.751V2" /><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" /></svg>
  ),
  Pencil: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></svg>
  ),
  SquarePen: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" /></svg>
  ),
  Star: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>
  ),
  Hand: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></svg>
  ),
  Power: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" /></svg>
  ),
  Link: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
  ),
  GraduationCap: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></svg>
  ),
  Camera: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
  ),
  Mic: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
  ),
  MicOff: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><line x1="2" x2="22" y1="2" y2="22" /><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" /><path d="M5 10v2a7 7 0 0 0 12 5" /><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
  ),
  Image: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
  ),
  MessageSquare: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
  ),
  Send: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
  ),
  Languages: ({ size = 16, className, style }: IconProps) => (
    <svg {...base(size)} className={className} style={style}><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></svg>
  ),
};
