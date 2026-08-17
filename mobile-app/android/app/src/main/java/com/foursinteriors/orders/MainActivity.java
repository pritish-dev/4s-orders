package com.foursinteriors.orders;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Expose a tiny save bridge to the web layer. jsPDF's doc.save() is a
        // blob download on a hidden <a download>, which the Android WebView
        // silently drops — so the order-form PDF buttons produced no file in
        // the installed app. The web layer (deliverPDF) hands the PDF bytes to
        // AndroidPDF.save(), which writes them to the public Downloads folder
        // and opens the file.
        getBridge().getWebView().addJavascriptInterface(new PdfBridge(), "AndroidPDF");
    }

    public class PdfBridge {
        // base64: the PDF payload (no data: prefix). filename: e.g. Order-123-Customer.pdf
        @JavascriptInterface
        public void save(String base64, String filename) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String name = (filename == null || filename.trim().isEmpty()) ? "order.pdf" : filename.trim();
                if (!name.toLowerCase().endsWith(".pdf")) name = name + ".pdf";
                final Uri uri = writePdf(bytes, name);
                final String shown = name;
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Saved to Downloads: " + shown, Toast.LENGTH_LONG).show();
                    openPdf(uri);
                });
            } catch (Exception e) {
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "Could not save the PDF", Toast.LENGTH_LONG).show());
            }
        }
    }

    // Write the bytes into the public Downloads collection and return a viewable Uri.
    private Uri writePdf(byte[] bytes, String name) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
            cv.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
            cv.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri item = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (item == null) throw new Exception("insert failed");
            try (OutputStream os = getContentResolver().openOutputStream(item)) {
                if (os == null) throw new Exception("open stream failed");
                os.write(bytes);
            }
            cv.clear();
            cv.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(item, cv, null, null);
            return item;
        } else {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, name);
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(bytes);
            }
            return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", out);
        }
    }

    // Open the saved PDF in the device's default PDF viewer.
    private void openPdf(Uri uri) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/pdf");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception ignored) {
            // No PDF viewer installed — the file is saved in Downloads regardless.
        }
    }
}
