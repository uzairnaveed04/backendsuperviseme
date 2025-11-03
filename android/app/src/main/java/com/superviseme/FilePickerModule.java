package com.superviseme;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class FilePickerModule extends ReactContextBaseJavaModule implements ActivityEventListener {

    private static final int FILE_PICKER_REQUEST_CODE = 12345;
    private Promise pickerPromise;

    public FilePickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(this);
    }

    @Override
    public String getName() {
        return "FilePickerModule";
    }

    @ReactMethod
    public void pickFile(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null");
            return;
        }

        pickerPromise = promise;

        try {
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("application/pdf");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            currentActivity.startActivityForResult(Intent.createChooser(intent, "Select PDF"), FILE_PICKER_REQUEST_CODE);
        } catch (Exception e) {
            pickerPromise.reject("ERROR", e.getMessage());
            pickerPromise = null;
        }
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_PICKER_REQUEST_CODE) {
            if (pickerPromise != null) {
                if (resultCode == Activity.RESULT_OK && data != null) {
                    Uri uri = data.getData();
                    if (uri == null) {
                        pickerPromise.reject("NO_FILE", "No file selected");
                        pickerPromise = null;
                        return;
                    }

                    String fileName = "document.pdf";

                    try {
                        Cursor cursor = getReactApplicationContext().getContentResolver().query(uri, null, null, null, null);
                        if (cursor != null && cursor.moveToFirst()) {
                            int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                            if (nameIndex >= 0) {
                                fileName = cursor.getString(nameIndex);
                            }
                            cursor.close();
                        }
                    } catch (Exception e) {
                        // fallback to default name
                    }

                    WritableMap map = Arguments.createMap();
                    map.putString("uri", uri.toString());
                    map.putString("name", fileName);
                    map.putString("type", "application/pdf");

                    pickerPromise.resolve(map);
                } else {
                    pickerPromise.reject("CANCELLED", "File picking cancelled");
                }
                pickerPromise = null;
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        // Not needed
    }
}
