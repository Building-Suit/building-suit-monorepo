import{Capacitor,registerPlugin}from'@capacitor/core'
import{decodeNativeSession,doctorNativeSessionNamespace,type NativeSessionVault}from'./nativeSession'
interface VaultPlugin {read(input:{namespace:string}):Promise<{value:string|null}>;write(input:{namespace:string;value:string}):Promise<void>;clear(input:{namespace:string}):Promise<void>}
const plugin=registerPlugin<VaultPlugin>('DoctorSessionVault')
export function nativeSessionVault():NativeSessionVault{
 const namespace=doctorNativeSessionNamespace
 function available(){if(Capacitor.getPlatform()!=='android'||!Capacitor.isPluginAvailable('DoctorSessionVault'))throw new Error('Session storage unavailable')}
 return{
  async read(){available();const result=await plugin.read({namespace});if(result.value===null)return null;return JSON.stringify(decodeNativeSession(JSON.parse(result.value)))},
  async write(value){available();const checked=decodeNativeSession(JSON.parse(value));await plugin.write({namespace,value:JSON.stringify(checked)})},
  async clear(){available();await plugin.clear({namespace})},
 }
}
