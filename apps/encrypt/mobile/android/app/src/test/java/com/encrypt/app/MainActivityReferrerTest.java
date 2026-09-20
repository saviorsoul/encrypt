package com.encrypt.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import android.net.Uri;
import org.junit.Test;

public class MainActivityReferrerTest {
    @Test
    public void parseAndroidAppReferrer_readsChromePackage() {
        assertEquals(
            "com.android.chrome",
            MainActivity.parseAndroidAppReferrer(
                Uri.parse("android-app://com.android.chrome")
            )
        );
    }

    @Test
    public void parseAndroidAppReferrer_readsChromeBetaPackage() {
        assertEquals(
            "com.chrome.beta",
            MainActivity.parseAndroidAppReferrer(
                Uri.parse("android-app://com.chrome.beta")
            )
        );
    }

    @Test
    public void parseAndroidAppReferrer_returnsNullForHttpReferrer() {
        assertNull(
            MainActivity.parseAndroidAppReferrer(Uri.parse("https://example.com"))
        );
    }
}
