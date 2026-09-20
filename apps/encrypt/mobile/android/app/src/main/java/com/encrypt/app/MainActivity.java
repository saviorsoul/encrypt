package com.encrypt.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static volatile String referringBrowserPackage;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FeedLabExternalBrowserPlugin.class);
        super.onCreate(savedInstanceState);
        captureReferringBrowser();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureReferringBrowser();
    }

    private void captureReferringBrowser() {
        Uri referrer = getReferrer();
        if (referrer == null) {
            return;
        }
        String pkg = parseAndroidAppReferrer(referrer);
        if (pkg != null && !pkg.isEmpty()) {
            referringBrowserPackage = pkg;
        }
    }

    static String getReferringBrowserPackage() {
        return referringBrowserPackage;
    }

    static String parseAndroidAppReferrer(Uri referrer) {
        if (referrer == null) {
            return null;
        }
        if (!"android-app".equals(referrer.getScheme())) {
            return null;
        }
        String host = referrer.getHost();
        if (host != null && !host.isEmpty()) {
            return host;
        }
        String authority = referrer.getAuthority();
        if (authority == null || authority.isEmpty()) {
            return null;
        }
        int slash = authority.indexOf('/');
        return slash >= 0 ? authority.substring(0, slash) : authority;
    }
}
