package com.tylabsmedia.safesteps.child;

import android.os.Build;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class PairingClient {
    interface Callback {
        void onResult(boolean success, PairingResult result, String message);
    }

    static final class PairingResult {
        final String childId;
        final String deviceToken;
        final String locationEndpoint;

        PairingResult(String childId, String deviceToken, String locationEndpoint) {
            this.childId = childId;
            this.deviceToken = deviceToken;
            this.locationEndpoint = locationEndpoint;
        }
    }

    void pair(String apiBaseUrl, String childName, String code, String passkey, Callback callback) {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(trimSlash(apiBaseUrl) + "/api/child/pair");
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(10_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

                String body = "{\"childName\":\"" + escape(childName) + "\","
                        + "\"code\":\"" + escape(code) + "\","
                        + "\"passkey\":\"" + escape(passkey) + "\","
                        + "\"deviceName\":\"" + escape(Build.MODEL == null ? "Android" : Build.MODEL) + "\"}";
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream stream = connection.getOutputStream()) {
                    stream.write(bytes);
                }

                int status = connection.getResponseCode();
                String response = read(status >= 400 ? connection.getErrorStream() : connection.getInputStream());
                if (status < 200 || status >= 300) {
                    callback.onResult(false, null, messageFrom(response, "Pairing failed"));
                    return;
                }

                PairingResult result = new PairingResult(
                        valueFrom(response, "childId"),
                        valueFrom(response, "deviceToken"),
                        valueFrom(response, "locationEndpoint"));
                callback.onResult(true, result, "Paired");
            } catch (Exception error) {
                callback.onResult(false, null, error.getClass().getSimpleName() + ": " + error.getMessage());
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }, "safesteps-pair").start();
    }

    private String trimSlash(String value) {
        String trimmed = value == null || value.trim().isEmpty()
                ? AppConfig.DEFAULT_API_BASE_URL
                : value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String read(InputStream stream) throws Exception {
        if (stream == null) {
            return "";
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int count;
        while ((count = stream.read(buffer)) != -1) {
            output.write(buffer, 0, count);
        }
        return output.toString("UTF-8");
    }

    private String valueFrom(String json, String key) {
        Matcher matcher = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        return matcher.find() ? matcher.group(1) : "";
    }

    private String messageFrom(String json, String fallback) {
        String error = valueFrom(json, "error");
        return error.isEmpty() ? fallback : error;
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
