export const nativePolicyCases=Object.freeze([
 {id:'secure-window-enabled',method:'secureWindowEnabled'},
 {id:'webview-disk-cache-disabled',method:'webViewDiskCacheDisabled'},
 {id:'native-response-cache-disabled',method:'nativeResponseCacheDisabled'},
 {id:'backup-disabled',method:'backupDisabled'},
 {id:'background-cache-policy-retained',method:'backgroundCachePolicyRetained'},
 {id:'absent-bridge-cache-policy-safe',method:'absentBridgeCachePolicySafe'},
].map(value=>Object.freeze(value)))
