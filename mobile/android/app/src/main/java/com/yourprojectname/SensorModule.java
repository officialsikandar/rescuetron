package com.yourprojectname;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SensorModule extends ReactContextBaseJavaModule {

    private static final String TAG = "SensorModule";
    private final ReactApplicationContext reactContext;

    public SensorModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "SensorModule";
    }

    /**
     * Starts the native persistent Foreground Service for background/killed-state crash detection.
     */
    @ReactMethod
    public void startService(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Intent intent = new Intent(context, SensorService.class);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, intent);
            } else {
                context.startService(intent);
            }

            Log.d(TAG, "SensorService started via SensorModule.startService()");
            if (promise != null) {
                promise.resolve("SensorService started successfully");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start SensorService: " + e.getMessage(), e);
            if (promise != null) {
                promise.reject("START_SERVICE_ERROR", e.getMessage(), e);
            }
        }
    }

    /**
     * Stops the native Foreground Service and releases all sensor and audio resources.
     */
    @ReactMethod
    public void stopService(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            Intent intent = new Intent(context, SensorService.class);
            context.stopService(intent);

            Log.d(TAG, "SensorService stopped via SensorModule.stopService()");
            if (promise != null) {
                promise.resolve("SensorService stopped successfully");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop SensorService: " + e.getMessage(), e);
            if (promise != null) {
                promise.reject("STOP_SERVICE_ERROR", e.getMessage(), e);
            }
        }
    }
}
