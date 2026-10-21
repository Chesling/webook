/* 把原型网页同步进 Android 工程的 assets 目录（每次改完原型跑一次） */
const fs = require('fs');
const path = require('path');

const root = path.dirname(__filename);
const src = path.join(root, '..', 'prototype', '微书-原型.html');
const outDir = path.join(root, 'app', 'src', 'main', 'assets');
const out = path.join(outDir, 'index.html');

if (!fs.existsSync(src)) {
  console.error('找不到原型文件：' + src + '\n请先运行 prototype/build.js 生成单文件版。');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const html = fs.readFileSync(src, 'utf8');
fs.writeFileSync(out, html, 'utf8');
console.log('已同步到 assets/index.html（' + (html.length / 1024).toFixed(0) + ' KB）');
