package com.buildingsuit.doctor.synthetic;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class DoctorSessionVaultTest {
    static final String VALUE = "{\"accessToken\":\"synthetic-access-only\",\"refreshToken\":\"synthetic-refresh-only\",\"expiresAt\":4102444800000}";
    private DoctorSessionVault vault;
    private Context context;
    @Before public void prepare() throws Exception {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        vault = new DoctorSessionVault(context, DoctorSessionVault.NAMESPACE); vault.clear();
    }
    @After public void cleanup() throws Exception { vault.clear(); }
    @Test public void ciphertextRoundTrip() throws Exception {
        vault.write(VALUE); assertEquals(VALUE, vault.read());
        byte[] first = Files.readAllBytes(vault.ciphertextFile().toPath());
        assertFalse(new String(first, StandardCharsets.UTF_8).contains("synthetic-access-only"));
        assertTrue(vault.ciphertextFile().getCanonicalPath().startsWith(context.getNoBackupFilesDir().getCanonicalPath() + "/"));
        assertEquals(VALUE, new DoctorSessionVault(context, DoctorSessionVault.NAMESPACE).read());
        java.security.KeyStore keys = java.security.KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        assertNull(keys.getKey(context.getPackageName() + "." + DoctorSessionVault.NAMESPACE, null).getEncoded());
        vault.write(VALUE);
        assertFalse(java.util.Arrays.equals(first, Files.readAllBytes(vault.ciphertextFile().toPath())));
    }
    @Test public void tamperPurgesSession() throws Exception {
        vault.write(VALUE); byte[] bytes = Files.readAllBytes(vault.ciphertextFile().toPath()); bytes[bytes.length - 1] ^= 1;
        Files.write(vault.ciphertextFile().toPath(), bytes);
        try { vault.read(); fail("Tamper accepted"); } catch (SecurityException expected) { }
        assertNull(vault.read());
    }
    @Test public void otherNamespacesDenied() throws Exception {
        for (String name : new String[]{null, "bs-shop-mobile-local-synthetic-auth-v1", "bs-doctor-mobile-production-auth-v1", "../session"}) {
            try { new DoctorSessionVault(context, name); fail("Namespace accepted"); } catch (SecurityException expected) { }
        }
        vault.write(VALUE); assertEquals(VALUE, vault.read());
    }
    @Test public void purgeMarkerDefeatsRestoredCiphertext() throws Exception {
        vault.write(VALUE); byte[] old = Files.readAllBytes(vault.ciphertextFile().toPath()); vault.clear();
        Files.write(vault.ciphertextFile().toPath(), old);
        assertNull(new DoctorSessionVault(context, DoctorSessionVault.NAMESPACE).read());
        try { vault.write("{\"serviceKey\":\"synthetic-secret-only\"}"); fail("Unknown payload accepted"); } catch (SecurityException expected) { }
        assertNull(vault.read());
    }
}
