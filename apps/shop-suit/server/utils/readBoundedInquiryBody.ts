import type {H3Event} from 'h3'
/** Bound both declared and streamed bytes before parsing untrusted public JSON. */
export async function readBoundedInquiryBody(event:H3Event,limit=12000):Promise<unknown> {
 const declared=event.node.req.headers['content-length']
 if(declared && (!/^\d+$/.test(declared)||Number(declared)>limit))throw Object.assign(new Error('Inquiry too large'),{statusCode:413,statusMessage:'Inquiry too large'})
 const chunks:Buffer[]=[]
 let size=0
 for await(const value of event.node.req.iterator({destroyOnReturn:false})){
  const chunk=Buffer.isBuffer(value)?value:Buffer.from(value)
  size+=chunk.length
  if(size>limit)throw Object.assign(new Error('Inquiry too large'),{statusCode:413,statusMessage:'Inquiry too large'})
  chunks.push(chunk)
 }
 return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
