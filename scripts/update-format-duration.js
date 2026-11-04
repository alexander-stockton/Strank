/**
 * Align format.txt templates with ranks.txt duration placeholders (0h0m0s).
 * - Insert ([duration][unit]) on leaves that lack a duration placeholder
 * - Insert rule 14 about 0h0m0s; renumber former 14–18 → 15–19
 */

const fs = require('fs');
const path = require('path');

const RULE_14 = {
  en: `To denote having no time standard, write 0h0m0s if you still want the duration input field to show up in an active workout.`,
  es: `Para indicar que no hay estándar de tiempo, escribe 0h0m0s si aun así quieres que el campo de duración aparezca durante un entrenamiento activo.`,
  de: `Für keinen Zeitstandard schreibe 0h0m0s, wenn das Dauerfeld trotzdem in einem aktiven Training angezeigt werden soll.`,
  fr: `Pour indiquer l'absence de standard de temps, écrivez 0h0m0s si vous voulez quand même que le champ de durée s'affiche pendant une séance active.`,
  pt: `Para indicar que não há padrão de tempo, escreva 0h0m0s se ainda quiser que o campo de duração apareça durante um treino ativo.`,
  ru: `Чтобы указать отсутствие временного норматива, напишите 0h0m0s, если хотите, чтобы поле длительности всё равно отображалось во время активной тренировки.`,
  ja: `時間の基準がなくても、トレーニング中に時間の入力欄を表示したい場合は 0h0m0s と書いてください。`,
  'zh-Hans': `如果没有时间标准，但仍希望在训练中显示时长输入框，请写 0h0m0s。`,
  ar: `للإشارة إلى عدم وجود معيار زمني، اكتب 0h0m0s إذا كنت تريد مع ذلك ظهور حقل المدة أثناء التمرين النشط.`,
  hi: `अगर कोई समय मानक नहीं है, लेकिन आप चाहते हैं कि सक्रिय वर्कआउट में अवधि का इनपुट फ़ील्ड फिर भी दिखे, तो 0h0m0s लिखें।`,
};

function insertDurationOnLeaf(line) {
  if (!/^\t+- /.test(line)) return line;
  if (/\[duration\]/.test(line)) return line;
  if (/\(\[distance\]\[unit\]\)/.test(line)) {
    return line.replace(
      /(\(\[distance\]\[unit\]\))(\s+)/,
      '$1 ([duration][unit])$2'
    );
  }
  if (/\[distance\]\[unit\]/.test(line)) {
    return line.replace(/(\[distance\]\[unit\])(\s+)/, '$1 ([duration][unit])$2');
  }
  if (/x\[reps\]/.test(line)) {
    return line.replace(/(\s+)(x\[reps\])/, ' ([duration][unit]) $2');
  }
  return line;
}

function patchLines(lines, locale) {
  const ruleBody = RULE_14[locale] || RULE_14.en;
  const out = [];
  let inserted = false;
  for (const raw of lines) {
    const line = insertDurationOnLeaf(raw);
    const m = line.match(/^#(\s+)(\d+)\.\s(.*)$/);
    if (m) {
      const num = Number(m[2]);
      if (num === 13) {
        out.push(line);
        out.push(`#${m[1]}14. ${ruleBody}`);
        inserted = true;
        continue;
      }
      if (inserted && num >= 14 && num <= 18) {
        out.push(`#${m[1]}${num + 1}. ${m[3]}`);
        continue;
      }
    }
    out.push(line);
  }
  if (!inserted) throw new Error(`rule 13 not found for locale ${locale}`);
  return out;
}

const root = path.join(__dirname, '..');
const targets = [
  { file: path.join(root, 'data', 'defaults', 'format.txt'), locale: 'en' },
  { file: path.join(root, 'data', 'format.txt'), locale: 'en' },
];

const locRoot = path.join(root, 'data', 'localization');
for (const dir of fs.readdirSync(locRoot)) {
  const file = path.join(locRoot, dir, 'format.txt');
  if (fs.existsSync(file)) {
    targets.push({ file, locale: RULE_14[dir] ? dir : 'en' });
  }
}

for (const { file, locale } of targets) {
  const text = fs.readFileSync(file, 'utf8');
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const next = patchLines(lines, locale);
  fs.writeFileSync(file, next.join(nl), 'utf8');
  console.log('updated', path.relative(root, file), `(${locale})`);
}
