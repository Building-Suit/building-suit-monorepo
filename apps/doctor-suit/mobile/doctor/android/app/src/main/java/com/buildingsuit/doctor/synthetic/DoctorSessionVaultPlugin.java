package com.buildingsuit.doctor.synthetic;

import androidx.lifecycle.Lifecycle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;

@CapacitorPlugin(name = "DoctorSessionVault")
public final class DoctorSessionVaultPlugin extends Plugin {
    private DoctorSessionVault sessionVault;
    private boolean allowed(PluginCall call, boolean foreground) throws Exception {
        URI origin = new URI(getBridge().getWebView().getUrl());
        if (!"https".equals(origin.getScheme()) || !"localhost".equals(origin.getHost()) || origin.getPort() != -1 || origin.getUserInfo() != null ||
            !DoctorSessionVault.NAMESPACE.equals(call.getString("namespace")) ||
            (foreground && !getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED))) return false;
        return true;
    }
    private interface Operation { JSObject run(DoctorSessionVault vault) throws Exception; }
    private void run(PluginCall call, boolean foreground, Operation command) {
        // WebView and lifecycle inspection belong on the UI thread. Keystore
        // and atomic file work run on the bridge's serial background handler.
        getBridge().executeOnMainThread(() -> {
            try { if (!allowed(call, foreground)) throw new SecurityException("Session unavailable"); }
            catch (Exception error) { call.reject("Session storage unavailable", "DOCTOR_VAULT_UNAVAILABLE"); return; }
            getBridge().execute(() -> {
                try {
                    if (sessionVault == null) sessionVault = new DoctorSessionVault(getContext(), DoctorSessionVault.NAMESPACE);
                    JSObject result = command.run(sessionVault);
                    getBridge().executeOnMainThread(() -> {
                        try { if (!allowed(call, foreground)) throw new SecurityException("Session unavailable"); call.resolve(result); }
                        catch (Exception error) { call.reject("Session storage unavailable", "DOCTOR_VAULT_UNAVAILABLE"); }
                    });
                } catch (Exception error) { call.reject("Session storage unavailable", "DOCTOR_VAULT_UNAVAILABLE"); }
            });
        });
    }
    @PluginMethod public void read(PluginCall call) {
        run(call, true, vault -> { JSObject result = new JSObject(); String value = vault.read(); result.put("value", value == null ? JSObject.NULL : value); return result; });
    }
    @PluginMethod public void write(PluginCall call) {
        run(call, true, vault -> { vault.write(call.getString("value")); return new JSObject(); });
    }
    @PluginMethod public void clear(PluginCall call) {
        run(call, false, vault -> { vault.clear(); return new JSObject(); });
    }
}
