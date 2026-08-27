package br.com.metalcalhas.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeFile")
public class NativeFilePlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void downloadFile(PluginCall call) {
        String url = call.getString("url");
        String token = call.getString("token");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (url == null || token == null || fileName == null) {
            call.reject("Dados incompletos para baixar o arquivo.");
            return;
        }

        executor.execute(() -> {
            try {
                String safeName = sanitizeFileName(fileName);
                download(url, token, safeName, mimeType);
                JSObject response = new JSObject();
                response.put("fileName", safeName);
                response.put(
                    "location",
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? "Downloads/Metal Calhas"
                        : "Arquivos do aplicativo/Download/Metal Calhas");
                call.resolve(response);
            } catch (Exception exception) {
                call.reject(exception.getMessage() == null
                    ? "Não foi possível baixar o arquivo."
                    : exception.getMessage());
            }
        });
    }

    private void download(
        String targetUrl,
        String token,
        String fileName,
        String mimeType) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(targetUrl).openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(30_000);
        connection.setReadTimeout(300_000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", "*/*");

        Uri mediaUri = null;
        File legacyFile = null;

        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IOException(
                    "Falha ao baixar arquivo (HTTP " + status + "). " +
                        readResponse(connection.getErrorStream()));
            }

            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream())) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContext().getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(
                        MediaStore.Downloads.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/Metal Calhas");
                    values.put(MediaStore.Downloads.IS_PENDING, 1);

                    mediaUri = resolver.insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                        values);
                    if (mediaUri == null)
                        throw new IOException("Não foi possível criar o arquivo em Downloads.");

                    try (OutputStream output = resolver.openOutputStream(mediaUri)) {
                        if (output == null)
                            throw new IOException("Não foi possível abrir o arquivo em Downloads.");
                        copy(input, output);
                    }

                    values.clear();
                    values.put(MediaStore.Downloads.IS_PENDING, 0);
                    resolver.update(mediaUri, values, null, null);
                } else {
                    File downloads = new File(
                        getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
                        "Metal Calhas");
                    if (!downloads.exists() && !downloads.mkdirs())
                        throw new IOException("Não foi possível criar a pasta de downloads.");
                    legacyFile = uniqueFile(downloads, fileName);
                    try (OutputStream output = new FileOutputStream(legacyFile)) {
                        copy(input, output);
                    }
                }
            }
        } catch (Exception exception) {
            if (mediaUri != null) getContext().getContentResolver().delete(mediaUri, null, null);
            if (legacyFile != null && legacyFile.exists()) legacyFile.delete();
            throw exception;
        } finally {
            connection.disconnect();
        }
    }

    private void copy(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
        output.flush();
    }

    private File uniqueFile(File directory, String fileName) {
        File candidate = new File(directory, fileName);
        if (!candidate.exists()) return candidate;

        String base = fileName;
        String extension = "";
        int dot = fileName.lastIndexOf('.');
        if (dot > 0) {
            base = fileName.substring(0, dot);
            extension = fileName.substring(dot);
        }

        return new File(directory, base + "-" + System.currentTimeMillis() + extension);
    }

    private String sanitizeFileName(String fileName) {
        String safeName = new File(fileName).getName()
            .replaceAll("[\\\\/:*?\"<>|]", "_")
            .trim();
        return safeName.isEmpty() ? "arquivo" : safeName;
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
