package com.buildingsuit.doctor.synthetic;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import java.net.ResponseCache;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(DoctorSessionVaultPlugin.class);
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        // Only public bundled assets and explicit UI preferences survive a view.
        // Native API responses and private charts have no disk cache admission.
        ResponseCache.setDefault(null);
        getBridge().getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    }
    @Override public void onStop() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
        }
        super.onStop();
    }
}
