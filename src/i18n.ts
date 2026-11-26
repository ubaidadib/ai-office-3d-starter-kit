// Language: chosen once at page load (?lang=en|ar, else the config default). English and Arabic only.
// Unit tests (no browser) always run in English; tests/config.test.ts and tools/check-browser.mjs cover Arabic.
import config, { type Lang, type RoleSlot, type Text } from '../office.config';

const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
const asked = q.get('lang');

export const LANG: Lang = typeof window === 'undefined' ? 'en'
  : asked === 'ar' || asked === 'en' ? asked : config.language.default;
export const RTL = LANG === 'ar';

/** The current-language version of a config text. */
export const t = (x: Text): string => x[LANG];

/** "Marketing Manager · AI" / "مدير التسويق · ذكاء اصطناعي". */
export const roleTitle = (id: RoleSlot) => `${t(config.roles[id].title)} · ${t(config.aiTag)}`;
export const roleChip = (id: RoleSlot) => `${t(config.roles[id].short)} · ${t(config.aiTag)}`;

/** Interface wording (not company-specific, so it lives here rather than in office.config.ts). */
const UI = {
  tour: { en: '▶ Tour', ar: '▶ جولة' },
  shortCut: { en: '▶ Short tour', ar: '▶ جولة قصيرة' },
  movementOn: { en: '❚❚ Movement', ar: '❚❚ الحركة' },
  movementOff: { en: '▶ Movement', ar: '▶ الحركة' },
  goToRoom: { en: 'Go to room…', ar: 'انتقل إلى غرفة…' },
  pause: { en: '❚❚ Pause', ar: '❚❚ إيقاف مؤقت' },
  resume: { en: '▶ Resume', ar: '▶ متابعة' },
  restart: { en: '↺ Restart', ar: '↺ من البداية' },
  exit: { en: '✕ Exit', ar: '✕ خروج' },
  labels: { en: 'Labels', ar: 'التسميات' },
  fullTour: { en: 'Full tour', ar: 'الجولة الكاملة' },
  shortTour: { en: 'Short tour', ar: 'الجولة القصيرة' },
  seconds: { en: 's', ar: 'ث' },
  otherLanguage: { en: 'العربية', ar: 'English' },
  controls: { en: 'Presentation controls', ar: 'أدوات العرض' },
  tipTour: { en: 'Start the full guided tour (T)', ar: 'ابدأ الجولة الكاملة (T)' },
  tipShort: { en: 'Start the short tour (Shift+T)', ar: 'ابدأ الجولة القصيرة (Shift+T)' },
  tipMovement: { en: 'Pause / resume the staged movement (Space)', ar: 'إيقاف الحركة أو متابعتها (مسافة)' },
  tipOverview: { en: 'Overview (H)', ar: 'المنظر العام (H)' },
  tipPause: { en: 'Pause / resume (Space)', ar: 'إيقاف مؤقت أو متابعة (مسافة)' },
  tipRestart: { en: 'Restart (R)', ar: 'من البداية (R)' },
  tipExit: { en: 'Exit the tour (Esc)', ar: 'الخروج من الجولة (Esc)' },
  tipLabels: { en: 'Room labels (L)', ar: 'تسميات الغرف (L)' },
  tipFull: { en: 'Full screen (Shift+F)', ar: 'ملء الشاشة (Shift+F)' },
  tipLanguage: { en: 'Switch language', ar: 'تغيير اللغة' },
  simulated: { en: 'SIMULATED', ar: 'محاكاة' },
  notAiActivity: { en: 'staged movement — not AI activity', ar: 'حركة مُعدّة مسبقًا — ليست نشاطًا فعليًا' },
} satisfies Record<string, Text>;

export const ui = (k: keyof typeof UI): string => UI[k][LANG];

/** Same page in the other language (keeps every other address option). */
export function otherLanguageHref(): string {
  const p = new URLSearchParams(window.location.search);
  p.set('lang', LANG === 'ar' ? 'en' : 'ar');
  return `${window.location.pathname}?${p.toString()}`;
}

/** Applies language, direction, brand colours and title to the document. Called once at start-up. */
export function applyDocumentSettings() {
  const root = document.documentElement;
  root.lang = LANG;
  root.dir = RTL ? 'rtl' : 'ltr';
  root.style.setProperty('--brand-primary', config.brand.primary);
  root.style.setProperty('--brand-accent', config.brand.accent);
  document.title = `${t(config.company.name)} — ${t(config.company.headquarters)} · ${t(config.disclosure)}`;
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) icon.href = config.brand.mark;
  if (window.__m2) { window.__m2.lang = LANG; window.__m2.config = config; }
}
