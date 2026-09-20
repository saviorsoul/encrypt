package com.encrypt.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens feed-lab callback URLs in the same Android browser that launched
 * encrypt:// (via Intent referrer), instead of an arbitrary Custom Tabs provider.
 */
@CapacitorPlugin(name = "FeedLabExternalBrowser")
public class FeedLabExternalBrowserPlugin extends Plugin {

    @PluginMethod
    public void getReferringBrowserPackage(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("packageName", MainActivity.getReferringBrowserPackage());
        call.resolve(ret);
    }

    @PluginMethod
    public void openInBrowser(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }

        String packageName = call.getString("packageName");
        if (packageName == null || packageName.isEmpty()) {
            packageName = MainActivity.getReferringBrowserPackage();
        }
        boolean background = Boolean.TRUE.equals(call.getBoolean("background", false));

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is not available");
            return;
        }

        Uri uri = Uri.parse(url.trim());

        if (packageName != null && !packageName.isEmpty()) {
            if (tryOpenInPackage(activity, uri, packageName, background)) {
                call.resolve();
                return;
            }
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (background) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
            }
            activity.startActivity(intent);
        } catch (ActivityNotFoundException e) {
            call.reject("No browser can open this URL.");
            return;
        }

        call.resolve();
    }

    @PluginMethod
    public void returnToCaller(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is not available");
            return;
        }
        activity.moveTaskToBack(true);
        call.resolve();
    }

    private boolean tryOpenInPackage(
        Activity activity,
        Uri uri,
        String packageName,
        boolean background
    ) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.setPackage(packageName);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (background) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
            }
            activity.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        }
    }
}
