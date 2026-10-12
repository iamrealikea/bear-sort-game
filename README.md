# 🐻 Bear & Sort — ห้องเรียนอัลกอริทึมกลางป่า

เว็บเกมสำหรับเรียนรู้ **Sorting Algorithm** ผ่านการจัดแถวคุณหมี ทีละก้าว
สังเกตว่าอัลกอริทึมเปรียบเทียบและสลับตำแหน่งอย่างไร แล้วลงมือเรียงเองตามกติกา

🌐 **เล่นออนไลน์:** https://beargame.iamrealikea.dev

*(An interactive web game for learning Bubble Sort and Selection Sort by arranging bears in a line.)*

## ✨ ฟีเจอร์

- **อัลกอริทึม 2 แบบ:** Bubble Sort และ Selection Sort (สลับเลือกได้ทุกเมื่อ)
- **สนามฝึก (Practice):** ดูการทำงานทีละก้าว ย้อนกลับได้ เล่นอัตโนมัติ สุ่มแถวใหม่ และดูสถิติ (ขั้นตอน / เปรียบเทียบ / สลับ)
- **ภารกิจจัดแถว (Challenge):** ลงมือสลับหมีเองตามกติกาของอัลกอริทึม
  ทำผิดกฎเสียหัวใจ หัวใจหมดคือแพ้ เลือกจำนวนหมีได้ 5–7 ตัว
- **คู่มือนักสำรวจ:** สรุปแนวคิดของอัลกอริทึม 3 ขั้นตอน
- **Algorithm Lab:** ดูโค้ดพร้อมคำอธิบาย (ไฮไลต์เงื่อนไขหลัก) และตารางความซับซ้อนเชิงเวลา
- เอฟเฟกต์เสียง เปิด/ปิดได้ และรองรับการเข้าถึง (ARIA, skip link)

## 🚀 วิธีรัน

โปรเจกต์เป็น static site (HTML + CSS + JavaScript) ไม่ต้องติดตั้งหรือ build

```bash
git clone <repo-url>
cd bear-sort-game
```

จากนั้นเปิด `index.html` ในเบราว์เซอร์ หรือรันเซิร์ฟเวอร์ในเครื่อง:

```bash
npx serve .
# หรือ
python -m http.server 8000
```

## 📁 โครงสร้างโปรเจกต์

```
bear-sort-game/
├── index.html          # หน้าเว็บหลัก
├── css/style.css       # สไตล์
├── js/
│   ├── algorithms.js   # อัลกอริทึมแบบ generator (yield ทีละขั้นตอน) + ข้อมูลคู่มือ/โค้ด
│   ├── audio.js        # เสียงประกอบ
│   ├── bear.js         # การแสดงผลและแอนิเมชันคุณหมี
│   └── game.js         # ลอจิกเกม โหมดสนามฝึกและภารกิจ
├── asset/              # รูปภาพ (bear-idle.png, bear-animate.gif, head-icon.png)
└── CNAME               # โดเมนสำหรับ GitHub Pages
```

## 🧠 วิธีทำงานของอัลกอริทึม

ทุกอัลกอริทึมใน `algorithms.js` เขียนเป็น generator (`function*`) ที่ `yield` step ออกมาทีละขั้น:

```js
{ type, i, j, arr, sorted, text }
// type: 'compare' | 'swap' | 'min' | 'sorted' | 'done'
```

สนามฝึกจึงเล่นทีละก้าว ย้อนกลับ หรือเล่นอัตโนมัติได้จากข้อมูลชุดเดียวกัน

| อัลกอริทึม | ดีที่สุด | เฉลี่ย | แย่ที่สุด | จำนวนการสลับ |
| --- | --- | --- | --- | --- |
| Bubble Sort | O(n) | O(n²) | O(n²) | ได้ถึง O(n²) |
| Selection Sort | O(n²) | O(n²) | O(n²) | ไม่เกิน n−1 |

## 🛠️ เทคโนโลยี

HTML5 · CSS3 · Vanilla JavaScript · ฟอนต์ Mali และ Noto Sans Thai (Google Fonts)

## 📄 License

ยังไม่ได้ระบุ — เพิ่มไฟล์ `LICENSE` ตามต้องการ
