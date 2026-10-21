/* 把 index.html + app.css + app.js + jsPDF 打包成一个可独立打开的 HTML
   jsPDF 用 base64 内嵌再动态加载，避免被 HTML 解析器截断 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pdf = fs.readFileSync(path.join(root, 'vendor', 'jspdf.umd.min.js'));

const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const b64 = pdf.toString('base64');

const loader = `<script>
(function () {
  try {
    var bin = atob("${b64}");
    var len = bin.length;
    var arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    var url = URL.createObjectURL(new Blob([arr], { type: 'text/javascript' }));
    var s = document.createElement('script');
    s.src = url;
    document.head.appendChild(s);
  } catch (e) { }
})();
</script>`;

/* 注意：必须用函数式替换，否则替换串里的 $$ 会被当成转义符吃掉 */
let out = html
  .replace('<link rel="stylesheet" href="app.css">', () => '<style>\n' + css + '\n</style>')
  .replace('<script src="vendor/jspdf.umd.min.js"></script>', () => loader)
  .replace('<script src="app.js"></script>', () => '<script>\n' + safe(app) + '\n</script>');

const target = path.join(root, '微书-原型.html');
fs.writeFileSync(target, out);
console.log('单文件版已生成：' + target + '（' + Math.round(out.length / 1024) + ' KB）');
