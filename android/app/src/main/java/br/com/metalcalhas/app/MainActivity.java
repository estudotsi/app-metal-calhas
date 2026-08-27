package br.com.metalcalhas.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeBiometricPlugin.class);
        registerPlugin(NativeFilePlugin.class);
        registerPlugin(NativePhotoPlugin.class);
        registerPlugin(NativeVideoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
