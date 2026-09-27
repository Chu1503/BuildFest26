package dev.gogo.traveler;
import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.webkit.*;
import android.speech.tts.TextToSpeech;
import android.view.*;
import android.widget.FrameLayout;
import java.util.Locale;
import java.io.*;
/** Offline map and speech. No location or motion sensor collection. */
public class MainActivity extends Activity {
 WebView web;TextToSpeech tts;boolean speakingReady=false,pageReady=false;
 @Override public void onCreate(Bundle state){super.onCreate(state);
 web=new WebView(this);web.setBackgroundColor(0xfff2f5f5);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
 web.addJavascriptInterface(new Bridge(),"GoGoNative");web.setWebViewClient(new WebViewClient(){
 @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return true;}
 @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){if("https".equals(r.getUrl().getScheme())&&"tile.openstreetmap.org".equals(r.getUrl().getHost()))return null;String path=r.getUrl().getPath();if(!"appassets.androidplatform.net".equals(r.getUrl().getHost())||path==null||!path.startsWith("/web/")||path.contains(".."))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));try{String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".png")?"image/png":"text/html";return new WebResourceResponse(mime,"UTF-8",getAssets().open(path.substring(1)));}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}}
 @Override public void onPageFinished(WebView v,String url){pageReady=true;}
 });
 // Insets belong to the parent, not WebView padding, including Android 15 edge-to-edge.
 FrameLayout root=new FrameLayout(this);root.setBackgroundColor(0xfff2f5f5);root.addView(web,new FrameLayout.LayoutParams(-1,-1));
 if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
 else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
 root.setOnApplyWindowInsetsListener((v,i)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets b=i.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());v.setPadding(b.left,b.top,b.right,b.bottom);}else v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});
 setContentView(root);root.requestApplyInsets();
 tts=new TextToSpeech(this,status->{speakingReady=status==TextToSpeech.SUCCESS;if(speakingReady){int result=tts.setLanguage(Locale.US);speakingReady=result!=TextToSpeech.LANG_MISSING_DATA&&result!=TextToSpeech.LANG_NOT_SUPPORTED;tts.setSpeechRate(.95f);}});
 web.loadUrl("https://appassets.androidplatform.net/web/index.html");
 }
 final class Bridge {
 @JavascriptInterface public void closeApp(){runOnUiThread(()->finish());}
 @JavascriptInterface public void speak(String text){runOnUiThread(()->{if(speakingReady)tts.speak(text.substring(0,Math.min(text.length(),1000)),TextToSpeech.QUEUE_FLUSH,null,"cue");else android.widget.Toast.makeText(MainActivity.this,"Enable an English voice in Android settings.",android.widget.Toast.LENGTH_LONG).show();});}
 @JavascriptInterface public void stopSpeech(){runOnUiThread(()->{if(tts!=null)tts.stop();});}
 }
 @Override public void onBackPressed(){if(pageReady)web.evaluateJavascript("typeof window.GoGoBack === 'function' && window.GoGoBack()",handled->{if(!"true".equals(handled))finish();});else finish();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onPause(){super.onPause();if(tts!=null)tts.stop();if(web!=null)web.onPause();}
 @Override protected void onDestroy(){if(tts!=null)tts.shutdown();if(web!=null){web.removeJavascriptInterface("GoGoNative");web.destroy();}super.onDestroy();}
}
