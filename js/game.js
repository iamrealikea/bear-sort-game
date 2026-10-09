/* game.js — ตัวควบคุมหน้าเว็บ Bear & Sort:
   คู่มือนักสำรวจ, สนามฝึก (ทีละก้าว), ภารกิจจัดแถว, Algorithm Lab */
(() => {
  const $ = (s) => document.querySelector(s);
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  let algo = 'bubble';          // อัลกอริทึมที่เลือกอยู่ (ใช้ร่วมกันทุกส่วนของหน้า)
  let currentMode = null;       // โหมดที่กำลังแสดง ('practice' หรือ 'challenge')

  /* ---------- ยูทิลิตี้ ---------- */
  function randomValues(n) {
    // สุ่มเลขไม่ซ้ำ 1..60 แล้วตรวจว่ายังไม่เรียง
    const pool = Array.from({ length: 60 }, (_, k) => k + 1);
    for (let k = pool.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [pool[k], pool[r]] = [pool[r], pool[k]];
    }
    const arr = pool.slice(0, n);
    while (Algo.isSorted(arr)) arr.sort(() => Math.random() - 0.5);
    return arr;
  }
  function setMsg(sel, text, kind = '') {
    const el = $(sel);
    el.textContent = text;
    el.className = el.className.replace(/\b(good|bad)\b/g, '').trim() + (kind ? ' ' + kind : '');
  }
  const starsHtml = (n) => `<div class="big-stars" role="img" aria-label="${n} จาก 3 ดาว">` +
    [1, 2, 3].map((k) => icon('star', k <= n ? 'fill' : '')).join('') + '</div>';

  /* ---------- หน้าต่างผลลัพธ์ ---------- */
  const dlg = $('#result');
  function showResult(title, bodyHtml, buttons) {
    $('#res-title').textContent = title;
    $('#res-body').innerHTML = bodyHtml;
    const box = $('#res-actions');
    box.innerHTML = '';
    buttons.forEach((b, k) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (k === 0 ? ' primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => { dlg.close(); b.action(); });
      box.appendChild(btn);
    });
    dlg.showModal();
  }

  /* ---------- เสียง ---------- */
  function updateSoundBtn() {
    const on = Sfx.isEnabled();
    const btn = $('#btn-sound');
    if (btn) {
      btn.setAttribute('aria-pressed', on);
      btn.setAttribute('aria-label', on ? 'ปิดเสียง' : 'เปิดเสียง');
      btn.innerHTML = icon(on ? 'sound-on' : 'sound-off');
    }
  }
  $('#btn-sound').addEventListener('click', () => {
    const on = !Sfx.isEnabled();
    Sfx.setEnabled(on);
    updateSoundBtn();
  });

  /* =====================================================================
     คู่มือนักสำรวจ + Algorithm Lab (แสดงตามอัลกอริทึมที่เลือก)
     ===================================================================== */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function renderGuide() {
    const I = Algo.INFO[algo];
    $('#guide-name').textContent = I.name;
    $('#guide-desc').textContent = I.desc;
    $('#guide-steps').innerHTML = Algo.GUIDE[algo].map((t) => `<li>${t}</li>`).join('');

    // Lab: ใส่สีคอมเมนต์/คีย์เวิร์ดแบบเรียบง่าย และเน้นบรรทัดเงื่อนไขหลัก
    $('#lab-name').textContent = `${I.name} — ${I.desc}`;
    $('#lab-code').innerHTML = Algo.CODE[algo].map((ln) => {
      const at = ln.t.indexOf('//');
      const code = at >= 0 ? ln.t.slice(0, at) : ln.t;
      const cmt = at >= 0 ? ln.t.slice(at) : '';
      const html = esc(code).replace(/\b(function|const|let|for|if|return)\b/g, '<span class="k">$1</span>')
        + (cmt ? `<span class="c">${esc(cmt)}</span>` : '');
      return `<li${ln.hl ? ' class="hl"' : ''}>${html || ' '}</li>`;
    }).join('');
    $('#lab-cx').innerHTML = `<tr><td>${I.best}</td><td>${I.avg}</td><td>${I.worst}</td><td>${I.swaps}</td></tr>`;
  }

  document.querySelectorAll('input[name="algo"]').forEach((r) => {
    r.addEventListener('change', () => {
      algo = r.value;
      renderGuide();
      newStepper();
      startChallenge();
      requestAnimationFrame(() => {
        if (currentMode === 'practice') {
          stepBoard.layout();
        } else if (cb) {
          cb.layout();
        }
      });
    });
  });

  /* =====================================================================
     สนามฝึก: เล่น step ของอัลกอริทึมทีละก้าว (ย้อนกลับได้)
     ===================================================================== */
  const stepBoard = new Board($('#board-step'));
  let st = { steps: [], k: 0, playing: false, token: 0, vals: [] };

  /* ควบคุมการเปิด/ปิดปุ่มและตัวเลือกทั้งหมดเมื่อมีบอร์ดใดบอร์ดหนึ่งกำลังเล่นอนิเมชัน */
  function updateControlsState() {
    const busyStep = stepBoard.busy;
    const busyChallenge = cb ? cb.busy : false;
    const busyAny = busyStep || busyChallenge;

    // ปิดการเปลี่ยนอัลกอริทึมระหว่างที่บอร์ดกำลังเคลื่อนไหว
    document.querySelectorAll('input[name="algo"]').forEach((r) => {
      r.disabled = busyAny;
    });

    // ปุ่มควบคุมในสนามฝึก
    $('#s-new').disabled = busyStep;
    $('#s-play').disabled = !st.playing && busyStep;
    if (busyStep) {
      $('#s-back').disabled = true;
      $('#s-next').disabled = true;
    } else {
      $('#s-back').disabled = st.k === 0;
      $('#s-next').disabled = st.k >= st.steps.length - 1;
    }

    // ปุ่มควบคุมในภารกิจจัดแถว
    $('#c-reset').disabled = busyChallenge;
    $('#c-size').disabled = busyChallenge;
    if (cb) {
      if (busyChallenge) {
        cb.setDisabled(true);
      } else if (ch && !ch.done) {
        cb.setDisabled(false);
      }
    }
  }

  stepBoard.onBusyChange = updateControlsState;

  function stopStepper() {
    st.playing = false; st.token++;            // ยกเลิกลูปเล่นอัตโนมัติที่กำลังรออยู่
    $('#s-play').innerHTML = icon('play') + '<span>เล่นอัตโนมัติ</span>';
  }

  function newStepper() {
    stopStepper();
    st.vals = randomValues(6);
    // step แรก (index 0) = สถานะเริ่มต้นก่อนเริ่มเรียง
    st.steps = [{ type: 'start', i: -1, j: -1, arr: st.vals.slice(), sorted: [], text: 'แถวเริ่มต้น — กด "ก้าวถัดไป" เพื่อดูทีละขั้นตอน' },
      ...Algo.steps(algo, st.vals)];
    st.k = 0;
    stepBoard.load(st.vals);
    stepBoard.setDisabled(true);
    $('#s-total').textContent = st.steps.length - 1;
    renderStepper();
  }

  function renderStepper() {
    const s = st.steps[st.k];
    stepBoard.setOrderByValues(s.arr);
    stepBoard.clear();
    stepBoard.mark(s.sorted, 'is-sorted');

    // Selection Sort: แยกสีค่าน้อยสุด (is-min ฟ้า) กับตัวที่กำลังสแกนเปรียบเทียบ (is-compare ส้ม)
    if (algo === 'selection') {
      if (s.min !== undefined && s.min >= 0) {
        stepBoard.mark([s.min], 'is-min');
      } else if (s.type === 'min') {
        stepBoard.mark([s.i], 'is-min');
      }
      if (s.type === 'compare') {
        stepBoard.mark([s.j], 'is-compare');
      } else if (s.type === 'swap') {
        stepBoard.mark([s.i, s.j], 'is-compare');
      }
    } else {
      if (s.type === 'compare' || s.type === 'swap') stepBoard.mark([s.i, s.j], 'is-compare');
      if (s.type === 'min') stepBoard.mark([s.i], 'is-min');
    }

    setMsg('#s-text', s.text);
    let cmp = 0, swp = 0;
    for (let k = 1; k <= st.k; k++) {
      if (st.steps[k].type === 'compare') cmp++;
      if (st.steps[k].type === 'swap') swp++;
    }
    $('#s-step').textContent = st.k;
    $('#s-cmp').textContent = cmp;
    $('#s-swp').textContent = swp;
    updateControlsState();
  }

  function stepBy(d) {
    st.k = Math.min(st.steps.length - 1, Math.max(0, st.k + d));
    renderStepper();
    if (st.k >= st.steps.length - 1) stopStepper();
  }
  $('#s-next').addEventListener('click', () => { stopStepper(); stepBy(1); });
  $('#s-back').addEventListener('click', () => { stopStepper(); stepBy(-1); });
  $('#s-new').addEventListener('click', newStepper);
  $('#s-play').addEventListener('click', async () => {
    if (st.playing) { stopStepper(); return; }
    if (st.k >= st.steps.length - 1) { st.k = 0; renderStepper(); await stepBoard.whenIdle(); }
    st.playing = true;
    const token = ++st.token;
    $('#s-play').innerHTML = icon('pause') + '<span>หยุดชั่วคราว</span>';
    // เล่นทีละก้าว: รอให้หมีเดินสลับเสร็จก่อน แล้วพักสั้น ๆ ค่อยไปก้าวถัดไป
    while (st.playing && token === st.token && st.k < st.steps.length - 1) {
      stepBy(1);
      await stepBoard.whenIdle();
      await sleep(550);
    }
  });

  /* =====================================================================
     ภารกิจจัดแถว (ลงมือเอง)
     Bubble   : สลับได้เฉพาะหมีที่ติดกัน และต้อง "ซ้าย > ขวา" เท่านั้น
     Selection: ต้องชี้หมีตัวที่น้อยที่สุดของส่วนที่ยังไม่เรียง
     ทำผิดกฎเสียหัวใจ 1 ดวง (หมด 3 ดวง = แพ้)
     ===================================================================== */
  const RULES = {
    bubble: '<strong>กฎ Bubble Sort:</strong> คลิกหมี 2 ตัวที่ยืนติดกันเพื่อสลับ สลับได้เฉพาะเมื่อตัวซ้ายมีเลขมากกว่าตัวขวา ดันเลขมากไปท้ายแถวทีละรอบ',
    selection: '<strong>กฎ Selection Sort:</strong> ในส่วนที่ยังไม่เรียง ให้คลิกหมีที่มีเลขน้อยที่สุด หมีตัวนั้นจะถูกสลับไปไว้หน้าสุดของส่วนที่ยังไม่เรียง'
  };
  const cb = new Board($('#board-challenge'));
  cb.onBusyChange = updateControlsState;
  let ch = null;

  function updateHud() {
    const box = $('#c-hearts');
    box.innerHTML = [1, 2, 3].map((k) => icon('heart', k <= ch.hearts ? 'fill' : '')).join('');
    box.setAttribute('aria-label', `หัวใจเหลือ ${ch.hearts} ดวง`);
    $('#c-moves').textContent = ch.moves;
  }

  function startChallenge() {
    const n = +$('#c-size').value;
    ch = { n, hearts: 3, moves: 0, mistakes: 0, done: false, start: 0, sel: null, pendingShowResult: null };
    $('#c-rule').innerHTML = RULES[algo];
    cb.load(randomValues(n));
    cb.setDisabled(false);
    cb.onClick = onChallengeClick;
    setMsg('#c-msg', algo === 'bubble'
      ? 'เริ่มเลย! เลือกหมีคู่ที่ติดกันซึ่งตัวซ้ายมากกว่าตัวขวา'
      : 'หาหมีที่มีเลขน้อยที่สุดในแถวแล้วคลิกเลย');
    refreshSettled();
    updateHud();
    updateControlsState();
  }
  $('#c-reset').addEventListener('click', startChallenge);
  $('#c-size').addEventListener('change', startChallenge);

  function mistake(msg, idxs) {
    ch.hearts--; ch.mistakes++;
    Sfx.wrong();
    idxs.forEach((i) => cb.shake(i));
    setMsg('#c-msg', 'ผิดกฎ: ' + msg, 'bad');
    updateHud();
    if (ch.hearts <= 0) endChallenge(false);
  }

  /* ทำเครื่องหมายหมีที่ "เข้าที่ถาวรแล้ว" */
  function refreshSettled() {
    cb.clear('is-settled', 'is-sorted', 'is-selected');
    const vals = cb.values();
    if (algo === 'bubble') {
      // Bubble: หมีท้ายแถวที่ตรงตำแหน่งเรียงแล้ว (ชุด suffix)
      const target = vals.slice().sort((a, b) => a - b);
      for (let i = vals.length - 1; i >= 0 && vals[i] === target[i]; i--) cb.mark([i], 'is-settled');
    } else {
      // Selection: ส่วนหน้าที่ล็อกแล้ว
      cb.mark(Array.from({ length: ch.start }, (_, k) => k), 'is-sorted');
    }
  }

  async function onChallengeClick(i) {
    if (!ch || ch.done || cb.busy) return;     // ระหว่างหมีกำลังเดินสลับ ไม่รับคลิกซ้อน
    const mine = ch;                           // กันกรณีกด "เริ่มใหม่" ระหว่างรออนิเมชัน
    const vals = cb.values();

    if (algo === 'bubble') {
      // ป้องกันการคลิกหมีที่เข้าที่เรียบร้อยแล้ว (suffix checkmark)
      if (cb.bears[i] && cb.bears[i].el.classList.contains('is-settled')) {
        setMsg('#c-msg', 'หมีตัวนี้อยู่ในตำแหน่งที่ถูกต้องแล้ว เลือกตัวที่ยังไม่เรียง', 'bad');
        return;
      }
      if (ch.sel === null) {
        ch.sel = i;
        Sfx.select();
        cb.clear('is-selected');
        cb.mark([i], 'is-selected');
        return;
      }
      if (ch.sel === i) {
        ch.sel = null;
        cb.clear('is-selected');
        return;
      }
      const a = Math.min(ch.sel, i), b = Math.max(ch.sel, i);
      ch.sel = null;
      cb.clear('is-selected');
      if (cb.bears[a].el.classList.contains('is-settled') || cb.bears[b].el.classList.contains('is-settled')) {
        setMsg('#c-msg', 'หมีตัวนี้อยู่ในตำแหน่งที่ถูกต้องแล้ว ไม่ต้องสลับอีก', 'bad');
        return;
      }
      if (b - a !== 1) return mistake('Bubble Sort เทียบและสลับได้เฉพาะหมีที่ยืนติดกันเท่านั้น', [a, b]);
      if (vals[a] < vals[b]) return mistake(`${vals[a]} น้อยกว่า ${vals[b]} อยู่แล้ว (ซ้าย < ขวา) Bubble Sort จะไม่สลับ`, [a, b]);
      ch.moves++; Sfx.swap();
      setMsg('#c-msg', `ถูกต้อง: ${vals[a]} > ${vals[b]} จึงสลับที่กัน`, 'good');
      await cb.swap(a, b);                     // หมี 2 ตัวก้าวสลับที่กัน 1 ช่อง
      if (ch !== mine) return;
      refreshSettled(); updateHud();
      if (Algo.isSorted(cb.values())) endChallenge(true);
    } else {
      if (i < ch.start || (cb.bears[i] && cb.bears[i].el.classList.contains('is-sorted'))) {
        setMsg('#c-msg', 'หมีตัวนี้อยู่ในส่วนที่เรียงเสร็จแล้ว เลือกจากส่วนที่ยังไม่เรียง', 'bad');
        return;
      }
      const minVal = Math.min(...vals.slice(ch.start));
      if (vals[i] !== minVal) {
        return mistake(`ยังมี ${minVal} ที่น้อยกว่า ${vals[i]} ในส่วนที่ยังไม่เรียง Selection Sort ต้องหาค่าน้อยที่สุดก่อนเสมอ`, [i]);
      }
      setMsg('#c-msg', `ถูกต้อง: ${minVal} น้อยที่สุดในส่วนที่เหลือ จึงนำไปไว้ตำแหน่งที่ ${ch.start + 1}`, 'good');
      if (i !== ch.start) {
        ch.moves++; Sfx.swap();
        await cb.swap(ch.start, i);            // หมีเดินสวนกันทีละ 1 ช่องจนถึงปลายทาง
      } else Sfx.correct();
      if (ch !== mine) return;
      ch.start++;
      refreshSettled(); updateHud();
      // Selection Sort ต้องทำครบ n - 1 รอบเพื่อคงแนวคิดการสอน (H-02)
      if (ch.start >= ch.n - 1) endChallenge(true);
    }
  }

  function endChallenge(win) {
    ch.done = true;
    cb.setDisabled(true);
    updateControlsState();
    const I = Algo.INFO[algo];
    const triggerDialog = () => {
      if (win) {
        const s = Math.max(1, 3 - ch.mistakes);
        const score = Math.max(100, ch.n * 200 - ch.mistakes * 150);
        cb.mark(cb.values().map((_, k) => k), 'is-sorted');
        Sfx.win();
        showResult('จัดแถวสำเร็จ',
          `${starsHtml(s)}<p>คะแนน <strong>${score}</strong> · สลับ ${ch.moves} ครั้ง · ผิดกฎ ${ch.mistakes} ครั้ง</p>
           <p><strong>${I.name}:</strong> ${I.desc}</p>`,
          [{ label: 'เล่นอีกครั้ง', action: startChallenge }, { label: 'ปิด', action: () => { cb.setDisabled(false); } }]);
      } else {
        Sfx.lose();
        showResult('หัวใจหมดแล้ว',
          `<p>ลองทบทวนกติกา <strong>${I.name}</strong> อีกครั้ง</p><p>${I.desc}</p>`,
          [{ label: 'ลองใหม่', action: startChallenge }, { label: 'ปิด', action: () => { cb.setDisabled(false); } }]);
      }
    };

    if (currentMode === 'challenge') {
      triggerDialog();
    } else {
      ch.pendingShowResult = triggerDialog;
    }
  }

  // จัดการกรณีผู้ใช้กด Escape หรือปิด dialog ให้เปิดใช้งานบอร์ดตามปกติ (M-04)
  const onDlgDismiss = () => {
    if (ch && ch.done) {
      cb.setDisabled(false);
    }
    updateControlsState();
  };
  dlg.addEventListener('cancel', onDlgDismiss);
  dlg.addEventListener('close', onDlgDismiss);

  /* =====================================================================
     ตัวสลับโหมด: สนามฝึก (Training) vs ภารกิจจัดแถว (Challenging)
     ===================================================================== */
  const tabPractice = $('#tab-practice');
  const tabChallenge = $('#tab-challenge');
  const panelPractice = $('#panel-practice');
  const panelChallenge = $('#panel-challenge');
  const modeTabs = [tabPractice, tabChallenge].filter(Boolean);

  function switchMode(mode, force = false) {
    if (mode !== 'practice' && mode !== 'challenge') return;
    if (!force && mode === currentMode) return;
    currentMode = mode;
    const isPractice = mode === 'practice';

    // 1. หยุด autoplay ของ stepper และยกเลิกอนิเมชันที่กำลังทำงานอยู่ทั้ง 2 บอร์ด
    stopStepper();
    stepBoard.cancel();
    if (cb) {
      cb.cancel();
      if (ch) ch.sel = null;
      cb.clear('is-selected');
    }

    // 2. อัปเดต ARIA state & class สำหรับ Tabs
    if (tabPractice) {
      tabPractice.setAttribute('aria-selected', isPractice ? 'true' : 'false');
      tabPractice.tabIndex = isPractice ? 0 : -1;
      tabPractice.classList.toggle('is-active', isPractice);
    }

    if (tabChallenge) {
      tabChallenge.setAttribute('aria-selected', isPractice ? 'false' : 'true');
      tabChallenge.tabIndex = isPractice ? -1 : 0;
      tabChallenge.classList.toggle('is-active', !isPractice);
    }

    // 3. สลับการแสดงผลของ Tab Panels
    if (panelPractice) {
      if (isPractice) {
        panelPractice.removeAttribute('hidden');
      } else {
        panelPractice.setAttribute('hidden', '');
      }
    }

    if (panelChallenge) {
      if (isPractice) {
        panelChallenge.setAttribute('hidden', '');
      } else {
        panelChallenge.removeAttribute('hidden');
      }
    }

    // 4. จัด layout บอร์ดที่เปิดใหม่ให้พอดีกับขนาดหน้าจอจริงทันที โดยไม่ให้ตัวหมีสไลด์กระตุก
    requestAnimationFrame(() => {
      if (isPractice) {
        stepBoard.el.classList.add('instant');
        stepBoard.layout();
        renderStepper();
        requestAnimationFrame(() => requestAnimationFrame(() => stepBoard.el.classList.remove('instant')));
      } else if (cb) {
        cb.el.classList.add('instant');
        cb.layout();
        refreshSettled();
        requestAnimationFrame(() => requestAnimationFrame(() => cb.el.classList.remove('instant')));
        if (ch && ch.pendingShowResult) {
          const show = ch.pendingShowResult;
          ch.pendingShowResult = null;
          show();
        }
      }
      updateControlsState();
    });
  }

  if (tabPractice) tabPractice.addEventListener('click', () => switchMode('practice'));
  if (tabChallenge) tabChallenge.addEventListener('click', () => switchMode('challenge'));

  // การรองรับคีย์บอร์ดตามมาตรฐาน ARIA Tablist (ลูกศรซ้าย/ขวา/ขึ้น/ลง, Home, End)
  const modeToggle = $('.arena-mode-toggle');
  if (modeToggle) {
    modeToggle.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const idx = modeTabs.indexOf(activeEl);
      if (idx === -1) return;

      let nextIdx = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIdx = (idx + 1) % modeTabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIdx = (idx - 1 + modeTabs.length) % modeTabs.length;
      } else if (e.key === 'Home') {
        nextIdx = 0;
      } else if (e.key === 'End') {
        nextIdx = modeTabs.length - 1;
      }

      if (nextIdx !== -1) {
        e.preventDefault();
        const targetTab = modeTabs[nextIdx];
        targetTab.focus();
        const targetMode = targetTab.id === 'tab-practice' ? 'practice' : 'challenge';
        switchMode(targetMode);
      }
    });
  }

  function checkHash() {
    if (!window.location) return;
    const hash = window.location.hash;
    if (hash === '#challenge' || hash === '#panel-challenge') {
      switchMode('challenge', true);
      const target = $('#panel-challenge') || $('#arena');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === '#practice' || hash === '#panel-practice' || hash === '#arena') {
      switchMode('practice', true);
      const target = $('#panel-practice') || $('#arena');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('hashchange', checkHash);
  }

  /* ---------- เริ่มต้น ---------- */
  updateSoundBtn();
  renderGuide();
  newStepper();
  startChallenge();
  switchMode('practice', true);
  checkHash();
  updateControlsState();
})();
