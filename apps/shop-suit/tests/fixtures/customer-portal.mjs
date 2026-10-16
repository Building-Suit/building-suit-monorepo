export function portalPayload({scope='customer',bucket='upcoming',page=1,expiresAt=new Date(Date.now()+590000).toISOString(),shop='alpha-tools'}={}){
 const startsAt=new Date(Date.now()+(bucket==='upcoming'?86400000:-86400000)).toISOString(),endsAt=new Date(Date.parse(startsAt)+1800000).toISOString()
 const row={startsAt,endsAt,timeZone:'Africa/Cairo',service:shop==='beta-tools'?'Beta consultation':'Alpha haircut',staff:shop==='beta-tools'?'Beta specialist':'Alpha stylist',status:bucket==='upcoming'?'booked':'completed',location:{name:shop==='beta-tools'?'Beta public office':'Alpha public studio',address:'Public street'}}
 const total=scope==='appointment'?1:bucket==='past'?3:21
 const items=scope==='appointment'?(page===1?[row]:[]):bucket==='past'?[{...row,status:'completed'},{...row,status:'cancelled',location:null},{...row,status:'no_show'}]:Array.from({length:page===1?20:1},(_,i)=>({...row,service:page===1?row.service:row.service+' page two',startsAt:new Date(Date.parse(startsAt)+i*3600000).toISOString(),endsAt:new Date(Date.parse(endsAt)+i*3600000).toISOString()}))
 return{authenticated:true,expiresAt,scope,bucket,page,pageSize:20,total,items}
}
