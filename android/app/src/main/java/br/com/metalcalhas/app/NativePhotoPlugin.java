package br.com.metalcalhas.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativePhoto")
public class NativePhotoPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void capturePhoto(PluginCall call) {
        Intent intent = new Intent(getContext(), NativePhotoActivity.class);
        startActivityForResult(call, intent, "captureResult");
    }

    @ActivityCallback
    private void captureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        String path = data.getStringExtra(NativePhotoActivity.EXTRA_PHOTO_PATH);
        if (path == null) {
            call.reject("A foto capturada não foi encontrada.");
            return;
        }

        File file = new File(path);
        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("path", path);
        response.put("name", file.getName());
        response.put("mimeType", "image/jpeg");
        response.put("size", file.length());
        call.resolve(response);
    }

    @PluginMethod
    public void uploadPhoto(PluginCall call) {
        String path = call.getString("path");
        String url = call.getString("url");
        String token = call.getString("token");

        if (path == null || url == null || token == null) {
            call.reject("Dados incompletos para enviar a foto.");
            return;
        }

        executor.execute(() -> {
            try {
                File file = validateTemporaryFile(path);
                JSObject response = upload(file, url, token);
                if (!file.delete()) file.deleteOnExit();
                call.resolve(response);
            } catch (Exception exception) {
                call.reject(exception.getMessage() == null
                    ? "Não foi possível enviar a foto."
                    : exception.getMessage());
            }
        });
    }

    private File validateTemporaryFile(String path) throws IOException {
        File file = new File(path).getCanonicalFile();
        File cache = getContext().getCacheDir().getCanonicalFile();

        if (!file.getPath().startsWith(cache.getPath() + File.separator) ||
            !file.exists() || file.length() == 0) {
            throw new IOException("Arquivo temporário de foto inválido.");
        }

        return file;
    }

    private JSObject upload(File file, String targetUrl, String token) throws IOException {
        String boundary = "MetalCalhasPhoto-" + UUID.randomUUID();
        String prefix = "--" + boundary + "\r\n" +
            "Content-Disposition: form-data; name=\"Foto\"; filename=\"" + file.getName() + "\"\r\n" +
            "Content-Type: image/jpeg\r\n\r\n";
        String suffix = "\r\n--" + boundary + "--\r\n";
        byte[] prefixBytes = prefix.getBytes(StandardCharsets.UTF_8);
        byte[] suffixBytes = suffix.getBytes(StandardCharsets.UTF_8);
        long contentLength = prefixBytes.length + file.length() + suffixBytes.length;

        HttpURLConnection connection = (HttpURLConnection) new URL(targetUrl).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(30_000);
        connection.setReadTimeout(120_000);
        connection.setFixedLengthStreamingMode(contentLength);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
        connection.setRequestProperty("Accept", "application/json");

        try {
            try (DataOutputStream output = new DataOutputStream(connection.getOutputStream());
                 BufferedInputStream input = new BufferedInputStream(new java.io.FileInputStream(file))) {
                output.write(prefixBytes);
                byte[] buffer = new byte[64 * 1024];
                long sent = 0;
                int read;

                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                    sent += read;
                    JSObject progress = new JSObject();
                    progress.put("sent", sent);
                    progress.put("total", file.length());
                    progress.put("percent", Math.min(100, Math.round(sent * 100f / file.length())));
                    notifyListeners("photoUploadProgress", progress);
                }

                output.write(suffixBytes);
                output.flush();
            }

            int status = connection.getResponseCode();
            InputStream responseStream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
            String responseBody = readResponse(responseStream);

            if (status < 200 || status >= 300) {
                throw new IOException("Falha ao enviar foto (HTTP " + status + "). " + responseBody);
            }

            JSObject response = new JSObject();
            response.put("status", status);
            response.put("body", responseBody);
            return response;
        } finally {
            connection.disconnect();
        }
    }

    private String readResponse(InputStream stream) throws IOException {
        if (stream == null) return "";
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }
}
