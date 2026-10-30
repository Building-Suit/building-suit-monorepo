import hashlib,json,pathlib,re,subprocess,sys,tempfile

source=pathlib.Path(sys.argv[1]); label=sys.argv[2]
if not re.fullmatch(r'[a-z0-9-]{1,40}',label):raise SystemExit('Invalid fixed probe label')
root=pathlib.Path(tempfile.mkdtemp(prefix='doctor-native-boundary-'+label+'-',dir=None))
files={
'android/os/Bundle.java':'package android.os; public class Bundle {}',
'android/view/WindowManager.java':'package android.view; public class WindowManager { public static class LayoutParams { public static final int FLAG_SECURE=8192; }}',
'android/view/Window.java':'package android.view; public class Window { public int flags=0; public void addFlags(int value){flags|=value;} }',
'android/webkit/WebSettings.java':'package android.webkit; public class WebSettings { public static final int LOAD_NO_CACHE=2; private int mode=0; public void setCacheMode(int value){mode=value;} public int getCacheMode(){return mode;} }',
'android/webkit/WebView.java':'package android.webkit; public class WebView { private WebSettings settings=new WebSettings(); public boolean cleared=false; public WebSettings getSettings(){return settings;} public void clearCache(boolean all){cleared=all;} }',
'com/getcapacitor/Bridge.java':'package com.getcapacitor; import android.webkit.WebView; public class Bridge { private final WebView view; public Bridge(WebView value){view=value;} public WebView getWebView(){return view;} }',
'com/getcapacitor/BridgeActivity.java':'''package com.getcapacitor;
import android.os.Bundle; import android.view.Window;
public class BridgeActivity {
 public static Bridge startupBridge; private Bridge bridge; private final Window window=new Window();
 protected void onCreate(Bundle state){bridge=startupBridge;}
 protected void onStop(){}
 public void registerPlugin(Class<?> plugin){}
 public Bridge getBridge(){return bridge;}
 public Window getWindow(){return window;}
}''',
'com/buildingsuit/doctor/synthetic/DoctorSessionVaultPlugin.java':'package com.buildingsuit.doctor.synthetic; public class DoctorSessionVaultPlugin {}',
'com/buildingsuit/doctor/synthetic/BoundaryProbe.java':'''package com.buildingsuit.doctor.synthetic;
import com.getcapacitor.*; import android.os.Bundle; import android.webkit.*; import android.view.WindowManager;
import java.net.*; import java.util.*;
public class BoundaryProbe {
 public static void main(String[] args){boolean all=true;
  for(int state=0;state<3;state++){
   WebView view=state==2?new WebView():null;
   BridgeActivity.startupBridge=state==0?null:new Bridge(view);
   ResponseCache.setDefault(new ResponseCache(){public CacheResponse get(URI u,String m,Map<String,List<String>> h){return null;}public CacheRequest put(URI u,URLConnection c){return null;}});
   MainActivity activity=new MainActivity(); boolean created=false,nullDereference=false,stopped=false;
   try{activity.onCreate(new Bundle());created=true;}catch(NullPointerException error){nullDereference=true;}catch(Throwable error){}
   try{activity.onStop();stopped=true;}catch(Throwable error){}
   boolean secure=(activity.getWindow().flags&WindowManager.LayoutParams.FLAG_SECURE)!=0;
   boolean responseDisabled=ResponseCache.getDefault()==null;
   boolean viewDisabled=view==null||view.getSettings().getCacheMode()==WebSettings.LOAD_NO_CACHE;
   boolean cacheCleared=view==null||view.cleared;
   boolean passed=created&&stopped&&secure&&responseDisabled&&viewDisabled&&cacheCleared;all&=passed;
   System.out.println("{\\"case\\":\\""+new String[]{"absent-bridge","absent-webview","available-webview"}[state]+"\\",\\"created\\":"+created+",\\"nullDereference\\":"+nullDereference+",\\"secureWindow\\":"+secure+",\\"responseCacheDisabled\\":"+responseDisabled+",\\"availableWebviewCacheDisabled\\":"+viewDisabled+",\\"stopSafe\\":"+stopped+",\\"availableWebviewCacheCleared\\":"+cacheCleared+",\\"passed\\":"+passed+"}");
  }
  if(!all)System.exit(1);
 }
}''',
}
files['com/buildingsuit/doctor/synthetic/MainActivity.java']=source.read_text()
for name,contents in files.items():
 p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(contents)
compiled=subprocess.run(['java','--module','jdk.compiler/com.sun.tools.javac.Main','-d',str(root/'classes')]+[str(root/name) for name in files],capture_output=True,text=True)
if compiled.returncode:print(json.dumps({'compiler':'failed','exitCode':compiled.returncode}));sys.exit(2)
executed=subprocess.run(['java','-cp',str(root/'classes'),'com.buildingsuit.doctor.synthetic.BoundaryProbe'],capture_output=True,text=True)
cases=[json.loads(line) for line in executed.stdout.splitlines()]
result={'scope':'JVM boundary doubles; no Android SDK/emulator or application acceptance','mainActivitySha256':hashlib.sha256(source.read_bytes()).hexdigest(),'cases':cases,'exitCode':executed.returncode,'taskAcceptance':False,'historicalFailureCauseProven':False}
output=pathlib.Path('.local/doctor-native-startup');output.mkdir(parents=True,exist_ok=True)
(output/(label+'.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));sys.exit(executed.returncode)
