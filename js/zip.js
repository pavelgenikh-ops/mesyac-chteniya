/* Чтение ZIP-архива (EPUB, FB2.ZIP) без библиотек: оглавление архива разбираем сами,
   сжатые файлы распаковывает встроенный в браузер DecompressionStream('deflate-raw'). */
window.Zip = async function (buf) {
  const dv = new DataView(buf);
  let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Файл повреждён или это не архив');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const utf8 = new TextDecoder('utf-8'), cp866 = new TextDecoder('ibm866');
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const raw = new Uint8Array(buf, p + 46, nlen);
    const name = (flags & 0x800) ? utf8.decode(raw) : (/[\x80-\xff]/.test(String.fromCharCode(...raw)) ? cp866.decode(raw) : utf8.decode(raw));
    files.set(name, { method, csize, lho });
    p += 46 + nlen + xlen + clen;
  }
  const lower = new Map([...files.keys()].map(k => [k.toLowerCase(), k]));
  const find = name => files.has(name) ? name : lower.get(String(name).toLowerCase());

  async function bytes(name) {
    const key = find(name);
    if (!key) return null;
    const f = files.get(key);
    const nl = dv.getUint16(f.lho + 26, true), xl = dv.getUint16(f.lho + 28, true);
    const data = new Uint8Array(buf, f.lho + 30 + nl + xl, f.csize);
    if (f.method === 0) return data;
    if (f.method !== 8) throw new Error('Неизвестный способ сжатия в архиве');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return {
    names: [...files.keys()],
    has: name => !!find(name),
    bytes,
    text: async name => { const b = await bytes(name); return b ? utf8.decode(b) : null; },
  };
};
