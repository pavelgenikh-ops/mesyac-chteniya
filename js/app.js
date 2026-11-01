/* Месяц чтения — экраны: Сегодня, Курс, Урок, Книги, Читалка. Прогресс и настройки — в localStorage этого телефона. */
(() => {
  const KEY = 'mesyac.v1';
  const L = (window.LESSONS || []).slice().sort((a, b) => a.day - b.day);
  const T = Object.fromEntries(TOPICS.map(t => [t.id, t]));
  const $ = s => document.querySelector(s);
  const view = $('#view');
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- состояние ---------- */
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
  S = Object.assign({ done: {}, quiz: {}, font: 18, theme: 'paper', books: {}, lastRead: null }, S);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const iso = d => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const human = s => { const [y, m, d] = s.split('-'); return +d + ' ' + MONTHS[m - 1]; };

  function applyLook() {
    document.documentElement.style.setProperty('--fs', S.font + 'px');
    document.body.dataset.theme = S.theme;
    $('meta[name=theme-color]').content = S.theme === 'night' ? '#1C2738' : S.theme === 'white' ? '#FCFCFA' : '#F4F2EC';
    $('#fontV').textContent = S.font;
    document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.theme === S.theme));
  }

  const lessonByDay = d => L.find(l => l.day === d);
  const nextLesson = () => L.find(l => !S.done[l.day]);
  const doneCount = () => L.filter(l => S.done[l.day]).length;
  const topicBook = id => Object.entries(S.books).find(([, b]) => b.topic === id);
  function streak() {
    const days = new Set(Object.values(S.done));
    const d = new Date();
    if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function quizScore() {
    let ok = 0, all = 0;
    for (const l of L) for (const [qi, a] of Object.entries(S.quiz[l.day] || {})) { all++; if (l.quiz[qi] && l.quiz[qi].ok === a) ok++; }
    return { ok, all };
  }
  const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };

  /* ---------- шапка ---------- */
  const stack = [];          // переходы внутри приложения — для кнопки «Назад»
  let replacing = false;
  function chrome(title, tab, back) {
    $('#topTitle').textContent = title;
    $('#back').hidden = !back;
    $('#back').dataset.to = back || '';
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  }
  $('#back').onclick = () => { if (stack.length > 1) history.back(); else location.hash = $('#back').dataset.to; };

  /* ---------- сетка 30 дней ---------- */
  function grid() {
    const now = nextLesson();
    return TOPICS.map(t => {
      const ls = L.filter(l => l.topic === t.id);
      return `<div class="grid-topic"><div class="gt">${esc(t.title)}</div><div class="grid">` +
        ls.map(l => `<a class="cell${S.done[l.day] ? ' done' : ''}${now && now.day === l.day ? ' now' : ''}" href="#lesson/${l.day}" aria-label="День ${l.day}">${l.day}</a>`).join('') +
        `</div></div>`;
    }).join('');
  }

  /* ---------- Сегодня ---------- */
  function today() {
    chrome('Месяц чтения', 'today');
    const n = nextLesson(), dc = doneCount(), sc = quizScore(), st = streak();
    let hero;
    if (!L.length) hero = `<div class="card">Уроки не загружены.</div>`;
    else if (!n) hero = `<div class="card sig"><div class="k-rubric">Курс пройден</div><h2 class="k-title">Все 30 дней позади</h2>
      <p class="k-sub lead">Шесть тем — это карта. Дальше — книги целиком: они ждут во вкладке «Книги».</p><a class="k-btn-primary wide" href="#books">К книгам</a></div>`;
    else {
      const t = T[n.topic];
      hero = `<div class="card sig"><div class="k-rubric">День ${n.day} из ${L.length} · ${esc(t.title)}</div>
        <h2 class="k-title">${esc(n.title)}</h2><p class="k-sub lead">${esc(n.lead)}</p>
        <p class="meta">≈ ${n.minutes || 25} минут: конспект, ${n.watch && n.watch.length ? 'оригинал, ' : ''}три вопроса</p>
        <a class="k-btn-primary wide" href="#lesson/${n.day}">Читать урок</a></div>`;
    }
    let cont = '';
    const lb = S.lastRead && S.books[S.lastRead];
    if (lb) cont = `<a class="card" href="#read/${S.lastRead}" style="display:block;text-decoration:none;color:inherit">
      <div class="k-rubric">Продолжить книгу</div><div style="font-weight:600;margin-top:4px">${esc(lb.title)}</div>
      <div class="bar"><i style="width:${Math.round((lb.prog || 0) * 100)}%"></i></div><div class="meta">${Math.round((lb.prog || 0) * 100)} % прочитано</div></a>`;
    view.innerHTML = `<h1 class="k-title">Месяц <span class="k-accent">чтения</span></h1>
      <p class="k-sub" style="margin:0 0 16px">6 тем · 30 дней · 20–30 минут в день</p>
      ${hero}${cont}
      <div class="card"><div class="k-rubric">Прогресс</div>
        <div class="bar"><i style="width:${L.length ? dc / L.length * 100 : 0}%"></i></div>
        <div class="stats mt">
          <div class="stat"><b class="k-num">${dc}</b><span>${plural(dc, 'урок пройден', 'урока пройдено', 'уроков пройдено')}</span></div>
          <div class="stat"><b class="k-num">${st}</b><span>${plural(st, 'день', 'дня', 'дней')} подряд</span></div>
          <div class="stat"><b class="k-num">${sc.all ? Math.round(sc.ok / sc.all * 100) + '%' : '—'}</b><span>верных ответов</span></div>
        </div>
        <div class="mt">${grid()}</div></div>`;
  }

  /* ---------- Курс ---------- */
  function course() {
    chrome('Курс', 'course');
    view.innerHTML = `<h1 class="k-title">Шесть <span class="k-accent">тем</span></h1>
      <p class="k-sub" style="margin:0 0 16px">По пять дней на тему. Идти можно по порядку или открыть любой день.</p>` +
      TOPICS.map(t => {
        const ls = L.filter(l => l.topic === t.id);
        const d0 = ls.length ? ls[0].day : '', d1 = ls.length ? ls[ls.length - 1].day : '';
        return `<div class="card sig"><div class="k-rubric">Тема ${t.n}${ls.length ? ` · дни ${d0}–${d1}` : ''}</div>
          <h2 class="k-title" style="margin-top:6px">${esc(t.title)}</h2><p class="k-sub" style="margin:0 0 10px">${esc(t.src)}</p>` +
          (ls.length ? ls.map(l => `<a class="day${S.done[l.day] ? ' done' : ''}" href="#lesson/${l.day}"><span class="dn">${S.done[l.day] ? '✓' : l.day}</span>
            <span class="dt">${esc(l.title)}<small>${S.done[l.day] ? 'пройден ' + human(S.done[l.day]) : (l.minutes || 25) + ' мин'}</small></span></a>`).join('')
            : '<p class="hint">Уроки этой темы ещё не добавлены.</p>') + `</div>`;
      }).join('');
  }

  /* ---------- Урок ---------- */
  function bodyHtml(lines) {
    let h = '', ul = false;
    for (const raw of lines || []) {
      const l = String(raw);
      if (l.startsWith('- ')) { if (!ul) { h += '<ul>'; ul = true; } h += '<li>' + esc(l.slice(2)) + '</li>'; continue; }
      if (ul) { h += '</ul>'; ul = false; }
      if (l.startsWith('## ')) h += '<h3>' + esc(l.slice(3)) + '</h3>';
      else if (l.startsWith('> ')) h += '<div class="ex">' + esc(l.slice(2)) + '</div>';
      else h += '<p>' + esc(l) + '</p>';
    }
    return h + (ul ? '</ul>' : '');
  }
  function quizHtml(l) {
    const ans = S.quiz[l.day] || {};
    return l.quiz.map((q, qi) => {
      const a = ans[qi];
      return `<div class="q"><p>${qi + 1}. ${esc(q.q)}</p>` + q.a.map((o, oi) => {
        let c = '';
        if (a != null) { if (oi === q.ok) c = ' ok'; else if (oi === a) c = ' bad'; }
        return `<button class="opt${c}" data-q="${qi}" data-o="${oi}" ${a != null ? 'disabled' : ''}>${esc(o)}</button>`;
      }).join('') + (a != null ? `<p class="why">${a === q.ok ? 'Верно. ' : 'Не совсем. '}${esc(q.why)}</p>` : '') + `</div>`;
    }).join('');
  }
  function lesson(day) {
    const l = lessonByDay(day);
    if (!l) { location.hash = '#course'; return; }
    const t = T[l.topic];
    chrome(`День ${l.day} · ${t.title}`, 'course', '#course');
    const tb = topicBook(l.topic);
    const watch = (l.watch || []).map(w => w.url
      ? `<a href="${esc(w.url)}" target="_blank" rel="noopener"><b>${esc(w.what)}</b><small>${esc(w.note || '')}</small></a>`
      : `<div class="w"><b>${esc(w.what)}</b><small>${esc(w.note || '')}</small>${tb ? `<div style="margin-top:8px"><a class="k-btn sm" href="#read/${tb[0]}">Открыть мою книгу</a></div>` : ''}</div>`).join('');
    const next = lessonByDay(l.day + 1);
    view.innerHTML = `<div class="k-rubric">День ${l.day} из ${L.length} · ${esc(t.title)}</div>
      <h1 class="k-title">${esc(l.title)}</h1><p class="k-sub lead">${esc(l.lead)}</p>
      ${watch ? `<div class="card watch"><div class="k-rubric" style="margin-bottom:4px">В оригинале</div>${watch}
        ${!tb && t.kind === 'book' ? `<p class="hint" style="margin:8px 0 0">Загрузите свою книгу во вкладке «Книги» — она откроется прямо отсюда.</p>` : ''}</div>` : ''}
      <article class="lesson">${bodyHtml(l.body)}</article>
      <div class="card sig key"><div class="k-rubric">Главное</div><ul class="lesson" style="padding-left:1.1em;margin:8px 0 0">${(l.key || []).map(k => `<li>${esc(k)}</li>`).join('')}</ul></div>
      ${l.try ? `<div class="card"><div class="k-rubric">Задание на сегодня</div><p class="lesson" style="margin:8px 0 0">${esc(l.try)}</p></div>` : ''}
      <div class="card quiz" id="quiz"><div class="k-rubric" style="margin-bottom:10px">Проверь себя</div>${quizHtml(l)}</div>
      <div class="donebox" id="donebox">${doneBox(l, next)}</div>`;
    window.scrollTo(0, 0);
    view.querySelector('#quiz').onclick = e => {
      const b = e.target.closest('.opt'); if (!b || b.disabled) return;
      (S.quiz[l.day] = S.quiz[l.day] || {})[b.dataset.q] = +b.dataset.o; save();
      view.querySelector('#quiz').innerHTML = `<div class="k-rubric" style="margin-bottom:10px">Проверь себя</div>` + quizHtml(l);
    };
    view.querySelector('#donebox').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'done') S.done[l.day] = iso(); else delete S.done[l.day];
      save();
      view.querySelector('#donebox').innerHTML = doneBox(l, next);
    };
  }
  function doneBox(l, next) {
    if (!S.done[l.day]) return `<button class="k-btn-primary wide" data-act="done">Урок пройден</button>`;
    return `<p class="meta">Пройден ${human(S.done[l.day])} · <button class="x" style="font-size:14px;text-decoration:underline" data-act="undo">снять отметку</button></p>` +
      (next ? `<a class="k-btn-primary wide" href="#lesson/${next.day}">Дальше: день ${next.day}</a>` : `<a class="k-btn-primary wide" href="#today">На главную</a>`);
  }

  /* ---------- Книги ---------- */
  function bookRow(id, b) {
    const p = Math.round((b.prog || 0) * 100);
    return `<div class="mybook"><div class="bt"><b>${esc(b.title)}</b><small>${esc(b.author || '')}${b.author ? ' · ' : ''}${b.chapters} ${plural(b.chapters, 'глава', 'главы', 'глав')} · прочитано ${p} %</small></div>
      <a class="k-btn-primary sm" href="#read/${id}">Читать</a><button class="x" data-del="${id}" aria-label="Убрать книгу">×</button></div>`;
  }
  const uploadBtn = (topic, label) => `<label class="k-btn sm file">${label}<input type="file" data-topic="${topic}"></label>`;
  function books() {
    chrome('Книги', 'books');
    const others = Object.entries(S.books).filter(([, b]) => !b.topic);
    view.innerHTML = `<h1 class="k-title">Книги и <span class="k-accent">лекции</span></h1>
      <div class="card"><p style="margin:0 0 8px">Тексты книг защищены авторским правом, поэтому в приложение не вшиты. Конспекты всех тем — в уроках курса.</p>
      <p class="hint" style="margin:0">Чтобы читать книгу целиком: купите электронную версию (например, на ЛитРес), скачайте файл <b>FB2</b> или <b>EPUB</b> и загрузите его сюда. Книга останется только в этом телефоне, будет открываться без интернета и запомнит место, где вы остановились.</p></div>` +
      TOPICS.map(t => {
        const tb = Object.entries(S.books).filter(([, b]) => b.topic === t.id);
        const links = (t.links || []).map(x => `<a class="k-btn sm" href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)} ↗</a>`).join('');
        return `<div class="card sig src"><div class="k-rubric">Тема ${t.n} · ${esc(t.title)}</div><h3>${esc(t.src)}</h3>
          <p class="hint" style="margin:6px 0 0">${esc(t.about)}</p>
          <div class="links">${t.buy ? `<a class="k-btn sm" href="${esc(t.buy)}" target="_blank" rel="noopener">Найти на ЛитРес ↗</a>` : ''}${links}
          ${t.kind === 'book' && !tb.length ? uploadBtn(t.id, 'Загрузить файл книги') : ''}</div>
          ${tb.map(([id, b]) => bookRow(id, b)).join('')}</div>`;
      }).join('') +
      `<div class="card"><div class="k-rubric">Другие книги</div><p class="hint" style="margin:6px 0 10px">Любая своя книга FB2, EPUB или TXT — читалка та же.</p>
        ${others.map(([id, b]) => bookRow(id, b)).join('')}<div class="links">${uploadBtn('', 'Загрузить книгу')}</div></div>
      <p class="hint" id="bmsg" style="text-align:center"></p>`;
    view.onchange = async e => {
      const inp = e.target.closest('input[type=file]'); if (!inp || !inp.files[0]) return;
      const f = inp.files[0];
      $('#bmsg').textContent = 'Открываю «' + f.name + '»…';
      try {
        const m = await Books.add(f);
        S.books[m.id] = { name: m.name, title: m.title, author: m.author, size: m.size, chapters: m.chapters, topic: inp.dataset.topic || '', added: iso(), ch: 0, pos: 0, prog: 0 };
        save(); books();
      } catch (err) { $('#bmsg').textContent = 'Не получилось: ' + err.message; }
    };
    view.onclick = async e => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      const b = S.books[d.dataset.del];
      if (!confirm('Убрать «' + b.title + '» из телефона? Закладка тоже пропадёт.')) return;
      await Books.remove(d.dataset.del).catch(() => {});
      delete S.books[d.dataset.del]; if (S.lastRead === d.dataset.del) S.lastRead = null;
      save(); books();
    };
  }

  /* ---------- Читалка ---------- */
  let saveT = null;
  async function read(id, ch, toc) {
    const meta = S.books[id];
    if (!meta) { location.hash = '#books'; return; }
    document.body.classList.add('reading');
    chrome(meta.title, 'books', '#books');
    view.innerHTML = `<div class="busy">Открываю книгу…</div>`;
    let book;
    try { book = await Books.open(id, meta.name); }
    catch (err) { view.innerHTML = `<div class="card">${esc(err.message)}</div>`; return; }
    if (location.hash.indexOf('#read/' + id) !== 0 && location.hash.indexOf('#toc/' + id) !== 0) return;
    S.lastRead = id; save();
    const N = book.chapters.length;
    if (toc) {
      chrome('Оглавление', 'books', '#read/' + id);
      view.innerHTML = `<h1 class="k-title">${esc(book.title)}</h1><p class="k-sub">${esc(book.author)}</p><div class="toc">` +
        book.chapters.map((c, i) => `<a href="#read/${id}/${i}" class="${i === meta.ch ? 'on' : ''}">${esc(c.title)}</a>`).join('') + `</div>`;
      const on = view.querySelector('.toc a.on'); if (on) on.scrollIntoView({ block: 'center' });
      return;
    }
    const jump = ch != null;
    let i = jump ? Math.max(0, Math.min(N - 1, ch)) : Math.min(meta.ch || 0, N - 1);
    if (jump && i !== meta.ch) meta.pos = 0;
    meta.ch = i;
    view.innerHTML = `<article class="reader">${book.chapters[i].html}</article>`;
    let rb = $('#rbar');
    if (!rb) { rb = document.createElement('nav'); rb.id = 'rbar'; rb.className = 'rbar k-glass'; document.body.appendChild(rb); }
    rb.innerHTML = `<button class="ico" ${i === 0 ? 'disabled' : ''} data-go="${i - 1}" aria-label="Предыдущая глава">‹</button>
      <div class="mid"><span class="k-num">${i + 1} / ${N}</span> · <span id="rp">${Math.round((meta.prog || 0) * 100)} %</span><div class="bar"><i id="rpb" style="width:${(meta.prog || 0) * 100}%"></i></div></div>
      <a class="ico" href="#toc/${id}" aria-label="Оглавление" style="display:grid;place-items:center;text-decoration:none;color:inherit">☰</a>
      <button class="ico" ${i >= N - 1 ? 'disabled' : ''} data-go="${i + 1}" aria-label="Следующая глава">›</button>`;
    rb.onclick = e => { const b = e.target.closest('[data-go]'); if (b && !b.disabled) { replacing = true; location.replace('#read/' + id + '/' + b.dataset.go); } };
    const restore = () => { const max = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, max > 0 ? (meta.pos || 0) * max : 0); };
    restore(); setTimeout(restore, 120);
    save();
    window.onscroll = () => {
      if (!location.hash.startsWith('#read/')) return;
      const max = document.documentElement.scrollHeight - innerHeight;
      meta.pos = max > 0 ? Math.min(1, scrollY / max) : 1;
      meta.prog = Math.min(1, (i + meta.pos) / N);
      const rp = $('#rp'); if (rp) { rp.textContent = Math.round(meta.prog * 100) + ' %'; $('#rpb').style.width = meta.prog * 100 + '%'; }
      clearTimeout(saveT); saveT = setTimeout(save, 400);
    };
  }

  /* ---------- маршруты ---------- */
  function route() {
    const h = location.hash || '#today';
    const [name, a, b] = h.slice(1).split('/');
    document.body.classList.remove('reading');
    const rb = $('#rbar'); if (rb) rb.remove();
    window.onscroll = null; view.onchange = null; view.onclick = null;
    if (name === 'lesson') lesson(+a);
    else if (name === 'course') course();
    else if (name === 'books') books();
    else if (name === 'read') read(a, b != null ? +b : null);
    else if (name === 'toc') read(a, null, true);
    else today();
    if (name !== 'read') window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => {
    const h = location.hash || '#today';
    if (replacing) { stack[stack.length - 1] = h; replacing = false; }
    else if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
    else stack.push(h);
    route();
  });
  document.querySelectorAll('.tabs a').forEach(a => a.addEventListener('click', () => { stack.length = 0; }));

  /* ---------- настройки чтения ---------- */
  $('#aa').onclick = () => { $('#sheet').hidden = false; };
  $('#sheetClose').onclick = () => { $('#sheet').hidden = true; };
  $('#sheet').onclick = e => {
    if (e.target.id === 'sheet') { $('#sheet').hidden = true; return; }
    const f = e.target.closest('[data-font]'); if (f) { S.font = Math.max(14, Math.min(26, S.font + +f.dataset.font)); save(); applyLook(); }
    const t = e.target.closest('[data-theme]'); if (t && t.tagName === 'BUTTON') { S.theme = t.dataset.theme; save(); applyLook(); }
  };

  applyLook();
  stack.push(location.hash || '#today');
  route();
})();
