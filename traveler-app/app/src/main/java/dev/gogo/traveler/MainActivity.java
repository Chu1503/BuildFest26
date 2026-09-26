package dev.gogo.traveler;

import android.app.*;
import android.os.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.speech.tts.TextToSpeech;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.util.*;

/** Offline demonstration. No location, camera, analytics or network permissions. */
public class MainActivity extends Activity {
    final int INK=Color.rgb(18,53,66), MUTED=Color.rgb(77,105,117), MINT=Color.rgb(225,248,239);
    JSONObject nodes; JSONArray edges, destinations;
    ArrayList<String> route=new ArrayList<>(); int step=0;
    Spinner destination,profile,condition; TextView cue,detail,status,steps; Button next; Switch voice;
    TextToSpeech tts; boolean ttsReady=false, ready=false; int restoredStep=0;
    LinearLayout root;
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        try { ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=getAssets().open("building.json")){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}JSONObject data=new JSONObject(out.toString("UTF-8"));nodes=data.getJSONObject("nodes");edges=data.getJSONArray("edges");destinations=data.getJSONArray("destinations"); }
        catch(Exception e){TextView error=new TextView(this);error.setText("GoGo could not load its offline map. Please reinstall this demo.");setContentView(error);return;}
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);root=new LinearLayout(this);root.setOrientation(1);root.setPadding(dp(24),dp(24),dp(24),dp(30));root.setBackgroundColor(Color.rgb(246,250,251));scroll.addView(root);setContentView(scroll);
        scroll.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets i=insets.getInsets(WindowInsets.Type.systemBars());v.setPadding(i.left,i.top,i.right,i.bottom);}else v.setPadding(0,insets.getSystemWindowInsetTop(),0,insets.getSystemWindowInsetBottom());return insets;});
        label(root,"GoGo",34,true,INK); label(root,"TRAVELER · MORGRIDGE HALL",12,true,MUTED);label(root,"Where are you going?",27,true,INK);
        label(root,"Destination",15,true,INK);String[] names=new String[destinations.length()];for(int i=0;i<names.length;i++)names[i]=name(destinations.optString(i));destination=spinner(names);
        label(root,"My access preferences",15,true,INK);profile=spinner(new String[]{"Step-free / wheelchair","Audio and landmarks","Walking / stairs allowed"});
        LinearLayout card=new LinearLayout(this);card.setOrientation(1);card.setPadding(dp(20),dp(20),dp(20),dp(20));card.setBackground(bg(MINT,20));LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,-2);cp.setMargins(0,dp(22),0,dp(14));root.addView(card,cp);
        status=label(card,"SIMULATED START · ORCHARD STREET",12,true,MUTED);cue=label(card,"Ready when you are",26,true,INK);detail=label(card,"",16,false,MUTED);cue.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        button("Start / restart journey",()->{step=0;plan();speak();},true);
        next=button("Next instruction (simulate moving)",()->{if(step+1<route.size()){step++;render();speak();}},false);
        button("Repeat instruction",this::speak,false);
        voice=new Switch(this);voice.setText("Spoken directions");voice.setTextColor(INK);voice.setTextSize(16);voice.setMinHeight(dp(52));root.addView(voice);voice.setChecked(true);voice.setOnCheckedChangeListener((b,on)->{if(!on&&tts!=null)tts.stop();cue.setAccessibilityLiveRegion(on?View.ACCESSIBILITY_LIVE_REGION_NONE:View.ACCESSIBILITY_LIVE_REGION_POLITE);});
        button("Request assistance",()->{if(tts!=null)tts.stop();new AlertDialog.Builder(this).setTitle("Assistance — demonstration").setMessage("No request has been sent. This demo has no staff connection. In a real deployment, this screen must provide a verified staffed contact and confirm delivery.").setPositiveButton("Close",null).show();},false);
        label(root,"Demo building conditions",17,true,INK);condition=spinner(new String[]{"All elevator cars available","Car 1 unavailable","Entire elevator bank unavailable","Location uncertain"});
        label(root,"These switches simulate conditions. They do not report current elevator status.",13,false,MUTED);
        steps=label(root,"",15,false,MUTED);steps.setVisibility(View.GONE);button("Show / hide route steps",()->steps.setVisibility(steps.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE),false);
        label(root,"Prototype only. No real positioning. Use your usual mobility aids and verified surroundings. Maps and circulation are approximate. Selected access preferences stay on this device.",13,false,MUTED);
        tts=new TextToSpeech(this,result->{ttsReady=result==TextToSpeech.SUCCESS;if(ttsReady){int lang=tts.setLanguage(Locale.US);ttsReady=lang!=TextToSpeech.LANG_MISSING_DATA&&lang!=TextToSpeech.LANG_NOT_SUPPORTED;tts.setSpeechRate(.95f);}});
        android.content.SharedPreferences prefs=getPreferences(MODE_PRIVATE);destination.setSelection(saved!=null?saved.getInt("dest",0):prefs.getInt("dest",0));profile.setSelection(saved!=null?saved.getInt("profile",0):prefs.getInt("profile",0));if(saved!=null){condition.setSelection(saved.getInt("condition",0));restoredStep=saved.getInt("step",0);voice.setChecked(saved.getBoolean("voice",true));}
        AdapterView.OnItemSelectedListener change=new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){} public void onItemSelected(AdapterView<?> p,View v,int n,long id){if(ready){restoredStep=0;step=0;plan();getPreferences(MODE_PRIVATE).edit().putInt("dest",destination.getSelectedItemPosition()).putInt("profile",profile.getSelectedItemPosition()).apply();}}};
        destination.setOnItemSelectedListener(change);profile.setOnItemSelectedListener(change);condition.setOnItemSelectedListener(change);
        root.post(()->{ready=true;plan();step=Math.min(restoredStep,Math.max(0,route.size()-1));render();});
    }
    Spinner spinner(String[] options){Spinner s=new Spinner(this);ArrayAdapter<String>a=new ArrayAdapter<>(this,android.R.layout.simple_spinner_item,options);a.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);s.setAdapter(a);s.setMinimumHeight(dp(54));root.addView(s,new LinearLayout.LayoutParams(-1,-2));return s;}
    TextView label(LinearLayout parent,String value,int size,boolean bold,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);t.setPadding(0,dp(7),0,dp(7));parent.addView(t,new LinearLayout.LayoutParams(-1,-2));return t;}
    Button button(String title,Runnable fn,boolean primary){Button b=new Button(this);b.setAllCaps(false);b.setText(title);b.setTextSize(16);b.setTextColor(primary?Color.WHITE:INK);b.setBackground(bg(primary?INK:Color.rgb(231,239,243),12));b.setMinHeight(dp(54));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,dp(5),0,dp(5));root.addView(b,p);b.setOnClickListener(v->fn.run());return b;}
    GradientDrawable bg(int color,int radius){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(radius));return g;}
    int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    String name(String id){return nodes.optJSONObject(id).optString("name");}
    int floor(String id){return nodes.optJSONObject(id).optInt("floor");}
    void plan(){
        if(tts!=null)tts.stop();route.clear();step=0;
        if(condition.getSelectedItemPosition()==3){render();return;}
        String end=destinations.optString(destination.getSelectedItemPosition());HashMap<String,Double>d=new HashMap<>();HashMap<String,String>prev=new HashMap<>();HashSet<String>q=new HashSet<>();Iterator<String>keys=nodes.keys();while(keys.hasNext()){String k=keys.next();d.put(k,Double.POSITIVE_INFINITY);q.add(k);}d.put("entrance",0d);
        while(!q.isEmpty()){String u=null;for(String k:q)if(u==null||d.get(k)<d.get(u))u=k;if(u==null||Double.isInfinite(d.get(u)))break;q.remove(u);if(u.equals(end))break;
            for(int i=0;i<edges.length();i++){JSONObject e=edges.optJSONObject(i);String a=e.optString("a"),b=e.optString("b"),type=e.optString("type");if(!a.equals(u)&&!b.equals(u))continue;if(type.equals("stairs")&&profile.getSelectedItemPosition()!=2)continue;int incident=condition.getSelectedItemPosition();if(type.equals("elevatorA")&&incident>=1)continue;if(type.equals("elevatorB")&&incident==2)continue;String v=a.equals(u)?b:a;if(!q.contains(v))continue;double cost=e.optDouble("d")+(type.startsWith("elevator")?5:type.equals("stairs")?1:0);if(d.get(u)+cost<d.get(v)){d.put(v,d.get(u)+cost);prev.put(v,u);}}
        }
        if(!Double.isInfinite(d.get(end))){String at=end;while(at!=null){route.add(0,at);if(at.equals("entrance"))break;at=prev.get(at);}}
        render();
    }
    String floorName(int f){return f==0?"the garden level":"Floor "+f;}
    void render(){
        if(condition.getSelectedItemPosition()==3){cue.setText("Location uncertain. Pause here.");detail.setText("Reconfirm a known landmark or ask building staff for assistance.");status.setText("DEMO · GUIDANCE PAUSED");}
        else if(route.isEmpty()){cue.setText("No step-free route is available.");detail.setText("The elevator bank is unavailable in this scenario. Ask staff for assistance; stairs remain excluded.");status.setText("DEMO · ROUTE UNAVAILABLE");}
        else {String here=route.get(step);status.setText("SIMULATED · "+floorName(floor(here)).toUpperCase(Locale.US)+" · "+(step+1)+" / "+route.size());
            if(step==route.size()-1){cue.setText("You have arrived at "+name(here)+".");detail.setText("Demo destination reached. Confirm signs and current access with staff.");}
            else {String to=route.get(step+1);String message="Continue toward "+name(to)+".";String hint="Route geometry is approximate. Next instruction simulates movement.";
                if(here.equals("entrance")&&to.equals("ramp")){message="Use the ramp to the left of the three steps.";hint="Orchard Street entrance. Wave-to-open sensor is on the right side of the doors.";}
                else if(floor(here)!=floor(to)){message="Take "+(here.startsWith("s")?"the stairs":"the elevator")+" to "+floorName(floor(to))+".";hint=here.startsWith("s")?"Walking scenario. Confirm the stair landing.":"The elevator area has textured grey walls. This is a simulated floor change.";}
                else if(to.equals("library")){message="The Commons & Library is to your left.";hint="The information desk can help with heavy doors and room access.";}
                cue.setText(message);detail.setText(hint);
            }
        }
        next.setEnabled(!route.isEmpty()&&step+1<route.size());StringBuilder list=new StringBuilder("DEMO ROUTE\n");for(int i=0;i<route.size();i++)list.append(i+1).append(". ").append(name(route.get(i))).append('\n');steps.setText(list.toString());
    }
    void speak(){if(voice.isChecked()){if(ttsReady)tts.speak(cue.getText()+" "+detail.getText(),TextToSpeech.QUEUE_FLUSH,null,"gogo-cue");else Toast.makeText(this,"Speech is unavailable. Read the instruction or enable an English text-to-speech voice in Android settings.",Toast.LENGTH_LONG).show();}}
    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);if(destination==null)return;out.putInt("dest",destination.getSelectedItemPosition());out.putInt("profile",profile.getSelectedItemPosition());out.putInt("condition",condition.getSelectedItemPosition());out.putInt("step",step);out.putBoolean("voice",voice.isChecked());}
    @Override protected void onPause(){super.onPause();if(tts!=null)tts.stop();}
    @Override protected void onDestroy(){if(tts!=null){tts.stop();tts.shutdown();}super.onDestroy();}
}
