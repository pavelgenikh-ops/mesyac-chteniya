// Собирает уроки content/*.json в js/lessons.js, проверяет их и поднимает версию (?v=) в index.html и sw.js.
// Запуск из папки приложения: <node> _служебное/build.js        (--no-bump — без смены версии)
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..');
const TOPICS = ['games', 'biases', 'philosophy', 'nations', 'art', 'stats'];

const files = fs.readdirSync(path.join(APP, 'content')).filter(f => /^\d\d-.+\.json$/.test(f)).sort();
const all = [], errs = [], warn = [];
for (const f of files) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(APP, 'content', f), 'utf8')); }
  catch (e) { errs.push(f + ': не JSON — ' + e.message); continue; }
  if (!Array.isArray(arr) || arr.length !== 5) errs.push(f + ': нужно 5 уроков, а их ' + (arr && arr.length));
  for (const l of arr || []) {
    const id = f + ' день ' + l.day;
    for (const k of ['day', 'topic', 'title', 'lead', 'body', 'key', 'quiz']) if (l[k] == null) errs.push(id + ': нет поля ' + k);
    if (!TOPICS.includes(l.topic)) errs.push(id + ': неизвестная тема ' + l.topic);
    if (!Array.isArray(l.quiz) || l.quiz.length !== 3) errs.push(id + ': вопросов должно быть 3');
    for (const q of l.quiz || []) {
      if (!Array.isArray(q.a) || q.a.length !== 3 || !(q.ok >= 0 && q.ok < 3)) errs.push(id + ': неверный вопрос «' + q.q + '»');
      if (!q.why) errs.push(id + ': нет пояснения к вопросу');
    }
    for (const w of l.watch || []) if (w.url && !/^https:\/\/(www\.youtube\.com\/results\?search_query=|oyc\.yale\.edu\/|ourworldindata\.org\/|artsandculture\.google\.com\/|ru\.wikipedia\.org\/wiki\/)/.test(w.url)) errs.push(id + ': ссылка вне разрешённых — ' + w.url);
    const text = (l.body || []).join('\n');
    if (/\*\*|\]\(|`/.test(text)) errs.push(id + ': в тексте осталась markdown-разметка');
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 450 || words > 1000) warn.push(id + ': ' + words + ' слов');
    l.words = words;
    all.push(l);
  }
}
all.sort((a, b) => a.day - b.day);
all.forEach((l, i) => { if (l.day !== i + 1) errs.push('пропуск или повтор дня около ' + (i + 1) + ' (стоит ' + l.day + ')'); });
const okCounts = [0, 0, 0];
all.forEach(l => (l.quiz || []).forEach(q => okCounts[q.ok]++));

console.log('уроков: ' + all.length + ', слов: ' + all.reduce((s, l) => s + l.words, 0) + ', верные ответы по местам: ' + okCounts.join('/'));
warn.forEach(w => console.log('  внимание: ' + w));
if (errs.length) { errs.forEach(e => console.log('ОШИБКА ' + e)); process.exit(1); }

all.forEach(l => delete l.words);
fs.writeFileSync(path.join(APP, 'js', 'lessons.js'),
  '/* Собрано _служебное/build.js из content/*.json — руками не править. */\nwindow.LESSONS = ' + JSON.stringify(all) + ';\n', 'utf8');

if (!process.argv.includes('--no-bump')) {
  const V = Date.now().toString(36).slice(-6);
  for (const f of ['index.html', 'sw.js']) {
    const p = path.join(APP, f);
    let s = fs.readFileSync(p, 'utf8');
    s = s.replace(/\?v=[a-z0-9]+/g, '?v=' + V).replace(/(get\('v'\) \|\| ')[a-z0-9]+'/, "$1" + V + "'");
    fs.writeFileSync(p, s, 'utf8');
  }
  console.log('версия: ' + V);
}
