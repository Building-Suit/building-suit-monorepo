package com.buildingsuit.doctor.synthetic;
import static org.junit.Assert.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.security.KeyStore;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class DoctorSessionFreshInstallTest {
    @Test public void freshInstallEmpty() throws Exception {
        android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        DoctorSessionVault vault = new DoctorSessionVault(context, DoctorSessionVault.NAMESPACE);
        assertFalse(vault.ciphertextFile().exists()); assertNull(vault.read());
        KeyStore keys = KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        assertFalse(keys.containsAlias(context.getPackageName() + "." + DoctorSessionVault.NAMESPACE));
    }
}
