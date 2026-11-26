# Customisation prompt · أمر التخصيص

Open this folder in an AI coding assistant (Claude Code, Cursor, Windsurf, GitHub Copilot agent mode or similar),
then copy **one** of the two prompts below into its chat. Both do the same thing; pick your language.

افتح هذا المجلد في مساعد برمجة بالذكاء الاصطناعي (مثل Claude Code أو Cursor أو Windsurf أو GitHub Copilot)،
ثم انسخ **أحد** الأمرين التاليين في نافذة المحادثة. كلاهما يؤدي المهمة نفسها؛ اختر لغتك.

> In Claude Code you can simply type `/customize-ai-office` instead.
> في Claude Code يمكنك ببساطة كتابة `/customize-ai-office` بدلًا من ذلك.

---

## English

```text
You are helping me customise the "AI Office 3D Starter Kit" in this folder for my company.

Rules:
- Only edit office.config.ts and add files to public/brand/. Do not change anything in src/, tests/ or tools/
  unless I explicitly ask.
- Every text in the config needs both an English ("en") and an Arabic ("ar") version. If I give you only one
  language, write a natural, professional translation for the other and show it to me for approval.
- Keep the disclosure honest: the figures follow a fixed script and do no real work. Do not reword "disclosure",
  "closingLine", "captions.teamMeetingSub" or "captions.meetingSub" into a claim of live or real AI activity.
  Leave "founder", "aiTag" and the other captions as they are unless I ask.
- Do not add new packages, create accounts or publish anything. (Running `npm install` to install the kit's own
  dependencies is fine.)

Steps:
1. Read README.md and office.config.ts so you understand what can be changed.
2. Ask me, in one short message, for:
   a) my company name (and Arabic name if different), and the subtitle under it, shown on the badge and the closing card (default "AI Office HQ"),
   b) my two brand colours (a dark primary colour and a highlight/accent colour) as hex codes, or my website so you can suggest them,
   c) my logo files (a light version of the full logo, and a square mark), or say "keep the placeholder",
   d) the four AI roles I want to show (a title and a short 1–2 word label for each), or say "keep the defaults",
   e) any room names I want to change,
   f) which language the page should open in by default.
3. Edit office.config.ts with my answers. Put logo files in public/brand/ and update brand.logo and brand.mark.
   Pick a different character for each role (the list of allowed characters is at the top of the file) and
   role colours that are easy to tell apart, not pure green and not the same as my brand colours.
   Each role slot owns rooms that should fit the new role; rename them in both languages and tell me what you chose:
   coo → coo_office · marketing → marketing_office, marketing_studio · admissions → admissions_office,
   admissions_library · bizdev → bizdev_office, bizdev_pipeline. Name the four role offices in the same pattern.
4. Run `npm install` if node_modules is missing, then `npm run check`. Fix any config problem it reports and run it again
   until it passes.
5. Start `npm run dev` and give me two links: http://127.0.0.1:5173/?lang=en and http://127.0.0.1:5173/?lang=ar
   (leave it running; I stop it with Ctrl+C). If you can open a browser, look at both and tell me if any text is
   cut off or hard to read. If you cannot, and Chrome is installed, run `npm run build && npm run check:browser`
   and look at the screenshots it saves in check-output/.
6. Finish with a short summary of what you changed, and the recording address:
   http://127.0.0.1:5173/?lang=<default language>&autoplay=short&clean=1  (add &frame=9x16 for a vertical video).
```

---

## العربية

<div dir="rtl">

