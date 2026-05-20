package com.tylabsmedia.safesteps.child;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;

public class TrackingService extends Service implements LocationListener {
    private static final String TAG = "TrackingService";
    private static final long MIN_TIME_MS = 15_000L;
    private static final float MIN_DISTANCE_METERS = 15f;

    private LocationManager locationManager;
    private SharedPreferences prefs;
    private final LocationPingClient pingClient = new LocationPingClient();

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences(AppConfig.PREFS, MODE_PRIVATE);
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        ensureNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? AppConfig.ACTION_START : intent.getAction();
        if (AppConfig.ACTION_STOP.equals(action)) {
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }

        prefs.edit().putBoolean(AppConfig.KEY_TRACKING_ENABLED, true).apply();
        startForeground(AppConfig.TRACKING_NOTIFICATION_ID, buildNotification("Waiting for location..."));
        startLocationUpdates();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopTracking();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onLocationChanged(Location location) {
        updateNotification(location);
        pingClient.send(
                locationEndpoint(),
                prefs.getString(AppConfig.KEY_DEVICE_TOKEN, ""),
                prefs.getString(AppConfig.KEY_CHILD_NAME, ""),
                location,
                (success, message) -> Log.i(TAG, "Ping " + (success ? "sent: " : "failed: ") + message));
    }

    @Override
    public void onProviderEnabled(String provider) {
    }

    @Override
    public void onProviderDisabled(String provider) {
        startForeground(AppConfig.TRACKING_NOTIFICATION_ID, buildNotification("Location provider disabled"));
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
    }

    private void startLocationUpdates() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            startForeground(AppConfig.TRACKING_NOTIFICATION_ID, buildNotification("Location permission needed"));
            return;
        }

        tryRequest(LocationManager.GPS_PROVIDER);
        tryRequest(LocationManager.NETWORK_PROVIDER);
    }

    private void tryRequest(String provider) {
        try {
            if (locationManager != null && locationManager.isProviderEnabled(provider)) {
                locationManager.requestLocationUpdates(provider, MIN_TIME_MS, MIN_DISTANCE_METERS, this);
            }
        } catch (SecurityException error) {
            Log.w(TAG, "Location permission missing", error);
        } catch (IllegalArgumentException error) {
            Log.w(TAG, "Provider unavailable: " + provider, error);
        }
    }

    private void stopTracking() {
        prefs.edit().putBoolean(AppConfig.KEY_TRACKING_ENABLED, false).apply();
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
    }

    private void updateNotification(Location location) {
        String text = String.format(java.util.Locale.US,
                "Updated %.5f, %.5f",
                location.getLatitude(),
                location.getLongitude());
        startForeground(AppConfig.TRACKING_NOTIFICATION_ID, buildNotification(text));
    }

    private Notification buildNotification(String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stopIntent = new Intent(this, TrackingService.class);
        stopIntent.setAction(AppConfig.ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
                this,
                1,
                stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, AppConfig.NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(this);

        return builder
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("SafeSteps is active")
                .setContentText(text)
                .setOngoing(true)
                .setContentIntent(openPendingIntent)
                .addAction(android.R.drawable.ic_media_pause, "Stop", stopPendingIntent)
                .build();
    }

    private String locationEndpoint() {
        String savedEndpoint = prefs.getString(AppConfig.KEY_ENDPOINT, "");
        if (savedEndpoint != null && !savedEndpoint.trim().isEmpty()) {
            return savedEndpoint;
        }
        String apiBaseUrl = prefs.getString(AppConfig.KEY_API_BASE_URL, AppConfig.DEFAULT_API_BASE_URL);
        while (apiBaseUrl.endsWith("/")) {
            apiBaseUrl = apiBaseUrl.substring(0, apiBaseUrl.length() - 1);
        }
        return apiBaseUrl + "/api/child/location-pings";
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
                AppConfig.NOTIFICATION_CHANNEL_ID,
                "Live location tracking",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shows when SafeSteps is sharing this phone's location.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
