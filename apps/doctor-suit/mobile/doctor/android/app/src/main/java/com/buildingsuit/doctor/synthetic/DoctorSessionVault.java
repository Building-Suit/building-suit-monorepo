package com.buildingsuit.doctor.synthetic;

import android.app.KeyguardManager;
import android.content.Context;
import android.os.UserManager;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** Synthetic Doctor credentials only. Ciphertext never grants session authority.
 * A durable purge marker wins interrupted deletion; no backup or plaintext store. */
final class DoctorSessionVault {
    static final String NAMESPACE = "bs-doctor-mobile-local-synthetic-auth-v1";
    private static final int MAX_BYTES = 32768;
    private final Context context;
    private final String alias;
    private final File directory;
    private final AtomicFile sealed;
    private final AtomicFile disabled;

    DoctorSessionVault(Context context, String namespace) throws Exception {
        if (!NAMESPACE.equals(namespace)) throw new SecurityException("Namespace unavailable");
        this.context = context.getApplicationContext();
        alias = this.context.getPackageName() + "." + NAMESPACE;
        directory = new File(this.context.getNoBackupFilesDir(), "doctor-session-v1");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new SecurityException("Storage unavailable");
        sealed = new AtomicFile(new File(directory, "session.sealed"));
        disabled = new AtomicFile(new File(directory, "session.disabled"));
    }

    private void unlocked() {
        UserManager user = context.getSystemService(UserManager.class);
        KeyguardManager keyguard = context.getSystemService(KeyguardManager.class);
        if (user == null || !user.isUserUnlocked() || keyguard == null || keyguard.isDeviceLocked()) {
            throw new SecurityException("Device unavailable");
        }
    }

    private KeyStore keys() throws Exception {
        KeyStore result = KeyStore.getInstance("AndroidKeyStore");
        result.load(null);
        return result;
    }

    private SecretKey key(boolean create) throws Exception {
        KeyStore keys = keys();
        if (keys.containsAlias(alias)) return (SecretKey) keys.getKey(alias, null);
        if (!create) throw new SecurityException("Session unavailable");
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).setUnlockedDeviceRequired(true).build());
        return generator.generateKey();
    }

    private static void atomic(AtomicFile file, byte[] bytes) throws Exception {
        FileOutputStream stream = null;
        try { stream = file.startWrite(); stream.write(bytes); file.finishWrite(stream); }
        catch (Exception error) { if (stream != null) file.failWrite(stream); throw error; }
    }

    private static void validate(String value) throws Exception {
        if (value == null || value.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) throw new SecurityException("Session unavailable");
        JSONObject row = new JSONObject(value);
        if (row.length() != 3 || !row.has("accessToken") || !row.has("refreshToken") || !row.has("expiresAt")) throw new SecurityException("Session unavailable");
        Object access = row.get("accessToken"), refresh = row.get("refreshToken"), expiry = row.get("expiresAt");
        if (!(access instanceof String) || !(refresh instanceof String) || !(expiry instanceof Number)) throw new SecurityException("Session unavailable");
        String token = (String) access, renewal = (String) refresh;
        double time = ((Number) expiry).doubleValue();
        if (token.length() < 16 || token.length() > 16384 || renewal.length() < 8 || renewal.length() > 4096 ||
            !token.matches("[A-Za-z0-9._~+/=-]+") || !renewal.matches("[A-Za-z0-9._~+/=-]+") ||
            !Double.isFinite(time) || time <= 0 || time > 9007199254740991L || Math.rint(time) != time) throw new SecurityException("Session unavailable");
        if (token.startsWith("sb_") || renewal.startsWith("sb_")) throw new SecurityException("Session unavailable");
        String[] parts = token.split("\\.", -1);
        if (parts.length == 3) {
            JSONObject claims = new JSONObject(new String(Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING), StandardCharsets.UTF_8));
            if (!"authenticated".equals(claims.optString("role"))) throw new SecurityException("Session unavailable");
        }
    }

    synchronized String read() throws Exception {
        unlocked();
        if (disabled.getBaseFile().exists() || !sealed.getBaseFile().exists()) return null;
        try {
            long size = sealed.getBaseFile().length();
            if (size < 30 || size > MAX_BYTES + 64) throw new SecurityException("Session unavailable");
            byte[] bytes = sealed.readFully();
            if (bytes.length < 30 || bytes.length > MAX_BYTES + 64 || bytes[0] != 1 || bytes[1] != 12) throw new SecurityException("Session unavailable");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Arrays.copyOfRange(bytes, 2, 14)));
            cipher.updateAAD(NAMESPACE.getBytes(StandardCharsets.UTF_8));
            String value = new String(cipher.doFinal(Arrays.copyOfRange(bytes, 14, bytes.length)), StandardCharsets.UTF_8);
            validate(value);
            return value;
        } catch (Exception error) {
            clear();
            throw new SecurityException("Session unavailable");
        }
    }

    synchronized void write(String value) throws Exception {
        unlocked(); validate(value);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(true));
            cipher.updateAAD(NAMESPACE.getBytes(StandardCharsets.UTF_8));
            byte[] iv = cipher.getIV(), encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            if (iv.length != 12) throw new SecurityException("Session unavailable");
            byte[] bytes = new byte[14 + encrypted.length]; bytes[0] = 1; bytes[1] = 12;
            System.arraycopy(iv, 0, bytes, 2, 12); System.arraycopy(encrypted, 0, bytes, 14, encrypted.length);
            atomic(sealed, bytes);
            disabled.delete();
            if (disabled.getBaseFile().exists()) throw new SecurityException("Session unavailable");
        } catch (Exception error) {
            atomic(disabled, new byte[]{1});
            throw new SecurityException("Session unavailable");
        }
    }

    synchronized void clear() throws Exception {
        atomic(disabled, new byte[]{1});
        sealed.delete();
        keys().deleteEntry(alias);
    }

    File ciphertextFile() { return sealed.getBaseFile(); }
}
