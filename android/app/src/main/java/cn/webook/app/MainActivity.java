package cn.webook.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 微书 WeBook —— 原生壳。
 *
 * 页面本体是 assets/index.html（就是那份单文件原型），这里只负责三件原生做不到的事：
 *   1. 把本地网页挂到一个 https 虚拟域名下 —— 只有安全上下文里，麦克风录音才被允许；
 *   2. 相机拍照 / 相册选图 —— 网页的 <input type=file> 要靠这里拉起系统界面；
 *   3. 朗读和导出 —— 用系统语音引擎读出步骤，把 PDF / 长图写进手机的「下载」目录。
 *
 * 关于权限：**打开 App 时一个权限都不问**。老人点开就是看书，不该被弹窗拦。
 * 权限只在教导者真正用到那个功能的那一刻才问一次：
 *   点「拍一张照片」→ 走系统相机 Intent（相机 App 自己有权限，我们不需要申请）
 *   点「从相册选图」→ 只在 Android 12 及以下问一次「读取照片」
 *   点「开始录音」  → 问一次「麦克风」
 *   导出 PDF/长图  → 只在 Android 9 及以下问一次「写入存储」
 * 系统只要允许过一次就记住，之后不会再问。
 */
public class MainActivity extends Activity {

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraUri;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;

    private static final int REQ_FILE = 1001;
    private static final int REQ_PERM_MIC = 1011;
    private static final int REQ_PERM_IMAGES = 1012;
    private static final int REQ_PERM_SAVE = 1013;

    /* 权限拿到（或被拒绝）之后要做的事，按请求码排队 */
    private final Map<Integer, Runnable> afterPerm = new HashMap<>();
    private PermissionRequest pendingWebPerm;
    private File pendingOutFile;
    private FileOutputStream pendingOut;
    private String pendingOutName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        initTts();

