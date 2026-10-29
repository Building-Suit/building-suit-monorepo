package com.buildingsuit.doctor.synthetic;

import static org.junit.Assert.*;
import android.content.pm.ApplicationInfo;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.IOException;
import java.net.CacheRequest;
import java.net.CacheResponse;
import java.net.ResponseCache;
import java.net.URI;
import java.net.URLConnection;
import java.util.List;
import java.util.Map;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Installed debug candidate checks only. No patient/session fixture, provider,
 * physical-device or clinical qualification is created by these assertions. */
@RunWith(AndroidJUnit4.class)
public final class DoctorOnlinePolicyTest {
    @After public void cleanup() { ResponseCache.setDefault(null); }
    @Test public void secureWindowEnabled() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> assertTrue((activity.getWindow().getAttributes().flags
                & WindowManager.LayoutParams.FLAG_SECURE) != 0));
        }
    }
    @Test public void webViewDiskCacheDisabled() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> assertEquals(WebSettings.LOAD_NO_CACHE,
                activity.getBridge().getWebView().getSettings().getCacheMode()));
        }
    }
    @Test public void nativeResponseCacheDisabled() {
        ResponseCache.setDefault(new ResponseCache() {
            @Override public CacheResponse get(URI uri, String method, Map<String, List<String>> headers) throws IOException { return null; }
            @Override public CacheRequest put(URI uri, URLConnection connection) throws IOException { return null; }
        });
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> assertNull(ResponseCache.getDefault()));
        }
    }
    @Test public void backupDisabled() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> assertEquals(0, activity.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP));
        }
    }
    @Test public void backgroundCachePolicyRetained() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.moveToState(Lifecycle.State.CREATED);
            scenario.moveToState(Lifecycle.State.RESUMED);
            scenario.onActivity(activity -> {
                assertEquals(WebSettings.LOAD_NO_CACHE, activity.getBridge().getWebView().getSettings().getCacheMode());
                assertTrue((activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0);
                assertNull(ResponseCache.getDefault());
            });
        }
    }
}
