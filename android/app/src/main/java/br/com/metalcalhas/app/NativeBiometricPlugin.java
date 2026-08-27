package br.com.metalcalhas.app;

import static androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "NativeBiometric")
public class NativeBiometricPlugin extends Plugin {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "metal_calhas_biometric_token";
    private static final String PREFS = "metal_calhas_biometric";
    private static final String PREF_TOKEN = "token";
    private static final String PREF_IV = "iv";

    private boolean promptOpen;

    @PluginMethod
    public void getStatus(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(BIOMETRIC_STRONG);
        JSObject result = new JSObject();
        result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("hasCredential", hasCredential());
        result.put("status", status);
        call.resolve(result);
    }

    @PluginMethod
    public void storeToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null || token.isBlank()) {
            call.reject("Token não informado.", "token_required");
            return;
        }

        if (!isBiometricAvailable()) {
            call.reject("Nenhuma biometria forte está cadastrada neste aparelho.", "biometric_unavailable");
            return;
        }

        if (!beginPrompt(call)) return;

        try {
            preferences().edit().clear().apply();
            deleteKey();
            SecretKey key = createKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            showPrompt(call, cipher, "Ativar entrada biométrica", "Confirme sua biometria para proteger o acesso.", authenticatedCipher -> {
                byte[] encrypted = authenticatedCipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
                preferences().edit()
                    .putString(PREF_TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                    .putString(PREF_IV, Base64.encodeToString(authenticatedCipher.getIV(), Base64.NO_WRAP))
                    .apply();

                JSObject result = new JSObject();
                result.put("stored", true);
                call.resolve(result);
            });
        } catch (Exception error) {
            finishPrompt();
            clearCredential();
            call.reject("Não foi possível proteger o acesso biométrico.", "biometric_store_failed", error);
        }
    }

    @PluginMethod
    public void retrieveToken(PluginCall call) {
        if (!hasCredential()) {
            call.reject("Não existe acesso biométrico salvo.", "credential_not_found");
            return;
        }

        if (!isBiometricAvailable()) {
            call.reject("A biometria não está disponível neste aparelho.", "biometric_unavailable");
            return;
        }

        if (!beginPrompt(call)) return;

        try {
            String encryptedToken = preferences().getString(PREF_TOKEN, null);
            String encodedIv = preferences().getString(PREF_IV, null);
            SecretKey key = loadKey();
            if (encryptedToken == null || encodedIv == null || key == null) {
                throw new IllegalStateException("Credencial biométrica incompleta.");
            }

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP))
            );

            showPrompt(call, cipher, "Entrar com biometria", "Confirme sua identidade para abrir o Metal Telhas.", authenticatedCipher -> {
                byte[] decrypted = authenticatedCipher.doFinal(
                    Base64.decode(encryptedToken, Base64.NO_WRAP)
                );
                JSObject result = new JSObject();
                result.put("token", new String(decrypted, StandardCharsets.UTF_8));
                call.resolve(result);
            });
        } catch (KeyPermanentlyInvalidatedException error) {
            finishPrompt();
            clearCredential();
            call.reject("A biometria do aparelho mudou. Entre novamente com sua senha.", "credential_invalidated", error);
        } catch (Exception error) {
            finishPrompt();
            call.reject("Não foi possível abrir o acesso biométrico.", "biometric_read_failed", error);
        }
    }

    @PluginMethod
    public void removeCredential(PluginCall call) {
        clearCredential();
        call.resolve();
    }

    private void showPrompt(
        PluginCall call,
        Cipher cipher,
        String title,
        String subtitle,
        CipherAction action
    ) {
        FragmentActivity activity = (FragmentActivity) getActivity();
        Executor executor = ContextCompat.getMainExecutor(getContext());
        BiometricPrompt prompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errorMessage) {
                super.onAuthenticationError(errorCode, errorMessage);
                finishPrompt();
                call.reject(errorMessage.toString(), "biometric_cancelled");
            }

            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                try {
                    BiometricPrompt.CryptoObject cryptoObject = result.getCryptoObject();
                    Cipher authenticatedCipher = cryptoObject == null ? null : cryptoObject.getCipher();
                    if (authenticatedCipher == null) {
                        throw new IllegalStateException("Operação criptográfica não liberada.");
                    }
                    action.run(authenticatedCipher);
                } catch (Exception error) {
                    call.reject("Falha ao processar a credencial protegida.", "biometric_crypto_failed", error);
                } finally {
                    finishPrompt();
                }
            }
        });

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BIOMETRIC_STRONG)
            .setNegativeButtonText("Cancelar")
            .build();

        activity.runOnUiThread(() -> prompt.authenticate(
            promptInfo,
            new BiometricPrompt.CryptoObject(cipher)
        ));
    }

    private SecretKey createKey() throws Exception {
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        } else {
            builder.setUserAuthenticationValidityDurationSeconds(-1);
        }

        generator.init(builder.build());
        return generator.generateKey();
    }

    private SecretKey loadKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }

    private void deleteKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
    }

    private boolean hasCredential() {
        SharedPreferences prefs = preferences();
        return prefs.contains(PREF_TOKEN) && prefs.contains(PREF_IV);
    }

    private boolean isBiometricAvailable() {
        return BiometricManager.from(getContext()).canAuthenticate(BIOMETRIC_STRONG)
            == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void clearCredential() {
        preferences().edit().clear().apply();
        try {
            deleteKey();
        } catch (Exception ignored) {
            // A preferência já foi removida; uma chave órfã não libera nenhum token.
        }
    }

    private synchronized boolean beginPrompt(PluginCall call) {
        if (promptOpen) {
            call.reject("Já existe uma autenticação biométrica aberta.", "biometric_busy");
            return false;
        }
        promptOpen = true;
        return true;
    }

    private synchronized void finishPrompt() {
        promptOpen = false;
    }

    private interface CipherAction {
        void run(Cipher cipher) throws Exception;
    }
}
