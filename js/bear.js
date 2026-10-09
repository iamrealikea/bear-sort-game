/* bear.js — หมีของผู้เล่น (PNG ท่ายืน + GIF ก้าวสลับ 1 ช่อง) พร้อมป้ายตัวเลขที่หมีถืออยู่
   และคลาส Board สำหรับจัดการแถวหมี */

/* ---- ค่าคงที่ที่ได้จากการวัดไฟล์ภาพจริงของผู้ใช้ ----
   bear-idle.png    : 500x800 พิกเซล
   bear-animate.gif : 1000x800 (กว้าง 2 เท่า) 24 เฟรม เฟรมละ 40ms = 960ms เล่นวนไม่รู้จบ
                      หมีก้าวไปทางขวา 372px จากทั้งหมด 500px  ->  ระยะห่างระหว่างช่อง = 0.744 ของความกว้างภาพ */
const IDLE_SRC = 'asset/bear-idle.png';
const GIF_SRC = 'asset/bear-animate.gif';
const PITCH_RATIO = 0.744;      // ระยะห่างช่อง / ความกว้างภาพหมี
const HOP_MS = 960;             // เวลาที่ GIF ใช้ก้าว 1 ช่อง
/* ระยะที่หมีเคลื่อนไปในแต่ละเฟรมของ GIF (สัดส่วน 0..1 ของ 1 ช่อง) — ใช้ให้ป้ายตัวเลขเคลื่อนตามหมีทัน */
const HOP_PATH = [0, .011, .019, .054, .078, .097, .121, .137, .164, .19, .188, .247,
  .315, .411, .669, .766, .831, .847, .868, .892, .938, .965, .976, 1];

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ภาพหมีสำรอง (SVG) กรณีไฟล์ภาพหาย จะได้ไม่เป็นภาพแตก */
const FALLBACK_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 800">
    <circle cx="170" cy="170" r="45" fill="#755A43"/><circle cx="330" cy="170" r="45" fill="#755A43"/>
    <ellipse cx="250" cy="480" rx="115" ry="190" fill="#B39A62"/>
    <circle cx="250" cy="230" r="115" fill="#C3AA75"/>
    <ellipse cx="250" cy="265" rx="55" ry="40" fill="#CBC3A6"/>
    <circle cx="250" cy="225" r="14" fill="#755A43"/>
    <rect x="165" y="600" width="70" height="95" rx="30" fill="#AD9150"/><rect x="265" y="600" width="70" height="95" rx="30" fill="#AD9150"/>
  </svg>`);

/* โหลด GIF ครั้งเดียวเป็น Blob ในหน่วยความจำ เพื่อให้เล่นเฟรมแรกเสมอโดยไม่ต้องดาวน์โหลดซ้ำผ่านเน็ตเวิร์ก */
let gifBlob = null;
let gifBlobPromise = null;
function ensureGifBlob() {
  if (!gifBlobPromise) {
    gifBlobPromise = fetch(GIF_SRC)
      .then((res) => (res.ok ? res.blob() : null))
      .then((b) => { gifBlob = b; return b; })
      .catch(() => null);
  }
  return gifBlobPromise;
}
ensureGifBlob();

async function createHopGif(dir) {
  await ensureGifBlob();
  return new Promise((resolve) => {
    const g = new Image();
    g.className = 'bear-gif' + (dir < 0 ? ' flip' : '');
    g.alt = '';
    let blobUrl = null;
    if (gifBlob) {
      blobUrl = URL.createObjectURL(gifBlob);
      g.src = blobUrl;
    } else {
      g.src = GIF_SRC;
    }
    const done = () => {
      if (g.naturalWidth === 0) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        resolve({ img: null, blobUrl: null });
      } else {
        resolve({ img: g, blobUrl });
      }
    };
    if (g.complete) {
      done();
    } else {
      g.onload = done;
      g.onerror = () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        resolve({ img: null, blobUrl: null });
      };
    }
  });
}

const MARK_CLASSES = ['is-compare', 'is-selected', 'is-min', 'is-wrong', 'is-sorted', 'is-settled'];

/* Board: แถวหมี 1 แถว
   - ตำแหน่งหมีคำนวณจาก index แล้วเลื่อนด้วย CSS transform
   - การสลับ: หมีแต่ละตัวเดิน "ทีละ 1 ช่อง" ด้วย GIF ต่อเนื่องจนถึงปลายทาง */
class Board {
  constructor(el) {
    this.el = el;
    this.bears = [];       // [{ value, el, x, walking }] เรียงตามลำดับ "จริง" (logical) ปัจจุบัน
    this.pitch = 80;       // ระยะห่างระหว่างช่อง (px)
    this.width = 107;      // ความกว้างภาพหมี (px)
    this.busy = false;     // true ระหว่างอนิเมชันสลับ — ให้ UI ไม่รับคลิกซ้อน
    this._gen = 0;         // generation token สำหรับยกเลิกอนิเมชันที่กำลังทำงานอยู่
    this._idle = Promise.resolve();
    this.onClick = null;
    this.onBusyChange = null;
    new ResizeObserver(() => this.layout()).observe(el);
  }

  setBusy(v) {
    this.busy = Boolean(v);
    if (this.onBusyChange) this.onBusyChange(this.busy);
  }

  /* ยกเลิกอนิเมชันทั้งหมดในบอร์ดทันที ป้องกัน callback จากบอร์ดเก่ามารบกวน */
  cancel() {
    this._gen++;
    this.setBusy(false);
    this._idle = Promise.resolve();
    if (this.el) {
      this.el.querySelectorAll('.bear-gif').forEach((g) => g.remove());
    }
    this.bears.forEach((b) => {
      b.walking = false;
      b.el.classList.remove('is-hopping');
      b.el.style.zIndex = '';
      const idle = b.el.querySelector('.bear-img');
      if (idle) idle.style.visibility = '';
      const sign = b.el.querySelector('.bear-sign');
      if (sign) {
        sign.getAnimations().forEach((a) => a.cancel());
      }
    });
    this.layout();
  }

  load(values) {
    this.cancel();
    this.el.classList.add('instant');          // ปิดอนิเมชันตอนจัดวางครั้งแรก
    this.el.innerHTML = '';
    this.bears = values.map((v) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bear';
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML =
        `<span class="bear-inner">
           <img class="bear-img" src="${IDLE_SRC}" alt="" draggable="false">
           <span class="bear-sign"><span class="bear-num">${v}</span></span>
         </span>`;
      btn.querySelector('.bear-img').addEventListener('error', (e) => { e.target.src = FALLBACK_SRC; }, { once: true });
      const bear = { value: v, el: btn, x: 0, walking: false };
      btn.addEventListener('click', () => {
        if (!this.busy && this.onClick) this.onClick(this.bears.indexOf(bear));
      });
      this.el.appendChild(btn);
      return bear;
    });
    this.layout();
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.remove('instant')));
  }

  /* ตำแหน่ง x (px) ของช่องที่ i */
  xOf(i) {
    const n = this.bears.length;
    const w = this.el.clientWidth || 600;
    return Math.max(0, (w - n * this.pitch) / 2) + i * this.pitch;
  }

  place(bear, x) {
    bear.x = x;
    bear.el.style.transform = `translateX(${x}px)`;
  }

  layout() {
    const n = this.bears.length;
    if (!n) return;
    const w = this.el.clientWidth || 600;
    this.pitch = Math.max(40, Math.min(100, Math.floor(w / n)));
    this.width = this.pitch / PITCH_RATIO;
    this.el.style.setProperty('--pitch', this.pitch + 'px');
    this.el.style.setProperty('--w', this.width + 'px');
    this.bears.forEach((b, i) => {
      // จัดเรียง DOM children ให้ตรงกับลำดับ array จริง เพื่อให้ Tab navigation และ Screen reader ถูกต้อง (WCAG 2.4.3)
      this.el.appendChild(b.el);
      if (!b.walking) this.place(b, this.xOf(i));
      b.el.setAttribute('aria-label', `หมีหมายเลข ${b.value} ตำแหน่งที่ ${i + 1}`);
    });
  }

  values() { return this.bears.map((b) => b.value); }

  whenIdle() { return this._idle; }

  /* สลับหมีตำแหน่ง i กับ j — ลำดับจริงเปลี่ยนทันที ส่วนภาพให้หมี 2 ตัวเดินสวนกันทีละ 1 ช่อง
     คืน Promise ที่เสร็จเมื่ออนิเมชันจบ */
  swap(i, j) {
    if (i === j) return Promise.resolve();
    if (i > j) [i, j] = [j, i];
    const gen = this._gen;
    const a = this.bears[i];      // ตัวนี้เดินไปทางขวา
    const b = this.bears[j];      // ตัวนี้เดินไปทางซ้าย
    this.bears[i] = b; this.bears[j] = a;
    if (REDUCED_MOTION) { this.layout(); return Promise.resolve(); }
    const hops = j - i;
    this.setBusy(true);
    this._idle = Promise.all([this.walk(a, 1, hops, gen), this.walk(b, -1, hops, gen)]).then(() => {
      if (this._gen !== gen) return;
      this.setBusy(false);
      this.layout();
    });
    return this._idle;
  }

  /* ให้หมี 1 ตัวเดินต่อเนื่อง hops ก้าว ทิศ dir (+1 ขวา / -1 ซ้าย) */
  async walk(bear, dir, hops, gen) {
    bear.walking = true;
    bear.el.classList.add('is-hopping');
    bear.el.style.zIndex = 2;
    for (let k = 0; k < hops; k++) {
      if (this._gen !== gen) break;
      await this.hop(bear, dir, gen);
    }
    if (this._gen === gen) {
      bear.el.classList.remove('is-hopping');
      bear.el.style.zIndex = '';
      bear.walking = false;
    }
  }

  /* 1 ก้าว: เล่น GIF 1 รอบ (960ms) เริ่มจากเฟรม 0 เสมอ พร้อมเลื่อนป้ายตัวเลขให้ไปพร้อมกับตัวหมี */
  async hop(bear, dir, gen) {
    if (this._gen !== gen) return;
    const el = bear.el;
    const step = dir * this.pitch;
    const { img: gif, blobUrl } = await createHopGif(dir);
    if (this._gen !== gen) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return;
    }
    if (!gif || (gif.complete && gif.naturalWidth === 0)) {  // ไม่มีไฟล์ GIF หรือโหลดไม่สำเร็จ -> เลื่อนด้วย CSS แทน
      el.classList.remove('is-hopping');
      this.place(bear, bear.x + step);
      await sleep(450);
      if (this._gen === gen) el.classList.add('is-hopping');
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return;
    }
    const inner = el.querySelector('.bear-inner');
    const idle = el.querySelector('.bear-img');
    const sign = el.querySelector('.bear-sign');
    inner.insertBefore(gif, sign);
    idle.style.visibility = 'hidden';
    const totalFrames = HOP_PATH.length;
    const frames = HOP_PATH.map((p, f) => ({
      transform: `translateX(${p * step}px)`,
      offset: f / (totalFrames - 1)
    }));
    const anim = sign.animate(frames, { duration: HOP_MS, easing: 'linear', fill: 'forwards' });
    await sleep(HOP_MS);
    gif.remove();
    idle.style.visibility = '';
    anim.cancel();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    if (this._gen === gen) {
      // จบก้าว: ย้ายตำแหน่งจริงไปช่องใหม่ แล้วกลับเป็นภาพยืนนิ่ง
      this.place(bear, bear.x + step);
    }
  }

  /* จัดลำดับหมีให้ตรงกับอาร์เรย์ค่า (ค่าไม่ซ้ำกัน)
     ถ้าต่างกันแค่การสลับ 2 ตัว จะเล่นอนิเมชันเดิน ไม่เช่นนั้นย้ายทันที */
  setOrderByValues(arr) {
    const cur = this.values();
    const diff = [];
    cur.forEach((v, i) => { if (v !== arr[i]) diff.push(i); });
    if (!diff.length) return Promise.resolve();
    const [p, q] = diff;
    if (diff.length === 2 && cur[p] === arr[q] && cur[q] === arr[p]) return this.swap(p, q);
    this.cancel();
    const map = new Map(this.bears.map((b) => [b.value, b]));
    this.bears = arr.map((v) => map.get(v));
    this.el.classList.add('instant');
    this.layout();
    requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.remove('instant')));
    return Promise.resolve();
  }

  mark(indices, cls) {
    indices.forEach((i) => {
      if (this.bears[i]) {
        this.bears[i].el.classList.add(cls);
        if (cls === 'is-selected') {
          this.bears[i].el.setAttribute('aria-pressed', 'true');
        }
      }
    });
  }

  clear(...classes) {
    const list = classes.length ? classes : MARK_CLASSES;
    const clearsSelected = list.includes('is-selected');
    this.bears.forEach((b) => {
      b.el.classList.remove(...list);
      if (clearsSelected) {
        b.el.setAttribute('aria-pressed', 'false');
      }
    });
  }

  shake(i) {
    const b = this.bears[i];
    if (!b) return;
    b.el.classList.add('is-wrong');
    setTimeout(() => b.el.classList.remove('is-wrong'), 500);
  }

  setDisabled(v) { this.bears.forEach((b) => { b.el.disabled = v; }); }
}
