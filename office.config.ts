// ─────────────────────────────────────────────────────────────────────────────
//  AI Office 3D Starter Kit — the ONE file you edit to make the office yours.
//  ملف الإعدادات الوحيد الذي تحتاج إلى تعديله لتخصيص المكتب.
//
//  Every visible text has an English (en) and an Arabic (ar) version.
//  The page opens in `language.default`; add ?lang=en or ?lang=ar to the address to switch.
//
//  After editing, run:  npm run check      (type check + tests)
//  then look at it:     npm run dev        (opens on http://127.0.0.1:5173)
// ─────────────────────────────────────────────────────────────────────────────

export type Lang = 'en' | 'ar';
/** A text shown on screen, in both languages. */
export type Text = Record<Lang, string>;

/** The 13 Kenney Mini Characters (public domain) you can pick for a role. */
export type CharacterModel =
  | 'character-female-a' | 'character-female-b' | 'character-female-c' | 'character-female-d'
  | 'character-female-e' | 'character-female-f'
  | 'character-male-a' | 'character-male-b' | 'character-male-c' | 'character-male-d'
  | 'character-male-e' | 'character-male-f' | 'character-male-g';

/**
 * The four role slots. The internal ids never change (the floor plan, seats and the meeting scene use them);
 * only the titles, colours and characters do. Slot → office it sits in:
 *   coo        → top row, second office       marketing  → middle row, left office
 *   admissions → top row, right-hand office   bizdev     → middle row, right office
 */
export type RoleSlot = 'coo' | 'marketing' | 'admissions' | 'bizdev';

export type RoomId =
  | 'founder_office' | 'coo_office' | 'boardroom' | 'admissions_office' | 'admissions_library'
  | 'marketing_office' | 'marketing_studio' | 'meeting_room' | 'bizdev_pipeline' | 'bizdev_office'
  | 'lounge' | 'reception' | 'archive';

export interface OfficeConfig {
  company: {
    /** Shown in the corner badge, the first tour caption and the browser tab. */
    name: Text;
    /** Second line of the corner badge and the title on the opening and closing cards. */
    headquarters: Text;
  };
  language: {
    default: Lang;
    /** Show the English / العربية switch in the control dock. */
    switcher: boolean;
  };
  brand: {
    /** Main dark colour: logo wall, cards, badges. Use a dark colour so white text stays readable. */
    primary: string;
    /** Highlight colour: lines, buttons, the wall trim and the welcome mat border. */
    accent: string;
    /** Logo shown on the reception wall and on the opening and closing cards. Light version: it sits on `primary`.
     *  PNG (transparent background, at least 600 px tall) or SVG with width and height set. Put the file in public/brand/. */
    logo: string;
    /** Square mark for the corner badge, the welcome mat and the browser tab icon. */
    mark: string;
  };
  /** The permanent on-screen line. Keep it honest: the figures follow a fixed script and do no real work. */
  disclosure: Text;
  /** Second line on the closing card. */
  closingLine: Text;
  /** Tag added after every AI role title, so no figure is mistaken for a person. */
  aiTag: Text;
  founder: {
    /** Nameplate of the founder's office. There is deliberately no figure for the founder: a real person. */
    nameplate: Text;
    /** Caption under the founder's office in the full tour. */
    caption: Text;
  };
  roles: Record<RoleSlot, {
    /** Full role title (the AI tag is added automatically). */
    title: Text;
    /** Short form for the small chip above a walking figure. */
    short: Text;
    /** Colour of the role: office door strip, nameplate edge and chip border. Avoid pure green. */
    color: string;
    character: CharacterModel;
  }>;
  rooms: Record<RoomId, Text>;
  captions: {
    /** Second line of the first tour caption (the size of the floor). */
    floor: Text;
    reception: Text;
    aiRole: Text;
    teamMeeting: Text;
    teamMeetingSub: Text;
    meetingSub: Text;
  };
}