        web = new WebView(this);
        setContentView(web);
        tuneWebSettings(web.getSettings());

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("webook.local")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClientCompat(assetLoader));
        web.setWebChromeClient(new WebChromeCompat());
        web.addJavascriptInterface(this, "WeBook");

        web.loadUrl("https://webook.local/assets/index.html");
    }

    /* ---------------- 权限：用到才问，一次一件事 ---------------- */
    private boolean hasPerm(String p) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return checkSelfPermission(p) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    /** 有权限就直接做；没有就先问一次，不管答应还是拒绝，最后都会把 after 跑一遍 */
    private void withPerm(String perm, int code, String before, Runnable after) {
        if (hasPerm(perm)) { after.run(); return; }
        if (before != null) toast(before);
        afterPerm.put(code, after);
        requestPermissions(new String[]{perm}, code);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean ok = grantResults != null && grantResults.length > 0
                && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED;
        if (!ok) {
            // 用户勾了「不再询问」的话，只能请他去设置里打开
            boolean forever = permissions != null && permissions.length > 0
                    && !shouldShowRequestPermissionRationale(permissions[0]);
            toast(forever
                    ? "这个开关没打开。去手机「设置 → 应用 → 微书」里打开就能用了"
                    : "没给这个权限，这个功能这次用不了。想用的时候再点一次就行");
        }
        Runnable after = afterPerm.remove(requestCode);
        if (after != null) after.run();
    }

    /* ---------------- WebView ---------------- */
    private void tuneWebSettings(WebSettings s) {
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // 朗读和录音都要求用户先点过屏幕，这里放开是因为界面上的按钮本身就是明确意图
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        // 别让系统字号/缩放把排版撑坏，字号由 App 自己控制
        s.setTextZoom(100);
        s.setDefaultFontSize(16);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setLoadsImagesAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    }

    private static class WebViewClientCompat extends android.webkit.WebViewClient {
        private final WebViewAssetLoader assetLoader;

        WebViewClientCompat(WebViewAssetLoader loader) { this.assetLoader = loader; }

        @Nullable
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            WebResourceResponse r = assetLoader.shouldInterceptRequest(request.getUrl());
            return r != null ? r : super.shouldInterceptRequest(view, request);
        }
    }

    private class WebChromeCompat extends WebChromeClient {

        /* 录音（方言旁白）：网页问 → 我们先确保 App 拿到了麦克风权限，再放行 */
        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(() -> {
                String[] wanted = request.getResources();
                List<String> grant = new ArrayList<>();
                boolean wantsMic = false;
                for (String r : wanted) {
                    if (r.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        grant.add(r); wantsMic = true;
                    } else if (r.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                            || r.equals(PermissionRequest.RESOURCE_MIDI_SYSEX)) {
                        grant.add(r);
                    }
                }
                if (!wantsMic) {
                    if (grant.isEmpty()) request.deny();
                    else request.grant(grant.toArray(new String[0]));
                    return;
                }
                pendingWebPerm = request;
                withPerm(Manifest.permission.RECORD_AUDIO, REQ_PERM_MIC,
                        "第一次录音，手机会问「允许使用麦克风吗」，点「允许」",
                        () -> {
                            PermissionRequest pr = pendingWebPerm;
                            pendingWebPerm = null;
                            if (pr == null) return;
                            if (hasPerm(Manifest.permission.RECORD_AUDIO)) {
                                pr.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                            } else {
                                pr.deny();
                            }
                        });
            });
        }

        /* 网页里的 <input type=file> —— 拍照 / 相册选图 */
        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
            filePathCallback = cb;
            cameraUri = null;

            /* 拍照：交给系统相机 App（它自己有相机权限），我们不需要声明和申请 CAMERA */
            if (params != null && params.isCaptureEnabled()) {
                Intent take = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                Uri out = createImageUri();
                if (out != null && take.resolveActivity(getPackageManager()) != null) {
                    cameraUri = out;
                    take.putExtra(MediaStore.EXTRA_OUTPUT, out);
                    take.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    take.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    try {
                        startActivityForResult(take, REQ_FILE);
                        return true;
                    } catch (Exception ignored) { }
                }
            }

            /* 从相册选图：Android 13 起系统直接给临时读取权，不用问；
               12 及以下的老手机才需要先问一次「读取照片」 */
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S) {
                withPerm(Manifest.permission.READ_EXTERNAL_STORAGE, REQ_PERM_IMAGES,
                        "第一次从相册选图，手机会问「允许访问照片吗」，点「允许」",
                        () -> openGallery(params));
            } else {
                openGallery(params);
            }
            return true;
        }

        private void openGallery(FileChooserParams params) {
            try {
                Intent pick = (params != null) ? params.createIntent()
                        : new Intent(Intent.ACTION_GET_CONTENT).setType("image/*");
                // 让相册和拍照两个入口都出现，有些老人手机没有装相册应用
                Intent chooser = Intent.createChooser(pick, "选一张照片");
                startActivityForResult(chooser, REQ_FILE);
            } catch (Exception e) {
                filePathCallback = null;
                toast("这台手机上找不到能选照片的应用");
            }
        }

        @Override
        public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("知道了", (d, w) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("确定", (d, w) -> result.confirm())
                    .setNegativeButton("取消", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }

        /* 新建说明书 / 改名 用的是 prompt()，不接管的话网页会卡死 */
        @Override
        public boolean onJsPrompt(WebView view, String url, String message, String defaultValue,
                                  JsPromptResult result) {
            final EditText input = new EditText(MainActivity.this);
            input.setSingleLine(true);
            input.setText(defaultValue == null ? "" : defaultValue);
            input.setSelection(input.getText().length());
            LinearLayout box = new LinearLayout(MainActivity.this);
            int pad = (int) (18 * getResources().getDisplayMetrics().density);
            box.setPadding(pad, pad / 3, pad, 0);
            box.addView(input, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setView(box)
                    .setPositiveButton("确定", (d, w) -> result.confirm(input.getText().toString()))
                    .setNegativeButton("取消", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel())
                    .show();
            return true;
        }
    }

    private Uri createImageUri() {
        try {
            File dir = new File(getCacheDir(), "webook");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, "shot_" + System.currentTimeMillis() + ".jpg");
            return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", f);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE) return;
        if (filePathCallback == null) return;

        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK) {
            if (cameraUri != null && (data == null || data.getData() == null)) {
                results = new Uri[]{cameraUri};
            } else if (data != null) {
                Uri one = data.getData();
                ClipData many = data.getClipData();
                if (many != null && many.getItemCount() > 0) {
                    results = new Uri[many.getItemCount()];
                    for (int i = 0; i < many.getItemCount(); i++) results[i] = many.getItemAt(i).getUri();
                } else if (one != null) {
                    results = new Uri[]{one};
                }
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
        cameraUri = null;
    }

    /* ---------------- 系统语音朗读 ---------------- */
    private void initTts() {
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS && tts != null) {
                int r = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
                ttsReady = (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED);
                if (ttsReady) {
                    tts.setSpeechRate(0.85f);   // 老人听慢一点更清楚
                    tts.setPitch(1.0f);
                }
            }
        });
    }

    @android.webkit.JavascriptInterface
    public void speak(String text) {
        runOnUiThread(() -> {
            if (tts != null && ttsReady) {
                tts.stop();
                if (Build.VERSION.SDK_INT >= 21) {
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "webook");
                } else {
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
                }
            } else {
                toast("这台手机还没装中文语音，去「设置 → 语言和输入」里装一个");
            }
        });
    }

    /* ---------------- 导出：PDF / 长图 ----------------
       一条原则：文件先落地到 App 自己的目录（分享一定可用），再复制一份到
       公共「下载 → 微书」（文件管理里能翻到）。PDF 动辄几 MB，整串 base64
       一次性穿桥会被截断，所以网页端切成小块送过来。 */

    private File exportsDir() {
        File d = new File(getFilesDir(), "exports");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private static String mimeOf(String name) {
        String lower = (name == null ? "" : name.toLowerCase());
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".png")) return "image/png";
        return "image/jpeg";
    }

    @android.webkit.JavascriptInterface
    public boolean saveBegin(String name) {
        try {
            File dir = new File(getCacheDir(), "exporting");
            if (!dir.exists()) dir.mkdirs();
            pendingOutFile = new File(dir, "tmp_" + System.currentTimeMillis() + ".bin");
            pendingOutName = (name == null ? "webook.bin" : name);
            pendingOut = new FileOutputStream(pendingOutFile, false);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @android.webkit.JavascriptInterface
    public boolean saveChunk(String base64) {
        try {
            pendingOut.write(Base64.decode(base64, Base64.DEFAULT));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @android.webkit.JavascriptInterface
    public boolean saveEnd() {
        try {
            if (pendingOut != null) { pendingOut.flush(); pendingOut.close(); }
        } catch (Exception ignored) { }
        pendingOut = null;
        File src = pendingOutFile;
        pendingOutFile = null;
        if (src == null || !src.exists()) return false;
        try {
            File dst = new File(exportsDir(), pendingOutName);
            copyFile(src, dst);
            src.delete();
            publishToDownloads(dst, pendingOutName);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** 旧接口留着兜底：一次性把整个文件送过来（小文件才安全） */
    @android.webkit.JavascriptInterface
    public boolean saveBase64(String name, String base64) {
        if (!saveBegin(name)) return false;
        if (!saveChunk(base64)) { return false; }
        return saveEnd();
    }

    private void copyFile(File src, File dst) throws Exception {
        java.io.InputStream in = new java.io.FileInputStream(src);
        OutputStream out = new FileOutputStream(dst, false);
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        out.flush(); out.close(); in.close();
    }

    /** 复制一份到公共「下载 / 微书」，让文件管理 App 能翻到 */
    private void publishToDownloads(File src, String name) {
        if (Build.VERSION.SDK_INT <= 28 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && !hasPerm(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            // 老手机第一次导出才问，问完立刻补一份到公共目录
            runOnUiThread(() -> withPerm(Manifest.permission.WRITE_EXTERNAL_STORAGE, REQ_PERM_SAVE,
                    "第一次导出，手机会问「允许访问存储空间吗」，点「允许」",
                    () -> new Thread(() -> writePublic(src, name)).start()));
            return;
        }
        new Thread(() -> writePublic(src, name)).start();
    }

    private void writePublic(File src, String name) {
        boolean ok;
        try {
            byte[] data = readAll(src);
            String mime = mimeOf(name);
            String folder = "微书";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + folder);
                cv.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) { ok = false; }
                else {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) ok = false;
                    else {
                        os.write(data); os.flush(); os.close();
                        ContentValues done = new ContentValues();
                        done.put(MediaStore.Downloads.IS_PENDING, 0);
                        getContentResolver().update(uri, done, null, null);
                        ok = true;
                    }
                }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS), folder);
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(data); fos.flush(); fos.close();
                ok = true;
            }
        } catch (Exception e) {
            ok = false;
        }
        boolean finalOk = ok;
        runOnUiThread(() -> {
            if (finalOk) toast("《" + name + "》也放了一份到「文件管理 → 下载 → 微书」");
            else toast("存到 App 里了，可以分享；放进「下载」目录这一步失败了");
            refreshExportList();
        });
    }

    private byte[] readAll(File f) throws Exception {
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[64 * 1024];
        java.io.InputStream in = new java.io.FileInputStream(f);
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        in.close();
        return bos.toByteArray();
    }

    /** 给网页的清单：名字 / 大小 / 时间 / 类型 */
    @android.webkit.JavascriptInterface
    public String exportList() {
        File dir = exportsDir();
        File[] fs = dir.listFiles();
        if (fs == null || fs.length == 0) return "[]";
        java.util.List<File> list = new ArrayList<>();
        for (File f : fs) if (f.isFile()) list.add(f);
        list.sort((a, b) -> Long.compare(b.lastModified(), a.lastModified()));
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            File f = list.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"name\":").append(q(f.getName()))
              .append(",\"size\":").append(f.length())
              .append(",\"time\":").append(f.lastModified() / 1000).append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String q(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') sb.append('\\');
            sb.append(c);
        }
        return sb.append('"').toString();
    }

    /** 调用手机的系统分享面板：微信、QQ、打印服务、附近打印店都能收到 */
    @android.webkit.JavascriptInterface
    public void shareFile(String name) {
        runOnUiThread(() -> {
            File f = new File(exportsDir(), name == null ? "" : name);
            if (!f.exists()) { toast("这个文件找不到了"); return; }
            try {
                Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", f);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mimeOf(name));
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "把《" + name + "》发给…");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(chooser);
            } catch (Exception e) {
                toast("这台手机上没有能接收文件的应用");
            }
        });
    }

    @android.webkit.JavascriptInterface
    public void deleteExport(String name) {
        try {
            File f = new File(exportsDir(), name == null ? "" : name);
            if (f.exists()) f.delete();
            /* 顺便把「下载 / 微书」里的那份也删掉，不然用户以为没删干净。
               只删我们自己在那个文件夹里放的文件，不碰别人下载的东西。 */
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                String sel = MediaStore.Downloads.DISPLAY_NAME + "=? AND "
                        + MediaStore.Downloads.RELATIVE_PATH + " LIKE ?";
                getContentResolver().delete(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                        sel, new String[]{name, "%微书%"});
            }
        } catch (Exception ignored) { }
    }

    private void refreshExportList() {
        if (web == null) return;
        web.post(() -> web.evaluateJavascript(
                "(typeof renderExportList==='function' ? (renderExportList(),1) : 0)", null));
    }

    @android.webkit.JavascriptInterface
    public void toastMsg(String msg) {
        runOnUiThread(() -> toast(msg));
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    /* ---------------- 生命周期 ---------------- */
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (tts != null && tts.isSpeaking()) tts.stop();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (web != null) { web.destroy(); }
        super.onDestroy();
    }
}
