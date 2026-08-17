package com.foursinteriors.orders;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

// Native PDF save/share for the installed app. Exists because the Android
// WebView silently drops jsPDF's blob download (doc.save) and cannot attach
// files through navigator.share — so the web layer hands the PDF bytes here.
@CapacitorPlugin(name = "PdfSaver")
public class PdfSaverPlugin extends Plugin {

    private static final String MIME = "application/pdf";

    // Save the PDF into the phone's public Downloads folder and open it.
    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        String filename = sanitize(call.getString("filename"));
        if (data == null) { call.reject("No PDF data provided"); return; }
        try {
            byte[] bytes = decode(data);
            Uri uri = writeToDownloads(bytes, filename);
            openPdf(uri);
            JSObject ret = new JSObject();
            ret.put("saved", true);
            ret.put("name", filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not save the PDF: " + e.getMessage());
        }
    }

    // Write the PDF to a private cache file and launch the Android share sheet
    // with the file attached and the caption pre-filled (WhatsApp attaches the
    // real PDF; the recipient/contact is chosen inside the target app).
    @PluginMethod
    public void share(PluginCall call) {
        String data = call.getString("data");
        String filename = sanitize(call.getString("filename"));
        String text = call.getString("text", "");
        if (data == null) { call.reject("No PDF data provided"); return; }
        try {
            byte[] bytes = decode(data);
            File dir = new File(getContext().getCacheDir(), "shared-pdfs");
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, filename);
            try (FileOutputStream fos = new FileOutputStream(out)) { fos.write(bytes); }
            Uri uri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", out);

            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(MIME);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(send, "Share order PDF");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not share the PDF: " + e.getMessage());
        }
    }

    // Accept raw base64 or a full data: URI.
    private byte[] decode(String data) {
        int idx = data.indexOf("base64,");
        String b64 = idx >= 0 ? data.substring(idx + 7) : data;
        return Base64.decode(b64, Base64.DEFAULT);
    }

    private String sanitize(String name) {
        String n = (name == null || name.trim().isEmpty()) ? "order.pdf" : name.trim();
        n = n.replaceAll("[\\\\/:*?\"<>|]", "-");
        if (!n.toLowerCase().endsWith(".pdf")) n = n + ".pdf";
        return n;
    }

    private Uri writeToDownloads(byte[] bytes, String name) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
            cv.put(MediaStore.Downloads.MIME_TYPE, MIME);
            cv.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri item = getContext().getContentResolver()
                .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (item == null) throw new Exception("MediaStore insert failed");
            try (OutputStream os = getContext().getContentResolver().openOutputStream(item)) {
                if (os == null) throw new Exception("Could not open output stream");
                os.write(bytes);
            }
            cv.clear();
            cv.put(MediaStore.Downloads.IS_PENDING, 0);
            getContext().getContentResolver().update(item, cv, null, null);
            return item;
        } else {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, name);
            try (FileOutputStream fos = new FileOutputStream(out)) { fos.write(bytes); }
            return FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", out);
        }
    }

    private void openPdf(Uri uri) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, MIME);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
        } catch (Exception ignored) {
            // No PDF viewer installed — the file is still saved in Downloads.
        }
    }
}
