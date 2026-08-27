package br.com.metalcalhas.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.video.FallbackStrategy;
import androidx.camera.video.FileOutputOptions;
import androidx.camera.video.PendingRecording;
import androidx.camera.video.Quality;
import androidx.camera.video.QualitySelector;
import androidx.camera.video.Recorder;
import androidx.camera.video.Recording;
import androidx.camera.video.VideoCapture;
import androidx.camera.video.VideoRecordEvent;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.File;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutionException;

public class NativeVideoActivity extends AppCompatActivity {
    public static final String EXTRA_VIDEO_PATH = "videoPath";

    private final Handler timerHandler = new Handler(Looper.getMainLooper());
    private PreviewView previewView;
    private PlayerView playerView;
    private LinearLayout captureControls;
    private LinearLayout reviewControls;
    private TextView timerText;
    private Button recordButton;
    private Button pauseButton;
    private VideoCapture<Recorder> videoCapture;
    private ProcessCameraProvider cameraProvider;
    private Recording recording;
    private ExoPlayer player;
    private File videoFile;
    private boolean closing;
    private long recordingStartedAt;
    private long pausedStartedAt;
    private long accumulatedPausedMillis;
    private boolean recordingPaused;

    private final ActivityResultLauncher<String[]> permissionLauncher =
        registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            this::onPermissionsResult);

    private final Runnable timerRunnable = new Runnable() {
        @Override
        public void run() {
            long now = System.currentTimeMillis();
            long currentPause = recordingPaused ? now - pausedStartedAt : 0;
            long seconds = Math.max(
                0,
                (now - recordingStartedAt - accumulatedPausedMillis - currentPause) / 1000);
            timerText.setText(String.format(
                Locale.getDefault(),
                "%02d:%02d",
                seconds / 60,
                seconds % 60));
            timerHandler.postDelayed(this, 500);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildInterface();

        if (hasPermissions()) {
            startCamera();
        } else {
            permissionLauncher.launch(new String[] {
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO
            });
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

        playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setVisibility(View.GONE);
        playerView.setBackgroundColor(Color.BLACK);
        root.addView(playerView, matchParent());

        LinearLayout topBar = new LinearLayout(this);
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(16), dp(14), dp(16), dp(12));
        topBar.setBackgroundColor(Color.argb(125, 5, 8, 23));

        Button closeButton = textButton("Cancelar");
        closeButton.setOnClickListener(view -> cancelCapture());
        topBar.addView(closeButton, new LinearLayout.LayoutParams(0, dp(42), 1));

        TextView quality = new TextView(this);
        quality.setText("HD 720p  •  ÁUDIO ATIVO");
        quality.setTextColor(Color.rgb(112, 228, 218));
        quality.setTextSize(12);
        quality.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        quality.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        topBar.addView(quality, new LinearLayout.LayoutParams(0, dp(42), 2));
        root.addView(topBar, topLayout());

        captureControls = new LinearLayout(this);
        captureControls.setOrientation(LinearLayout.VERTICAL);
        captureControls.setGravity(Gravity.CENTER);
        captureControls.setPadding(dp(20), dp(14), dp(20), dp(24));
        captureControls.setBackgroundColor(Color.argb(150, 5, 8, 23));

        timerText = new TextView(this);
        timerText.setText("00:00");
        timerText.setTextColor(Color.WHITE);
        timerText.setTextSize(16);
        timerText.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        timerText.setGravity(Gravity.CENTER);
        captureControls.addView(timerText, new LinearLayout.LayoutParams(-1, dp(34)));

        LinearLayout recordingActions = new LinearLayout(this);
        recordingActions.setGravity(Gravity.CENTER);

        recordButton = textButton("●  GRAVAR");
        recordButton.setTextColor(Color.WHITE);
        recordButton.setTextSize(15);
        recordButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        recordButton.setBackground(rounded(Color.rgb(218, 48, 70), 28));
        recordButton.setOnClickListener(view -> toggleRecording());
        LinearLayout.LayoutParams recordParams = new LinearLayout.LayoutParams(0, dp(54), 1);
        recordParams.topMargin = dp(4);
        recordingActions.addView(recordButton, recordParams);

        pauseButton = textButton("Ⅱ  PAUSAR");
        pauseButton.setTextColor(Color.WHITE);
        pauseButton.setTextSize(14);
        pauseButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        pauseButton.setBackground(rounded(Color.rgb(55, 66, 92), 28));
        pauseButton.setVisibility(View.GONE);
        pauseButton.setOnClickListener(view -> togglePause());
        LinearLayout.LayoutParams pauseParams = new LinearLayout.LayoutParams(0, dp(54), 1);
        pauseParams.leftMargin = dp(10);
        pauseParams.topMargin = dp(4);
        recordingActions.addView(pauseButton, pauseParams);

        captureControls.addView(recordingActions, new LinearLayout.LayoutParams(-1, dp(58)));
        root.addView(captureControls, bottomLayout(dp(130)));

        reviewControls = new LinearLayout(this);
        reviewControls.setGravity(Gravity.CENTER);
        reviewControls.setPadding(dp(14), dp(16), dp(14), dp(22));
        reviewControls.setBackgroundColor(Color.argb(220, 5, 8, 23));
        reviewControls.setVisibility(View.GONE);

        Button discardButton = textButton("Apagar e gravar novamente");
        discardButton.setTextColor(Color.WHITE);
        discardButton.setBackground(rounded(Color.rgb(55, 66, 92), 14));
        discardButton.setOnClickListener(view -> discardAndRecordAgain());
        LinearLayout.LayoutParams discardParams = new LinearLayout.LayoutParams(0, dp(54), 1);
        discardParams.rightMargin = dp(8);
        reviewControls.addView(discardButton, discardParams);

        Button useButton = textButton("Usar vídeo");
        useButton.setTextColor(Color.WHITE);
        useButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        useButton.setBackground(rounded(Color.rgb(10, 166, 166), 14));
        useButton.setOnClickListener(view -> useVideo());
        LinearLayout.LayoutParams useParams = new LinearLayout.LayoutParams(0, dp(54), 1);
        useParams.leftMargin = dp(8);
        reviewControls.addView(useButton, useParams);
        root.addView(reviewControls, bottomLayout(dp(96)));

        setContentView(root);
    }

    private void onPermissionsResult(Map<String, Boolean> result) {
        if (Boolean.TRUE.equals(result.get(Manifest.permission.CAMERA)) &&
            Boolean.TRUE.equals(result.get(Manifest.permission.RECORD_AUDIO))) {
            startCamera();
        } else {
            setResult(Activity.RESULT_CANCELED);
            finish();
        }
    }

    private boolean hasPermissions() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> providerFuture = ProcessCameraProvider.getInstance(this);
        providerFuture.addListener(() -> {
            try {
                cameraProvider = providerFuture.get();
                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                QualitySelector selector = QualitySelector.from(
                    Quality.HD,
                    FallbackStrategy.higherQualityOrLowerThan(Quality.HD));
                Recorder recorder = new Recorder.Builder()
                    .setQualitySelector(selector)
                    .setTargetVideoEncodingBitRate(3_000_000)
                    .build();
                videoCapture = VideoCapture.withOutput(recorder);

                cameraProvider.unbindAll();
                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    videoCapture);
                recordButton.setEnabled(true);
            } catch (ExecutionException | InterruptedException exception) {
                Thread.currentThread().interrupt();
                finishWithError();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void toggleRecording() {
        if (recording == null) startRecording();
        else recording.stop();
    }

    private void togglePause() {
        if (recording == null) return;

        if (recordingPaused) recording.resume();
        else recording.pause();
    }

    private void startRecording() {
        if (videoCapture == null) return;

        videoFile = new File(
            getCacheDir(),
            "metal-video-" + System.currentTimeMillis() + ".mp4");
        FileOutputOptions outputOptions = new FileOutputOptions.Builder(videoFile).build();
        PendingRecording pending = videoCapture.getOutput()
            .prepareRecording(this, outputOptions)
            .withAudioEnabled();

        recording = pending.start(
            ContextCompat.getMainExecutor(this),
            this::onRecordingEvent);
    }

    private void onRecordingEvent(@NonNull VideoRecordEvent event) {
        if (event instanceof VideoRecordEvent.Start) {
            recordingStartedAt = System.currentTimeMillis();
            pausedStartedAt = 0;
            accumulatedPausedMillis = 0;
            recordingPaused = false;
            timerHandler.post(timerRunnable);
            recordButton.setText("■  PARAR");
            recordButton.setBackground(rounded(Color.rgb(40, 48, 73), 28));
            pauseButton.setText("Ⅱ  PAUSAR");
            pauseButton.setVisibility(View.VISIBLE);
            return;
        }

        if (event instanceof VideoRecordEvent.Pause) {
            recordingPaused = true;
            pausedStartedAt = System.currentTimeMillis();
            pauseButton.setText("▶  CONTINUAR");
            pauseButton.setBackground(rounded(Color.rgb(10, 166, 166), 28));
            return;
        }

        if (event instanceof VideoRecordEvent.Resume) {
            if (recordingPaused && pausedStartedAt > 0) {
                accumulatedPausedMillis += System.currentTimeMillis() - pausedStartedAt;
            }
            recordingPaused = false;
            pausedStartedAt = 0;
            pauseButton.setText("Ⅱ  PAUSAR");
            pauseButton.setBackground(rounded(Color.rgb(55, 66, 92), 28));
            return;
        }

        if (event instanceof VideoRecordEvent.Finalize finalizeEvent) {
            timerHandler.removeCallbacks(timerRunnable);
            recording = null;
            recordingPaused = false;
            recordButton.setText("●  GRAVAR");
            recordButton.setBackground(rounded(Color.rgb(218, 48, 70), 28));
            pauseButton.setVisibility(View.GONE);

            if (closing || finalizeEvent.hasError() || videoFile == null || videoFile.length() == 0) {
                deleteVideo();
                if (!closing) finishWithError();
                return;
            }

            showReview();
        }
    }

    private void showReview() {
        previewView.setVisibility(View.GONE);
        captureControls.setVisibility(View.GONE);
        reviewControls.setVisibility(View.VISIBLE);
        playerView.setVisibility(View.VISIBLE);

        player = new ExoPlayer.Builder(this).build();
        player.setRepeatMode(Player.REPEAT_MODE_ONE);
        playerView.setPlayer(player);
        player.setMediaItem(MediaItem.fromUri(videoFile.toURI().toString()));
        player.prepare();
        player.play();
    }

    private void discardAndRecordAgain() {
        releasePlayer();
        deleteVideo();
        playerView.setVisibility(View.GONE);
        reviewControls.setVisibility(View.GONE);
        previewView.setVisibility(View.VISIBLE);
        captureControls.setVisibility(View.VISIBLE);
        timerText.setText("00:00");
    }

    private void useVideo() {
        if (videoFile == null || !videoFile.exists()) return;
        releasePlayer();
        Intent result = new Intent();
        result.putExtra(EXTRA_VIDEO_PATH, videoFile.getAbsolutePath());
        setResult(Activity.RESULT_OK, result);
        finish();
    }

    private void cancelCapture() {
        closing = true;
        if (recording != null) recording.stop();
        releasePlayer();
        deleteVideo();
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    private void finishWithError() {
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    private void releasePlayer() {
        if (player != null) {
            player.release();
            player = null;
        }
        playerView.setPlayer(null);
    }

    private void deleteVideo() {
        if (videoFile != null && videoFile.exists()) videoFile.delete();
        videoFile = null;
    }

    @Override
    protected void onDestroy() {
        timerHandler.removeCallbacks(timerRunnable);
        releasePlayer();
        if (cameraProvider != null) cameraProvider.unbindAll();
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
