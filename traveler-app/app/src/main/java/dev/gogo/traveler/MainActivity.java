package dev.gogo.traveler;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity implements RecognitionListener {
    private static final int AUDIO_PERMISSION = 41;
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    private TextToSpeech tts;
    private SpeechRecognizer recognizer;
    private boolean speakingReady;
    private boolean pageReady;
    private boolean resumed;
    private boolean listening;
    private boolean listeningForWake;
    private boolean wakeEnabled;
    private boolean wakeTransition;
    private boolean requestedWake;
    private boolean listenAfterSpeech;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xfff2f5f5);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "GoGoNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if ("https".equals(request.getUrl().getScheme()) && "tile.openstreetmap.org".equals(request.getUrl().getHost())) return null;
                String path = request.getUrl().getPath();
                if (!"appassets.androidplatform.net".equals(request.getUrl().getHost()) || path == null || !path.startsWith("/web/") || path.contains(".."))
                    return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                try {
                    String mime = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : "text/html";
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open(path.substring(1)));
                } catch (IOException error) {
                    return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                }
            }
            @Override public void onPageFinished(WebView view, String url) { pageReady = true; }
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xfff2f5f5);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(root);
        root.requestApplyInsets();

        tts = new TextToSpeech(this, status -> {
            speakingReady = status == TextToSpeech.SUCCESS;
            if (speakingReady) {
                int result = tts.setLanguage(Locale.US);
                speakingReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED;
                tts.setSpeechRate(.95f);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String utteranceId) {}
                    @Override public void onDone(String utteranceId) { continueAfterPrompt(); }
                    @Override public void onError(String utteranceId) { continueAfterPrompt(); }
                });
            }
        });
        web.loadUrl("https://appassets.androidplatform.net/web/index.html");
    }

    private void ensureRecognizer() {
        if (recognizer != null) return;
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            jsStatus("Speech recognition is unavailable on this device.", false);
            return;
        }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(this);
    }

    private void requestListening(boolean wake) {
        requestedWake = wake;
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION);
            return;
        }
        startListening(wake);
    }

    private void startListening(boolean wake) {
        ensureRecognizer();
        if (recognizer == null || !resumed) return;
        listeningForWake = wake;
        if (listening) {
            listening = false;
            recognizer.cancel();
            main.postDelayed(() -> startListening(wake), 350);
            return;
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag());
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, wake);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        try {
            recognizer.startListening(intent);
            listening = true;
            jsStatus(wake ? "Listening for “Hey GoGo” while the app is open." : "Listening…", !wake);
        } catch (RuntimeException error) {
            listening = false;
            jsStatus("Could not start speech recognition.", false);
        }
    }

    private boolean containsWake(String text) {
        String value = text == null ? "" : text.toLowerCase(Locale.US).replaceAll("[^a-z ]", " ").replaceAll("\\s+", " ").trim();
        return value.matches("^(hey|hi|okay) (gogo|go go|google|go)( .*)?$");
    }

    private void wakeDetected() {
        if (wakeTransition) return;
        wakeTransition = true;
        listening = false;
        if (recognizer != null) recognizer.cancel();
        playWakeTone();
        js("window.GoGoWakeDetected&&window.GoGoWakeDetected()");
        // The web voice state machine now decides whether to ask for the starting
        // location or listen for an active-route command after the wake tone.
        main.postDelayed(() -> wakeTransition = false, 500);
    }

    private void playWakeTone() {
        try {
            ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 85);
            tone.startTone(ToneGenerator.TONE_PROP_ACK, 180);
            main.postDelayed(tone::release, 350);
        } catch (RuntimeException ignored) {}
    }

    private void stopVoiceSession() {
        wakeEnabled = false;
        listenAfterSpeech = false;
        wakeTransition = true;
        listening = false;
        listeningForWake = false;
        if (recognizer != null) recognizer.cancel();
        if (tts != null) tts.stop();
        main.postDelayed(() -> wakeTransition = false, 500);
    }

    private void deliver(ArrayList<String> results, boolean partial) {
        if (results == null || results.isEmpty()) return;
        String best = results.get(0);
        if (listeningForWake) {
            for (String result : results) if (containsWake(result)) { wakeDetected(); return; }
            if (!partial) scheduleWake(650);
        } else if (!partial) {
            listening = false;
            js("window.GoGoVoiceResult&&window.GoGoVoiceResult(" + JSONObject.quote(best) + ")");
            scheduleWake(1800);
        }
    }

    private void scheduleWake(long delay) {
        if (wakeEnabled && resumed) main.postDelayed(() -> { if (wakeEnabled && resumed && !listening && !wakeTransition) startListening(true); }, delay);
    }

    private void speakText(String text) {
        if (text == null || text.isEmpty()) return;
        listeningForWake = false;
        if (recognizer != null && listening) { listening = false; recognizer.cancel(); }
        if (speakingReady) {
            String safe = text.substring(0, Math.min(text.length(), 1000));
            tts.speak(safe, TextToSpeech.QUEUE_FLUSH, null, "gogo");
            if (!listenAfterSpeech) scheduleWake(Math.max(1600, Math.min(9000, safe.length() * 55L)));
        } else { Toast.makeText(this, "Enable an English voice in Android settings.", Toast.LENGTH_LONG).show(); continueAfterPrompt(); }
    }

    private void promptAndListen(String text) {
        listenAfterSpeech = true;
        wakeEnabled = true;
        speakText(text);
    }

    private void continueAfterPrompt() {
        if (!listenAfterSpeech) return;
        listenAfterSpeech = false;
        main.post(() -> { if (resumed) requestListening(false); });
    }

    private void jsStatus(String text, boolean active) {
        js("window.GoGoVoiceStatus&&window.GoGoVoiceStatus(" + JSONObject.quote(text) + "," + active + ")");
    }

    private void js(String script) {
        if (web != null && pageReady) web.evaluateJavascript(script, null);
    }

    private void askOllama(String requestId, String baseUrl, String model, String question, String context) {
        new Thread(() -> {
            String answer = "", error = "";
            HttpURLConnection connection = null;
            try {
                String base = baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", "");
                if (!(base.startsWith("http://") || base.startsWith("https://"))) throw new IOException("Use an http:// or https:// Ollama address.");
                if (model == null || model.trim().isEmpty()) throw new IOException("Choose an Ollama model.");
                URL url = new URL(base + "/api/chat");
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(6000);
                connection.setReadTimeout(45000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

                String systemText = "You are GoGo, a concise voice-only indoor accessibility navigation agent. Use only the supplied building context. Never invent a room, floor, elevator, obstacle, or route. A new route requires a verbally confirmed starting building, floor, and mapped room or place. Infer mapped room floors from the destination catalog. A floor-only destination request must ask which room or place on that floor. If a required fact is missing or ambiguous, ask exactly one short question. Navigation actions are validated by the app. Reply with JSON only using: {\"speech\":\"short spoken response\",\"action\":\"none|next|repeat|navigate|ask\",\"destination\":\"exact mapped name or empty\",\"question\":\"one short follow-up question or empty\",\"missingData\":\"specific absent map detail or empty\"}. Building context: " + limit(context, 30000);
                JSONArray messages = new JSONArray()
                    .put(new JSONObject().put("role", "system").put("content", systemText))
                    .put(new JSONObject().put("role", "user").put("content", limit(question, 2000)));
                JSONObject body = new JSONObject().put("model", model.trim()).put("stream", false).put("format", "json").put("messages", messages);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
                int code = connection.getResponseCode();
                InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
                String response = read(stream);
                if (code < 200 || code >= 300) throw new IOException("Ollama returned HTTP " + code + ".");
                answer = new JSONObject(response).getJSONObject("message").optString("content", "");
                if (answer.isEmpty()) throw new IOException("Ollama returned an empty response.");
            } catch (Exception failure) {
                error = failure.getMessage() == null ? "Ollama request failed." : failure.getMessage();
            } finally {
                if (connection != null) connection.disconnect();
            }
            String finalAnswer = answer, finalError = error;
            main.post(() -> js("window.GoGoAssistantReply&&window.GoGoAssistantReply(" + JSONObject.quote(requestId) + "," + JSONObject.quote(finalAnswer) + "," + JSONObject.quote(finalError) + ")"));
        }, "gogo-ollama").start();
    }

    private static String limit(String value, int max) { return value == null ? "" : value.substring(0, Math.min(value.length(), max)); }
    private static String read(InputStream stream) throws IOException {
        if (stream == null) return "";
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            for (String line; (line = reader.readLine()) != null && text.length() < 1_000_000;) text.append(line);
        }
        return text.toString();
    }

    public final class Bridge {
        @JavascriptInterface public void closeApp() { runOnUiThread(() -> finish()); }
        @JavascriptInterface public void speak(String text) { runOnUiThread(() -> speakText(text)); }
        @JavascriptInterface public void stopSpeech() { runOnUiThread(() -> { if (tts != null) tts.stop(); }); }
        @JavascriptInterface public void startVoice() { runOnUiThread(() -> { wakeEnabled = true; requestListening(false); }); }
        @JavascriptInterface public void promptAndListen(String text) { runOnUiThread(() -> MainActivity.this.promptAndListen(text)); }
        @JavascriptInterface public void stopVoice() { runOnUiThread(() -> stopVoiceSession()); }
        @JavascriptInterface public void setWakeWord(boolean enabled) { runOnUiThread(() -> { wakeEnabled = enabled; if (enabled) requestListening(true); else { listening = false; if (recognizer != null) recognizer.cancel(); jsStatus("Wake phrase off.", false); } }); }
        @JavascriptInterface public void askOllama(String requestId, String baseUrl, String model, String question, String context) { MainActivity.this.askOllama(requestId, baseUrl, model, question, context); }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code != AUDIO_PERMISSION) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startListening(requestedWake);
        else jsStatus("Microphone permission is required for voice commands.", false);
    }

    @Override public void onReadyForSpeech(Bundle params) { if (!listeningForWake) jsStatus("Listening…", true); }
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() { if (!listeningForWake) jsStatus("Processing…", false); }
    @Override public void onError(int error) {
        listening = false;
        if (wakeTransition) return;
        if (listeningForWake && wakeEnabled) { scheduleWake(error == SpeechRecognizer.ERROR_NETWORK ? 3000 : 700); return; }
        String message = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ? "I did not catch that. Try again." : error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "Microphone permission is required." : "Voice recognition stopped. Try again.";
        jsStatus(message, false);
        scheduleWake(1800);
    }
    @Override public void onResults(Bundle results) { listening = false; deliver(results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION), false); }
    @Override public void onPartialResults(Bundle partialResults) { deliver(partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION), true); }
    @Override public void onEvent(int eventType, Bundle params) {}

    @Override public void onBackPressed() {
        if (pageReady) web.evaluateJavascript("typeof window.GoGoBack === 'function' && window.GoGoBack()", handled -> { if (!"true".equals(handled)) finish(); });
        else finish();
    }
    @Override protected void onResume() { super.onResume(); resumed = true; if (web != null) web.onResume(); scheduleWake(500); }
    @Override protected void onPause() { resumed = false; listening = false; if (recognizer != null) recognizer.cancel(); if (tts != null) tts.stop(); if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { if (recognizer != null) recognizer.destroy(); if (tts != null) tts.shutdown(); if (web != null) { web.removeJavascriptInterface("GoGoNative"); web.destroy(); } super.onDestroy(); }
}
