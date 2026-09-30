/* calm-ui behaviour - optional, no dependencies. Include once, after components.css:
     <script src="calm.js" defer></script>
   Everything is opt-in by markup (classes / data attributes) and works for elements added later (React, innerHTML).
   Without this file every component still renders; these parts just stay still:
   - .cu-seg            the selected pill is one thumb that slides to the button with aria-pressed="true"
   - .cu-more           "N more" / "Show less" (rule 9)
   - .cu-slots          one time slot selected at a time
   - .cu-stepper        − / + with data-min, data-max, data-step on the stepper; fires "change"
   - .cu-otp            auto-advance, backspace, paste; fires "cu-complete" with the code in detail
   - .cu-swipe          drag the row left to reveal .cu-swipe-actions
   - .cu-sort           drag rows by .cu-handle; fires "cu-sort"
   - .cu-cal            month calendar (data-value="2026-09-25", data-month, data-min); fires "change" with the day in detail
   - .cu-drop           drag-over state; fires "cu-files" with the files in detail
   - [data-cu-count]    counts up/down to the value whenever the attribute changes (data-cu-prefix, -suffix, -decimals)
   - [data-cu-until]    countdown to an ISO time or a number of seconds; fills [data-cu-part="d|h|m|s"] or its own text
   - [data-cu-remove]   removes its .cu-chip with a short fade; fires "cu-remove"
   - [data-cu-open="id"] opens that dialog / sheet / palette; [data-cu-close] or a click outside closes it
   - .cu-cmd            command palette: Ctrl/Cmd+K opens the first one; typing filters, arrows move, Enter runs */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fire = (el, name, detail) => el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  const lang = () => document.documentElement.lang || undefined;

  // ---------------------------------------------------------------- rolling digits: each changed character rolls in on the vertical axis
  // dir > 0: the new digit comes from below (counting up); dir < 0: from above (counting down). Used by steppers and countdowns;
  // call window.calmRoll(el, text, dir) for your own numbers.
  const roll = (el, text, dir) => {
    text = String(text);
    const prev = el._cuTxt !== undefined ? el._cuTxt : el.textContent;
    el._cuTxt = text;
    if (reduce || document.hidden || prev === text && el.querySelector(':scope > .cu-roll')) { if (reduce || document.hidden) el.textContent = text; return; }
    let cells = [...el.querySelectorAll(':scope > .cu-roll')];
    if (cells.length !== text.length) {
      const p = prev.padStart(text.length).slice(-text.length);
      el.innerHTML = [...text].map((_, i) => '<span class="cu-roll"><span>' + (p[i] === ' ' ? '&#8203;' : p[i]) + '</span></span>').join('');
      el.setAttribute('aria-label', text);
      cells = [...el.children];
    }
    el.setAttribute('aria-label', text);
    const up = dir === undefined ? (parseFloat(text) >= parseFloat(prev)) : dir > 0;
    cells.forEach((c, i) => {
      c.querySelectorAll('.is-out-up, .is-out-down').forEach(x => x.remove());
      const cur = c.lastElementChild;
      if (cur.textContent === text[i]) return;
      const nx = document.createElement('span');
      nx.textContent = text[i];
      nx.className = up ? 'is-in-up' : 'is-in-down';
      cur.className = up ? 'is-out-up' : 'is-out-down';
      c.appendChild(nx);
      setTimeout(() => { if (cur.parentNode) cur.remove(); if (nx.className !== '') nx.className = ''; }, 420);
    });
  };
  window.calmRoll = roll;

  // ---------------------------------------------------------------- sliding pill thumb
  const place = (seg, animate) => {
    const t = seg.querySelector(':scope > .cu-seg-thumb');
    if (!t) return;
    const b = seg.querySelector(':scope > button[aria-pressed="true"]');
    if (!b || !b.offsetWidth) { t.style.opacity = '0'; return; }
    t.style.opacity = '1';
    if (!animate) t.classList.add('is-instant');
    t.style.setProperty('--x', b.offsetLeft + 'px');
    t.style.setProperty('--w', b.offsetWidth + 'px');
    if (!animate) { void t.offsetWidth; t.classList.remove('is-instant'); }
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(e => place(e.target, false))) : null;
  // the thumb can be wiped by a re-render (innerHTML); put it back without animating
  const thumb = seg => {
    if (seg.querySelector(':scope > .cu-seg-thumb')) return false;
    const t = document.createElement('span');
    t.className = 'cu-seg-thumb';
    t.setAttribute('aria-hidden', 'true');
    seg.prepend(t);
    return true;
  };
  const seen = new WeakSet();
  const initSeg = seg => {
    thumb(seg);
    seg.classList.add('is-sliding');
    place(seg, false);
    new MutationObserver(() => place(seg, !thumb(seg)))
      .observe(seg, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed'] });
    if (ro) ro.observe(seg);
  };

  // ---------------------------------------------------------------- count-up
  const fmt = (el, v) => {
    const d = +(el.dataset.cuDecimals || 0);
    return (el.dataset.cuPrefix || '') + v.toLocaleString(lang(), { minimumFractionDigits: d, maximumFractionDigits: d }) + (el.dataset.cuSuffix || '');
  };
  const count = el => {
    const to = +el.dataset.cuCount;
    if (!isFinite(to)) return;
    const first = el._cuV === undefined;
    const from = first ? (reduce ? to : 0) : el._cuV;
    el._cuV = to;
    const res = el.closest('.cu-res');
    if (res && !first && to !== from) {
      const p = document.createElement('span');
      p.className = 'cu-res-pop' + (to < from ? ' is-neg' : '');
      p.textContent = (to > from ? '+' : '−') + Math.abs(to - from).toLocaleString(lang());
      res.appendChild(p);
      setTimeout(() => p.remove(), 950);
    }
    cancelAnimationFrame(el._cuRaf);
    if (reduce || from === to || document.hidden) { el.textContent = fmt(el, to); return; }
    const t0 = performance.now(), dur = first ? 900 : 600;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(el, from + (to - from) * e);
      if (p < 1) el._cuRaf = requestAnimationFrame(step);
    };
    el._cuRaf = requestAnimationFrame(step);
  };

  // ---------------------------------------------------------------- countdown
  const endOf = el => {
    const v = el.dataset.cuUntil;
    if (/^\d+$/.test(v)) { if (el._cuEndFor !== v) { el._cuEndFor = v; el._cuEnd = Date.now() + v * 1000; } return el._cuEnd; }
    return Date.parse(v);
  };
  const two = n => String(n).padStart(2, '0');
  const tick = () => document.querySelectorAll('[data-cu-until]').forEach(el => {
    const s = Math.max(0, Math.round((endOf(el) - Date.now()) / 1000));
    const parts = el.querySelectorAll('[data-cu-part]');
    const hasD = [...parts].some(p => p.dataset.cuPart === 'd');
    const d = Math.floor(s / 86400), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    if (parts.length) {
      const map = { d, h: hasD ? h % 24 : h, m, s: sec };
      parts.forEach(p => roll(p, two(map[p.dataset.cuPart]), -1));
    } else {
      roll(el, (h ? h + ':' + two(m) : m) + ':' + two(sec), -1);
    }
    el.classList.toggle('is-done', !s);
    if (!s && !el._cuFired) { el._cuFired = true; fire(el, 'cu-done'); }
    if (s) el._cuFired = false;
  });

  // ---------------------------------------------------------------- calendar
  const CHEV = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  const drawCal = el => {
    const sel = el.dataset.value || '';
    const base = el.dataset.month || (sel || new Date().toISOString()).slice(0, 7);
    const [y, mo] = base.split('-').map(Number);
    const first = new Date(y, mo - 1, 1);
    const lead = (first.getDay() + 6) % 7;             // Monday first
    const days = new Date(y, mo, 0).getDate();
    const now = new Date();
    const iso = d => y + '-' + two(mo) + '-' + two(d);
    const min = el.dataset.min || '';
    const wd = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(lang(), { weekday: 'narrow' }));
    el.dataset.month = y + '-' + two(mo);
    el.innerHTML = '<div class="cu-cal-h"><button type="button" class="cu-iconbtn is-ghost is-sm" data-cu-cal="-1" aria-label="Previous month">' + CHEV('M15 6l-6 6 6 6') + '</button>' +
      '<b>' + first.toLocaleDateString(lang(), { month: 'long', year: 'numeric' }) + '</b>' +
      '<button type="button" class="cu-iconbtn is-ghost is-sm" data-cu-cal="1" aria-label="Next month">' + CHEV('M9 6l6 6-6 6') + '</button></div>' +
      '<div class="cu-cal-g">' + wd.map(w => '<span>' + w + '</span>').join('') + '<i></i>'.repeat(lead) +
      [...Array(days)].map((_, i) => {
        const v = iso(i + 1);
        const today = now.getFullYear() === y && now.getMonth() === mo - 1 && now.getDate() === i + 1;
        return '<button type="button" data-d="' + v + '"' + (v === sel ? ' aria-pressed="true"' : '') + (today ? ' class="is-today"' : '') + (min && v < min ? ' disabled' : '') + '>' + (i + 1) + '</button>';
      }).join('') + '</div>';
  };

  // ---------------------------------------------------------------- init + late elements
  const init = root => {
    if (!root.querySelectorAll) return;
    const all = sel => [...(root.matches && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];
    all('.cu-seg').forEach(s => { if (!seen.has(s)) { seen.add(s); initSeg(s); } });
    all('.cu-cal').forEach(c => { if (!seen.has(c)) { seen.add(c); drawCal(c); } });
    all('[data-cu-count]').forEach(n => { if (!seen.has(n)) { seen.add(n); count(n); } });
  };
  const start = () => {
    init(document);
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === 'attributes') { if (m.attributeName === 'data-cu-count') count(m.target); return; }
      m.addedNodes.forEach(n => { if (n.nodeType === 1) init(n); });
    })).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cu-count'] });
    if (document.fonts) document.fonts.ready.then(() => document.querySelectorAll('.cu-seg.is-sliding').forEach(s => place(s, false)));
    tick();
    setInterval(tick, 1000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // ---------------------------------------------------------------- clicks
  const outside = (d, e) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
  const openDialog = d => { if (!d || !d.showModal || d.open) return; d.showModal(); const f = d.querySelector('.cu-cmd-in input, [autofocus]'); if (f) { f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); f.focus(); } };
  document.addEventListener('click', e => {
    const t = e.target;
    const more = t.closest('.cu-morebtn');
    if (more) { const box = more.closest('.cu-more'); if (box) more.setAttribute('aria-expanded', String(box.classList.toggle('is-open'))); }

    const slot = t.closest('.cu-slots button');
    if (slot && !slot.disabled) slot.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === slot)));

    const stepBtn = t.closest('.cu-stepper [data-step]');
    if (stepBtn) {
      const st = stepBtn.closest('.cu-stepper'), out = st.querySelector('output, input');
      const min = st.dataset.min !== undefined ? +st.dataset.min : -Infinity, max = st.dataset.max !== undefined ? +st.dataset.max : Infinity;
      const cur = st._cuV !== undefined ? st._cuV : (+(out.tagName === 'INPUT' ? out.value : out.textContent) || 0);
      const v = Math.min(max, Math.max(min, cur + (+stepBtn.dataset.step) * (+(st.dataset.step || 1))));
      st._cuV = v; st.dataset.value = v;
      if (out.tagName === 'INPUT') out.value = v; else if (v !== cur) roll(out, v, v > cur ? 1 : -1);
      st.querySelectorAll('[data-step]').forEach(b => { b.disabled = (+b.dataset.step < 0 && v <= min) || (+b.dataset.step > 0 && v >= max); });
      fire(st, 'change', v);
    }

    const calNav = t.closest('.cu-cal [data-cu-cal]');
    if (calNav) { const c = calNav.closest('.cu-cal'); const [y, m] = c.dataset.month.split('-').map(Number); const d = new Date(y, m - 1 + (+calNav.dataset.cuCal), 1); c.dataset.month = d.getFullYear() + '-' + two(d.getMonth() + 1); drawCal(c); }
    const day = t.closest('.cu-cal [data-d]');
    if (day && !day.disabled) { const c = day.closest('.cu-cal'); c.dataset.value = day.dataset.d; drawCal(c); fire(c, 'change', day.dataset.d); }

    const rm = t.closest('[data-cu-remove]');
    if (rm) { const chip = rm.closest('.cu-chip'); if (chip) { fire(chip, 'cu-remove', chip.textContent.trim()); chip.classList.add('is-leaving'); setTimeout(() => chip.remove(), reduce ? 0 : 200); } }

    const op = t.closest('[data-cu-open]');
    if (op) openDialog(document.getElementById(op.dataset.cuOpen));
    const cl = t.closest('[data-cu-close]');
    if (cl) { const d = cl.closest('dialog'); if (d) d.close(); }
    if (t.tagName === 'DIALOG' && t.open && outside(t, e)) t.close();
  });

  // ---------------------------------------------------------------- command palette
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { const c = document.querySelector('dialog.cu-cmd'); if (c) { e.preventDefault(); openDialog(c); } }
    const cmd = e.target.closest && e.target.closest('.cu-cmd');
    if (cmd && ['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
      const items = [...cmd.querySelectorAll('li:not([hidden]) button')];
      if (!items.length) return;
      let i = items.findIndex(b => b.classList.contains('is-active'));
      if (e.key === 'Enter') { e.preventDefault(); (items[i] || items[0]).click(); return; }
      e.preventDefault();
      i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items.forEach((b, j) => b.classList.toggle('is-active', j === i));
      items[i].scrollIntoView({ block: 'nearest' });
    }
  });
  document.addEventListener('input', e => {
    const inp = e.target;
    if (inp.closest && inp.closest('.cu-cmd-in')) {
      const cmd = inp.closest('.cu-cmd'), q = inp.value.trim().toLowerCase();
      let n = 0;
      cmd.querySelectorAll('li').forEach(li => { const b = li.querySelector('button'); if (!b) { li.hidden = !!q; return; } const hit = !q || b.textContent.toLowerCase().includes(q); li.hidden = !hit; b.classList.remove('is-active'); if (hit) n++; });
      const first = cmd.querySelector('li:not([hidden]) button'); if (first) first.classList.add('is-active');
      const empty = cmd.querySelector('.cu-cmd-empty'); if (empty) empty.hidden = !!n;
    }

    // ---------------------------------------------------------------- code input
    if (inp.closest && inp.closest('.cu-otp')) {
      const box = inp.closest('.cu-otp');
      box.classList.remove('is-neg', 'is-pos');
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      const all = [...box.querySelectorAll('input')];
      if (inp.value) { const nx = all[all.indexOf(inp) + 1]; if (nx) nx.focus(); }
      const code = all.map(x => x.value).join('');
      if (code.length === all.length) fire(box, 'cu-complete', code);
    }
  });
  document.addEventListener('keydown', e => {
    const inp = e.target;
    if (e.key === 'Backspace' && inp.closest && inp.closest('.cu-otp') && !inp.value) { const all = [...inp.closest('.cu-otp').querySelectorAll('input')]; const pv = all[all.indexOf(inp) - 1]; if (pv) { pv.value = ''; pv.focus(); e.preventDefault(); } }
  });
  document.addEventListener('paste', e => {
    const inp = e.target, box = inp.closest && inp.closest('.cu-otp');
    if (!box) return;
    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (!digits) return;
    e.preventDefault();
    const all = [...box.querySelectorAll('input')];
    all.forEach((x, i) => { x.value = digits[i] || ''; });
    (all[Math.min(digits.length, all.length) - 1] || all[0]).focus();
    if (digits.length >= all.length) fire(box, 'cu-complete', digits.slice(0, all.length));
  });

  // ---------------------------------------------------------------- swipe rows and sortable lists (pointer events: mouse + touch)
  let sw = null, dr = null;
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest('.cu-sort .cu-handle');
    if (h) {
      const li = h.closest('li');
      dr = { li, list: li.parentElement, y0: e.clientY, top0: li.offsetTop, dy: 0 };
      li.classList.add('is-dragging'); dr.list.classList.add('is-sorting');
      li.style.transition = 'box-shadow var(--m-base) var(--ease), background var(--m-base) var(--ease)';
      li.animate([{ transform: 'none' }, { transform: 'scale(1.04)' }], { duration: reduce ? 0 : 160, easing: 'cubic-bezier(.3,1.25,.45,1)' });
      li.style.transform = 'scale(1.04)';
      try { h.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault(); return;
    }
    const row = e.target.closest('.cu-swipe > .cu-swipe-row');
    if (!row || e.target.closest('button, a, input')) return;
    const box = row.parentElement, acts = box.querySelector('.cu-swipe-actions');
    const w = acts ? acts.offsetWidth : 0;
    box.style.setProperty('--w', w + 'px');
    sw = { row, box, w, x0: e.clientX, y0: e.clientY, base: box.classList.contains('is-open') ? -w : 0, x: 0, moved: false };
  });
  document.addEventListener('pointermove', e => {
    if (dr) {
      // the row follows the pointer; when it passes a neighbour's middle the DOM order changes and the neighbours glide (FLIP)
      const sibs = [...dr.list.children].filter(c => c !== dr.li);
      const over = sibs.find(c => { const r = c.getBoundingClientRect(); return e.clientY > r.top && e.clientY < r.bottom; });
      if (over) {
        const r = over.getBoundingClientRect(), ref = e.clientY < r.top + r.height / 2 ? over : over.nextSibling;
        if (ref !== dr.li && dr.li.nextSibling !== ref) {
          const first = new Map(sibs.map(c => [c, c.offsetTop]));
          dr.list.insertBefore(dr.li, ref);
          if (!reduce) sibs.forEach(c => { const d = first.get(c) - c.offsetTop; if (d) c.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' }); });
        }
      }
      dr.dy = (e.clientY - dr.y0) - (dr.li.offsetTop - dr.top0);
      dr.li.style.transform = 'translateY(' + dr.dy + 'px) scale(1.04)';
      return;
    }
    if (!sw) return;
    const dx = e.clientX - sw.x0;
    if (!sw.moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(e.clientY - sw.y0) > Math.abs(dx)) { sw = null; return; }
      sw.moved = true;
      sw.row.style.transition = 'none';
      try { sw.row.setPointerCapture(e.pointerId); } catch {}
    }
    sw.x = Math.min(0, Math.max(-sw.w - 28, sw.base + dx));
    sw.row.style.transform = 'translateX(' + sw.x + 'px)';
  });
  const endDrag = () => {
    if (dr) {
      const { li, list, dy } = dr;
      li.style.transform = ''; li.style.transition = '';
      if (!reduce) li.animate([{ transform: 'translateY(' + dy + 'px) scale(1.04)' }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.3,1.25,.45,1)' });
      li.classList.remove('is-dragging'); list.classList.remove('is-sorting');
      fire(list, 'cu-sort', [...list.children].map(x => x.textContent.trim()));
      dr = null;
    }
    if (!sw) return;
    sw.row.style.transition = ''; sw.row.style.transform = '';
    if (sw.moved) sw.box.classList.toggle('is-open', sw.x < -sw.w / 2);
    else if (sw.box.classList.contains('is-open')) sw.box.classList.remove('is-open');
    sw = null;
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  // ---------------------------------------------------------------- drop zone
  const zoneOf = e => e.target.closest && e.target.closest('.cu-drop');
  ['dragenter', 'dragover'].forEach(n => document.addEventListener(n, e => { const z = zoneOf(e); if (z) { e.preventDefault(); z.classList.add('is-over'); } }));
  document.addEventListener('dragleave', e => { const z = zoneOf(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove('is-over'); });
  document.addEventListener('drop', e => { const z = zoneOf(e); if (!z) return; e.preventDefault(); z.classList.remove('is-over'); fire(z, 'cu-files', [...e.dataTransfer.files]); });
  document.addEventListener('change', e => { const z = e.target.matches && e.target.matches('.cu-drop input[type="file"]') && e.target.closest('.cu-drop'); if (z) { fire(z, 'cu-files', [...e.target.files]); e.target.value = ''; } });

  // ---------------------------------------------------------------- single choice groups, toggles, rating
  const SINGLE = '.cu-scale, .cu-swatches, .cu-options, [data-cu-single]';
  document.addEventListener('click', e => {
    const t = e.target;
    const one = t.closest('button') && t.closest(SINGLE);
    if (one && t.closest('button').parentElement === one && !t.closest('button').disabled) {
      const b = t.closest('button');
      one.querySelectorAll(':scope > button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      fire(one, 'change', b.value || b.dataset.value || b.textContent.trim());
    }
    const tg = t.closest('[data-cu-toggle]');
    if (tg) { const on = tg.getAttribute('aria-pressed') !== 'true'; tg.setAttribute('aria-pressed', String(on)); fire(tg, 'change', on); }
    const star = t.closest('.cu-rating > button');
    if (star) {
      const r = star.parentElement, all = [...r.children], n = all.indexOf(star) + 1;
      all.forEach((b, i) => b.classList.toggle('is-on', i < n));
      r.dataset.value = n; fire(r, 'change', n);
    }

    // password: show / hide
    const rv = t.closest('.cu-pass [data-cu-reveal]');
    if (rv) { const inp = rv.closest('.cu-pass').querySelector('input'); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; rv.setAttribute('aria-pressed', String(show)); rv.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); }

    // copy: [data-cu-copy="#id" | "text:..."] or the closest .cu-code
    const cp = t.closest('[data-cu-copy]');
    if (cp) {
      const v = cp.dataset.cuCopy;
      const txt = v && v.startsWith('text:') ? v.slice(5) : v ? (document.querySelector(v) || {}).textContent : (cp.closest('.cu-code') || cp.parentElement).querySelector('code, pre').textContent;
      const done = () => { cp.classList.add('is-done'); setTimeout(() => cp.classList.remove('is-done'), 1200); fire(cp, 'cu-copied', txt); };
      (navigator.clipboard ? navigator.clipboard.writeText(txt || '') : Promise.reject()).then(done, () => {
        const ta = document.createElement('textarea'); ta.value = txt || ''; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
        try { if (document.execCommand('copy')) done(); } catch {} ta.remove();
      });
    }

    // accordion: animate the height of <details class="cu-acc"> (one open at a time inside [data-cu-single-open])
    const sum = t.closest('.cu-acc > summary');
    if (sum && !reduce) {
      e.preventDefault();
      const d = sum.parentElement, body = d.querySelector('.cu-acc-body');
      if (!body) { d.open = !d.open; return; }
      const openIt = !d.open;
      if (openIt) {
        const grp = d.closest('[data-cu-single-open]');
        if (grp) grp.querySelectorAll('.cu-acc[open]').forEach(o => { if (o !== d) o.querySelector('summary').click(); });
        d.open = true;
        const h = body.scrollHeight;
        body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
      } else {
        const h = body.scrollHeight;
        const a = body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0, paddingBottom: '0px' }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
        d.classList.add('is-closing');
        a.onfinish = () => { d.open = false; d.classList.remove('is-closing'); };
      }
    }

    // carousel dots
    const dot = t.closest('.cu-carousel + .cu-dots i');
    if (dot) { const car = dot.parentElement.previousElementSibling, i = [...dot.parentElement.children].indexOf(dot); const s = car.children[i]; if (s) car.scrollTo({ left: s.offsetLeft - car.offsetLeft, behavior: reduce ? 'auto' : 'smooth' }); }
  });
  document.addEventListener('scroll', e => {
    const car = e.target.classList && e.target.classList.contains('cu-carousel') ? e.target : null;
    const dots = car && car.nextElementSibling && car.nextElementSibling.classList.contains('cu-dots') ? car.nextElementSibling : null;
    if (!dots) return;
    const w = car.firstElementChild ? car.firstElementChild.offsetWidth + parseFloat(getComputedStyle(car).columnGap || 0) : 1;
    const i = Math.round(car.scrollLeft / w);
    [...dots.children].forEach((d, j) => d.classList.toggle('is-now', j === i));
  }, true);

  // ---------------------------------------------------------------- tag input: Enter or comma adds, Backspace on empty removes the last
  const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const addTag = (box, text) => {
    text = text.trim().replace(/,$/, '');
    if (!text || [...box.querySelectorAll('.cu-chip')].some(c => c.textContent.trim().toLowerCase() === text.toLowerCase())) return;
    const chip = document.createElement('span'); chip.className = 'cu-chip is-filter'; chip.textContent = text;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'cu-chip-x'; x.dataset.cuRemove = ''; x.setAttribute('aria-label', 'Remove ' + text); x.innerHTML = X_SVG;
    chip.appendChild(x); box.insertBefore(chip, box.querySelector('input')); fire(box, 'change', text);
  };
  document.addEventListener('keydown', e => {
    const inp = e.target, box = inp.closest && inp.closest('.cu-tags');
    if (!box || inp.tagName !== 'INPUT') return;
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(box, inp.value); inp.value = ''; }
    else if (e.key === 'Backspace' && !inp.value) { const last = [...box.querySelectorAll('.cu-chip')].pop(); if (last) last.remove(); }
  });
  document.addEventListener('click', e => { const box = e.target.classList && e.target.classList.contains('cu-tags') ? e.target : null; if (box) box.querySelector('input').focus(); });

  // ---------------------------------------------------------------- password strength: .cu-pass input[data-cu-strength="#meter"] → .cu-steps + a meta line
  const WORDS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  document.addEventListener('input', e => {
    const inp = e.target;
    if (!inp.dataset || !inp.dataset.cuStrength) return;
    const m = document.querySelector(inp.dataset.cuStrength); if (!m) return;
    const v = inp.value;
    const score = v.length < 8 ? (v ? 0 : -1) : [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(v)).length + (v.length >= 12 ? 1 : 0) - 1;
    const s = Math.max(-1, Math.min(4, score));
    m.querySelectorAll('.cu-steps > i').forEach((i, n) => i.className = n < s ? 'is-done' : '');
    const w = m.querySelector('.cu-meta'); if (w) w.textContent = s < 0 ? '' : WORDS[s];
  });
})();
