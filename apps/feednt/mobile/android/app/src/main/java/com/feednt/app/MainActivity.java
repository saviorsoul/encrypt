package com.feednt.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        disableWebViewPullToRefresh();
    }

    @Override
    public void onStart() {
        super.onStart();
        disableWebViewPullToRefresh();
    }

    private void disableWebViewPullToRefresh() {
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        bridge.getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
