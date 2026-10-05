package com.yourprojectname;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Persistent Foreground Service for 24/7 G-Force crash impact monitoring.
 * Runs in background, screen-off, and killed states with PARTIAL_WAKE_LOCK.
 */
public class SensorService extends Service implements SensorEventListener {

    private static final String TAG = "RescuetronSensorService";
    private static final String CHANNEL_ID = "rescuetron_crash_monitoring_channel";
    private static final int NOTIFICATION_ID = 1001;
    private static final double CRASH_G_FORCE_THRESHOLD = 3.5;
    private static final long ALARM_COOLDOWN_MS = 10000; // 10 seconds cooldown between consecutive alarm triggers

    private SensorManager sensorManager;
    private Sensor accelerometer;
    private PowerManager.WakeLock wakeLock;
    private MediaPlayer mediaPlayer;
    private long lastAlarmTriggerTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "SensorService onCreate: Initializing background crash detection...");

        // 1. Acquire Partial WakeLock to keep CPU active during screen-off
        acquireWakeLock();

        // 2. Initialize Accelerometer Sensor
        initSensor();

        // 3. Create Notification Channel for Android 8.0+ (API 26+)
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "SensorService onStartCommand: Starting Foreground Service...");

        // Build persistent notification
        Notification notification = buildForegroundNotification();

        // Start Foreground Service compliant with Android 14+ (API 34)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                );
            } catch (Exception e) {
                Log.e(TAG, "Failed to start with FOREGROUND_SERVICE_TYPE_SPECIAL_USE, falling back: " + e.getMessage());
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // Register sensor listener if not already active
        registerSensorListener();

        // START_STICKY ensures OS restarts the service if killed under memory pressure
        return START_STICKY;
    }

    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Rescuetron::CrashDetectionWakeLock"
                );
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
                Log.d(TAG, "Partial WakeLock acquired successfully.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring WakeLock: " + e.getMessage());
        }
    }

    private void initSensor() {
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            if (accelerometer == null) {
                Log.w(TAG, "Device does not have an Accelerometer sensor!");
            }
        }
    }

    private void registerSensorListener() {
        if (sensorManager != null && accelerometer != null) {
            // SENSOR_DELAY_GAME (approx 50Hz/20ms) is ideal for crash detection with balanced battery usage
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
            Log.d(TAG, "Accelerometer listener registered successfully.");
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) {
            return;
        }

        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];

        // Calculate resultant total G-Force normalized against Earth gravity
        double totalAcceleration = Math.sqrt(x * x + y * y + z * z);
        double gForce = totalAcceleration / SensorManager.GRAVITY_EARTH;

        if (gForce >= CRASH_G_FORCE_THRESHOLD) {
            long currentTime = System.currentTimeMillis();
            if (currentTime - lastAlarmTriggerTime > ALARM_COOLDOWN_MS) {
                lastAlarmTriggerTime = currentTime;
                Log.e(TAG, String.format("🚨 CRASH IMPACT DETECTED! G-Force: %.2f G (Threshold: %.1f G)", gForce, CRASH_G_FORCE_THRESHOLD));
                
                // Immediately trigger loud system alarm even if screen is locked or app is killed
                playEmergencyAlarm();
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No-op
    }

    /**
     * Plays the default System Alarm/Ringtone at max audible priority
     */
    private synchronized void playEmergencyAlarm() {
        try {
            // Wake screen up momentarily if possible
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock screenWakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "Rescuetron::CrashAlarmScreenWake"
                );
                screenWakeLock.acquire(5000); // 5 seconds screen turn on
            }

            if (mediaPlayer != null) {
                try {
                    if (mediaPlayer.isPlaying()) {
                        mediaPlayer.stop();
                    }
                    mediaPlayer.release();
                } catch (Exception ignored) {}
                mediaPlayer = null;
            }

            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(getApplicationContext(), alarmUri);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                    .build();
                mediaPlayer.setAudioAttributes(audioAttributes);
            } else {
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            }

            mediaPlayer.setLooping(false);
            mediaPlayer.prepare();
            mediaPlayer.start();
            Log.d(TAG, "Emergency Alarm audio stream successfully triggered.");

        } catch (Exception e) {
            Log.e(TAG, "Failed to play emergency alarm: " + e.getMessage(), e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Rescuetron Crash Monitoring Shield",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Continuous background G-force accelerometer monitoring for vehicle crash detection.");
            channel.setShowBadge(false);
            channel.setSound(null, null);

            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification() {
        int iconRes = getResources().getIdentifier("ic_launcher", "mipmap", getPackageName());
        if (iconRes == 0) {
            iconRes = android.R.drawable.ic_dialog_alert;
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛡️ Rescuetron Crash Shield Active")
            .setContentText("Actively monitoring motion sensors for crash detection.")
            .setSmallIcon(iconRes)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "SensorService onDestroy: Cleaning up background service...");

        // 1. Unregister sensor
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
            sensorManager = null;
        }

        // 2. Stop and release audio player
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }

        // 3. Release WakeLock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
            Log.d(TAG, "Partial WakeLock released.");
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
