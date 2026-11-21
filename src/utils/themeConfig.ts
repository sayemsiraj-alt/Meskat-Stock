export type ThemeId = 
  | 'emerald-enterprise' 
  | 'royal-sapphire' 
  | 'obsidian-dark' 
  | 'corporate-violet' 
  | 'nordic-forest' 
  | 'crimson-ruby'
  | 'amber-gold'
  | 'teal-cyan-fusion'
  | 'sunset-copper'
  | 'electric-indigo'
  | 'monochrome-minimal'
  | 'emerald-night';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  tagline: string;
  previewBg: string;
  previewSidebar: string;
  previewAccent: string;
  
  // Outer Root Classes
  appBgClass: string;
  
  // Sidebar Classes
  sidebarBgClass: string;
  sidebarHeaderBgClass: string;
  sidebarBorderClass: string;
  sidebarActivePillClass: string;
  sidebarActiveTextClass: string;
  sidebarHoverClass: string;

  // Header Classes
  headerBgClass: string;
  headerTitleClass: string;

  // Main UI Card & Accent Classes
  cardClass: string;
  primaryButtonClass: string;
  accentTextClass: string;
  accentBadgeClass: string;
  kpiHighlightClass: string;
}

export const SYSTEM_THEMES: Record<ThemeId, ThemeConfig> = {
  'emerald-enterprise': {
    id: 'emerald-enterprise',
    name: 'Emerald Enterprise (Default)',
    tagline: 'Modern Slate Dark Sidebar with Teal & Emerald Accents',
    previewBg: '#F1F5F9',
    previewSidebar: '#020617',
    previewAccent: '#10B981',

    appBgClass: 'bg-slate-100/90 text-slate-900',
    sidebarBgClass: 'bg-slate-950 text-slate-200 border-slate-800/80',
    sidebarHeaderBgClass: 'bg-slate-950/90 border-slate-800/80',
    sidebarBorderClass: 'border-slate-800/80',
    sidebarActivePillClass: 'bg-gradient-to-r from-teal-500/20 via-cyan-500/10 to-transparent text-teal-300 border-teal-500/30 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-teal-400',
    sidebarHoverClass: 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-200',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-slate-200/90',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-slate-200/90',
    primaryButtonClass: 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-extrabold',
    accentTextClass: 'text-teal-600',
    accentBadgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    kpiHighlightClass: 'from-emerald-500/10 via-white to-teal-500/5 border-emerald-500/30'
  },

  'royal-sapphire': {
    id: 'royal-sapphire',
    name: 'Royal Sapphire (Midnight Navy)',
    tagline: 'Deep Midnight Navy with Indigo & Sapphire Blue Theme',
    previewBg: '#EEF2FF',
    previewSidebar: '#0B132B',
    previewAccent: '#3B82F6',

    appBgClass: 'bg-indigo-50/60 text-slate-900',
    sidebarBgClass: 'bg-[#0B132B] text-slate-200 border-indigo-900/40',
    sidebarHeaderBgClass: 'bg-[#060D1E] border-indigo-900/50',
    sidebarBorderClass: 'border-indigo-900/50',
    sidebarActivePillClass: 'bg-gradient-to-r from-blue-600/30 via-indigo-500/20 to-transparent text-blue-300 border-blue-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-blue-400',
    sidebarHoverClass: 'text-slate-400 hover:bg-[#1C2541]/70 hover:text-slate-200',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-indigo-100',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-indigo-100',
    primaryButtonClass: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold',
    accentTextClass: 'text-blue-600',
    accentBadgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    kpiHighlightClass: 'from-blue-500/10 via-white to-indigo-500/5 border-blue-500/30'
  },

  'obsidian-dark': {
    id: 'obsidian-dark',
    name: 'Obsidian Dark Mode (OLED Neon)',
    tagline: 'Full Dark OLED Mode with Neon Cyan & Emerald Glow',
    previewBg: '#090D16',
    previewSidebar: '#030712',
    previewAccent: '#06B6D4',

    appBgClass: 'bg-[#090D16] text-slate-100',
    sidebarBgClass: 'bg-[#030712] text-slate-200 border-slate-800/90',
    sidebarHeaderBgClass: 'bg-[#030712] border-slate-800',
    sidebarBorderClass: 'border-slate-800',
    sidebarActivePillClass: 'bg-gradient-to-r from-cyan-500/25 via-emerald-500/15 to-transparent text-cyan-300 border-cyan-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-cyan-400',
    sidebarHoverClass: 'text-slate-400 hover:bg-slate-900 hover:text-slate-100',

    headerBgClass: 'bg-[#0D1322]/95 backdrop-blur-md border-slate-800/90',
    headerTitleClass: 'text-white',

    cardClass: 'bg-[#0F172A] border-slate-800/90 text-slate-100 shadow-md',
    primaryButtonClass: 'bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-black',
    accentTextClass: 'text-cyan-400',
    accentBadgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
    kpiHighlightClass: 'from-cyan-950/40 via-[#0F172A] to-slate-900 border-cyan-500/30'
  },

  'corporate-violet': {
    id: 'corporate-violet',
    name: 'Corporate Amethyst (Luxury Violet)',
    tagline: 'Deep Amethyst Plum with Soft Lavender & Violet Accents',
    previewBg: '#FAF5FF',
    previewSidebar: '#130E26',
    previewAccent: '#8B5CF6',

    appBgClass: 'bg-purple-50/50 text-slate-900',
    sidebarBgClass: 'bg-[#130E26] text-purple-200 border-purple-900/40',
    sidebarHeaderBgClass: 'bg-[#0B071A] border-purple-900/50',
    sidebarBorderClass: 'border-purple-900/50',
    sidebarActivePillClass: 'bg-gradient-to-r from-purple-600/30 via-fuchsia-500/20 to-transparent text-purple-200 border-purple-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-purple-300',
    sidebarHoverClass: 'text-purple-300/70 hover:bg-[#1E1738]/80 hover:text-white',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-purple-100',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-purple-100',
    primaryButtonClass: 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white font-extrabold',
    accentTextClass: 'text-purple-600',
    accentBadgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    kpiHighlightClass: 'from-purple-500/10 via-white to-fuchsia-500/5 border-purple-500/30'
  },

  'nordic-forest': {
    id: 'nordic-forest',
    name: 'Nordic Forest (Executive Sage & Gold)',
    tagline: 'Deep Nordic Forest Green with Gold & Emerald Highlights',
    previewBg: '#F0FDF4',
    previewSidebar: '#062C22',
    previewAccent: '#059669',

    appBgClass: 'bg-emerald-50/40 text-slate-900',
    sidebarBgClass: 'bg-[#062C22] text-emerald-100 border-emerald-900/50',
    sidebarHeaderBgClass: 'bg-[#031C16] border-emerald-900/60',
    sidebarBorderClass: 'border-emerald-900/60',
    sidebarActivePillClass: 'bg-gradient-to-r from-emerald-500/30 via-teal-500/20 to-transparent text-emerald-200 border-emerald-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-emerald-300',
    sidebarHoverClass: 'text-emerald-300/70 hover:bg-[#0A3A2F]/80 hover:text-white',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-emerald-100',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-emerald-100',
    primaryButtonClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold',
    accentTextClass: 'text-emerald-700',
    accentBadgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    kpiHighlightClass: 'from-emerald-500/10 via-white to-teal-500/5 border-emerald-500/30'
  },

  'crimson-ruby': {
    id: 'crimson-ruby',
    name: 'Crimson Ruby (Executive Burgundy)',
    tagline: 'Luxurious Burgundy Red with Warm Rose Gold Accents',
    previewBg: '#FFF1F2',
    previewSidebar: '#240B13',
    previewAccent: '#E11D48',

    appBgClass: 'bg-rose-50/40 text-slate-900',
    sidebarBgClass: 'bg-[#240B13] text-rose-100 border-rose-900/40',
    sidebarHeaderBgClass: 'bg-[#17050B] border-rose-900/50',
    sidebarBorderClass: 'border-rose-900/50',
    sidebarActivePillClass: 'bg-gradient-to-r from-rose-600/30 via-pink-500/20 to-transparent text-rose-200 border-rose-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-rose-300',
    sidebarHoverClass: 'text-rose-300/70 hover:bg-[#38121E]/80 hover:text-white',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-rose-100',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-rose-100',
    primaryButtonClass: 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-extrabold',
    accentTextClass: 'text-rose-600',
    accentBadgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    kpiHighlightClass: 'from-rose-500/10 via-white to-pink-500/5 border-rose-500/30'
  },

  'amber-gold': {
    id: 'amber-gold',
    name: 'Imperial Gold (স্বর্ণালী প্রিমিয়াম)',
    tagline: 'Deep Bronze Dark Sidebar with Imperial Amber & Warm Gold Accents',
    previewBg: '#FFFBEB',
    previewSidebar: '#1C150A',
    previewAccent: '#D97706',

    appBgClass: 'bg-amber-50/40 text-slate-900',
    sidebarBgClass: 'bg-[#1C150A] text-amber-100 border-amber-900/40',
    sidebarHeaderBgClass: 'bg-[#120F06] border-amber-900/50',
    sidebarBorderClass: 'border-amber-900/50',
    sidebarActivePillClass: 'bg-gradient-to-r from-amber-500/30 via-yellow-500/20 to-transparent text-amber-200 border-amber-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-amber-400',
    sidebarHoverClass: 'text-amber-300/70 hover:bg-[#2B2010]/80 hover:text-white',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-amber-100',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-amber-100',
    primaryButtonClass: 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-extrabold',
    accentTextClass: 'text-amber-700',
    accentBadgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    kpiHighlightClass: 'from-amber-500/10 via-white to-yellow-500/5 border-amber-500/30'
  },

  'teal-cyan-fusion': {
    id: 'teal-cyan-fusion',
    name: 'Oceanic Teal & Cyber Cyan (সাইবার টিল)',
    tagline: 'Deep Dark Petrol Sidebar with Electric Cyan & Mint Glow',
    previewBg: '#ECFEFF',
    previewSidebar: '#041C24',
    previewAccent: '#06B6D4',

    appBgClass: 'bg-cyan-50/40 text-slate-900',
    sidebarBgClass: 'bg-[#041C24] text-cyan-100 border-cyan-900/50',
    sidebarHeaderBgClass: 'bg-[#021118] border-cyan-900/60',
    sidebarBorderClass: 'border-cyan-900/60',
    sidebarActivePillClass: 'bg-gradient-to-r from-cyan-500/30 via-teal-500/20 to-transparent text-cyan-200 border-cyan-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-cyan-300',
    sidebarHoverClass: 'text-cyan-300/70 hover:bg-[#072A35]/80 hover:text-white',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-cyan-100',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-cyan-100',
    primaryButtonClass: 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-slate-950 font-extrabold',
    accentTextClass: 'text-cyan-700',
    accentBadgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    kpiHighlightClass: 'from-cyan-500/10 via-white to-teal-500/5 border-cyan-500/30'
  },

  'sunset-copper': {
    id: 'sunset-copper',
    name: 'Sunset Copper & Coral (কপার সানসেট)',
    tagline: 'Warm Espresso Dark Sidebar with Vibrant Coral & Orange Gold',
    previewBg: '#FFF7ED',
    previewSidebar: '#1C1310',
    previewAccent: '#F97316',

    appBgClass: 'bg-orange-50/40 text-slate-900',
    sidebarBgClass: 'bg-[#1C1310] text-orange-100 border-orange-900/40',
    sidebarHeaderBgClass: 'bg-[#120B09] border-orange-900/50',
    sidebarBorderClass: 'border-orange-900/50',
    sidebarActivePillClass: 'bg-gradient-to-r from-orange-500/30 via-amber-500/20 to-transparent text-orange-200 border-orange-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-orange-400',
    sidebarHoverClass: 'text-orange-300/70 hover:bg-[#2B1D18]/80 hover:text-white',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-orange-100',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-orange-100',
    primaryButtonClass: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-extrabold',
    accentTextClass: 'text-orange-600',
    accentBadgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    kpiHighlightClass: 'from-orange-500/10 via-white to-amber-500/5 border-orange-500/30'
  },

  'electric-indigo': {
    id: 'electric-indigo',
    name: 'Electric Indigo Cyber (ইন্ডিগো প্রিমিয়াম)',
    tagline: 'Deep Midnight Cyber Dark with Neon Electric Indigo Accents',
    previewBg: '#F5F3FF',
    previewSidebar: '#0F0C29',
    previewAccent: '#6366F1',

    appBgClass: 'bg-indigo-50/50 text-slate-900',
    sidebarBgClass: 'bg-[#0F0C29] text-indigo-100 border-indigo-900/50',
    sidebarHeaderBgClass: 'bg-[#080619] border-indigo-900/60',
    sidebarBorderClass: 'border-indigo-900/60',
    sidebarActivePillClass: 'bg-gradient-to-r from-indigo-500/30 via-violet-500/20 to-transparent text-indigo-200 border-indigo-500/40 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-indigo-300',
    sidebarHoverClass: 'text-indigo-300/70 hover:bg-[#1A1642]/80 hover:text-white',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-indigo-100',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-indigo-100',
    primaryButtonClass: 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold',
    accentTextClass: 'text-indigo-600',
    accentBadgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    kpiHighlightClass: 'from-indigo-500/10 via-white to-violet-500/5 border-indigo-500/30'
  },

  'monochrome-minimal': {
    id: 'monochrome-minimal',
    name: 'Platinum Steel Minimal (প্ল্যাটিনাম মিনিমাল)',
    tagline: 'Ultra Clean Dark Charcoal & Platinum Metallic Executive Style',
    previewBg: '#F8FAFC',
    previewSidebar: '#0F172A',
    previewAccent: '#475569',

    appBgClass: 'bg-slate-100/90 text-slate-900',
    sidebarBgClass: 'bg-slate-900 text-slate-200 border-slate-800',
    sidebarHeaderBgClass: 'bg-slate-950 border-slate-800',
    sidebarBorderClass: 'border-slate-800',
    sidebarActivePillClass: 'bg-gradient-to-r from-slate-700/50 via-slate-800/40 to-transparent text-white border-slate-600 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-white',
    sidebarHoverClass: 'text-slate-400 hover:bg-slate-800/70 hover:text-white',

    headerBgClass: 'bg-white/95 backdrop-blur-md border-slate-200',
    headerTitleClass: 'text-slate-900',

    cardClass: 'corporate-card bg-white border-slate-200',
    primaryButtonClass: 'bg-slate-900 hover:bg-slate-800 text-white font-extrabold',
    accentTextClass: 'text-slate-800',
    accentBadgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    kpiHighlightClass: 'from-slate-500/10 via-white to-slate-400/5 border-slate-400/30'
  },

  'emerald-night': {
    id: 'emerald-night',
    name: 'Midnight Emerald Glow (মিডনাইট এমারেল্ড)',
    tagline: 'Ultra Dark Black-Green OLED Sidebar with Pure Mint Neon Glow',
    previewBg: '#02120F',
    previewSidebar: '#011915',
    previewAccent: '#10B981',

    appBgClass: 'bg-[#02120F] text-slate-100',
    sidebarBgClass: 'bg-[#011915] text-slate-200 border-emerald-950',
    sidebarHeaderBgClass: 'bg-[#01110E] border-emerald-950',
    sidebarBorderClass: 'border-emerald-950',
    sidebarActivePillClass: 'bg-gradient-to-r from-emerald-500/30 via-teal-500/20 to-transparent text-emerald-300 border-emerald-500/50 shadow-xs font-extrabold',
    sidebarActiveTextClass: 'text-emerald-400',
    sidebarHoverClass: 'text-slate-400 hover:bg-[#032620] hover:text-slate-100',

    headerBgClass: 'bg-[#031E1B]/95 backdrop-blur-md border-emerald-950',
    headerTitleClass: 'text-white',

    cardClass: 'bg-[#042823] border-emerald-900/60 text-slate-100 shadow-md',
    primaryButtonClass: 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black',
    accentTextClass: 'text-emerald-400',
    accentBadgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    kpiHighlightClass: 'from-emerald-950/50 via-[#042823] to-slate-900 border-emerald-500/40'
  }
};

export const getThemeConfig = (themeId?: ThemeId): ThemeConfig => {
  if (themeId && SYSTEM_THEMES[themeId]) {
    return SYSTEM_THEMES[themeId];
  }
  return SYSTEM_THEMES['emerald-enterprise'];
};
