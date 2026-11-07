package com.buildingsuit.doctor.synthetic;
import static org.junit.Assert.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class DoctorSessionSeedTest {
    @Test public void seedBeforeReinstall() throws Exception {
        DoctorSessionVault vault = new DoctorSessionVault(InstrumentationRegistry.getInstrumentation().getTargetContext(), DoctorSessionVault.NAMESPACE);
        vault.write(DoctorSessionVaultTest.VALUE); assertEquals(DoctorSessionVaultTest.VALUE, vault.read());
    }
}
