package com.foursinteriors.orders;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register BEFORE super.onCreate() so the plugin is exposed to the very
        // first page load. (A JavascriptInterface added after the WebView has
        // started loading is only visible on the next load — which is why the
        // earlier download bridge never worked.)
        registerPlugin(PdfSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
