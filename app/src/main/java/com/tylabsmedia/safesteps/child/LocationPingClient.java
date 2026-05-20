package com.tylabsmedia.safesteps.child;

import android.location.Location;
import android.os.Build;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

final class LocationPingClient {
    interface Callback {
        void onResult(boolean success, String message);
    }

    void send(String endpoint, String deviceToken, String childName, Location location, Callback callback) {
        new Thread(() -> {
            if (endpoint == null || endpoint.trim().isEmpty()) {
                callback.onResult(false, "Missing endpoint");
                return;
            }
            if (deviceToken == null || deviceToken.trim().isEmpty()) {
                callback.onResult(false, "Missing device token");
                return;
            }

            HttpURLConnection connection = null;
            try {
                URL url = new URL(endpoint.trim());
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(10_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Authorization", "Bearer " + deviceToken.trim());
                connection.setRequestProperty("X-SafeSteps-Device", Build.MODEL == null ? "Android" : Build.MODEL);

                byte[] body = buildBody(childName, location).getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(body.length);
                try (OutputStream stream = connection.getOutputStream()) {
                    stream.write(body);
                }

                int status = connection.getResponseCode();
                callback.onResult(status >= 200 && status < 300, "HTTP " + status);
            } catch (Exception error) {
                callback.onResult(false, error.getClass().getSimpleName() + ": " + error.getMessage());
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }, "location-ping").start();
    }

    private String buildBody(String childName, Location location) {
        return String.format(Locale.US,
                "{\"childName\":\"%s\",\"latitude\":%.7f,\"longitude\":%.7f,\"accuracyMeters\":%.1f,\"altitudeMeters\":%.1f,\"speedMetersPerSecond\":%.2f,\"bearingDegrees\":%.1f,\"provider\":\"%s\",\"capturedAt\":%d}",
                escape(childName),
                location.getLatitude(),
                location.getLongitude(),
                location.hasAccuracy() ? location.getAccuracy() : -1,
                location.hasAltitude() ? location.getAltitude() : -1,
                location.hasSpeed() ? location.getSpeed() : -1,
                location.hasBearing() ? location.getBearing() : -1,
                escape(location.getProvider()),
                location.getTime());
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
