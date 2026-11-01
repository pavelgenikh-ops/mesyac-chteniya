/* Свои книги: файл хранится только в этом телефоне (IndexedDB), никуда не отправляется.
   Разбор форматов FB2 / FB2.ZIP / EPUB / TXT в единый вид { title, author, chapters: [{ title, html }] }. */
(() => {
  /* ---------- хранилище ---------- */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((ok, no) => {
      const r = indexedDB.open('mesyac-chteniya', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((ok, no) => {
      const t = d.transaction('files', mode), s = t.objectStore('files');
      const r = fn(s);
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => no(t.error);
    });
  }
  const putFile = (id, buf) => tx('readwrite', s => s.put(buf, id));
  const getFile = id => tx('readonly', s => s.get(id));
  const delFile = id => tx('readwrite', s => s.delete(id));

  /* ---------- безопасная пересборка HTML: только разрешённые теги, без скриптов и стилей ---------- */
  const KEEP = new Set('p h1 h2 h3 h4 h5 h6 em i b strong u s sup sub small blockquote ul ol li br hr table thead tbody tr td th pre code figure figcaption cite dl dt dd div section span'.split(' '));
  const HEAD = { title: 'h1' };
  function clean(src, resolveImg, out) {
    for (const n of src.childNodes) {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const tag = (n.localName || '').toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'head' || tag === 'iframe' || tag === 'object') continue;
      if (tag === 'img' || tag === 'image') {
        const href = n.getAttribute('src') || n.getAttribute('xlink:href') || n.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || n.getAttribute('href');
        const url = href && resolveImg(href);
        if (url) { const im = document.createElement('img'); im.src = url; im.alt = ''; im.loading = 'lazy'; out.appendChild(im); }
        continue;
      }
      if (tag === 'svg') { clean(n, resolveImg, out); continue; }
      if (tag === 'a') { const sp = document.createElement('span'); clean(n, resolveImg, sp); out.appendChild(sp); continue; }
      const el = document.createElement(KEEP.has(tag) ? tag : (HEAD[tag] || 'span'));
      for (const at of ['colspan', 'rowspan']) if (n.hasAttribute && n.hasAttribute(at)) el.setAttribute(at, n.getAttribute(at));
      clean(n, resolveImg, el);
      out.appendChild(el);
    }
    return out;
  }
  const textOf = n => (n && n.textContent || '').replace(/\s+/g, ' ').trim();

  /* ---------- FB2 ---------- */
  function decodeXml(u8) {
    const head = new TextDecoder('latin1').decode(u8.subarray(0, 300));
    const m = head.match(/encoding\s*=\s*["']([\w-]+)["']/i);
    let enc = m ? m[1].toLowerCase() : 'utf-8';
    try { return new TextDecoder(enc).decode(u8); } catch (e) { return new TextDecoder('utf-8').decode(u8); }
  }
  function fb2(u8) {
    const doc = new DOMParser().parseFromString(decodeXml(u8), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Файл FB2 повреждён');
    const kids = (el, name) => [...el.children].filter(c => c.localName === name);
    const bin = {};
    for (const b of doc.getElementsByTagName('binary')) bin[b.getAttribute('id')] = b;
    const urls = {};
    const img = href => {
      const id = href.replace(/^#/, '');
      if (urls[id]) return urls[id];
      const b = bin[id]; if (!b) return null;
      try {
        const raw = atob(b.textContent.replace(/\s+/g, ''));
        const arr = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return (urls[id] = URL.createObjectURL(new Blob([arr], { type: b.getAttribute('content-type') || 'image/jpeg' })));
      } catch (e) { return null; }
    };
    const MAP = { p: 'p', emphasis: 'em', strong: 'strong', strikethrough: 's', sup: 'sup', sub: 'sub', code: 'code', epigraph: 'blockquote',
      cite: 'blockquote', poem: 'div', stanza: 'div', v: 'p', 'text-author': 'p', subtitle: 'h4', table: 'table', tr: 'tr', td: 'td', th: 'th',
      a: 'span', style: 'span' };
    function conv(src, out, depth) {
      for (const n of src.childNodes) {
        if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); continue; }
        if (n.nodeType !== 1) continue;
        const t = n.localName;
        if (t === 'title') { const h = document.createElement(depth <= 1 ? 'h2' : 'h3'); h.textContent = [...n.children].map(textOf).join(' · ') || textOf(n); out.appendChild(h); continue; }
        if (t === 'section') { const d = document.createElement('div'); conv(n, d, depth + 1); out.appendChild(d); continue; }
        if (t === 'empty-line') { out.appendChild(document.createElement('br')); continue; }
        if (t === 'image') {
          const u = img(n.getAttribute('l:href') || n.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '');
          if (u) { const im = document.createElement('img'); im.src = u; im.alt = ''; im.loading = 'lazy'; out.appendChild(im); }
          continue;
        }
        if (t === 'a' && n.getAttribute('type') === 'note') { const s = document.createElement('span'); s.className = 'note'; s.textContent = textOf(n); out.appendChild(s); continue; }
        const el = document.createElement(MAP[t] || 'span');
        if (t === 'poem') el.className = 'poem';
        if (t === 'text-author') el.className = 'ta';
        conv(n, el, depth);
        out.appendChild(el);
      }
      return out;
    }
    const ti = doc.getElementsByTagName('title-info')[0];
    const title = ti ? textOf(ti.getElementsByTagName('book-title')[0]) : '';
    const au = ti && ti.getElementsByTagName('author')[0];
    const author = au ? ['first-name', 'last-name'].map(k => textOf(au.getElementsByTagName(k)[0])).filter(Boolean).join(' ') : '';
    const bodies = [...doc.getElementsByTagName('body')];
    const main = bodies.find(b => !b.getAttribute('name')) || bodies[0];
    const chapters = [];
    if (main) {
      let secs = kids(main, 'section');
      const intro = document.createElement('div');
      for (const c of main.children) if (c.localName !== 'section') conv({ childNodes: [c] }, intro, 0);
      // одна обёртка-«часть» на всю книгу — разворачиваем её главы
      if (secs.length === 1 && kids(secs[0], 'section').length > 1) secs = kids(secs[0], 'section');
      secs.forEach((s, i) => {
        const d = conv(s, document.createElement('div'), 1);
        if (i === 0 && intro.childNodes.length) d.prepend(...intro.childNodes);
        const t = s.getElementsByTagName('title')[0];
        chapters.push({ title: textOf(t) || 'Глава ' + (i + 1), html: d.innerHTML });
      });
      if (!secs.length) chapters.push({ title: title || 'Текст', html: conv(main, document.createElement('div'), 1).innerHTML });
    }
    for (const b of bodies) if (b !== main && b.getAttribute('name')) {
      chapters.push({ title: b.getAttribute('name') === 'notes' ? 'Примечания' : 'Приложение', html: conv(b, document.createElement('div'), 1).innerHTML });
    }
    return { title, author, chapters };
  }

  /* ---------- EPUB ---------- */
  const dir = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';
  function join(base, rel) {
    rel = rel.split('#')[0];
    try { rel = decodeURIComponent(rel); } catch (e) {}
    const parts = (base + rel).split('/'), out = [];
    for (const s of parts) { if (s === '..') out.pop(); else if (s !== '.' && s !== '') out.push(s); }
    return out.join('/');
  }
  const parseX = (s, type) => {
    let d = new DOMParser().parseFromString(s, type || 'application/xhtml+xml');
    if (d.getElementsByTagName('parsererror').length) d = new DOMParser().parseFromString(s, 'text/html');
    return d;
  };
  const byLocal = (d, name) => [...d.getElementsByTagName('*')].filter(e => e.localName === name);

  async function epub(buf) {
    const z = await Zip(buf);
    const cont = await z.text('META-INF/container.xml');
    if (!cont) throw new Error('Это не EPUB: нет META-INF/container.xml');
    const opfPath = byLocal(parseX(cont, 'application/xml'), 'rootfile')[0].getAttribute('full-path');
    const opf = parseX(await z.text(opfPath), 'application/xml');
    const base = dir(opfPath);
    const title = textOf(byLocal(opf, 'title')[0]);
    const author = textOf(byLocal(opf, 'creator')[0]);
    const man = {};
    for (const it of byLocal(opf, 'item')) man[it.getAttribute('id')] = { href: join(base, it.getAttribute('href')), type: it.getAttribute('media-type'), props: it.getAttribute('properties') || '' };
    const spineEl = byLocal(opf, 'spine')[0];
    const spine = byLocal(opf, 'itemref').map(r => man[r.getAttribute('idref')]).filter(Boolean);

    // названия глав — из оглавления книги (EPUB3 nav или EPUB2 toc.ncx)
    const names = {};
    const nav = Object.values(man).find(m => /\bnav\b/.test(m.props));
    const ncx = spineEl && man[spineEl.getAttribute('toc')] || Object.values(man).find(m => m.type === 'application/x-dtbncx+xml');
    try {
      if (nav) {
        const d = parseX(await z.text(nav.href));
        for (const a of byLocal(d, 'a')) { const h = join(dir(nav.href), a.getAttribute('href') || ''); if (!names[h]) names[h] = textOf(a); }
      } else if (ncx) {
        const d = parseX(await z.text(ncx.href), 'application/xml');
        for (const np of byLocal(d, 'navPoint')) {
          const c = byLocal(np, 'content')[0], l = byLocal(np, 'text')[0];
          if (c) { const h = join(dir(ncx.href), c.getAttribute('src')); if (!names[h]) names[h] = textOf(l); }
        }
      }
    } catch (e) { /* без оглавления — возьмём заголовки из текста */ }

    const urls = {};
    const chapters = [];
    for (const it of spine) {
      if (!/html|xml/.test(it.type || 'html')) continue;
      const s = await z.text(it.href); if (!s) continue;
      const d = parseX(s);
      const body = d.body || byLocal(d, 'body')[0]; if (!body) continue;
      // картинки достаём заранее: clean() синхронный
      for (const im of [...byLocal(d, 'img'), ...byLocal(d, 'image')]) {
        const h = im.getAttribute('src') || im.getAttribute('xlink:href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (!h) continue;
        const p = join(dir(it.href), h);
        if (!(p in urls)) { const b = await z.bytes(p); urls[p] = b ? URL.createObjectURL(new Blob([b])) : null; }
      }
      const out = clean(body, h => urls[join(dir(it.href), h)], document.createElement('div'));
      const txt = textOf(out);
      if (txt.length < 2 && !out.querySelector('img')) continue;
      const h = out.querySelector('h1,h2,h3');
      chapters.push({ title: names[it.href] || (h && textOf(h)) || txt.slice(0, 40) || 'Глава ' + (chapters.length + 1), html: out.innerHTML });
    }
    return { title, author, chapters };
  }

  /* ---------- TXT ---------- */
  function txt(u8) {
    let s = new TextDecoder('utf-8').decode(u8);
    if ((s.match(/�/g) || []).length > 20) s = new TextDecoder('windows-1251').decode(u8);
    const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const lines = s.replace(/\r/g, '').split(/\n/);
    const chapters = []; let cur = { title: 'Начало', ps: [] }, size = 0;
    for (const raw of lines) {
      const l = raw.trim(); if (!l) continue;
      const isHead = /^(глава|часть|chapter|part)\b/i.test(l) && l.length < 80;
      if (isHead || size > 40000) { if (cur.ps.length) chapters.push(cur); cur = { title: isHead ? l : 'Продолжение', ps: [] }; size = 0; if (isHead) continue; }
      cur.ps.push('<p>' + esc(l) + '</p>'); size += l.length;
    }
    if (cur.ps.length) chapters.push(cur);
    return { title: '', author: '', chapters: chapters.map(c => ({ title: c.title, html: c.ps.join('') })) };
  }

  /* ---------- общий вход ---------- */
  async function parse(buf, name) {
    const u8 = new Uint8Array(buf);
    const isZip = u8[0] === 0x50 && u8[1] === 0x4b;
    let book;
    if (isZip) {
      const z = await Zip(buf);
      if (z.has('META-INF/container.xml')) book = await epub(buf);
      else {
        const f = z.names.find(n => /\.fb2$/i.test(n));
        if (!f) throw new Error('В архиве нет книги FB2 или EPUB');
        book = fb2(await z.bytes(f));
      }
    } else if (/\.txt$/i.test(name)) book = txt(u8);
    else if (/<FictionBook|<\?xml/.test(new TextDecoder('latin1').decode(u8.subarray(0, 400)))) book = fb2(u8);
    else throw new Error('Формат не подходит: нужен FB2, EPUB или TXT');
    if (!book.chapters.length) throw new Error('В файле не нашлось текста');
    if (!book.title) book.title = name.replace(/\.(fb2|epub|txt|zip)+$/gi, '').replace(/[._]+/g, ' ');
    return book;
  }

  const cache = {};
  window.Books = {
    parse,
    async add(file) {
      const buf = await file.arrayBuffer();
      const book = await parse(buf, file.name);
      const id = 'b' + Date.now().toString(36);
      await putFile(id, buf);
      cache[id] = book;
      return { id, name: file.name, title: book.title, author: book.author, size: file.size, chapters: book.chapters.length };
    },
    async open(id, name) {
      if (cache[id]) return cache[id];
      const buf = await getFile(id);
      if (!buf) throw new Error('Файл книги не найден в памяти телефона — загрузите его заново');
      return (cache[id] = await parse(buf, name || id));
    },
    remove: id => { delete cache[id]; return delFile(id); },
  };
})();
