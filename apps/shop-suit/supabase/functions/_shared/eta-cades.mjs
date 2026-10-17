// Narrow DER/CMS verifier for detached RSA/SHA-256 CAdES-BES responses. The server
// pins the approved signing certificate; issuer onboarding/chain policy remains
// external setup. Unsupported algorithms/encodings fail closed.
const hex=bytes=>Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')
const hash=async bytes=>new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))
function node(bytes,offset=0){
 if(offset+2>bytes.length)throw new Error('der')
 const tag=bytes[offset],lengthByte=bytes[offset+1];let start=offset+2,length=lengthByte
 if(lengthByte&0x80){const count=lengthByte&0x7f;if(!count || count>4 || start+count>bytes.length)throw new Error('der');length=0;for(let i=0;i<count;i++)length=length*256+bytes[start++];if(length<128)throw new Error('der')}
 const end=start+length;if(end>bytes.length || end<=offset)throw new Error('der')
 return {tag,bytes:bytes.slice(offset,end),content:bytes.slice(start,end),end}
}
function children(value){let offset=0;const result=[];while(offset<value.content.length){const next=node(value.content,offset);result.push(next);offset=next.end;if(result.length>1000)throw new Error('der')}return result}
function requireTag(value,tag){if(value?.tag!==tag)throw new Error('der');return value}
const oid=value=>hex(requireTag(value,6).content)
const SHA256='608648016503040201',SIGNED_DATA='2a864886f70d010702',DIGESTED_DATA='2a864886f70d010705',RSA='2a864886f70d010101'
export async function verifyInvoiceCades(signature,canonical,certificateFingerprint){
 try {
  const der=Uint8Array.from(atob(signature),char=>char.charCodeAt(0)),root=requireTag(node(der),0x30)
  if(root.end!==der.length)throw new Error('der')
  const outer=children(root);if(outer.length!==2 || oid(outer[0])!==SIGNED_DATA)throw new Error('cms')
  const content=children(requireTag(outer[1],0xa0));if(content.length!==1)throw new Error('cms')
  const data=children(requireTag(content[0],0x30))
  const digestAlgorithms=children(requireTag(data[1],0x31))
  if(digestAlgorithms.length!==1 || oid(children(digestAlgorithms[0])[0])!==SHA256)throw new Error('algorithm')
  const encapsulated=children(requireTag(data[2],0x30))
  if(encapsulated.length!==1 || oid(encapsulated[0])!==DIGESTED_DATA)throw new Error('detached_content')
  const certificates=children(requireTag(data[3],0xa0))
  if(certificates.length>10)throw new Error('certificates')
  let certificate
  for(const candidate of certificates){if(candidate.tag===0x30 && hex(await hash(candidate.bytes))===certificateFingerprint)certificate=candidate}
  if(!certificate)throw new Error('certificate_binding')
  const signers=children(requireTag(data.at(-1),0x31));if(signers.length!==1)throw new Error('signers')
  const signer=children(requireTag(signers[0],0x30))
  if(oid(children(requireTag(signer[2],0x30))[0])!==SHA256 || oid(children(requireTag(signer[4],0x30))[0])!==RSA)throw new Error('algorithm')
  const attributes=requireTag(signer[3],0xa0),byOid=new Map()
  for(const attribute of children(attributes)){
   const pair=children(requireTag(attribute,0x30)),id=oid(pair[0]);if(byOid.has(id))throw new Error('duplicate_attribute')
   const values=children(requireTag(pair[1],0x31));if(values.length!==1)throw new Error('attribute');byOid.set(id,values[0])
  }
  if(oid(byOid.get('2a864886f70d010903'))!==DIGESTED_DATA)throw new Error('content_type')
  const documentDigest=await hash(new TextEncoder().encode(canonical))
  if(hex(requireTag(byOid.get('2a864886f70d010904'),4).content)!==hex(documentDigest))throw new Error('document_digest')
  const signingCertificate=children(requireTag(byOid.get('2a864886f70d010910022f'),0x30))
  const certIds=children(requireTag(signingCertificate[0],0x30));if(certIds.length!==1)throw new Error('certificate_ids')
  const certId=children(requireTag(certIds[0],0x30))
  if(certId[0]?.tag===0x30 && oid(children(certId[0])[0])!==SHA256)throw new Error('certificate_algorithm')
  if(hex(requireTag(certId.find(item=>item.tag===4),4).content)!==certificateFingerprint)throw new Error('signing_certificate')
  const tbs=children(requireTag(children(certificate)[0],0x30)),spki=tbs[tbs[0]?.tag===0xa0?6:5]
  const key=await crypto.subtle.importKey('spki',requireTag(spki,0x30).bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify'])
  const signedAttributes=attributes.bytes.slice();signedAttributes[0]=0x31
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,requireTag(signer[5],4).content,signedAttributes)
 }catch{return false}
}