```text
ساعدني في تخصيص «مجموعة البداية لمكتب الذكاء الاصطناعي ثلاثي الأبعاد» الموجودة في هذا المجلد لتناسب شركتي.

القواعد:
- عدّل الملف office.config.ts فقط، وأضف الملفات إلى المجلد public/brand/. لا تغيّر أي شيء في src/ أو tests/ أو tools/
  إلا إذا طلبت ذلك صراحةً.
- كل نص في ملف الإعدادات يحتاج إلى نسخة إنجليزية ("en") ونسخة عربية ("ar"). إذا أعطيتك لغة واحدة فقط، فاكتب ترجمة
  احترافية وطبيعية للغة الأخرى واعرضها عليّ للموافقة.
- حافظ على صدق سطر التوضيح: الشخصيات تتّبع سيناريو ثابتًا ولا تؤدي أي عمل فعلي. لا تُعِد صياغة "disclosure"
  أو "closingLine" أو "captions.teamMeetingSub" أو "captions.meetingSub" لتوحي بنشاط حقيقي أو مباشر للذكاء الاصطناعي.
  اترك "founder" و"aiTag" وبقية التعليقات كما هي ما لم أطلب غير ذلك.
- لا تُضِف حزمًا جديدة، ولا تنشئ حسابات، ولا تنشر أي شيء. (لا بأس بتشغيل `npm install` لتثبيت الحزم التي تعتمد عليها
  المجموعة أصلًا.)

الخطوات:
1. اقرأ README.ar.md (أو README.md) وoffice.config.ts لتفهم ما يمكن تغييره.
2. اطلب مني في رسالة واحدة قصيرة:
   أ) اسم شركتي (والاسم بالإنجليزية إن كان مختلفًا)، والعنوان الفرعي الذي يظهر تحته في الشارة والبطاقة الختامية (الافتراضي «مقرّ فريق الذكاء الاصطناعي»)،
   ب) لوني هويتي (لون أساسي داكن ولون إبراز accent) بصيغة hex، أو رابط موقعي لتقترحهما،
   ج) ملفات شعاري (نسخة فاتحة من الشعار الكامل، ورمز مربع)، أو عبارة «أبقِ الشعار المؤقت»،
   د) الأدوار الأربعة بالذكاء الاصطناعي التي أريد عرضها (مسمّى واسم مختصر من كلمة أو كلمتين لكل دور)، أو عبارة «أبقِ الأدوار الافتراضية»،
   هـ) أي أسماء غرف أريد تغييرها،
   و) اللغة التي تفتح بها الصفحة افتراضيًا.
3. عدّل office.config.ts وفق إجاباتي. ضع ملفات الشعار في public/brand/ وحدّث brand.logo وbrand.mark.
   اختر شخصية مختلفة لكل دور (قائمة الشخصيات المسموح بها في أعلى الملف)، وألوانًا للأدوار يسهل التمييز بينها،
   وليست خضراء صرفة، ولا تطابق لوني هويتي.
   لكل دور غرف خاصة به يجب أن تناسب الدور الجديد؛ غيّر أسماءها باللغتين وأخبرني بما اخترت:
   coo: coo_office · marketing: marketing_office وmarketing_studio · admissions: admissions_office
   وadmissions_library · bizdev: bizdev_office وbizdev_pipeline. وسمِّ مكاتب الأدوار الأربعة بصيغة موحّدة.
4. شغّل `npm install` إذا لم يكن المجلد node_modules موجودًا، ثم `npm run check`. أصلح أي مشكلة في الإعدادات يبلّغ عنها،
   وأعد التشغيل حتى ينجح.
5. شغّل `npm run dev` وأعطني رابطين: http://127.0.0.1:5173/?lang=ar و http://127.0.0.1:5173/?lang=en
   (اتركه يعمل؛ سأوقفه بنفسي بالضغط على Ctrl+C). إذا كان بإمكانك فتح متصفح، فافحص الصفحتين وأخبرني إن كان أي نص
   مقطوعًا أو صعب القراءة. وإن لم يكن ذلك ممكنًا وكان Chrome مثبّتًا، فشغّل `npm run build && npm run check:browser`
   وافحص لقطات الشاشة التي يحفظها في المجلد check-output/.
6. اختم بملخص قصير لما غيّرته، وبعنوان التسجيل:
   http://127.0.0.1:5173/?lang=<اللغة الافتراضية>&autoplay=short&clean=1  (أضف &frame=9x16 لفيديو عمودي).
```

</div>
