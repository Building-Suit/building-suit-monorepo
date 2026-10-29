<script setup lang="ts">
import {nativePatientScopeKey} from '../../utils/nativePatients'
import {nativePatientsCopy} from '../../utils/nativePatientsPresentation'
defineOptions({name:'DoctorNativePatientsPage'})
const patients=useDoctorNativePatients(),context=useDoctorNativeContext(),shell=useDoctorMobile(),{auth}=useDoctorNativeAuth(),{locale}=useI18n()
const copy=computed(()=>nativePatientsCopy(locale.value==='ar'))
const scope=computed(()=>auth.identity()&&context.state.phase==='ready'?context.state.current:null)
const scopeKey=computed(()=>nativePatientScopeKey(scope.value?.context??null))
const scopeLabel=computed(()=>scope.value?`${scope.value.doctorName} · ${scope.value.practiceName} · ${scope.value.locationName}`:'')
const query=reactive({page:0,size:25,search:'',status:'active' as 'active'|'archived'|'all'})
const form=ref({name:'',phone:'',email:'',dateOfBirth:''}),editorOpen=ref(false),archiveOpen=ref(false),acknowledged=ref(false)
const rows=computed(()=>(patients.state.directory?.rows??[]).map(row=>({id:row.id,name:row.name,phone:row.phone,email:row.email,dateOfBirth:row.dateOfBirth,status:row.archivedAt?copy.value.archived:copy.value.active,updated:new Intl.DateTimeFormat(locale.value==='ar'?'ar-EG':'en-GB',{dateStyle:'medium'}).format(new Date(row.updatedAt)),canEdit:false,canArchive:false,href:'/patients/'+row.id})))
const statusOptions=computed(()=>['active','archived','all'].map(value=>({value,label:copy.value[value as 'active'|'archived'|'all']})))
async function reload(){await shell.navigate('/patients');await patients.directory({...query})}
watch([scopeKey,()=>query.page,()=>query.size,()=>query.search,()=>query.status],()=>{void reload()},{immediate:true})
function search(key:string|null,value:string){if(key!==scopeKey.value)return;query.page=0;query.search=value}
function page(key:string|null,value:number,size:number){if(key!==scopeKey.value)return;query.page=value;query.size=size}
function status(key:string|null,value:string){if(key!==scopeKey.value||!['active','archived','all'].includes(value))return;query.page=0;query.status=value as typeof query.status}
onBeforeUnmount(patients.clear)
</script>
<template><BsPatientDirectoryPage v-model:form="form" v-model:editor-open="editorOpen" v-model:archive-open="archiveOpen" v-model:acknowledged="acknowledged" :title="copy.title" :description="copy.description" :scope-label="scopeLabel" :notice="copy.notice" :rows="rows" :total="patients.state.directory?.total??0" :page="query.page" :page-size="query.size" :scope-key="scopeKey" :status="query.status" :status-options="statusOptions" :loading="patients.state.phase==='loading'" :error="patients.state.phase==='error'?copy.readError:null" :denied="!scopeKey||patients.state.phase==='denied'?copy.denied:null" :can-create="false" :copy="copy" :editor="{title:copy.edit,dirty:false,pending:false,error:null,submitDisabled:true,latestDate:'',duplicates:[],duplicateTotal:0}" :archive="{title:copy.archive,description:copy.archiveDescription,pending:false,error:null}" @retry="reload" @search="search" @page="page" @status="status"/></template>