const config: OfficeConfig = {
  company: {
    name: { en: 'Your Company', ar: 'شركتك' },
    headquarters: { en: 'AI Office HQ', ar: 'مقرّ فريق الذكاء الاصطناعي' },
  },
  language: { default: 'en', switcher: true },
  brand: {
    primary: '#0B1530',
    accent: '#D4AF37',
    logo: '/brand/logo.svg',
    mark: '/brand/mark.svg',
  },
  disclosure: { en: 'Concept visualisation — simulated activity', ar: 'تصوّر مفاهيمي — نشاط مُحاكى' },
  closingLine: { en: 'Concept preview · the movement shown is illustrative', ar: 'معاينة مفاهيمية · الحركة المعروضة توضيحية' },
  aiTag: { en: 'AI', ar: 'ذكاء اصطناعي' },
  founder: {
    nameplate: { en: 'Founder · Human', ar: 'المؤسس · إنسان' },
    caption: { en: 'Human leadership · approvals stay with a person', ar: 'قيادة بشرية · القرار النهائي بيد إنسان' },
  },
  roles: {
    coo: {
      title: { en: 'Chief Operating Officer', ar: 'مدير العمليات' },
      short: { en: 'COO', ar: 'العمليات' },
      color: '#2b4a7a', character: 'character-male-d',
    },
    marketing: {
      title: { en: 'Marketing Manager', ar: 'مدير التسويق' },
      short: { en: 'Marketing', ar: 'التسويق' },
      color: '#d9735b', character: 'character-female-b',
    },
    admissions: {
      title: { en: 'Research Analyst', ar: 'محلل الأبحاث' },
      short: { en: 'Research', ar: 'الأبحاث' },
      color: '#2f8f83', character: 'character-female-e',
    },
    bizdev: {
      title: { en: 'Business Development Specialist', ar: 'أخصائي تطوير الأعمال' },
      short: { en: 'Business Development', ar: 'تطوير الأعمال' },
      color: '#6b5ca5', character: 'character-male-e',
    },
  },
  rooms: {
    founder_office: { en: 'Founder’s Office', ar: 'مكتب المؤسس' },
    coo_office: { en: 'COO Executive Office', ar: 'المكتب التنفيذي لمدير العمليات' },
    boardroom: { en: 'Boardroom', ar: 'قاعة مجلس الإدارة' },
    admissions_office: { en: 'Research Analyst’s Office', ar: 'مكتب محلل الأبحاث' },
    admissions_library: { en: 'Research Library', ar: 'مكتبة الأبحاث' },
    marketing_office: { en: 'Marketing Manager’s Office', ar: 'مكتب مدير التسويق' },
    marketing_studio: { en: 'Marketing Studio', ar: 'استوديو التسويق' },
    meeting_room: { en: 'Central Meeting Room', ar: 'قاعة الاجتماعات الرئيسية' },
    bizdev_pipeline: { en: 'Partnerships Pipeline', ar: 'مسار الشراكات' },
    bizdev_office: { en: 'Business Development Office', ar: 'مكتب تطوير الأعمال' },
    lounge: { en: 'Collaboration Lounge', ar: 'صالة التعاون' },
    reception: { en: 'Reception', ar: 'الاستقبال' },
    archive: { en: 'Records Archive', ar: 'أرشيف السجلات' },
  },
  captions: {
    floor: { en: '30 × 22 m · 13 rooms', ar: '30 × 22 م · 13 غرفة' },
    reception: { en: 'Welcome area', ar: 'منطقة الترحيب' },
    aiRole: { en: 'AI role', ar: 'دور بالذكاء الاصطناعي' },
    teamMeeting: { en: 'Team meeting', ar: 'اجتماع الفريق' },
    teamMeetingSub: { en: 'Staged sequence', ar: 'مشهد مُعدّ مسبقًا' },
    meetingSub: { en: 'Four AI roles · staged collaboration scene', ar: 'أربعة أدوار بالذكاء الاصطناعي · مشهد تعاون مُعدّ مسبقًا' },
  },
};

export default config;
