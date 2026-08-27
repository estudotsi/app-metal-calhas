package br.com.metalcalhas.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;
import java.util.concurrent.ExecutionException;

public class NativePhotoActivity extends AppCompatActivity {
    public static final String EXTRA_PHOTO_PATH = "photoPath";

    private PreviewView previewView;
    private ImageView photoPreview;
    private LinearLayout captureControls;
    private LinearLayout reviewControls;
    private Button captureButton;
    private ProcessCameraProvider cameraProvider;
    private ImageCapture imageCapture;
    private File photoFile;
    private boolean photoAccepted;

    private final ActivityResultLauncher<String> permissionLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> {
                if (granted) startCamera();
                else cancelCapture();
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildInterface();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            permissionLauncher.launch(Manifest.permission.CAMERA);
        }
    }

    private void buildInterface() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 8, 23));
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(0, systemBars.top, 0, systemBars.bottom);
            return windowInsets;
        });

        previewView = new PreviewView(this);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        root.addView(previewView, matchParent());

        photoPreview = new ImageView(this);
        photoPreview.setScaleType(ImageView.ScaleType.FIT_CENTER);
        photoPreview.setBackgroundColor(Color.BLACK);
        photoPreview.setVisibility(View.GONE);
        root.addView(photoPreview, matchParent());

        LinearLayout topBar = new LinearLayout(this);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(16), dp(14), dp(16), dp(12));
        topBar.setBackgroundColor(Color.argb(125, 5, 8, 23));

        Button closeButton = textButton("Cancelar");
        closeButton.setOnClickListener(view -> cancelCapture());
        topBar.addView(closeButton, new LinearLayout.LayoutParams(0, dp(42), 1));

        TextView quality = new TextView(this);
        quality.setText("FOTO  •  QUALIDADE ORIGINAL");
        quality.setTextColor(Color.rgb(112, 228, 218));
        quality.setTextSize(12);
        quality.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        quality.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        topBar.addView(quality, new LinearLayout.LayoutParams(0, dp(42), 2));
        root.addView(topBar, topLayout());

        captureControls = new LinearLayout(this);
        captureControls.setGravity(Gravity.CENTER);
        captureControls.setPadding(dp(20), dp(16), dp(20), dp(24));
        captureControls.setBackgroundColor(Color.argb(150, 5, 8, 23));

        captureButton = textButton("●  TIRAR FOTO");
        captureButton.setTextColor(Color.WHITE);
        captureButton.setTextSize(15);
        captureButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        captureButton.setBackground(rounded(Color.rgb(10, 166, 166), 28));
        captureButton.setEnabled(false);
        captureButton.setOnClickListener(view -> capturePhoto());
        captureControls.addView(
            captureButton,
            new LinearLayout.LayoutParams(dp(210), dp(54)));
        root.addView(captureControls, bottomLayout(dp(100)));

        reviewControls = new LinearLayout(this);
        reviewControls.setGravity(Gravity.CENTER);
        reviewControls.setPadding(dp(14), dp(16), dp(14), dp(22));
        reviewControls.setBackgroundColor(Color.argb(220, 5, 8, 23));
        reviewControls.setVisibility(View.GONE);

        Button discardButton = textButton("Tirar novamente");
        discardButton.setTextColor(Color.WHITE);
        discardButton.setBackground(rounded(Color.rgb(55, 66, 92), 14));
        discardButton.setOnClickListener(view -> discardAndCaptureAgain());
        LinearLayout.LayoutParams discardParams = new LinearLayout.LayoutParams(0, dp(54), 1);
        discardParams.rightMargin = dp(8);
        reviewControls.addView(discardButton, discardParams);

        Button useButton = textButton("Usar foto");
        useButton.setTextColor(Color.WHITE);
        useButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        useButton.setBackground(rounded(Color.rgb(10, 166, 166), 14));
        useButton.setOnClickListener(view -> usePhoto());
        LinearLayout.LayoutParams useParams = new LinearLayout.LayoutParams(0, dp(54), 1);
        useParams.leftMargin = dp(8);
        reviewControls.addView(useButton, useParams);
        root.addView(reviewControls, bottomLayout(dp(96)));

        setContentView(root);
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> providerFuture =
            ProcessCameraProvider.getInstance(this);
        providerFuture.addListener(() -> {
            try {
                cameraProvider = providerFuture.get();
                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                imageCapture = new ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                    .build();

                cameraProvider.unbindAll();
                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageCapture);
                captureButton.setEnabled(true);
            } catch (ExecutionException exception) {
                finishWithError();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                finishWithError();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void capturePhoto() {
        if (imageCapture == null) return;

        captureButton.setEnabled(false);
        deletePhoto();
        photoFile = new File(
            getCacheDir(),
            "metal-photo-" + System.currentTimeMillis() + ".jpg");

        ImageCapture.OutputFileOptions outputOptions =
            new ImageCapture.OutputFileOptions.Builder(photoFile).build();
        imageCapture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(this),
            new ImageCapture.OnImageSavedCallback() {
                @Override
                public void onImageSaved(
                    @NonNull ImageCapture.OutputFileResults outputFileResults) {
                    if (photoFile == null || photoFile.length() == 0) {
                        finishWithError();
                        return;
                    }
                    showReview();
                }

                @Override
                public void onError(@NonNull ImageCaptureException exception) {
                    deletePhoto();
                    captureButton.setEnabled(true);
                    finishWithError();
                }
            });
    }

    private void showReview() {
        previewView.setVisibility(View.GONE);
        captureControls.setVisibility(View.GONE);
        photoPreview.setImageURI(Uri.fromFile(photoFile));
        photoPreview.setVisibility(View.VISIBLE);
        reviewControls.setVisibility(View.VISIBLE);
    }

    private void discardAndCaptureAgain() {
        photoPreview.setImageDrawable(null);
        deletePhoto();
        photoPreview.setVisibility(View.GONE);
        reviewControls.setVisibility(View.GONE);
        previewView.setVisibility(View.VISIBLE);
        captureControls.setVisibility(View.VISIBLE);
        captureButton.setEnabled(true);
    }

    private void usePhoto() {
        if (photoFile == null || !photoFile.exists()) return;

        photoAccepted = true;
        Intent result = new Intent();
        result.putExtra(EXTRA_PHOTO_PATH, photoFile.getAbsolutePath());
        setResult(Activity.RESULT_OK, result);
        finish();
    }

    private void cancelCapture() {
        deletePhoto();
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    private void finishWithError() {
        deletePhoto();
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    private void deletePhoto() {
        if (photoFile != null && photoFile.exists()) photoFile.delete();
        photoFile = null;
    }

    @Override
    protected void onDestroy() {
        if (cameraProvider != null) cameraProvider.unbindAll();
        if (!photoAccepted) deletePhoto();
        super.onDestroy();
    }

    private FrameLayout.LayoutParams matchParent() {
        return new FrameLayout.LayoutParams(-1, -1);
    }

    private FrameLayout.LayoutParams topLayout() {
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(-1, dp(70));
        params.gravity = Gravity.TOP;
        return params;
    }

    private FrameLayout.LayoutParams bottomLayout(int height) {
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(-1, height);
        params.gravity = Gravity.BOTTOM;
        return params;
    }

    private Button textButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setTextSize(12);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setBackgroundColor(Color.TRANSPARENT);
        return button;
    }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
