package ae.personal.smartledger;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "SmsBridge",
    permissions = {
        @Permission(
            alias = "sms",
            strings = {
                Manifest.permission.READ_SMS,
                Manifest.permission.RECEIVE_SMS
            }
        )
    }
)
public class SmsBridgePlugin extends Plugin {

    private static final String TAG = "SmsBridgePlugin";
    private BroadcastReceiver smsReceiver;
    private boolean isReceiverRegistered = false;
    private ExecutorService executor;

    @Override
    public void load() {
        executor = Executors.newSingleThreadExecutor();
        ensureSmsReceiverRegistered();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        ensureSmsReceiverRegistered();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterSmsReceiver();
        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }
        super.handleOnDestroy();
    }

    private boolean hasReadSmsPermission() {
        Context ctx = getContext();
        return ctx != null
            && ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasReceiveSmsPermission() {
        Context ctx = getContext();
        return ctx != null
            && ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECEIVE_SMS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject buildPermissionPayload() {
        boolean readGranted = hasReadSmsPermission();
        boolean receiveGranted = hasReceiveSmsPermission();
        PermissionState capState = getPermissionState("sms");
        String stateStr = readGranted
            ? "granted"
            : (capState != null ? capState.toString() : "prompt");

        JSObject payload = new JSObject();
        payload.put("granted", readGranted);
        payload.put("readSms", readGranted);
        payload.put("receiveSms", receiveGranted);
        payload.put("state", stateStr);
        return payload;
    }

    @PluginMethod
    public void getSmsPermissionStatus(PluginCall call) {
        call.resolve(buildPermissionPayload());
    }

    @PluginMethod
    public void requestSmsPermissions(PluginCall call) {
        if (hasReadSmsPermission() && hasReceiveSmsPermission()) {
            ensureSmsReceiverRegistered();
            call.resolve(buildPermissionPayload());
            return;
        }
        requestPermissionForAlias("sms", call, "smsPermissionCallback");
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (hasReceiveSmsPermission()) {
            ensureSmsReceiverRegistered();
        }
        call.resolve(buildPermissionPayload());
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context unavailable");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", ctx.getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception ex) {
            call.reject("Unable to open App Settings: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void scanRecentBankSms(PluginCall call) {
        if (!hasReadSmsPermission()) {
            requestPermissionForAlias("sms", call, "scanSmsPermissionCallback");
            return;
        }
        ensureSmsReceiverRegistered();
        readInboxMessages(call);
    }

    @PermissionCallback
    private void scanSmsPermissionCallback(PluginCall call) {
        if (!hasReadSmsPermission()) {
            JSObject result = buildPermissionPayload();
            result.put("permissionDenied", true);
            result.put("messages", new JSArray());
            call.resolve(result);
            return;
        }
        ensureSmsReceiverRegistered();
        readInboxMessages(call);
    }

    private void readInboxMessages(PluginCall call) {
        final Context ctx = getContext();
        if (ctx == null) {
            call.reject("Android context unavailable");
            return;
        }

        final int days = Math.max(1, call.getInt("days", 30));
        final int limit = Math.max(1, Math.min(500, call.getInt("limit", 150)));
        final long cutoffMs = System.currentTimeMillis() - (days * 24L * 60L * 60L * 1000L);

        ExecutorService runner = executor != null ? executor : Executors.newSingleThreadExecutor();
        runner.execute(() -> {
            JSArray messages = new JSArray();
            SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

            ContentResolver resolver = ctx.getContentResolver();
            String[] projection = new String[] {
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE
            };
            String selection = Telephony.Sms.DATE + " >= ?";
            String[] selectionArgs = new String[] { String.valueOf(cutoffMs) };
            String sortOrder = Telephony.Sms.DATE + " DESC";

            try (Cursor cursor = resolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )) {
                if (cursor != null) {
                    int addrIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
                    int bodyIdx = cursor.getColumnIndex(Telephony.Sms.BODY);
                    int dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE);

                    int count = 0;
                    while (cursor.moveToNext() && count < limit) {
                        String sender = addrIdx >= 0 ? cursor.getString(addrIdx) : "";
                        String body = bodyIdx >= 0 ? cursor.getString(bodyIdx) : "";
                        long dateMs = dateIdx >= 0 ? cursor.getLong(dateIdx) : System.currentTimeMillis();

                        if (body == null || body.trim().isEmpty()) {
                            continue;
                        }

                        JSObject row = new JSObject();
                        row.put("sender", sender != null ? sender.trim() : "");
                        row.put("body", body.trim());
                        row.put("timestamp", isoFormat.format(new Date(dateMs)));
                        messages.put(row);
                        count++;
                    }
                }

                JSObject result = buildPermissionPayload();
                result.put("permissionDenied", false);
                result.put("messages", messages);
                call.resolve(result);
            } catch (SecurityException secEx) {
                Logger.warn(TAG, "READ_SMS security exception: " + secEx.getMessage());
                JSObject result = buildPermissionPayload();
                result.put("permissionDenied", true);
                result.put("messages", new JSArray());
                call.resolve(result);
            } catch (Exception ex) {
                Logger.error(TAG, "Failed reading SMS inbox", ex);
                call.reject("Failed reading SMS inbox: " + ex.getMessage());
            }
        });
    }

    private synchronized void ensureSmsReceiverRegistered() {
        if (isReceiverRegistered || !hasReceiveSmsPermission()) {
            return;
        }
        Context ctx = getContext();
        if (ctx == null) {
            return;
        }

        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
                    return;
                }
                try {
                    SmsMessage[] msgs = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                    if (msgs == null || msgs.length == 0) {
                        return;
                    }

                    SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
                    isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));

                    Map<String, StringBuilder> groupedBodies = new LinkedHashMap<>();
                    Map<String, Long> groupedTimestamps = new LinkedHashMap<>();

                    for (SmsMessage msg : msgs) {
                        if (msg == null) continue;
                        String sender = msg.getDisplayOriginatingAddress();
                        if (sender == null || sender.trim().isEmpty()) {
                            sender = msg.getOriginatingAddress();
                        }
                        if (sender == null) {
                            sender = "";
                        }
                        String part = msg.getDisplayMessageBody();
                        if (part == null) {
                            part = msg.getMessageBody();
                        }
                        if (part == null) continue;

                        groupedBodies.computeIfAbsent(sender, k -> new StringBuilder()).append(part);
                        groupedTimestamps.putIfAbsent(sender, msg.getTimestampMillis());
                    }

                    for (Map.Entry<String, StringBuilder> entry : groupedBodies.entrySet()) {
                        String bodyText = entry.getValue().toString().trim();
                        if (bodyText.isEmpty()) continue;

                        long ts = groupedTimestamps.getOrDefault(entry.getKey(), System.currentTimeMillis());
                        JSObject payload = new JSObject();
                        payload.put("sender", entry.getKey().trim());
                        payload.put("body", bodyText);
                        payload.put("timestamp", isoFormat.format(new Date(ts)));
                        notifyListeners("smsReceived", payload, true);
                    }
                } catch (Exception ex) {
                    Logger.warn(TAG, "Error handling incoming SMS broadcast: " + ex.getMessage());
                }
            }
        };

        IntentFilter filter = new IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            ctx.registerReceiver(smsReceiver, filter);
        }
        isReceiverRegistered = true;
    }

    private synchronized void unregisterSmsReceiver() {
        if (!isReceiverRegistered || smsReceiver == null) {
            return;
        }
        Context ctx = getContext();
        if (ctx != null) {
            try {
                ctx.unregisterReceiver(smsReceiver);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered
            }
        }
        smsReceiver = null;
        isReceiverRegistered = false;
    }
}
