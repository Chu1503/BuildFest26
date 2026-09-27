"""Build a development APK with official SDK tools, without requiring Gradle.
Usage: python scripts/build-apk.py --tools /path/to/android-tools --output /path/app.apk
Tools layout: jdk/*/bin, platforms-android-35/android-35, build-tools-35.0.0/android-15.
"""
import argparse,pathlib,subprocess,zipfile,shutil,datetime,xml.etree.ElementTree as ET
p=argparse.ArgumentParser();p.add_argument('--tools',required=True);p.add_argument('--output',required=True);p.add_argument('--standalone',action='store_true');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];tools=pathlib.Path(a.tools).resolve();out=pathlib.Path(a.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
jdk=next((tools/'jdk').glob('*/bin'));sdk=tools/'build-tools-35.0.0/android-15';platform=tools/'platforms-android-35/android-35/android.jar'
build=root/'traveler-app/build'/('manual-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));build.mkdir(parents=True);classes=build/'classes';classes.mkdir();dex=build/'dex';dex.mkdir()
def run(args):
 result=subprocess.run([str(v) for v in args],cwd=build,text=True,capture_output=True)
 if result.returncode:raise RuntimeError(result.stdout+'\n'+result.stderr)
 if result.stdout.strip():print(result.stdout.strip())
 if result.stderr.strip():print(result.stderr.strip())
def verify_resource_table(path):
 import struct
 with zipfile.ZipFile(path) as z:
  info=z.getinfo('resources.arsc')
  assert info.compress_type==zipfile.ZIP_STORED, 'Android 11+ requires an uncompressed resource table'
  with path.open('rb') as f:
   f.seek(info.header_offset+26);name,extra=struct.unpack('<HH',f.read(4))
  assert (info.header_offset+30+name+extra)%4==0, 'Resource table must be 4-byte aligned'
  assert z.testzip() is None
 print('Resource table: uncompressed and 4-byte aligned; ZIP integrity passed.')
source=root/'traveler-app/app/src/main/java/dev/gogo/traveler/MainActivity.java'
run([jdk/'javac.exe','-encoding','UTF-8','-source','8','-target','8','-classpath',platform,'-d',classes,source])
run([jdk/'java.exe','-cp',sdk/'lib/d8.jar','com.android.tools.r8.D8','--lib',platform,'--min-api','26','--output',dex,*classes.rglob('*.class')])
ET.register_namespace('android','http://schemas.android.com/apk/res/android');manifest=ET.parse(root/'traveler-app/app/src/main/AndroidManifest.xml');manifest.getroot().set('package','dev.gogo.traveler.map2d' if a.standalone else 'dev.gogo.traveler');android='{http://schemas.android.com/apk/res/android}';manifest.find('application/activity').set(android+'name','dev.gogo.traveler.MainActivity');manifest.find('application').set(android+'label','GoGo 2D' if a.standalone else 'GoGo Traveler');manifest.write(build/'AndroidManifest.xml',encoding='utf-8',xml_declaration=True)
assets=build/'assets/web';assets.mkdir(parents=True)
sourceAssets=root/'traveler-app/app/src/main/assets/web'
for f in sourceAssets.rglob('*'):
 if not f.is_file():continue
 relative=f.relative_to(sourceAssets)
 if relative.parts[:2]==('plans','plans'):continue
 dest=assets/relative;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
run([sdk/'aapt2.exe','link','-o',build/'unsigned.apk','-I',platform,'--manifest',build/'AndroidManifest.xml','--min-sdk-version','26','--target-sdk-version','35','--version-code','8','--version-name','0.7-clean-voice','-A',build/'assets'])
with zipfile.ZipFile(build/'unsigned.apk') as original, zipfile.ZipFile(build/'repacked.apk','w',compression=zipfile.ZIP_DEFLATED) as apk:
 for entry in original.infolist():apk.writestr(entry.filename,original.read(entry.filename),compress_type=zipfile.ZIP_STORED if entry.filename=='resources.arsc' else entry.compress_type)
 for f in dex.glob('*.dex'):apk.write(f,f.name)
run([sdk/'zipalign.exe','-p','-f','4',build/'repacked.apk',build/'aligned.apk'])
key=tools/'gogo-development.jks'
if not key.exists():run([jdk/'keytool.exe','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=GoGo Development,O=Hackathon,C=US','-keyalg','RSA','-keysize','2048','-validity','10000'])
run([jdk/'java.exe','-jar',sdk/'lib/apksigner.jar','sign','--ks',key,'--ks-pass','pass:android','--key-pass','pass:android','--out',out,build/'aligned.apk'])
run([jdk/'java.exe','-jar',sdk/'lib/apksigner.jar','verify','--verbose',out])
run([sdk/'zipalign.exe','-c','4',out]);verify_resource_table(out);print('APK ready:',out)
