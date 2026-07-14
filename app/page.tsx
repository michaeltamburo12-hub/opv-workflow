'use client'
import { useState, useRef, useCallback, useEffect, Fragment } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const D = {
  bg:'#0A0E1A',
  surface:'#111827',
  surface2:'#1A2236',
  border:'#1E293B',
  borderHover:'#334155',
  text:'#F1F5F9',
  textSec:'#94A3B8',
  textMuted:'#475569',
  blue:'#3B82F6',
  blueHover:'#2563EB',
  gold:'#D97706',
  goldLight:'#FCD34D',
  green:'#10B981',
  red:'#EF4444',
  purple:'#8B5CF6',
}

const COUNTIES = ['Nassau', 'Suffolk']
const PROP_TYPES = ['Warehouse','Manufacturing','Flex','Distribution','Industrial']

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:#0A0E1A;color:#F1F5F9;-webkit-font-smoothing:antialiased}
  input,select,textarea{font-family:'Inter',sans-serif;background:#0A0E1A;color:#F1F5F9}
  input:focus,select:focus,textarea:focus{outline:none;border-color:#3B82F6!important;box-shadow:0 0 0 3px rgba(59,130,246,0.15)}
  input::placeholder,textarea::placeholder{color:#475569}
  select option{background:#111827;color:#F1F5F9}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:#0A0E1A}
  ::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
  ::-webkit-scrollbar-thumb:hover{background:#475569}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .anim-in{animation:fadeIn .25s ease forwards}
  .spin{animation:spin .7s linear infinite}
  @media print{
    body{background:#fff!important;color:#111!important}
    .no-print{display:none!important}
    .print-area{box-shadow:none!important;border-radius:0!important;padding:24px!important;max-width:100%!important;margin:0!important}
  }
`

const fmtDate = (d: string) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
}

const Field = ({label, children, full, note}: {label:string,children:React.ReactNode,full?:boolean,note?:string}) => (
  <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:14,gridColumn:full?'1/-1':''}}>
    <label style={{fontSize:10,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:D.textSec}}>{label}</label>
    {children}
    {note&&<span style={{fontSize:10,color:D.textMuted,marginTop:2}}>{note}</span>}
  </div>
)

const inputStyle = {background:'#0A0E1A',border:`1px solid ${D.border}`,borderRadius:7,color:D.text,fontSize:13,padding:'10px 13px',width:'100%',transition:'all .18s'}
const Input = ({style={}, ...props}: React.InputHTMLAttributes<HTMLInputElement> & {style?: React.CSSProperties}) => (
  <input {...props} style={{...inputStyle,...style}}/>
)
const Sel = ({children, style={}, ...props}: React.SelectHTMLAttributes<HTMLSelectElement> & {style?: React.CSSProperties}) => (
  <select {...props} style={{...inputStyle,appearance:'none' as const,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'calc(100% - 12px) center',paddingRight:32,...style}}>
    {children}
  </select>
)

const ComboSel = ({options, value, onChange, placeholder, style={}}: {options:string[], value:string, onChange:(v:string)=>void, placeholder?:string, style?:React.CSSProperties}) => {
  const [custom, setCustom] = useState(!options.includes(value) && value !== '')
  if (custom) {
    return (
      <div style={{display:'flex',gap:6}}>
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Type value...'} style={{...inputStyle,flex:1,...style} as React.CSSProperties}/>
        <button onClick={()=>{setCustom(false);onChange(options[0]||'')}} style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:7,color:D.textSec,fontSize:11,padding:'8px 10px',cursor:'pointer',flexShrink:0,fontFamily:"'Inter',sans-serif"}}>↩ List</button>
      </div>
    )
  }
  return (
    <div style={{display:'flex',gap:6}}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{...inputStyle,appearance:'none' as const,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'calc(100% - 12px) center',paddingRight:32,flex:1,...style} as React.CSSProperties}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      <button onClick={()=>{setCustom(true);onChange('')}} style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:7,color:D.textSec,fontSize:11,padding:'8px 10px',cursor:'pointer',flexShrink:0,fontFamily:"'Inter',sans-serif"}} title="Type custom value">✏️</button>
    </div>
  )
}

interface BtnProps { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; variant?: 'primary'|'ghost'|'danger'|'success'|'blue'; disabled?: boolean; size?: 'sm'|'md' }
const Btn = ({children,onClick,style={},variant='primary',disabled,size='md'}: BtnProps) => {
  const base: React.CSSProperties = {fontFamily:"'Inter',sans-serif",fontWeight:600,border:'1px solid transparent',borderRadius:7,cursor:disabled?'not-allowed':'pointer',transition:'all .18s',opacity:disabled?.4:1,fontSize:size==='sm'?11:13,padding:size==='sm'?'6px 13px':'10px 20px',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,whiteSpace:'nowrap' as const}
  const vars: Record<string, React.CSSProperties> = {
    primary:{background:D.blue,color:'#FFFFFF',boxShadow:`0 2px 16px rgba(59,130,246,0.25)`},
    ghost:{background:`rgba(255,255,255,0.04)`,color:D.textSec,borderColor:D.border},
    danger:{background:`rgba(239,68,68,0.12)`,color:D.red,borderColor:`rgba(239,68,68,0.25)`},
    success:{background:`rgba(16,185,129,0.12)`,color:D.green,borderColor:`rgba(16,185,129,0.25)`},
    blue:{background:`rgba(59,130,246,0.12)`,color:D.blue,borderColor:`rgba(59,130,246,0.25)`},
  }
  return <button onClick={onClick} disabled={disabled} style={{...base,...vars[variant],...style}}>{children}</button>
}

const Card = ({children,style={},accent}: {children:React.ReactNode,style?: React.CSSProperties,accent?:string}) => (
  <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:12,padding:'22px 24px',boxShadow:'0 1px 4px rgba(0,0,0,0.3)',...(accent?{borderTop:`3px solid ${accent}`}:{}),...style}}>
    {children}
  </div>
)

const SectionTitle = ({children,sub,gradient}: {children:React.ReactNode,sub?:string,gradient?:string}) => (
  <div style={{marginBottom:24}}>
    <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:600,letterSpacing:'-.02em',lineHeight:1.15,marginBottom:sub?6:0,...(gradient?{background:gradient,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}:{color:D.text})}}>{children}</h2>
    {sub&&<p style={{fontSize:13,color:D.textSec,fontWeight:400,lineHeight:1.5,maxWidth:600}}>{sub}</p>}
  </div>
)

const Tag = ({children,color=D.gold}: {children:React.ReactNode,color?:string}) => (
  <span style={{fontSize:10,fontWeight:600,padding:'3px 9px',borderRadius:5,background:`${color}1A`,color,letterSpacing:'.04em',border:`1px solid ${color}33`,display:'inline-flex',alignItems:'center',gap:4,whiteSpace:'nowrap' as const}}>{children}</span>
)

const SL = ({children,style={}}: {children:React.ReactNode,style?:React.CSSProperties}) => (
  <p style={{fontSize:10,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase' as const,color:D.textSec,marginBottom:10,...style}}>{children}</p>
)

// Street View photo component — lazy loads on demand
function StreetViewPhoto({address, style={}}: {address:string, style?:React.CSSProperties}) {
  const [state, setState] = useState<'idle'|'loading'|'ok'|'err'>('idle')
  const [src, setSrc] = useState('')
  const load = async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/street-view?address=${encodeURIComponent(address)}`)
      if (!res.ok) { setState('err'); return }
      const blob = await res.blob()
      setSrc(URL.createObjectURL(blob)); setState('ok')
    } catch { setState('err') }
  }
  if (state==='idle') return (
    <button onClick={load} style={{background:`rgba(59,130,246,0.08)`,border:`1px dashed ${D.blue}44`,borderRadius:8,color:D.blue,fontSize:11,fontWeight:600,padding:'8px 14px',cursor:'pointer',fontFamily:"'Inter',sans-serif",display:'flex',alignItems:'center',gap:6,...style}}>
      📷 Load Street View
    </button>
  )
  if (state==='loading') return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:280,height:185,background:D.surface2,borderRadius:8,border:`1px solid ${D.border}`,...style}}>
      <div className="spin" style={{width:18,height:18,border:`2px solid ${D.border}`,borderTopColor:D.blue,borderRadius:'50%'}}/>
    </div>
  )
  if (state==='err') return (
    <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',width:280,height:185,background:D.surface2,borderRadius:8,border:`1px solid ${D.border}`,gap:4,...style}}>
      <span style={{fontSize:11,color:D.textMuted}}>No photo available</span>
      <span style={{fontSize:10,color:D.textMuted}}>(Enable Street View API)</span>
    </div>
  )
  return <img src={src} alt={address} style={{width:280,height:185,objectFit:'cover' as const,borderRadius:8,border:`1px solid ${D.border}`,flexShrink:0,...style}}/>
}

const Divider = ({label}: {label?:string}) => (
  <div style={{display:'flex',alignItems:'center',gap:12,margin:'20px 0'}}>
    <div style={{flex:1,height:'1px',background:`linear-gradient(90deg,transparent,${D.border})`}}/>
    {label&&<span style={{fontSize:10,color:D.textMuted,letterSpacing:'.1em',textTransform:'uppercase' as const,fontWeight:600,flexShrink:0}}>{label}</span>}
    {label&&<div style={{flex:1,height:'1px',background:`linear-gradient(90deg,${D.border},transparent)`}}/>}
  </div>
)

type VerifyStatus = 'verified'|'needs-review'|'rejected'
type Folder = {id:string, name:string, type:'comps'|'avails'|'lease-comps', color:string, items:(Comp|Avail|LeaseComp)[], opvAddress?:string, createdAt:number}
const FOLDER_COLORS = [D.gold, D.blue, D.green, D.purple, '#0891B2', '#DB2777', '#EA580C', D.red]

type SubjectForm = {address:string,city:string,county:string,municipality:string,parcelId:string,type:string,opvType:string,size:string,lot:string,ceiling:string,docks:string,driveIn:string,power:string,heat:string,parking:string,sprinkler:string,sewer:string,zoning:string,taxes:string,yearBuilt:string,officePct:string,construction:string,condition:string,notes:string,highestBestUse:string,capRateLow:string,capRateHigh:string,leasePsfLow:string,leasePsfHigh:string,estimatedValueLow:string,estimatedValueHigh:string,preparedBy:string}
type Comp = {id:string,address:string,city:string,county:string,building_sf:number,lot_size_ac:number,ceiling_height:string,loading_docks:string,drive_ins:string,power:string,sewer:string,zoning:string,sale_price:number,price_per_sf:number,sale_date:string,sale_type:string,buyer:string,seller:string,submarket:string,score?:number,[key:string]:unknown}
type Avail = {id:string,address:string,city:string,county:string,building_sf:number,lot_size_ac:number,ceiling_height:string,loading_docks:string,drive_ins:string,power:string,sewer:string,zoning:string,asking_price:number,price_per_sf:number,pricing_guidance:string,listing_broker:string,loopnet_url:string,score?:number,[key:string]:unknown}
type LeaseComp = {id:string,address:string,city:string,county:string,building_sf:number,ceiling_height:string,loading_docks:string,drive_ins:string,power:string,sewer:string,zoning:string,lease_price:number,price_per_sf:number,lease_date:string,tenant:string,landlord:string,lease_term:string,annual_escalations:string,landlord_work:string,cap_rate:number,comments:string,taxes_psf:number,office_pct:number,photo_url?:string,loopnet_url?:string}
type AnalyticsData = {mean:number,median:number,std:number,weighted:number,min:number,max:number,low:number,market:number,high:number,suggested:number,aMean:number,count:number}
type OPVReportData = {id:number,subject:SubjectForm,comps:Comp[],avails:Avail[],analytics:AnalyticsData|null,date:string}
type SavedOPV = {id:string, created_at:string, saved_by:string, address:string}


// ── WORKFLOW STEPPER ──────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  {id:'dashboard',icon:'🏠',label:'Dashboard'},
  {id:'assignment',icon:'📋',label:'Assignment'},
  {id:'subject',icon:'🏢',label:'Subject Property'},
  {id:'comp-search',icon:'📊',label:'Sale Comps'},
  {id:'avail-search',icon:'🔍',label:'Market Availabilities'},
  {id:'lease-comps',icon:'📄',label:'Lease Comps'},
  {id:'folders',icon:'📁',label:'OPV Folders'},
  {id:'analytics',icon:'📈',label:'Analytics'},
  {id:'broker-review',icon:'✍️',label:'Broker Analysis'},
  {id:'opv-report',icon:'📦',label:'Generate Package'},
]

function ProgressStepper({current, completedSteps}: {current:string, completedSteps:Record<string,boolean>}) {
  const idx = WORKFLOW_STEPS.findIndex(s=>s.id===current)
  return (
    <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:24,overflowX:'auto',paddingBottom:4,background:D.surface,borderRadius:10,padding:'12px 16px',border:`1px solid ${D.border}`}}>
      {WORKFLOW_STEPS.map((s,i)=>(
        <div key={s.id} style={{display:'flex',alignItems:'center',flexShrink:0}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
            <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,
              background:i===idx?D.blue:completedSteps[s.id]?`rgba(16,185,129,0.2)`:'transparent',
              color:i===idx?'#FFFFFF':completedSteps[s.id]?D.green:D.textMuted,
              border:`2px solid ${i===idx?D.blue:completedSteps[s.id]?D.green:D.border}`,
              boxShadow:i===idx?`0 0 12px rgba(59,130,246,0.4)`:'none'
            }}>
              {completedSteps[s.id]&&i!==idx?'✓':i+1}
            </div>
            <span style={{fontSize:9,color:i===idx?D.blue:completedSteps[s.id]?D.green:D.textMuted,fontWeight:i===idx?700:400,whiteSpace:'nowrap' as const,letterSpacing:'.04em',textTransform:'uppercase' as const,maxWidth:64,textAlign:'center' as const,lineHeight:1.2}}>{s.label}</span>
          </div>
          {i<WORKFLOW_STEPS.length-1&&<div style={{width:20,height:'1.5px',background:completedSteps[s.id]?`rgba(16,185,129,0.4)`:`rgba(255,255,255,0.07)`,margin:'0 4px',marginBottom:18,flexShrink:0}}/>}
        </div>
      ))}
    </div>
  )
}

// ── ASSIGNMENT PAGE ───────────────────────────────────────────────────────────
type AssignmentData = {clientName:string,propertyAddress:string,opvType:string,dueDate:string,preparedBy:string,notes:string}

function Dashboard({user,subject,comps,avails,leaseComps,analytics,savedOPVs,setPage,loadSavedOPVs,restoreOPV,onNewOPV}: {user:{name:string,role:string,init:string},subject:SubjectForm|null,comps:Comp[],avails:Avail[],leaseComps:LeaseComp[],analytics:AnalyticsData|null,savedOPVs:{id:string,address:string,current_step:string,updated_at:string,saved_by:string}[],setPage:(p:string)=>void,loadSavedOPVs:()=>void,restoreOPV:(id:string)=>void,onNewOPV:()=>void}) {
  useEffect(()=>{loadSavedOPVs()},[])
  const hour = new Date().getHours()
  const hasActiveOPV = subject||comps.length>0

  const steps = [
    {id:'assignment',label:'Assignment',icon:'📋',done:false},
    {id:'subject',label:'Subject Property',icon:'🏢',done:!!subject},
    {id:'comp-search',label:'Sale Comps',icon:'📊',done:comps.length>0},
    {id:'avail-search',label:'Market Availabilities',icon:'🔍',done:avails.length>0},
    {id:'lease-comps',label:'Lease Comps',icon:'📄',done:leaseComps.length>0},
    {id:'analytics',label:'Analytics',icon:'📈',done:!!analytics},
  ]

  return (
    <div className="anim-in" style={{maxWidth:900}}>
      <div style={{marginBottom:32}}>
        <h1 style={{fontSize:28,fontWeight:600,color:D.text,marginBottom:6}}>
          {hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'}, {user.name.split(' ')[0]}
        </h1>
        <p style={{fontSize:14,color:D.textSec}}>Premier Commercial Real Estate · Long Island Industrial OPV Platform</p>
      </div>

      {/* Quick actions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:32}}>
        <div onClick={onNewOPV} style={{background:D.blue,borderRadius:10,padding:24,cursor:'pointer',transition:'all .2s',border:`1px solid ${D.blue}`}}
          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background=D.blueHover}
          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background=D.blue}>
          <div style={{fontSize:28,marginBottom:12}}>📋</div>
          <div style={{fontSize:16,fontWeight:700,color:'#fff',marginBottom:4}}>Start New OPV</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.7)'}}>Begin a new Opinion of Value assignment</div>
        </div>
        <div onClick={()=>setPage('database')} style={{background:D.surface2,borderRadius:10,padding:24,cursor:'pointer',transition:'all .2s',border:`1px solid ${D.border}`}}
          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=D.borderHover}
          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=D.border}>
          <div style={{fontSize:28,marginBottom:12}}>🗄️</div>
          <div style={{fontSize:16,fontWeight:700,color:D.text,marginBottom:4}}>Database Manager</div>
          <div style={{fontSize:12,color:D.textSec}}>Add, browse, and manage comp data</div>
        </div>
      </div>

      {/* Active OPV status */}
      {hasActiveOPV&&(
        <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:10,padding:20,marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:D.text}}>Current OPV In Progress</div>
            <div style={{fontSize:11,color:D.green,background:'rgba(16,185,129,0.12)',padding:'3px 10px',borderRadius:20,border:`1px solid rgba(16,185,129,0.3)`}}>Active</div>
          </div>
          {subject&&<div style={{fontSize:13,color:D.textSec,marginBottom:12}}>📍 {subject.address}{subject.city?`, ${subject.city}`:''} · {subject.size?`${parseInt(subject.size).toLocaleString()} SF`:'—'}</div>}
          <div style={{display:'flex',gap:8,flexWrap:'wrap' as const,marginBottom:16}}>
            {[
              {label:`${comps.length} Sale Comps`,done:comps.length>0},
              {label:`${avails.length} Availabilities`,done:avails.length>0},
              {label:`${leaseComps.length} Lease Comps`,done:leaseComps.length>0},
              {label:analytics?'Analytics Complete':'Analytics Pending',done:!!analytics},
            ].map(item=>(
              <span key={item.label} style={{fontSize:11,padding:'3px 10px',borderRadius:20,border:`1px solid ${item.done?`rgba(16,185,129,0.4)`:D.border}`,color:item.done?D.green:D.textMuted,background:item.done?'rgba(16,185,129,0.08)':'transparent'}}>{item.done?'✓ ':''}{item.label}</span>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setPage('subject')} style={{background:D.blue,border:'none',color:'#fff',fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,padding:'9px 18px',borderRadius:6,cursor:'pointer'}}>Continue OPV →</button>
            <button onClick={()=>setPage('opv-report')} style={{background:'transparent',border:`1px solid ${D.border}`,color:D.textSec,fontFamily:"'Inter',sans-serif",fontSize:12,padding:'9px 18px',borderRadius:6,cursor:'pointer'}}>Generate Package</button>
          </div>
        </div>
      )}

      {/* Saved OPVs */}
      <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:10,padding:20}}>
        <div style={{fontSize:13,fontWeight:700,color:D.text,marginBottom:16}}>Recent OPVs</div>
        {savedOPVs.length===0
          ? <div style={{textAlign:'center' as const,padding:'32px 0',color:D.textMuted,fontSize:13}}>No saved OPVs yet. Start a new assignment above.</div>
          : savedOPVs.slice(0,5).map(s=>{
              const stepLabels: Record<string,string> = {assignment:'Assignment',subject:'Subject',['comp-search']:'Sale Comps',['avail-search']:'Availabilities',['broker-review']:'Broker Review',['opv-report']:'Report',analytics:'Analytics'}
              const updatedAt = new Date(s.updated_at||'')
              const diffMs = Date.now()-updatedAt.getTime()
              const timeAgo = diffMs<3600000?`${Math.floor(diffMs/60000)}m ago`:diffMs<86400000?`${Math.floor(diffMs/3600000)}h ago`:`${Math.floor(diffMs/86400000)}d ago`
              return (
                <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:`1px solid ${D.border}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:D.text,marginBottom:2}}>{s.address||'Untitled OPV'}</div>
                    <div style={{fontSize:11,color:D.textMuted}}>{timeAgo} · Stopped at: {stepLabels[s.current_step]||s.current_step}</div>
                  </div>
                  <button onClick={()=>restoreOPV(s.id)} style={{background:D.surface2,border:`1px solid ${D.border}`,color:D.textSec,fontFamily:"'Inter',sans-serif",fontSize:11,padding:'6px 14px',borderRadius:6,cursor:'pointer'}}>Resume</button>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}

function Assignment({assignmentData,setAssignmentData,user,setPage,setSubject,subject}: {assignmentData:AssignmentData,setAssignmentData:(a:AssignmentData)=>void,user:{name:string,role:string,init:string},setPage:(p:string)=>void,setSubject:(s:SubjectForm)=>void,subject:SubjectForm|null}) {
  const [form,setForm]=useState<AssignmentData>({...assignmentData,preparedBy:assignmentData.preparedBy||user.name})
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}))
  const begin=()=>{
    setAssignmentData(form)
    if(!subject&&form.propertyAddress){
      const blankSubject:SubjectForm={address:form.propertyAddress,city:'',county:'Nassau',municipality:'',parcelId:'',type:'Warehouse',opvType:form.opvType==='For Sale'?'sale':form.opvType==='For Lease'?'lease':'investment',size:'',lot:'',ceiling:'',docks:'',driveIn:'',power:'',heat:'Gas FHA',parking:'',sprinkler:'ESFR',sewer:'Municipal',zoning:'',taxes:'',yearBuilt:'',officePct:'',construction:'Masonry/Steel',condition:'Good',notes:'',highestBestUse:'',capRateLow:'',capRateHigh:'',leasePsfLow:'',leasePsfHigh:'',estimatedValueLow:'',estimatedValueHigh:'',preparedBy:form.preparedBy}
      setSubject(blankSubject)
    }
    setPage('subject')
  }
  return (
    <div className="anim-in" style={{maxWidth:680,margin:'0 auto'}}>
      <div style={{textAlign:'center' as const,marginBottom:36}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.2em',textTransform:'uppercase' as const,color:D.textMuted,marginBottom:12}}>STEP 1 OF 9</div>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:40,fontWeight:600,color:D.text,marginBottom:8}}>Assignment</h1>
        <p style={{fontSize:15,color:D.textSec}}>Who is this OPV for?</p>
      </div>
      <Card>
        <Field label="Client Name"><Input placeholder="e.g. John Smith / ABC Corporation" value={form.clientName} onChange={e=>set('clientName',e.target.value)}/></Field>
        <Field label="Property Address" full>
          <Input placeholder="e.g. 45 Orville Drive, Bohemia, NY 11716" value={form.propertyAddress} onChange={e=>set('propertyAddress',e.target.value)} style={{fontSize:15,padding:'13px 16px'}}/>
        </Field>
        <Field label="OPV Type">
          <div style={{display:'flex',gap:8}}>
            {['For Sale','Investment Sale','For Lease'].map(t=>(
              <div key={t} onClick={()=>set('opvType',t)} style={{flex:1,padding:'10px 8px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,textAlign:'center' as const,background:form.opvType===t?`rgba(59,130,246,0.15)`:'transparent',color:form.opvType===t?D.blue:D.textMuted,border:`1.5px solid ${form.opvType===t?D.blue:D.border}`,transition:'all .15s'}}>{t}</div>
            ))}
          </div>
        </Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={e=>set('dueDate',e.target.value)}/></Field>
          <Field label="Prepared By"><Input placeholder="Broker name" value={form.preparedBy} onChange={e=>set('preparedBy',e.target.value)}/></Field>
        </div>
        <Field label="Assignment Notes" full><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any special instructions, client preferences, or context..." style={{...inputStyle as React.CSSProperties,minHeight:80,resize:'vertical' as const,lineHeight:1.6}}/></Field>
        <button onClick={begin} style={{width:'100%',padding:'14px 24px',marginTop:8,background:D.blue,border:'none',borderRadius:10,color:'#FFFFFF',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:"'Inter',sans-serif",boxShadow:`0 4px 24px rgba(59,130,246,0.3)`,transition:'all .2s'}}>
          Begin OPV →
        </button>
      </Card>
    </div>
  )
}

// ── PHOTO COLLECTION ──────────────────────────────────────────────────────────
function PhotoCollection({subject,comps,avails,photoUrls,setPhotoUrls,setPage}: {subject:SubjectForm|null,comps:Comp[],avails:Avail[],photoUrls:Record<string,string>,setPhotoUrls:(p:Record<string,string>)=>void,setPage:(p:string)=>void}) {
  const allProps: {id:string,address:string,label:string,loopnet_url?:string}[] = [
    ...(subject?[{id:'subject',address:subject.address,label:'Subject Property'}]:[]),
    ...comps.map(c=>({id:c.id,address:c.address+(c.city?`, ${c.city}`:''),label:'Sale Comp',loopnet_url:(c as Comp&{loopnet_url?:string}).loopnet_url})),
    ...avails.map(a=>({id:a.id,address:a.address+(a.city?`, ${a.city}`:''),label:'Availability',loopnet_url:a.loopnet_url})),
  ]
  const verified = Object.values(photoUrls).filter(Boolean).length
  return (
    <div className="anim-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <SectionTitle sub="Collect aerial and street-level photos for all properties in your OPV.">Photo Collection</SectionTitle>
          <div style={{display:'flex',gap:8,marginTop:-10}}>
            <Tag color={D.green}>{verified} photos ready</Tag>
            <Tag color={D.textMuted}>{allProps.length - verified} missing</Tag>
          </div>
        </div>
        <Btn onClick={()=>setPage('verification')} style={{background:D.blue,color:'#fff',border:'none'}}>Next: Data Verification →</Btn>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16}}>
        {allProps.map(prop=>{
          const hasPhoto = !!photoUrls[prop.id]
          return (
            <Card key={prop.id} style={{padding:0,overflow:'hidden'}}>
              <div style={{position:'relative',height:160,background:D.surface2}}>
                {hasPhoto
                  ? <img src={photoUrls[prop.id]} alt={prop.address} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={()=>{const u={...photoUrls};delete u[prop.id];setPhotoUrls(u)}}/>
                  : prop.address
                    ? <img src={`/api/street-view?address=${encodeURIComponent(prop.address+', NY')}`} alt={prop.address} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                    : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,opacity:.3}}>📷</div>
                }
                <div style={{position:'absolute',top:8,left:8}}>
                  <Tag color={prop.label==='Subject Property'?D.gold:prop.label==='Sale Comp'?D.green:D.blue}>{prop.label}</Tag>
                </div>
                <div style={{position:'absolute',top:8,right:8}}>
                  {hasPhoto
                    ? <span style={{background:'rgba(16,185,129,0.9)',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:5}}>✓ Ready</span>
                    : <span style={{background:'rgba(217,119,6,0.9)',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:5}}>⚠ Missing</span>
                  }
                </div>
              </div>
              <div style={{padding:'12px 14px'}}>
                <div style={{fontSize:12,fontWeight:600,marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,color:D.text}}>{prop.address||'No address'}</div>
                <input
                  placeholder="Paste photo URL..."
                  style={{...inputStyle,fontSize:11,padding:'7px 10px',marginBottom:6}}
                  value={photoUrls[prop.id]||''}
                  onChange={e=>{const v=e.target.value.trim();setPhotoUrls({...photoUrls,[prop.id]:v})}}
                />
                {prop.loopnet_url&&<a href={prop.loopnet_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:D.blue,display:'inline-block'}}>Search LoopNet ↗</a>}
              </div>
            </Card>
          )
        })}
        {allProps.length===0&&(
          <div style={{gridColumn:'1/-1',textAlign:'center' as const,padding:'64px 20px',color:D.textMuted}}>
            <div style={{fontSize:48,opacity:.3,marginBottom:16}}>📷</div>
            <p>No properties added yet. Complete steps 2–4 first to add your subject property, sale comps, and availabilities.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── DATA VERIFICATION ─────────────────────────────────────────────────────────
function DataVerification({comps,avails,verificationStatus,setVerificationStatus,setPage}: {comps:Comp[],avails:Avail[],verificationStatus:Record<string,VerifyStatus>,setVerificationStatus:(v:Record<string,VerifyStatus>)=>void,setPage:(p:string)=>void}) {
  const setStatus=(id:string,s:VerifyStatus)=>setVerificationStatus({...verificationStatus,[id]:s})
  const allItems=[...comps.map(c=>({...c,_type:'comp'})),...avails.map(a=>({...a,_type:'avail'}))]
  const verified=Object.values(verificationStatus).filter(v=>v==='verified').length
  const needsReview=Object.values(verificationStatus).filter(v=>v==='needs-review').length
  const rejected=Object.values(verificationStatus).filter(v=>v==='rejected').length
  const statusColor=(s:VerifyStatus|undefined)=>s==='verified'?D.green:s==='needs-review'?D.gold:s==='rejected'?D.red:D.textMuted
  const statusLabel=(s:VerifyStatus|undefined)=>s==='verified'?'Verified':s==='needs-review'?'Needs Review':s==='rejected'?'Rejected':'Unreviewed'
  return (
    <div className="anim-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <SectionTitle sub="Review and verify all comparable sales and availabilities in your OPV.">Data Verification</SectionTitle>
        <Btn onClick={()=>setPage('broker-review')} style={{background:D.blue,color:'#fff',border:'none'}}>Next: Broker Review →</Btn>
      </div>
      <div style={{display:'flex',gap:12,marginBottom:16}}>
        <div style={{padding:'10px 16px',borderRadius:8,background:`rgba(16,185,129,0.1)`,border:`1px solid rgba(16,185,129,0.2)`,fontSize:12,fontWeight:700,color:D.green}}>{verified} Verified</div>
        <div style={{padding:'10px 16px',borderRadius:8,background:`rgba(217,119,6,0.1)`,border:`1px solid rgba(217,119,6,0.2)`,fontSize:12,fontWeight:700,color:D.gold}}>{needsReview} Needs Review</div>
        <div style={{padding:'10px 16px',borderRadius:8,background:`rgba(239,68,68,0.1)`,border:`1px solid rgba(239,68,68,0.2)`,fontSize:12,fontWeight:700,color:D.red}}>{rejected} Rejected</div>
        <div style={{padding:'10px 16px',borderRadius:8,background:D.surface2,border:`1px solid ${D.border}`,fontSize:12,fontWeight:700,color:D.textMuted}}>{allItems.length-verified-needsReview-rejected} Unreviewed</div>
      </div>
      {allItems.length===0?(
        <Card style={{textAlign:'center' as const,padding:'64px 20px'}}>
          <p style={{color:D.textMuted,marginBottom:16}}>No comps or availabilities to verify yet.</p>
          <Btn onClick={()=>setPage('comp-search')}>Go to Sale Comp Search</Btn>
        </Card>
      ):(
        <Card style={{padding:0,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse' as const}}>
            <thead>
              <tr style={{background:D.surface2}}>
                {['Type','Address','City','SF','Price/SF','Date / Listing','Status','Actions'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left' as const,fontSize:10,fontWeight:700,color:D.textMuted,letterSpacing:'.08em',textTransform:'uppercase' as const,borderBottom:`1px solid ${D.border}`,whiteSpace:'nowrap' as const}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allItems.map((item,i)=>{
                const c=item as Comp; const a=item as Avail
                const s=verificationStatus[item.id]
                const psf=item._type==='comp'?c.price_per_sf:(c.price_per_sf||(a.asking_price&&a.building_sf?Number(a.asking_price)/Number(a.building_sf):0))
                const dateOrListing=item._type==='comp'?fmtDate(c.sale_date):(a.pricing_guidance||'—')
                return (
                  <tr key={item.id} style={{borderBottom:`1px solid ${D.border}`,background:i%2===0?'transparent':D.surface2}}>
                    <td style={{padding:'10px 14px'}}>
                      <Tag color={item._type==='comp'?D.gold:D.blue}>{item._type==='comp'?'Sale Comp':'Availability'}</Tag>
                    </td>
                    <td style={{padding:'10px 14px',fontSize:12,fontWeight:600,color:D.text,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{item.address||'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:12,color:D.textSec}}>{item.city||'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:12,color:D.textSec,whiteSpace:'nowrap' as const}}>{item.building_sf?Number(item.building_sf).toLocaleString():'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:12,fontWeight:600,color:D.gold,whiteSpace:'nowrap' as const}}>{psf?`$${Number(psf).toFixed(2)}`:'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:11,color:D.textSec,whiteSpace:'nowrap' as const}}>{dateOrListing}</td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{fontSize:11,fontWeight:700,color:statusColor(s),background:`${statusColor(s)}15`,padding:'3px 9px',borderRadius:5,border:`1px solid ${statusColor(s)}30`}}>{statusLabel(s)}</span>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>setStatus(item.id,'verified')} style={{background:`rgba(16,185,129,0.15)`,border:`1px solid rgba(16,185,129,0.3)`,borderRadius:5,color:D.green,fontSize:11,fontWeight:700,padding:'4px 10px',cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>✓</button>
                        <button onClick={()=>setStatus(item.id,'rejected')} style={{background:`rgba(239,68,68,0.15)`,border:`1px solid rgba(239,68,68,0.3)`,borderRadius:5,color:D.red,fontSize:11,fontWeight:700,padding:'4px 10px',cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>✗</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ── FOLDER MANAGER ────────────────────────────────────────────────────────────
function FolderManager({folders, setFolders, setPage, comps, setComps, avails, setAvails}: {folders:Folder[], setFolders:(f:Folder[])=>void, setPage:(p:string)=>void, comps:Comp[], setComps:(c:Comp[])=>void, avails:Avail[], setAvails:(a:Avail[])=>void}) {
  const [activeFolder, setActiveFolder] = useState<string|null>(null)
  const [activeOPV, setActiveOPV] = useState<string|null>(null)
  const [manualName, setManualName] = useState('')
  const [manualType, setManualType] = useState<'comps'|'avails'|'lease-comps'>('comps')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fetchingPhoto, setFetchingPhoto] = useState<string|null>(null)

  const fetchPhoto = async (item: Comp|Avail) => {
    const url = (item as Comp).loopnet_url as string|undefined
    if (!url) { alert('No LoopNet URL for this property.'); return }
    setFetchingPhoto(item.id)
    try {
      const res = await fetch(`/api/fetch-photo?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (data.photo_url) {
        setFolders(folders.map(f => f.id === activeFolder
          ? {...f, items: f.items.map(i => i.id === item.id ? {...i, photo_url: data.photo_url} : i)}
          : f
        ))
      } else { alert('Could not find a photo on LoopNet for this property.') }
    } catch { alert('Photo fetch failed.') }
    setFetchingPhoto(null)
  }

  const opvGroups = Object.entries(
    folders.reduce((acc, f) => {
      const key = f.opvAddress || '__manual__'
      if (!acc[key]) acc[key] = []
      acc[key].push(f)
      return acc
    }, {} as Record<string, Folder[]>)
  ).sort((a,b) => {
    const aTime = Math.max(...a[1].map(f=>f.createdAt))
    const bTime = Math.max(...b[1].map(f=>f.createdAt))
    return bTime - aTime
  })

  const deleteFolder = (id:string) => { if(confirm('Delete this folder?')) setFolders(folders.filter(f=>f.id!==id)) }
  const removeItem = (folderId:string, itemId:string) => {
    setFolders(folders.map(f=>f.id===folderId?{...f,items:f.items.filter(i=>i.id!==itemId)}:f))
  }
  const createManual = () => {
    if (!manualName.trim()) { alert('Enter a folder name'); return }
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length]
    setFolders([...folders, {id:Date.now().toString(), name:manualName.trim(), type:manualType, color, items:[], createdAt:Date.now()}])
    setManualName('')
  }
  const active = folders.find(f=>f.id===activeFolder)

  return (
    <div className="anim-in">
      <SectionTitle sub="Each OPV gets its own sale comp and availability folders, auto-created when you save a subject property.">OPV Folders</SectionTitle>
      <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:20,alignItems:'start'}}>
        <div>
          <Card style={{marginBottom:16}}>
            <SL>Add Manual Folder</SL>
            <Field label="Folder Name"><Input placeholder="Custom folder name" value={manualName} onChange={e=>setManualName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createManual()}/></Field>
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' as const}}>
              {([['comps','📊 Sale Comps',D.gold],['avails','🏭 Avails',D.blue],['lease-comps','📋 Lease Comps',D.green]] as [string,string,string][]).map(([t,label,color])=>(
                <div key={t} onClick={()=>setManualType(t as 'comps'|'avails'|'lease-comps')} style={{flex:1,padding:'8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,textAlign:'center' as const,background:manualType===t?`${color}1A`:'transparent',color:manualType===t?color:D.textMuted,border:`1px solid ${manualType===t?`${color}44`:D.border}`}}>
                  {label}
                </div>
              ))}
            </div>
            <Btn onClick={createManual} style={{width:'100%',padding:9,fontSize:12}}>＋ Add Folder</Btn>
          </Card>
          {folders.length===0&&(
            <Card style={{textAlign:'center' as const,padding:'32px 16px'}}>
              <div style={{fontSize:32,opacity:.2,marginBottom:10}}>📁</div>
              <p style={{fontSize:12,color:D.textMuted,lineHeight:1.6}}>Folders appear here automatically when you save a subject property.</p>
            </Card>
          )}
          {opvGroups.map(([key, grpFolders])=>{
            const label = key==='__manual__' ? 'Manual Folders' : key
            const isOpen = activeOPV===key
            const color = grpFolders[0]?.color || D.gold
            return (
              <div key={key} style={{marginBottom:10}}>
                <div onClick={()=>setActiveOPV(isOpen?null:key)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:9,cursor:'pointer',background:isOpen?`${color}15`:D.surface2,border:`1px solid ${isOpen?color+'44':D.border}`,transition:'all .2s',userSelect:'none' as const}}>
                  <div style={{width:10,height:10,borderRadius:3,background:color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,color:isOpen?D.text:D.textSec}}>{label}</div>
                    <div style={{fontSize:10,color:D.textMuted}}>{grpFolders.length} folder{grpFolders.length!==1?'s':''} · {grpFolders.reduce((s,f)=>s+f.items.length,0)} items</div>
                  </div>
                  <span style={{fontSize:10,color:D.textMuted}}>{isOpen?'▲':'▼'}</span>
                </div>
                {isOpen&&(
                  <div style={{paddingLeft:8,marginTop:4}}>
                    {grpFolders.map(f=>(
                      <div key={f.id} onClick={()=>{setActiveFolder(activeFolder===f.id?null:f.id);setSelected(new Set())}} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:7,cursor:'pointer',marginBottom:4,border:`1px solid ${activeFolder===f.id?f.color+'66':D.border}`,background:activeFolder===f.id?`${f.color}15`:D.surface,transition:'all .15s'}}>
                        <div style={{fontSize:14}}>{f.type==='comps'?'📊':f.type==='lease-comps'?'📋':'🏭'}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,color:D.text}}>{f.name}</div>
                          <div style={{fontSize:10,color:D.textMuted}}>{f.items.length} item{f.items.length!==1?'s':''}</div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();deleteFolder(f.id)}} style={{background:'transparent',border:'none',color:D.textMuted,cursor:'pointer',fontSize:13,padding:'2px 4px',lineHeight:1}} title="Delete">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div>
          {!activeFolder&&(
            <Card style={{textAlign:'center' as const,padding:'64px 20px'}}>
              <div style={{fontSize:48,opacity:.12,marginBottom:16}}>📂</div>
              <p style={{fontSize:15,fontWeight:600,marginBottom:8,color:D.text}}>Select a Folder</p>
              <p style={{fontSize:13,color:D.textSec,maxWidth:380,margin:'0 auto 20px'}}>Click an OPV on the left, then select its folder to view and manage items.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <Btn variant="ghost" onClick={()=>setPage('comp-search')} style={{fontSize:12,padding:'9px 16px'}}>→ Comp Search</Btn>
                <Btn variant="ghost" onClick={()=>setPage('avail-search')} style={{fontSize:12,padding:'9px 16px'}}>→ Avail Search</Btn>
              </div>
            </Card>
          )}
          {active&&(
            <Card>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                    <div style={{width:12,height:12,borderRadius:3,background:active.color}}/>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:D.text}}>{active.name}</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center',paddingLeft:22}}>
                    <Tag color={active.type==='comps'?D.gold:D.blue}>{active.type==='comps'?'📊 Sale Comps':'🏭 Availabilities'}</Tag>
                    {active.opvAddress&&<Tag color={D.textMuted}>{active.opvAddress}</Tag>}
                  </div>
                </div>
                <div style={{textAlign:'right' as const}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:active.color}}>{active.items.length}</div>
                  <div style={{fontSize:10,color:D.textMuted}}>item{active.items.length!==1?'s':''}</div>
                </div>
              </div>
              {active.items.length===0&&(
                <div style={{textAlign:'center' as const,padding:'40px 20px',borderTop:`1px solid ${D.border}`}}>
                  <p style={{color:D.textSec,fontSize:13,marginBottom:14}}>No items yet. Search for properties and click "Add to Folder".</p>
                  <Btn variant="ghost" onClick={()=>setPage(active.type==='comps'?'comp-search':'avail-search')} style={{fontSize:12,padding:'9px 16px'}}>Go to {active.type==='comps'?'Comp Search':'Avail Search'} →</Btn>
                </div>
              )}
              {active.items.length>0&&(
                <>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderTop:`1px solid ${D.border}`,borderBottom:`1px solid ${D.border}`,marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <input type="checkbox" checked={selected.size===active.items.length} onChange={()=>setSelected(selected.size===active.items.length?new Set():new Set(active.items.map(i=>i.id)))} style={{width:15,height:15,cursor:'pointer',accentColor:active.color}}/>
                      <span style={{fontSize:11,color:D.textSec}}>{selected.size===0?'Select all':`${selected.size} of ${active.items.length} selected`}</span>
                    </div>
                    {selected.size>0&&<span onClick={()=>setSelected(new Set())} style={{fontSize:11,color:D.textSec,cursor:'pointer',textDecoration:'underline'}}>Clear</span>}
                  </div>
                  {active.items.map((item,i)=>{
                    const c = item as Comp; const a = item as Avail
                    const isChecked = selected.has(item.id)
                    const alreadyInOPV = active.type==='comps' ? comps.some(x=>x.id===item.id) : avails.some(x=>x.id===item.id)
                    return (
                      <div key={item.id} onClick={()=>{const s=new Set(selected);isChecked?s.delete(item.id):s.add(item.id);setSelected(s)}} style={{padding:'11px 8px',borderBottom:i<active.items.length-1?`1px solid ${D.border}`:'none',display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer',borderRadius:7,background:isChecked?`${active.color}0D`:'transparent',transition:'background .12s'}}>
                        <input type="checkbox" checked={isChecked} onChange={()=>{}} onClick={e=>e.stopPropagation()} style={{width:15,height:15,marginTop:2,cursor:'pointer',accentColor:active.color,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                            <div style={{fontSize:13,fontWeight:600,color:D.text}}>{item.address}{(item as Comp).city?`, ${(item as Comp).city}`:''}</div>
                            {alreadyInOPV&&<Tag color={D.green}>✓ In OPV</Tag>}
                          </div>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:6}}>
                            {item.building_sf&&<Tag color={D.blue}>{Number(item.building_sf).toLocaleString()} SF</Tag>}
                            {active.type==='comps'&&(c.price_per_sf||(c.sale_price&&c.building_sf))&&<Tag color={D.gold}>${(c.price_per_sf||Number(c.sale_price)/Number(c.building_sf)).toFixed(2)}/SF</Tag>}
                            {active.type==='comps'&&c.sale_date&&<Tag color={D.textMuted}>{fmtDate(c.sale_date)}</Tag>}
                            {active.type==='avails'&&a.asking_price&&<Tag color={D.purple}>${Number(a.asking_price).toLocaleString()}</Tag>}
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:8}} onClick={e=>e.stopPropagation()}>
                            {(item as Comp & {photo_url?:string}).photo_url
                              ? <img src={(item as Comp & {photo_url?:string}).photo_url} alt={item.address} style={{width:190,height:115,objectFit:'cover',borderRadius:5,border:`1px solid ${D.border}`,flexShrink:0}}/>
                              : item.address
                                ? <img src={`/api/street-view?address=${encodeURIComponent(item.address + ((item as Comp).city ? ', ' + (item as Comp).city + ', NY' : ', NY'))}`} alt={item.address} style={{width:190,height:115,objectFit:'cover',borderRadius:5,border:`1px solid ${D.border}`,flexShrink:0}} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                                : <div style={{width:190,height:115,background:D.surface2,borderRadius:5,border:`1px dashed ${D.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:D.textMuted,flexShrink:0}}>No Photo</div>
                            }
                            <div style={{display:'flex',flexDirection:'column',gap:4}}>
                              {(item as Comp).loopnet_url&&<Btn variant="ghost" size="sm" disabled={fetchingPhoto===item.id} onClick={()=>fetchPhoto(item)} style={{fontSize:10,padding:'4px 10px'}}>{fetchingPhoto===item.id?'Fetching...':'📸 Fetch from LoopNet'}</Btn>}
                              <input placeholder="Or paste photo URL..." style={{background:D.surface2,border:`1px solid ${D.border}`,borderRadius:5,color:D.text,fontSize:10,padding:'4px 8px',width:180,fontFamily:"'Inter',sans-serif"}} onClick={e=>e.stopPropagation()} onChange={e=>{
                                const val=e.target.value.trim()
                                if(val) setFolders(folders.map(f=>f.id===activeFolder?{...f,items:f.items.map(i=>i.id===item.id?{...i,photo_url:val}:i)}:f))
                              }}/>
                            </div>
                          </div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();removeItem(active.id,item.id);setSelected(s=>{const n=new Set(s);n.delete(item.id);return n})}} style={{background:'transparent',border:'none',color:D.textMuted,cursor:'pointer',fontSize:16,padding:'2px 6px',flexShrink:0}} title="Remove">×</button>
                      </div>
                    )
                  })}
                  <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${D.border}`,display:'flex',gap:10,alignItems:'center'}}>
                    <Btn disabled={selected.size===0} onClick={()=>{
                      const items = active.items.filter(i=>selected.has(i.id))
                      if(active.type==='comps'){
                        const existing = comps.map(c=>c.id)
                        setComps([...comps,...items.filter(i=>!existing.includes(i.id)) as Comp[]])
                      } else {
                        const existing = avails.map(a=>a.id)
                        setAvails([...avails,...items.filter(i=>!existing.includes(i.id)) as Avail[]])
                      }
                      alert(`${items.length} propert${items.length===1?'y':'ies'} added to your OPV.`)
                    }} style={{flex:1,padding:'11px 16px',fontSize:13}}>
                      {selected.size===0?'Select properties to add':'➕ Add ' + selected.size + ' to OPV Report'}
                    </Btn>
                    {(active.type==='comps'?comps.length:avails.length)>0&&(
                      <Btn variant="ghost" onClick={()=>setPage(active.type==='comps'?'comp-search':'avail-search')} style={{fontSize:12,padding:'10px 14px',flexShrink:0}}>
                        View OPV ({active.type==='comps'?comps.length:avails.length}) →
                      </Btn>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


// ── FILE IMPORT ───────────────────────────────────────────────────────────────
type ParsedFile = {headers:string[], columnTypes:{name:string,type:string}[], totalRows:number, preview:Record<string,string>[], allRows:Record<string,string>[], existingTables:string[], fileName:string}

function FileImport() {
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedFile|null>(null)
  const [targetTable, setTargetTable] = useState('')
  const [newTableName, setNewTableName] = useState('')
  const [isNewTable, setIsNewTable] = useState(false)
  const [createSQL, setCreateSQL] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [importError, setImportError] = useState('')
  const [result, setResult] = useState<{inserted:number,failed:number,total:number,firstError?:string}|null>(null)
  const [availableTables, setAvailableTables] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch table list on mount and after successful imports
  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/tables')
      const data = await res.json()
      if (data.tables) {
        setAvailableTables(data.tables)
        setTargetTable(t => t || data.tables[0] || '')
      }
    } catch {}
  }, [])

  useEffect(() => { fetchTables() }, [fetchTables])

  const processFile = async (file: File) => {
    setParsing(true); setParsed(null); setResult(null); setCreateSQL(''); setNewTableName(''); setIsNewTable(false)
    const form = new FormData(); form.append('file', file)
    try {
      const res = await fetch('/api/import', {method:'POST', body:form})
      const data = await res.json()
      if (data.error) { alert('Parse error: ' + data.error); setParsing(false); return }
      setParsed(data)
      // Merge any newly discovered tables
      if (data.existingTables?.length) {
        setAvailableTables(prev => {
          const merged = Array.from(new Set([...prev, ...data.existingTables])).sort()
          return merged
        })
      }
    } catch(e) { alert('Upload failed: ' + (e as Error).message) }
    setParsing(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }
  const genSQL = (name: string) => {
    if (!parsed || !name.trim()) return ''
    const colDefs = parsed.columnTypes.map(c => {
      const pg = c.type==='number'?'numeric':c.type==='date'?'date':'text'
      return `  ${c.name.padEnd(32)} ${pg}`
    }).join(',\n')
    return `CREATE TABLE public.${name} (\n  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n${colDefs},\n  created_at timestamptz DEFAULT now()\n);\n\nALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow all" ON public.${name} FOR ALL USING (true) WITH CHECK (true);`
  }
  const sanitizeTableName = (v: string) => v.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')
  const handleNewTableName = (v: string) => { setNewTableName(v); const clean = sanitizeTableName(v); setCreateSQL(clean ? genSQL(clean) : '') }
  const runImport = async () => {
    if (!parsed) return
    const table = isNewTable ? sanitizeTableName(newTableName) : targetTable
    if (!table) { alert('Select or name a table first'); return }
    setImporting(true); setResult(null); setImportError(''); setImportProgress('')
    try {
      const numFields = parsed.columnTypes.filter(c=>c.type==='number').map(c=>c.name)
      const rowsToInsert = parsed.allRows.map(row => {
        const mapped: Record<string,unknown> = {}
        Object.entries(row).forEach(([k,v]) => { if (numFields.includes(k)) mapped[k] = v ? parseFloat(v.replace(/[$,]/g,''))||null : null; else mapped[k] = v || null })
        return mapped
      })
      const CHUNK = 200; let totalInserted = 0, totalFailed = 0, lastError = ''
      const chunks = Math.ceil(rowsToInsert.length / CHUNK)
      for (let i = 0; i < chunks; i++) {
        const chunk = rowsToInsert.slice(i * CHUNK, (i + 1) * CHUNK)
        setImportProgress(`Importing batch ${i+1} of ${chunks}...`)
        const body: Record<string,unknown> = {tableName: table, rows: chunk}
        if (i === 0 && isNewTable && createSQL) body.createSQL = createSQL
        const res = await fetch('/api/import?action=insert', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)})
        if (!res.ok) { const text = await res.text(); throw new Error(`Server error: ${res.status} — ${text.slice(0,200)}`) }
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        totalInserted += data.inserted || 0; totalFailed += data.failed || 0
        if (data.firstError && !lastError) lastError = data.firstError
      }
      setResult({inserted: totalInserted, failed: totalFailed, total: rowsToInsert.length, firstError: lastError})
      fetchTables() // Refresh table list in case a new table was created
    } catch(e) { setImportError((e as Error).message) }
    setImporting(false); setImportProgress('')
  }
  const ACCEPTED = '.csv,.tsv,.xlsx,.xls,.numbers,.txt,.pdf'
  return (
    <div>
      {!parsed&&(
        <>
          {/* Table selector shown before file upload */}
          <Card style={{marginBottom:16}}>
            <div style={{display:'flex',gap:16,alignItems:'flex-end',flexWrap:'wrap' as const}}>
              <div style={{flex:1,minWidth:200}}>
                <Field label="Import into table">
                  <Sel value={availableTables.includes(targetTable)?targetTable:''} onChange={e=>setTargetTable(e.target.value)}>
                    {!availableTables.length&&<option value="">Loading tables...</option>}
                    {availableTables.map(t=><option key={t} value={t}>{t}</option>)}
                  </Sel>
                </Field>
              </div>
              <div style={{fontSize:11,color:D.textMuted,paddingBottom:14}}>
                {availableTables.length} table{availableTables.length!==1?'s':''} found
              </div>
            </div>
          </Card>
          <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()}
            style={{border:`2px dashed ${dragging?D.blue:D.border}`,borderRadius:14,padding:'56px 32px',textAlign:'center' as const,cursor:'pointer',background:dragging?`rgba(59,130,246,0.08)`:D.surface2,transition:'all .2s',marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:16,opacity:.5}}>📂</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:D.text}}>Drop your file here</div>
            <div style={{fontSize:12,color:D.textSec,marginBottom:16}}>Supports PDF, CSV, Excel (.xlsx), TSV, and Apple Numbers (.numbers) files</div>
            <Btn variant="blue" style={{padding:'10px 24px'}}>Browse Files</Btn>
            <input ref={fileRef} type="file" accept={ACCEPTED} style={{display:'none'}} onChange={e=>{ const f=e.target.files?.[0]; if(f) processFile(f) }}/>
          </div>
        </>
      )}
      {parsing&&<Card style={{textAlign:'center' as const,padding:48}}>
        <div style={{width:36,height:36,border:`2px solid ${D.border}`,borderTopColor:D.blue,borderRadius:'50%',margin:'0 auto 16px',animation:'spin 1s linear infinite'}}/>
        <p style={{color:D.textSec}}>Reading file...</p>
      </Card>}
      {parsed&&!result&&(
        <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:20,alignItems:'start'}}>
          <div>
            <Card style={{marginBottom:14,border:`1px solid rgba(59,130,246,0.3)`}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:D.blue,marginBottom:6}}>📄 {parsed.fileName}</div>
              <div style={{fontSize:12,color:D.textSec,marginBottom:16}}><strong style={{color:D.text}}>{parsed.totalRows.toLocaleString()}</strong> rows · <strong style={{color:D.text}}>{parsed.headers.length}</strong> columns detected</div>
              <Divider label="Target Table"/>
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <div onClick={()=>{setIsNewTable(false)}} style={{flex:1,padding:'8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,textAlign:'center' as const,background:!isNewTable?`rgba(59,130,246,0.12)`:'transparent',color:!isNewTable?D.blue:D.textMuted,border:`1px solid ${!isNewTable?`${D.blue}55`:D.border}`}}>Existing Table</div>
                <div onClick={()=>{setIsNewTable(true)}} style={{flex:1,padding:'8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,textAlign:'center' as const,background:isNewTable?`rgba(16,185,129,0.12)`:'transparent',color:isNewTable?D.green:D.textMuted,border:`1px solid ${isNewTable?`${D.green}55`:D.border}`}}>New Table</div>
              </div>
              {!isNewTable&&(
                <Field label="Select table">
                  <Sel value={availableTables.includes(targetTable)?targetTable:''} onChange={e=>setTargetTable(e.target.value)}>
                    {!availableTables.length&&<option value="">Loading tables...</option>}
                    {availableTables.map(t=><option key={t} value={t}>{t}</option>)}
                  </Sel>
                </Field>
              )}
              {isNewTable&&(
                <div>
                  <Field label="New Table Name"><Input placeholder="e.g. market_availabilities" value={newTableName} onChange={e=>handleNewTableName(e.target.value)}/></Field>
                  {newTableName.trim()&&(
                    <div style={{padding:'10px 12px',borderRadius:8,background:`rgba(16,185,129,0.1)`,border:`1px solid rgba(16,185,129,0.2)`,fontSize:11,color:D.green,marginTop:4,lineHeight:1.6}}>
                      ✓ Table will be created automatically on import<br/>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,opacity:.8}}>→ {sanitizeTableName(newTableName)}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>
            <Btn onClick={runImport} disabled={importing || (isNewTable && !newTableName.trim())} style={{width:'100%',padding:13,fontSize:13}}>
              {importing ? (importProgress||'Starting import...') : '📥 Import to Supabase'}
            </Btn>
            {importError&&<div style={{marginTop:10,padding:'10px 14px',borderRadius:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',fontSize:11,color:D.red,lineHeight:1.6}}><strong>Import failed:</strong> {importError}</div>}
            <Btn variant="ghost" onClick={()=>{setParsed(null);setResult(null);if(fileRef.current)fileRef.current.value=''}} style={{width:'100%',padding:10,marginTop:8,fontSize:12}}>Upload Different File</Btn>
          </div>
          <Card>
            <SL>Column Preview ({parsed.headers.length} columns)</SL>
            <div style={{display:'flex',flexWrap:'wrap' as const,gap:6,marginBottom:16}}>
              {parsed.columnTypes.map(c=>(
                <div key={c.name} style={{padding:'4px 10px',borderRadius:5,background:c.type==='number'?`rgba(217,119,6,0.1)`:c.type==='date'?`rgba(8,145,178,0.1)`:D.surface2,border:`1px solid ${c.type==='number'?`${D.gold}33`:c.type==='date'?'rgba(8,145,178,0.3)':D.border}`,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
                  <span style={{color:c.type==='number'?D.gold:c.type==='date'?'#0891B2':D.textSec}}>{c.name}</span>
                  <span style={{color:D.textMuted,marginLeft:5}}>{c.type==='number'?'#':c.type==='date'?'📅':'T'}</span>
                </div>
              ))}
            </div>
            <SL>Data Preview — First 8 Rows</SL>
            <div style={{overflowX:'auto',fontSize:11}}>
              <table style={{width:'100%',borderCollapse:'collapse' as const,minWidth:600}}>
                <thead><tr style={{background:D.surface2}}>
                  {parsed.headers.slice(0,8).map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left' as const,fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:D.textSec,whiteSpace:'nowrap' as const,borderBottom:`1px solid ${D.border}`}}>{h}</th>)}
                  {parsed.headers.length>8&&<th style={{padding:'7px 10px',color:D.textMuted,fontSize:9,borderBottom:`1px solid ${D.border}`}}>+{parsed.headers.length-8} more</th>}
                </tr></thead>
                <tbody>{parsed.preview.map((row,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                    {parsed!.headers.slice(0,8).map(h=><td key={h} style={{padding:'6px 10px',color:D.text,fontSize:11,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{row[h]||'—'}</td>)}
                    {parsed!.headers.length>8&&<td style={{padding:'6px 10px',color:D.textMuted}}>…</td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {result&&(
        <Card style={{textAlign:'center' as const,padding:'48px 32px'}}>
          <div style={{fontSize:40,marginBottom:16}}>{result.failed===0?'✅':'⚠️'}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,marginBottom:12,color:D.text}}>Import Complete</div>
          <div style={{display:'flex',gap:24,justifyContent:'center',marginBottom:20}}>
            <div style={{textAlign:'center' as const}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:28,fontWeight:700,color:D.green}}>{result.inserted.toLocaleString()}</div>
              <div style={{fontSize:11,color:D.textSec}}>Rows imported</div>
            </div>
            {result.failed>0&&<div style={{textAlign:'center' as const}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:28,fontWeight:700,color:D.red}}>{result.failed.toLocaleString()}</div>
              <div style={{fontSize:11,color:D.textSec}}>Failed</div>
            </div>}
          </div>
          {result?.firstError&&<div style={{margin:'0 auto 16px',maxWidth:480,padding:'10px 14px',borderRadius:8,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',fontSize:11,color:D.red,lineHeight:1.6,textAlign:'left' as const}}><strong>Insert error:</strong> {result.firstError}</div>}
          <p style={{fontSize:12,color:D.textSec,marginBottom:20}}>{result?.failed===0?'Data is now live in your Supabase database.':'Check the error above — fix it and try again.'}</p>
          <Btn onClick={()=>{setParsed(null);setResult(null);if(fileRef.current)fileRef.current.value=''}} style={{padding:'10px 24px'}}>Import Another File</Btn>
        </Card>
      )}
    </div>
  )
}


// ── DATABASE MANAGER ──────────────────────────────────────────────────────────
function DatabaseManager() {
  const [tab, setTab] = useState<'comps'|'avails'|'pcre-sales'|'pcre-leases'>('comps')
  const [subTab, setSubTab] = useState<'add'|'import'|'file'|'browse'>('add')
  const [saving, setSaving] = useState(false)
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<Record<string,string>[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ok:number,fail:number,skipped:number,skippedAddresses:string[]}|null>(null)
  type BrowseRow = {id:string,address?:string,city?:string,county?:string,building_sf?:number,price_per_sf?:number,sale_date?:string,asking_price?:number,status?:string,[key:string]:unknown}
  const [browseData, setBrowseData] = useState<BrowseRow[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseCount, setBrowseCount] = useState(0)
  const [browseOffset, setBrowseOffset] = useState(0)
  const PAGE_SIZE = 20

  const blankComp = {address:'',city:'',county:'Nassau',state:'NY',property_type:'Warehouse',building_sf:'',lot_size_ac:'',ceiling_height:'',loading_docks:'',drive_ins:'',power:'',heat:'',parking:'',sprinkler:'',sewer:'Municipal',zoning:'',real_estate_taxes:'',sale_price:'',price_per_sf:'',sale_date:'',sale_type:"Arm's Length",buyer:'',seller:'',listing_broker:'',market:'',submarket:'',zip_code:'',notes:''}
  const blankAvail = {address:'',city:'',county:'Nassau',state:'NY',property_type:'Warehouse',building_sf:'',lot_size_ac:'',ceiling_height:'',loading_docks:'',drive_ins:'',power:'',heat:'',parking:'',sprinkler:'',sewer:'Municipal',zoning:'',real_estate_taxes:'',asking_price:'',price_per_sf:'',pricing_guidance:'',availability_type:'For Sale',status:'Available',listing_broker:'',market:'',submarket:'',zip_code:'',loopnet_url:'',notes:''}
  const [compForm, setCompForm] = useState({...blankComp})
  const [availForm, setAvailForm] = useState({...blankAvail})
  const setC = (k:string,v:string) => setCompForm(f=>({...f,[k]:v}))
  const setA = (k:string,v:string) => setAvailForm(f=>({...f,[k]:v}))

  const blankPcreSale = {address:'',city:'',county:'Nassau',property_type:'Industrial',building_sf:'',sale_price_text:'',sale_date:'',buyer:'',seller:'',notes:''}
  const blankPcreLease = {address:'',city:'',county:'Nassau',tenant:'',landlord:'',building_sf:'',lease_price:'',lease_date:'',lease_term:'',notes:''}
  const [pcreSaleForm, setPcreSaleForm] = useState({...blankPcreSale})
  const [pcreLeaseForm, setPcreLeaseForm] = useState({...blankPcreLease})
  const setPS = (k:string,v:string) => setPcreSaleForm(f=>({...f,[k]:v}))
  const setPL = (k:string,v:string) => setPcreLeaseForm(f=>({...f,[k]:v}))
  const pcreSetupAttempted = useRef(false)
  const [pcreSetupSQL, setPcreSetupSQL] = useState<{sales?:string,leases?:string}|null>(null)
  const setupPcreTables = useCallback(async () => {
    if (pcreSetupAttempted.current) return
    pcreSetupAttempted.current = true
    try {
      const res = await fetch('/api/setup-pcre-tables', {method:'POST'})
      const data = await res.json()
      if (data.sales_sql || data.leases_sql) {
        setPcreSetupSQL({sales: data.sales_sql, leases: data.leases_sql})
      }
    } catch {}
  }, [])

  const tableForTab = (t: typeof tab) => t==='comps'?'industrial_sale_comps':t==='avails'?'market_availabilities':t==='pcre-sales'?'pcre_sale_transactions':'pcre_lease_transactions'

  const saveComp = async () => {
    if (!compForm.address) { alert('Address is required'); return }
    setSaving(true)
    const payload: Record<string,unknown> = {...compForm}
    const nums = ['building_sf','lot_size_ac','real_estate_taxes','sale_price','price_per_sf']
    nums.forEach(k=>{ if(payload[k]) payload[k]=parseFloat(payload[k] as string)||null; else payload[k]=null })
    if (!payload.sale_date) payload.sale_date = null
    const {error} = await supabase.from('industrial_sale_comps').insert([payload])
    setSaving(false)
    if (error) { alert('Error: '+error.message); return }
    alert('✅ Sale comp saved to Supabase!')
    setCompForm({...blankComp})
  }

  const saveAvail = async () => {
    if (!availForm.address) { alert('Address is required'); return }
    setSaving(true)
    const payload: Record<string,unknown> = {...availForm}
    const nums = ['building_sf','lot_size_ac','real_estate_taxes','asking_price','price_per_sf']
    nums.forEach(k=>{ if(payload[k]) payload[k]=parseFloat(payload[k] as string)||null; else payload[k]=null })
    const {error} = await supabase.from('market_availabilities').insert([payload])
    setSaving(false)
    if (error) { alert('Error: '+error.message); return }
    alert('✅ Availability saved to Supabase!')
    setAvailForm({...blankAvail})
  }

  const savePcreSale = async () => {
    if (!pcreSaleForm.address) { alert('Address is required'); return }
    setSaving(true)
    const payload: Record<string,unknown> = {...pcreSaleForm}
    payload.building_sf = pcreSaleForm.building_sf ? parseFloat(pcreSaleForm.building_sf)||null : null
    if (!pcreSaleForm.sale_date) payload.sale_date = null
    const {error} = await supabase.from('pcre_sale_transactions').insert([payload])
    setSaving(false)
    if (error) { alert('Error: '+error.message); return }
    alert('✅ PCRE sale transaction saved!')
    setPcreSaleForm({...blankPcreSale})
  }

  const savePcreLease = async () => {
    if (!pcreLeaseForm.address) { alert('Address is required'); return }
    setSaving(true)
    const payload: Record<string,unknown> = {...pcreLeaseForm}
    payload.building_sf = pcreLeaseForm.building_sf ? parseFloat(pcreLeaseForm.building_sf)||null : null
    if (!pcreLeaseForm.lease_date) payload.lease_date = null
    const {error} = await supabase.from('pcre_lease_transactions').insert([payload])
    setSaving(false)
    if (error) { alert('Error: '+error.message); return }
    alert('✅ PCRE lease transaction saved!')
    setPcreLeaseForm({...blankPcreLease})
  }

  const COLUMN_ALIASES: Record<string,string> = {
    'street_address':'address','property_address':'address','full_address':'address','property_name':'address','building_address':'address',
    'rentable_building_area_(sf)':'building_sf','rentable_building_area':'building_sf','building_size':'building_sf','bldg_sf':'building_sf','total_sf':'building_sf','gla_(sf)':'building_sf','building_size_(sf)':'building_sf',
    'clear_ceiling_height':'ceiling_height','clear_height':'ceiling_height','ceiling_ht':'ceiling_height','ceil_ht':'ceiling_height','clr_ht':'ceiling_height',
    'number_of_loading_docks':'loading_docks','dock_doors':'loading_docks','docks':'loading_docks',
    'drive_in_doors':'drive_ins','grade_level_doors':'drive_ins','drive-in_doors':'drive_ins',
    'electric_service':'power','electrical_service':'power','electrical':'power',
    'sewer_connection':'sewer','for_sale_price':'asking_price','sale_price':'asking_price','list_price':'asking_price',
    'price/sf':'price_per_sf','price_/_sf':'price_per_sf','asking_price/sf':'price_per_sf',
    'sprinkler_system':'sprinkler','fire_sprinklers':'sprinkler',
    'real_estate_taxes':'real_estate_taxes','re_taxes':'real_estate_taxes','annual_taxes':'real_estate_taxes',
    'lot_size_(ac)':'lot_size_ac','land_area':'lot_size_ac','land_area_(ac)':'lot_size_ac','lot_acres':'lot_size_ac',
    'cap_rate':'actual_cap_rate','capitalization_rate':'actual_cap_rate',
    'transaction_date':'sale_date','close_of_escrow':'sale_date',
    'grantor':'seller','grantee':'buyer','vendor':'seller','purchaser':'buyer',
    'listing_agent':'listing_broker','broker':'listing_broker',
    'sub_market':'submarket','sub-market':'submarket',
    'zip':'zip_code','postal_code':'zip_code',
  }
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(l=>l.trim())
    if (lines.length < 2) return []
    const sep = lines[0].includes('\t') ? '\t' : ','
    const rawHeaders = lines[0].split(sep).map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase().replace(/\s+/g,'_'))
    const headers = rawHeaders.map(h => COLUMN_ALIASES[h] || h)
    return lines.slice(1).map(line=>{
      const vals = line.split(sep).map(v=>v.trim().replace(/^"|"$/g,''))
      const row: Record<string,string> = {}
      headers.forEach((h,i)=>{ if(vals[i]) row[h]=vals[i] })
      return row
    })
  }
  const handleImportPreview = () => {
    const rows = parseCSV(importText)
    if (!rows.length) { alert('No data found.'); return }
    setImportPreview(rows.slice(0,5))
  }
  const numFields = tab==='comps' ? ['building_sf','lot_size_ac','real_estate_taxes','sale_price','price_per_sf'] : tab==='avails' ? ['building_sf','lot_size_ac','real_estate_taxes','asking_price','price_per_sf'] : ['building_sf']
  const runImport = async () => {
    const rows = parseCSV(importText)
    if (!rows.length) return
    setImporting(true); setImportResult(null)
    const table = tableForTab(tab)
    let ok=0, fail=0, skipped=0
    const skippedAddresses: string[] = []
    const BATCH=50
    for (let i=0;i<rows.length;i+=BATCH) {
      const rawBatch = rows.slice(i,i+BATCH)
      // Collect addresses in this batch and check for existing records
      const addresses = rawBatch.map(r=>r.address).filter(Boolean)
      const {data: existing} = await supabase.from(table).select('address').in('address', addresses)
      const existingSet = new Set((existing||[]).map((r: {address:string})=>r.address?.toLowerCase().trim()))
      // Filter out duplicates, track which were skipped
      const newRows = rawBatch.filter(r => {
        if (existingSet.has((r.address||'').toLowerCase().trim())) {
          skippedAddresses.push(r.address||'Unknown')
          skipped++
          return false
        }
        return true
      })
      if (!newRows.length) continue
      const batch = newRows.map(r=>{
        const payload: Record<string,unknown> = {...r}
        numFields.forEach(k=>{ payload[k]=r[k]?parseFloat(r[k])||null:null })
        if (tab==='comps' && !r.sale_date) payload.sale_date=null
        if (!r.county) payload.county='Nassau'
        if (!r.state) payload.state='NY'
        return payload
      })
      const {error, data} = await supabase.from(table).insert(batch).select()
      if (error) fail+=batch.length
      else ok+=(data?.length||0)
    }
    setImporting(false); setImportResult({ok,fail,skipped,skippedAddresses})
    if (ok>0) { setImportText(''); setImportPreview([]) }
  }
  const loadBrowse = async (offset=0) => {
    setBrowseLoading(true)
    const table = tableForTab(tab)
    const {data, count, error} = await supabase.from(table).select('*',{count:'exact'}).order('created_at',{ascending:false}).range(offset,offset+PAGE_SIZE-1)
    if (!error) { setBrowseData((data||[]) as BrowseRow[]); setBrowseCount(count||0); setBrowseOffset(offset) }
    setBrowseLoading(false)
  }
  const deleteRow = async (id: string) => {
    if (!confirm('Delete this record?')) return
    const table = tableForTab(tab)
    await supabase.from(table).delete().eq('id',id)
    setBrowseData((prev: BrowseRow[])=>prev.filter((r: BrowseRow)=>r.id!==id))
    setBrowseCount(c=>c-1)
  }
  const G2 = {display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}
  const G3 = {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}
  const tabBtn = (id: 'comps'|'avails'|'pcre-sales'|'pcre-leases', label: string) => (
    <div onClick={()=>{setTab(id);setSubTab('add');setBrowseData([]);setImportPreview([]);setImportResult(null);if(id==='pcre-sales'||id==='pcre-leases')setupPcreTables()}} style={{padding:'8px 20px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700,background:tab===id?D.blue:'transparent',color:tab===id?'#FFFFFF':D.textSec,border:`1px solid ${tab===id?'transparent':D.border}`,transition:'all .2s'}}>{label}</div>
  )
  const subTabBtn = (id: 'add'|'import'|'file'|'browse', label: string, icon: string) => (
    <div onClick={()=>{ setSubTab(id); if(id==='browse') loadBrowse(0) }} style={{padding:'7px 16px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,display:'flex',alignItems:'center',gap:6,background:subTab===id?`rgba(59,130,246,0.15)`:'transparent',color:subTab===id?D.blue:D.textSec,border:`1px solid ${subTab===id?`${D.blue}55`:D.border}`,transition:'all .2s'}}><span>{icon}</span>{label}</div>
  )
  return (
    <div className="anim-in">
      <SectionTitle sub="Add single records, upload files, paste CSV, or browse and manage your Supabase database directly.">Database Manager</SectionTitle>
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap' as const}}>
        {tabBtn('comps','📊 Sale Comps')}
        {tabBtn('avails','🏭 Availabilities')}
        {tabBtn('pcre-sales','📋 PCRE Sales')}
        {tabBtn('pcre-leases','📄 PCRE Leases')}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap' as const}}>
        {subTabBtn('add','Add Record','➕')}
        {subTabBtn('file','Upload File','📂')}
        {subTabBtn('import','Paste CSV','📥')}
        {subTabBtn('browse','Browse & Manage','📋')}
      </div>
      {subTab==='file' && <FileImport/>}
      {subTab==='add' && tab==='comps' && (
        <Card>
          <SL>Add Sale Comp — All fields save directly to Supabase</SL>
          <Field label="Property Address" full><Input placeholder="45 Orville Drive, Bohemia, NY 11716" value={compForm.address} onChange={e=>setC('address',e.target.value)}/></Field>
          <div style={G3}>
            <Field label="City"><Input value={compForm.city} onChange={e=>setC('city',e.target.value)}/></Field>
            <Field label="County"><Sel value={compForm.county} onChange={e=>setC('county',e.target.value)}>{['Nassau','Suffolk'].map(c=><option key={c}>{c}</option>)}</Sel></Field>
            <Field label="Zip Code"><Input value={compForm.zip_code} onChange={e=>setC('zip_code',e.target.value)}/></Field>
          </div>
          <Divider label="Building"/>
          <div style={G3}>
            <Field label="Property Type"><Sel value={compForm.property_type} onChange={e=>setC('property_type',e.target.value)}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</Sel></Field>
            <Field label="Building SF"><Input type="number" value={compForm.building_sf} onChange={e=>setC('building_sf',e.target.value)}/></Field>
            <Field label="Lot Size (acres)"><Input type="number" step="0.01" value={compForm.lot_size_ac} onChange={e=>setC('lot_size_ac',e.target.value)}/></Field>
            <Field label="Ceiling Height"><Input placeholder='22 ft' value={compForm.ceiling_height} onChange={e=>setC('ceiling_height',e.target.value)}/></Field>
            <Field label="Loading Docks"><Input value={compForm.loading_docks} onChange={e=>setC('loading_docks',e.target.value)}/></Field>
            <Field label="Drive-In Doors"><Input value={compForm.drive_ins} onChange={e=>setC('drive_ins',e.target.value)}/></Field>
            <Field label="Power"><Input placeholder="400A/3ph" value={compForm.power} onChange={e=>setC('power',e.target.value)}/></Field>
            <Field label="Heat"><Input value={compForm.heat} onChange={e=>setC('heat',e.target.value)}/></Field>
            <Field label="Sprinkler"><Sel value={compForm.sprinkler} onChange={e=>setC('sprinkler',e.target.value)}><option value="">Select...</option><option>ESFR</option><option>Wet</option><option>Dry</option><option>None</option></Sel></Field>
            <Field label="Sewer"><Sel value={compForm.sewer} onChange={e=>setC('sewer',e.target.value)}><option>Municipal</option><option>Septic</option></Sel></Field>
            <Field label="Zoning"><Input value={compForm.zoning} onChange={e=>setC('zoning',e.target.value)}/></Field>
            <Field label="RE Taxes ($/yr)"><Input type="number" value={compForm.real_estate_taxes} onChange={e=>setC('real_estate_taxes',e.target.value)}/></Field>
          </div>
          <Divider label="Sale"/>
          <div style={G3}>
            <Field label="Sale Price ($)"><Input type="number" value={compForm.sale_price} onChange={e=>setC('sale_price',e.target.value)}/></Field>
            <Field label="Price Per SF ($)"><Input type="number" step="0.01" value={compForm.price_per_sf} onChange={e=>setC('price_per_sf',e.target.value)}/></Field>
            <Field label="Sale Date"><Input type="date" value={compForm.sale_date} onChange={e=>setC('sale_date',e.target.value)}/></Field>
            <Field label="Sale Type"><Sel value={compForm.sale_type} onChange={e=>setC('sale_type',e.target.value)}><option>{"Arm's Length"}</option><option>Related Party</option><option>Foreclosure</option><option>Auction</option></Sel></Field>
            <Field label="Buyer"><Input value={compForm.buyer} onChange={e=>setC('buyer',e.target.value)}/></Field>
            <Field label="Seller"><Input value={compForm.seller} onChange={e=>setC('seller',e.target.value)}/></Field>
            <Field label="Listing Broker"><Input value={compForm.listing_broker} onChange={e=>setC('listing_broker',e.target.value)}/></Field>
            <Field label="Submarket"><Input value={compForm.submarket} onChange={e=>setC('submarket',e.target.value)}/></Field>
          </div>
          <Field label="Notes" full><textarea value={compForm.notes} onChange={e=>setC('notes',e.target.value)} placeholder="Any additional details..." style={{...inputStyle as React.CSSProperties,minHeight:70,resize:'vertical' as const}}/></Field>
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <Btn onClick={saveComp} disabled={saving} style={{flex:1,padding:12}}>{saving?'Saving...':'💾 Save to Supabase'}</Btn>
            <Btn variant="ghost" onClick={()=>setCompForm({...blankComp})} style={{padding:'12px 20px'}}>Clear</Btn>
          </div>
        </Card>
      )}
      {subTab==='add' && tab==='avails' && (
        <Card>
          <SL>Add Availability — Saves directly to Supabase</SL>
          <Field label="Property Address" full><Input placeholder="85 Davids Drive, Hauppauge, NY 11788" value={availForm.address} onChange={e=>setA('address',e.target.value)}/></Field>
          <div style={G3}>
            <Field label="City"><Input value={availForm.city} onChange={e=>setA('city',e.target.value)}/></Field>
            <Field label="County"><Sel value={availForm.county} onChange={e=>setA('county',e.target.value)}>{['Nassau','Suffolk'].map(c=><option key={c}>{c}</option>)}</Sel></Field>
            <Field label="Zip Code"><Input value={availForm.zip_code} onChange={e=>setA('zip_code',e.target.value)}/></Field>
          </div>
          <Divider label="Building"/>
          <div style={G3}>
            <Field label="Property Type"><Sel value={availForm.property_type} onChange={e=>setA('property_type',e.target.value)}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</Sel></Field>
            <Field label="Building SF"><Input type="number" value={availForm.building_sf} onChange={e=>setA('building_sf',e.target.value)}/></Field>
            <Field label="Lot Size (acres)"><Input type="number" step="0.01" value={availForm.lot_size_ac} onChange={e=>setA('lot_size_ac',e.target.value)}/></Field>
            <Field label="Ceiling Height"><Input placeholder='24 ft' value={availForm.ceiling_height} onChange={e=>setA('ceiling_height',e.target.value)}/></Field>
            <Field label="Loading Docks"><Input value={availForm.loading_docks} onChange={e=>setA('loading_docks',e.target.value)}/></Field>
            <Field label="Drive-In Doors"><Input value={availForm.drive_ins} onChange={e=>setA('drive_ins',e.target.value)}/></Field>
            <Field label="Power"><Input placeholder="400A/3ph" value={availForm.power} onChange={e=>setA('power',e.target.value)}/></Field>
            <Field label="Sprinkler"><Sel value={availForm.sprinkler} onChange={e=>setA('sprinkler',e.target.value)}><option value="">Select...</option><option>ESFR</option><option>Wet</option><option>Dry</option><option>None</option></Sel></Field>
            <Field label="Sewer"><Sel value={availForm.sewer} onChange={e=>setA('sewer',e.target.value)}><option>Municipal</option><option>Septic</option></Sel></Field>
            <Field label="Zoning"><Input value={availForm.zoning} onChange={e=>setA('zoning',e.target.value)}/></Field>
            <Field label="RE Taxes ($/yr)"><Input type="number" value={availForm.real_estate_taxes} onChange={e=>setA('real_estate_taxes',e.target.value)}/></Field>
          </div>
          <Divider label="Pricing & Listing"/>
          <div style={G3}>
            <Field label="Asking Price ($)"><Input type="number" value={availForm.asking_price} onChange={e=>setA('asking_price',e.target.value)}/></Field>
            <Field label="Price Per SF ($)"><Input type="number" step="0.01" value={availForm.price_per_sf} onChange={e=>setA('price_per_sf',e.target.value)}/></Field>
            <Field label="Pricing Guidance"><Input placeholder="$180/SF" value={availForm.pricing_guidance} onChange={e=>setA('pricing_guidance',e.target.value)}/></Field>
            <Field label="Availability Type"><Sel value={availForm.availability_type} onChange={e=>setA('availability_type',e.target.value)}><option>For Sale</option><option>For Lease</option><option>For Sale or Lease</option></Sel></Field>
            <Field label="Status"><Sel value={availForm.status} onChange={e=>setA('status',e.target.value)}><option>Available</option><option>Under Contract</option><option>Sold</option><option>Leased</option></Sel></Field>
            <Field label="Listing Broker"><Input value={availForm.listing_broker} onChange={e=>setA('listing_broker',e.target.value)}/></Field>
            <Field label="Submarket"><Input value={availForm.submarket} onChange={e=>setA('submarket',e.target.value)}/></Field>
            <Field label="LoopNet URL"><Input placeholder="https://www.loopnet.com/..." value={availForm.loopnet_url} onChange={e=>setA('loopnet_url',e.target.value)}/></Field>
          </div>
          <Field label="Notes" full><textarea value={availForm.notes} onChange={e=>setA('notes',e.target.value)} placeholder="Any additional details..." style={{...inputStyle as React.CSSProperties,minHeight:70,resize:'vertical' as const}}/></Field>
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <Btn onClick={saveAvail} disabled={saving} style={{flex:1,padding:12}}>{saving?'Saving...':'💾 Save to Supabase'}</Btn>
            <Btn variant="ghost" onClick={()=>setAvailForm({...blankAvail})} style={{padding:'12px 20px'}}>Clear</Btn>
          </div>
        </Card>
      )}
      {subTab==='add' && tab==='pcre-sales' && (
        <Card>
          <SL>Add PCRE Sale Transaction</SL>
          {pcreSetupSQL&&(
            <div style={{marginBottom:16,padding:'12px 16px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',fontSize:12,color:D.red,lineHeight:1.6}}>
              ⚠️ Tables not yet created. Open <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{color:D.blue}}>Supabase SQL Editor</a> and run the SQL shown below, then come back and save.
              <details style={{marginTop:8}}><summary style={{cursor:'pointer',color:D.textSec}}>View setup SQL</summary>
                <pre style={{marginTop:8,padding:10,background:'rgba(0,0,0,0.3)',borderRadius:6,fontSize:10,overflowX:'auto' as const,whiteSpace:'pre-wrap' as const}}>{pcreSetupSQL.sales}</pre>
              </details>
            </div>
          )}
          <Field label="Property Address" full><Input placeholder="128 Spagnoli Rd, Melville, NY" value={pcreSaleForm.address} onChange={e=>setPS('address',e.target.value)}/></Field>
          <div style={G3}>
            <Field label="City"><Input value={pcreSaleForm.city} onChange={e=>setPS('city',e.target.value)}/></Field>
            <Field label="County"><Sel value={pcreSaleForm.county} onChange={e=>setPS('county',e.target.value)}>{['Nassau','Suffolk'].map(c=><option key={c}>{c}</option>)}</Sel></Field>
            <Field label="Property Type"><Sel value={pcreSaleForm.property_type} onChange={e=>setPS('property_type',e.target.value)}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</Sel></Field>
          </div>
          <div style={G3}>
            <Field label="Building SF"><Input type="number" value={pcreSaleForm.building_sf} onChange={e=>setPS('building_sf',e.target.value)}/></Field>
            <Field label="Sale Price"><Input placeholder="$4,700,000 or Undisclosed" value={pcreSaleForm.sale_price_text} onChange={e=>setPS('sale_price_text',e.target.value)}/></Field>
            <Field label="Sale Date"><Input type="date" value={pcreSaleForm.sale_date} onChange={e=>setPS('sale_date',e.target.value)}/></Field>
          </div>
          <div style={G2}>
            <Field label="Buyer"><Input value={pcreSaleForm.buyer} onChange={e=>setPS('buyer',e.target.value)}/></Field>
            <Field label="Seller"><Input value={pcreSaleForm.seller} onChange={e=>setPS('seller',e.target.value)}/></Field>
          </div>
          <Field label="Notes" full><textarea value={pcreSaleForm.notes} onChange={e=>setPS('notes',e.target.value)} placeholder="Any additional details..." style={{...inputStyle as React.CSSProperties,minHeight:70,resize:'vertical' as const}}/></Field>
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <Btn onClick={savePcreSale} disabled={saving} style={{flex:1,padding:12}}>{saving?'Saving...':'💾 Save PCRE Sale'}</Btn>
            <Btn variant="ghost" onClick={()=>setPcreSaleForm({...blankPcreSale})} style={{padding:'12px 20px'}}>Clear</Btn>
          </div>
        </Card>
      )}
      {subTab==='add' && tab==='pcre-leases' && (
        <Card>
          <SL>Add PCRE Lease Transaction</SL>
          {pcreSetupSQL&&(
            <div style={{marginBottom:16,padding:'12px 16px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',fontSize:12,color:D.red,lineHeight:1.6}}>
              ⚠️ Tables not yet created. Open <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{color:D.blue}}>Supabase SQL Editor</a> and run the SQL shown below, then come back and save.
              <details style={{marginTop:8}}><summary style={{cursor:'pointer',color:D.textSec}}>View setup SQL</summary>
                <pre style={{marginTop:8,padding:10,background:'rgba(0,0,0,0.3)',borderRadius:6,fontSize:10,overflowX:'auto' as const,whiteSpace:'pre-wrap' as const}}>{pcreSetupSQL.leases}</pre>
              </details>
            </div>
          )}
          <Field label="Property Address" full><Input placeholder="1460 N Clinton Ave, Bay Shore, NY" value={pcreLeaseForm.address} onChange={e=>setPL('address',e.target.value)}/></Field>
          <div style={G3}>
            <Field label="City"><Input value={pcreLeaseForm.city} onChange={e=>setPL('city',e.target.value)}/></Field>
            <Field label="County"><Sel value={pcreLeaseForm.county} onChange={e=>setPL('county',e.target.value)}>{['Nassau','Suffolk'].map(c=><option key={c}>{c}</option>)}</Sel></Field>
            <Field label="Building SF"><Input type="number" value={pcreLeaseForm.building_sf} onChange={e=>setPL('building_sf',e.target.value)}/></Field>
          </div>
          <div style={G3}>
            <Field label="Tenant"><Input value={pcreLeaseForm.tenant} onChange={e=>setPL('tenant',e.target.value)}/></Field>
            <Field label="Landlord"><Input value={pcreLeaseForm.landlord} onChange={e=>setPL('landlord',e.target.value)}/></Field>
            <Field label="Lease Term"><Input placeholder="3 years" value={pcreLeaseForm.lease_term} onChange={e=>setPL('lease_term',e.target.value)}/></Field>
          </div>
          <div style={G2}>
            <Field label="Lease Price"><Input placeholder="$20.00 PSF" value={pcreLeaseForm.lease_price} onChange={e=>setPL('lease_price',e.target.value)}/></Field>
            <Field label="Lease Date"><Input type="date" value={pcreLeaseForm.lease_date} onChange={e=>setPL('lease_date',e.target.value)}/></Field>
          </div>
          <Field label="Notes" full><textarea value={pcreLeaseForm.notes} onChange={e=>setPL('notes',e.target.value)} placeholder="Any additional details..." style={{...inputStyle as React.CSSProperties,minHeight:70,resize:'vertical' as const}}/></Field>
          <div style={{display:'flex',gap:10,marginTop:4}}>
            <Btn onClick={savePcreLease} disabled={saving} style={{flex:1,padding:12}}>{saving?'Saving...':'💾 Save PCRE Lease'}</Btn>
            <Btn variant="ghost" onClick={()=>setPcreLeaseForm({...blankPcreLease})} style={{padding:'12px 20px'}}>Clear</Btn>
          </div>
        </Card>
      )}
      {subTab==='import' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}}>
          <Card>
            <SL>Paste CSV or Tab-Separated Data</SL>
            <p style={{fontSize:12,color:D.textSec,marginBottom:14,lineHeight:1.6}}>Export from Excel, Numbers, or CoStar and paste below. First row must be a header row.</p>
            <Field label="Paste data here" full>
              <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={"address,city,county,building_sf,sale_price,sale_date,buyer,seller\n45 Orville Dr,Bohemia,Suffolk,28500,4250000,2024-03-15,Acme LLC,Smith Realty"} style={{...inputStyle as React.CSSProperties,minHeight:220,resize:'vertical' as const,lineHeight:1.5,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}/>
            </Field>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" onClick={handleImportPreview} style={{flex:1,padding:10}}>Preview First 5 Rows</Btn>
              <Btn onClick={runImport} disabled={importing||!importText.trim()} style={{flex:1,padding:10}}>{importing?'Importing...':'📥 Import All Rows'}</Btn>
            </div>
            {importResult&&(
              <div style={{marginTop:12,padding:'12px 16px',borderRadius:8,background:importResult.fail>0?`rgba(239,68,68,0.1)`:`rgba(16,185,129,0.1)`,border:`1px solid ${importResult.fail>0?`rgba(239,68,68,0.2)`:`rgba(16,185,129,0.2)`}`}}>
                <div style={{fontSize:13,fontWeight:700,color:importResult.fail>0?D.red:D.green,marginBottom:importResult.skippedAddresses?.length?8:0}}>
                  {importResult.ok>0?`✅ ${importResult.ok} record${importResult.ok!==1?'s':''} imported successfully`:''}
                  {importResult.ok===0&&importResult.skipped>0?'⏭️ No new records — all already exist':''}
                  {importResult.fail>0?` · ⚠️ ${importResult.fail} failed`:''}
                </div>
                {importResult.skippedAddresses?.length>0&&(
                  <div style={{marginTop:6}}>
                    <div style={{fontSize:11,fontWeight:600,color:D.textSec,marginBottom:4}}>Already in database — skipped:</div>
                    {importResult.skippedAddresses.map((addr,i)=>(
                      <div key={i} style={{fontSize:11,color:D.textMuted,padding:'2px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>⏭️ {addr}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
          <Card>
            <SL>Column Name Reference</SL>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 12px'}}>
              {(tab==='comps'
                ? ['address','city','county','zip_code','property_type','building_sf','lot_size_ac','ceiling_height','loading_docks','drive_ins','power','heat','sprinkler','sewer','zoning','real_estate_taxes','sale_price','price_per_sf','sale_date','sale_type','buyer','seller','listing_broker','submarket','notes']
                : tab==='avails'
                ? ['address','city','county','zip_code','property_type','building_sf','lot_size_ac','ceiling_height','loading_docks','drive_ins','power','sprinkler','sewer','zoning','real_estate_taxes','asking_price','price_per_sf','pricing_guidance','availability_type','status','listing_broker','submarket','loopnet_url','notes']
                : tab==='pcre-sales'
                ? ['address','city','county','property_type','building_sf','sale_price_text','sale_date','buyer','seller','notes']
                : ['address','city','county','tenant','landlord','building_sf','lease_price','lease_date','lease_term','notes']
              ).map(col=>(
                <div key={col} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'#0891B2',padding:'3px 0',borderBottom:`1px solid ${D.border}`}}>{col}</div>
              ))}
            </div>
            {importPreview.length>0&&(
              <div style={{marginTop:18}}>
                <SL>Preview — First 5 Rows</SL>
                <div style={{overflowX:'auto',fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
                  {importPreview.map((row,i)=>(
                    <div key={i} style={{padding:'6px 0',borderBottom:`1px solid ${D.border}`,display:'flex',gap:12,flexWrap:'wrap' as const}}>
                      {Object.entries(row).slice(0,6).map(([k,v])=>(
                        <span key={k} style={{color:D.textSec}}>{k}: <span style={{color:D.text}}>{v||'—'}</span></span>
                      ))}
                      {Object.keys(row).length>6&&<span style={{color:D.textMuted}}>+{Object.keys(row).length-6} more</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
      {subTab==='browse' && (
        <Card>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <SL style={{marginBottom:0}}>{browseCount.toLocaleString()} total records in {tableForTab(tab)}</SL>
            <Btn variant="ghost" size="sm" onClick={()=>loadBrowse(browseOffset)}>↻ Refresh</Btn>
          </div>
          {browseLoading&&<div style={{textAlign:'center' as const,padding:40}}><div className="spin" style={{width:28,height:28,border:`2px solid ${D.border}`,borderTopColor:D.blue,borderRadius:'50%',margin:'0 auto 12px'}}/><p style={{color:D.textSec,fontSize:12}}>Loading...</p></div>}
          {!browseLoading&&browseData.length===0&&<p style={{color:D.textSec,fontSize:12,textAlign:'center' as const,padding:32}}>No records found.</p>}
          {!browseLoading&&browseData.map((row,i)=>(
            <div key={String(row.id)} style={{padding:'12px 0',borderBottom:`1px solid ${D.border}`,display:'flex',alignItems:'flex-start',gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4,color:D.text}}>
                  {row.address||'—'}{row.city?`, ${row.city}`:''}
                  {tab==='pcre-leases'&&row.tenant?<span style={{color:D.textSec,fontWeight:400}}>{` — ${row.tenant}`}</span>:null}
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
                  {!!row.building_sf&&<Tag color={D.blue}>{Number(row.building_sf).toLocaleString()} SF</Tag>}
                  {tab==='comps'&&!!row.price_per_sf&&<Tag color={D.gold}>${Number(row.price_per_sf).toFixed(2)}/SF</Tag>}
                  {tab==='comps'&&!!row.sale_date&&<Tag color={D.textMuted}>{fmtDate(String(row.sale_date))}</Tag>}
                  {tab==='avails'&&!!row.asking_price&&<Tag color={D.purple}>${Number(row.asking_price).toLocaleString()}</Tag>}
                  {tab==='avails'&&!!row.status&&<Tag color={row.status==='Available'?D.green:D.textMuted}>{String(row.status)}</Tag>}
                  {tab==='pcre-sales'&&!!row.sale_price_text&&<Tag color={D.gold}>{String(row.sale_price_text)}</Tag>}
                  {tab==='pcre-sales'&&!!row.sale_date&&<Tag color={D.textMuted}>{fmtDate(String(row.sale_date))}</Tag>}
                  {tab==='pcre-leases'&&!!row.lease_price&&<Tag color={D.gold}>{String(row.lease_price)}</Tag>}
                  {tab==='pcre-leases'&&!!row.lease_date&&<Tag color={D.textMuted}>{fmtDate(String(row.lease_date))}</Tag>}
                  {!!row.county&&<Tag color={row.county==='Nassau'?D.blue:'#0891B2'}>{String(row.county)}</Tag>}
                </div>
              </div>
              <Btn variant="danger" size="sm" onClick={()=>deleteRow(String(row.id))} style={{fontSize:10,padding:'5px 10px',flexShrink:0}}>Delete</Btn>
            </div>
          ))}
          {!browseLoading&&browseCount>PAGE_SIZE&&(
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16}}>
              <Btn variant="ghost" size="sm" disabled={browseOffset===0} onClick={()=>loadBrowse(Math.max(0,browseOffset-PAGE_SIZE))}>← Prev</Btn>
              <span style={{fontSize:11,color:D.textSec}}>Showing {browseOffset+1}–{Math.min(browseOffset+PAGE_SIZE,browseCount)} of {browseCount.toLocaleString()}</span>
              <Btn variant="ghost" size="sm" disabled={browseOffset+PAGE_SIZE>=browseCount} onClick={()=>loadBrowse(browseOffset+PAGE_SIZE)}>Next →</Btn>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}


// ── AUTH ──────────────────────────────────────────────────────────────────────
function Auth({onLogin}: {onLogin: (u:{name:string,role:string,init:string})=>void}) {
  const [email,setEmail]=useState(''); const [pass,setPass]=useState('')
  const [fname,setFname]=useState(''); const [lname,setLname]=useState('')
  const [tab,setTab]=useState('sign')
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,background:`radial-gradient(ellipse 60% 40% at 30% 20%,rgba(59,130,246,0.08) 0%,transparent 55%),radial-gradient(ellipse 50% 35% at 70% 80%,rgba(139,92,246,0.07) 0%,transparent 55%),${D.bg}`}}>
      <div style={{marginBottom:36,textAlign:'center'}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:50,fontWeight:600,color:D.text,marginBottom:6}}>Premier OPV</div>
        <p style={{fontSize:11,color:D.textMuted,letterSpacing:'.1em',textTransform:'uppercase' as const}}>Opinion of Value Platform · Long Island Industrial</p>
      </div>
      <div style={{background:D.surface,border:`1px solid ${D.border}`,borderRadius:14,padding:'32px 36px',width:'100%',maxWidth:420,boxShadow:'0 24px 64px rgba(0,0,0,.5)'}}>
        <div style={{display:'flex',borderBottom:`1px solid ${D.border}`,marginBottom:24}}>
          {[['sign','Sign In'],['reg','Create Account']].map(([t,l])=>(
            <div key={t} onClick={()=>setTab(t)} style={{flex:1,textAlign:'center' as const,padding:'8px 0',fontSize:11,fontWeight:700,cursor:'pointer',color:tab===t?D.blue:D.textMuted,borderBottom:`2px solid ${tab===t?D.blue:'transparent'}`,marginBottom:-1,transition:'all .2s',letterSpacing:'.06em',textTransform:'uppercase' as const}}>{l}</div>
          ))}
        </div>
        {tab==='sign'?(
          <div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,marginBottom:20,color:D.text}}>Welcome back</p>
            <Field label="Email"><Input type="email" placeholder="broker@firma.com" value={email} onChange={e=>setEmail(e.target.value)}/></Field>
            <Field label="Password"><Input type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)}/></Field>
            <Btn onClick={()=>{if(!email){alert('Enter email');return;}const n=email.split('@')[0].replace(/[^a-z]/gi,' ').trim()||'Broker';onLogin({name:n,role:'Commercial Broker',init:n.slice(0,2).toUpperCase()})}} style={{width:'100%',padding:12}}>Sign In</Btn>
            <div style={{textAlign:'center' as const,fontSize:11,color:D.textMuted,margin:'14px 0'}}>or</div>
            <Btn onClick={()=>onLogin({name:'Alex Rivera',role:'Senior Broker',init:'AR'})} variant="ghost" style={{width:'100%',padding:11,fontSize:12}}>Continue with Demo Account</Btn>
          </div>
        ):(
          <div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,marginBottom:20,color:D.text}}>Create account</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Field label="First Name"><Input placeholder="Alex" value={fname} onChange={e=>setFname(e.target.value)}/></Field>
              <Field label="Last Name"><Input placeholder="Rivera" value={lname} onChange={e=>setLname(e.target.value)}/></Field>
            </div>
            <Field label="Email"><Input type="email" placeholder="you@brokerage.com" value={email} onChange={e=>setEmail(e.target.value)}/></Field>
            <Btn onClick={()=>{if(!fname||!email){alert('Enter name and email');return;}onLogin({name:`${fname} ${lname}`.trim(),role:'Commercial Broker',init:(fname[0]+(lname[0]||'')).toUpperCase()})}} style={{width:'100%',padding:12}}>Create Account</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SUBJECT PROPERTY ──────────────────────────────────────────────────────────
function SubjectProperty({subject,setSubject,setPage,folders,setFolders,assignmentData}: {subject:SubjectForm|null,setSubject:(s:SubjectForm)=>void,setPage:(p:string)=>void,folders:Folder[],setFolders:(f:Folder[]|((prev:Folder[])=>Folder[]))=>void,assignmentData:AssignmentData}) {
  const defaultOpvType = assignmentData.opvType==='For Lease'?'lease':assignmentData.opvType==='Investment Sale'?'investment':'sale'
  const [form,setForm]=useState<SubjectForm>(subject||{address:assignmentData.propertyAddress||'',city:'',county:'Nassau',municipality:'',parcelId:'',type:'Warehouse',opvType:defaultOpvType,size:'',lot:'',ceiling:'',docks:'',driveIn:'',power:'',heat:'Gas FHA',parking:'',sprinkler:'ESFR',sewer:'Municipal',zoning:'',taxes:'',yearBuilt:'',officePct:'',construction:'Masonry/Steel',condition:'Good',notes:'',highestBestUse:'',capRateLow:'',capRateHigh:'',leasePsfLow:'',leasePsfHigh:'',estimatedValueLow:'',estimatedValueHigh:'',preparedBy:assignmentData.preparedBy||''})
  const set=(k:string,v:string)=>setForm((f:SubjectForm)=>({...f,[k]:v}))
  const autoCreateFolders = (address: string) => {
    const already = folders.some(f=>f.opvAddress===address)
    if (already) return
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length]
    const now = Date.now(); const shortAddr = address.split(',')[0]
    setFolders((prev: Folder[]) => [...prev,
      {id:`${now}-comps`, name:`${shortAddr} — Sale Comps`, type:'comps', color, items:[], opvAddress:address, createdAt:now},
      {id:`${now}-avails`, name:`${shortAddr} — Availabilities`, type:'avails', color, items:[], opvAddress:address, createdAt:now+1},
      {id:`${now}-lease`, name:`${shortAddr} — Lease Comps`, type:'lease-comps', color, items:[], opvAddress:address, createdAt:now+2}
    ])
  }
  const G2={display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}
  return (
    <div className="anim-in">
      <SectionTitle sub="Enter subject property specifications. All fields populate the OPV report.">Subject Property Details</SectionTitle>
      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:20,alignItems:'start'}}>
        <Card>
          <SL>OPV Type</SL>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {([['sale','🏷 For Sale'],['investment','📊 Investment Sale'],['lease','📋 Lease']] as [string,string][]).map(([val,lbl])=>(
              <div key={val} onClick={()=>set('opvType',val)} style={{flex:1,padding:'10px 8px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:700,textAlign:'center' as const,background:form.opvType===val?`rgba(217,119,6,0.12)`:'transparent',color:form.opvType===val?D.gold:D.textMuted,border:`1.5px solid ${form.opvType===val?D.gold:D.border}`,transition:'all .15s'}}>{lbl}</div>
            ))}
          </div>
          <SL>Location & Classification</SL>
          <Field label="Property Address" full><Input placeholder="e.g. 45 Orville Drive, Bohemia, NY 11716" value={form.address} onChange={e=>set('address',e.target.value)}/></Field>
          <div style={G2}>
            <Field label="City / Town"><Input placeholder="e.g. Bohemia" value={form.city} onChange={e=>set('city',e.target.value)}/></Field>
            <Field label="Municipality"><Input placeholder="e.g. Town of Islip" value={form.municipality} onChange={e=>set('municipality',e.target.value)}/></Field>
            <Field label="County"><Sel value={form.county} onChange={e=>set('county',e.target.value)}>{COUNTIES.map(c=><option key={c}>{c}</option>)}</Sel></Field>
            <Field label="Property Type"><Sel value={form.type} onChange={e=>set('type',e.target.value)}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</Sel></Field>
          </div>
          <Field label="Parcel / Section-Block-Lot ID"><Input placeholder="e.g. 0500-046.00-01.00-014.001" value={form.parcelId} onChange={e=>set('parcelId',e.target.value)}/></Field>
          <Divider label="Building Specifications"/>
          <div style={G2}>
            <Field label="Building Size (SF)"><Input type="number" placeholder="28500" value={form.size} onChange={e=>set('size',e.target.value)}/></Field>
            <Field label="Lot Size"><Input placeholder="2.1 acres" value={form.lot} onChange={e=>set('lot',e.target.value)}/></Field>
            <Field label="Clear Ceiling Height (ft)"><Input type="number" placeholder="22" value={form.ceiling} onChange={e=>set('ceiling',e.target.value)}/></Field>
            <Field label="Year Built"><Input type="number" placeholder="2001" value={form.yearBuilt} onChange={e=>set('yearBuilt',e.target.value)}/></Field>
            <Field label="Loading Docks"><Input type="number" placeholder="2" value={form.docks} onChange={e=>set('docks',e.target.value)}/></Field>
            <Field label="Drive-In Doors"><Input type="number" placeholder="1" value={form.driveIn} onChange={e=>set('driveIn',e.target.value)}/></Field>
            <Field label="Office Percentage (%)"><Input type="number" placeholder="12" value={form.officePct} onChange={e=>set('officePct',e.target.value)}/></Field>
            <Field label="Parking Spaces"><Input type="number" placeholder="45" value={form.parking} onChange={e=>set('parking',e.target.value)}/></Field>
          </div>
          <Divider label="Systems & Infrastructure"/>
          <div style={G2}>
            <Field label="Electrical Power"><Input placeholder="400A/3ph" value={form.power} onChange={e=>set('power',e.target.value)}/></Field>
            <Field label="Heat"><Sel value={form.heat} onChange={e=>set('heat',e.target.value)}><option>Gas FHA</option><option>Gas Unit Heaters</option><option>Electric</option><option>Oil</option><option>None</option></Sel></Field>
            <Field label="Sprinkler System"><Sel value={form.sprinkler} onChange={e=>set('sprinkler',e.target.value)}><option>ESFR</option><option>Wet</option><option>Dry</option><option>None</option></Sel></Field>
            <Field label="Sewer"><Sel value={form.sewer} onChange={e=>set('sewer',e.target.value)}><option>Municipal</option><option>Septic</option></Sel></Field>
            <Field label="Construction Type"><Sel value={form.construction} onChange={e=>set('construction',e.target.value)}><option>Masonry/Steel</option><option>Tilt-up Concrete</option><option>Steel Frame</option><option>Masonry</option></Sel></Field>
            <Field label="Condition"><Sel value={form.condition} onChange={e=>set('condition',e.target.value)}><option>Excellent</option><option>Good</option><option>Average</option><option>Fair</option><option>Poor</option></Sel></Field>
            <Field label="Zoning"><Input placeholder="M1 / Industrial" value={form.zoning} onChange={e=>set('zoning',e.target.value)}/></Field>
            <Field label="Real Estate Taxes ($/yr)"><Input type="number" placeholder="62400" value={form.taxes} onChange={e=>set('taxes',e.target.value)}/></Field>
          </div>
          <Field label="Highest & Best Use" full><textarea value={form.highestBestUse} onChange={e=>set('highestBestUse',e.target.value)} placeholder="Describe the highest and best use of the property..." style={{...inputStyle as React.CSSProperties,minHeight:64,resize:'vertical' as const,lineHeight:1.6}}/></Field>
          <Field label="Broker Notes / Special Features" full><textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Describe any features, renovations, access, or market notes..." style={{...inputStyle as React.CSSProperties,minHeight:80,resize:'vertical' as const,lineHeight:1.6}}/></Field>
          <Divider label="Value Guidance (Optional)"/>
          <div style={G2}>
            <Field label="Est. Value Low ($/SF)" note="For investment sale"><Input placeholder="e.g. 175" value={form.estimatedValueLow} onChange={e=>set('estimatedValueLow',e.target.value)}/></Field>
            <Field label="Est. Value High ($/SF)"><Input placeholder="e.g. 210" value={form.estimatedValueHigh} onChange={e=>set('estimatedValueHigh',e.target.value)}/></Field>
            {form.opvType==='investment'&&<>
              <Field label="Cap Rate Low (%)"><Input placeholder="e.g. 5.5" value={form.capRateLow} onChange={e=>set('capRateLow',e.target.value)}/></Field>
              <Field label="Cap Rate High (%)"><Input placeholder="e.g. 7.0" value={form.capRateHigh} onChange={e=>set('capRateHigh',e.target.value)}/></Field>
            </>}
            {(form.opvType==='lease'||form.opvType==='investment')&&<>
              <Field label="Lease PSF Low ($/SF/yr)"><Input placeholder="e.g. 14.00" value={form.leasePsfLow} onChange={e=>set('leasePsfLow',e.target.value)}/></Field>
              <Field label="Lease PSF High ($/SF/yr)"><Input placeholder="e.g. 18.00" value={form.leasePsfHigh} onChange={e=>set('leasePsfHigh',e.target.value)}/></Field>
            </>}
          </div>
          <Field label="Prepared By"><Input placeholder="Broker name" value={form.preparedBy} onChange={e=>set('preparedBy',e.target.value)}/></Field>
          <Btn onClick={()=>{if(!form.address||!form.size){alert('Address and building size are required.');return;}setSubject(form);autoCreateFolders(form.address);setPage('comp-search')}} style={{width:'100%',padding:12,marginTop:4}}>Save & Search Comps →</Btn>
        </Card>
        <div>
          <Card style={{border:`1px solid rgba(217,119,6,0.25)`}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:D.gold,marginBottom:14}}>Subject Property Preview</div>
            {([['Address',form.address||'—'],['County',form.county],['Type',form.type],['Building Size',form.size?`${parseInt(form.size).toLocaleString()} SF`:'—'],['Lot Size',form.lot||'—'],['Clear Height',form.ceiling?`${form.ceiling} ft`:'—'],['Docks',form.docks||'—'],['Drive-In',form.driveIn||'—'],['Power',form.power||'—'],['Sprinkler',form.sprinkler],['Sewer',form.sewer],['Zoning',form.zoning||'—'],['Year Built',form.yearBuilt||'—'],['Taxes',form.taxes?`$${parseInt(form.taxes).toLocaleString()}/yr`:'—']] as [string,string][]).map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${D.border}`,fontSize:12}}>
                <span style={{color:D.textSec}}>{l}</span>
                <span style={{fontWeight:500,textAlign:'right' as const,maxWidth:'55%',color:D.text}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card style={{marginTop:14}}>
            <SL>OPV Checklist</SL>
            {[{l:'Subject property saved',done:!!subject},{l:'Sale comps found',done:false},{l:'Availabilities found',done:false},{l:'Comps scored',done:false},{l:'Analytics run',done:false},{l:'Broker analysis written',done:false},{l:'Report complete',done:false}].map((c,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 0',fontSize:12}}>
                <div style={{width:16,height:16,borderRadius:'50%',background:c.done?`rgba(16,185,129,0.2)`:'transparent',border:`1.5px solid ${c.done?D.green:D.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:D.green,flexShrink:0}}>{c.done?'✓':''}</div>
                <span style={{color:c.done?D.text:D.textSec}}>{c.l}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}


// ── COMP SEARCH ───────────────────────────────────────────────────────────────
function CompSearch({subject,comps,setComps,setPage,folders,setFolders}: {subject:SubjectForm|null,comps:Comp[],setComps:(c:Comp[])=>void,setPage:(p:string)=>void,folders:Folder[],setFolders:(f:Folder[])=>void}) {
  const [results,setResults]=useState<Comp[]>([])
  const [loading,setLoading]=useState(false)
  const [searched,setSearched]=useState(false)
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [filters,setFilters]=useState({county:'',city:'',min_sf:'',max_sf:'',min_price:'',max_price:'',min_date:'',max_date:'',sewer:'',zoning:''})
  const [folderDropdown, setFolderDropdown] = useState<string|null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const toggleExpand = (id:string) => setExpandedRows(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})

  const scoreComp = (c: Comp, s: SubjectForm): number => {
    const subSF = parseFloat(s.size)||0; const compSF = c.building_sf||0
    const sizeDiff = subSF>0 ? Math.abs(compSF-subSF)/subSF : 0.5
    const sizeScore = Math.max(0, 100-(sizeDiff*200))
    const subCeil = parseFloat(s.ceiling)||0; const compCeil = parseFloat(c.ceiling_height)||0
    const ceilDiff = subCeil>0 ? Math.abs(compCeil-subCeil) : 4
    const ceilScore = Math.max(0, 100-(ceilDiff*10))
    return Math.min(99, Math.max(40, Math.round(sizeScore*0.5 + ceilScore*0.3 + 65*0.2)))
  }

  const search = async () => {
    setLoading(true); setResults([]); setSearched(false)
    let q = supabase.from('industrial_sale_comps').select('*')
    if (filters.county) q = q.eq('county', filters.county)
    if (filters.city) q = q.ilike('city', `%${filters.city}%`)
    if (filters.min_sf) q = q.gte('building_sf', Number(filters.min_sf))
    if (filters.max_sf) q = q.lte('building_sf', Number(filters.max_sf))
    if (filters.min_price) q = q.gte('sale_price', Number(filters.min_price))
    if (filters.max_price) q = q.lte('sale_price', Number(filters.max_price))
    if (filters.min_date) q = q.gte('sale_date', filters.min_date)
    if (filters.max_date) q = q.lte('sale_date', filters.max_date)
    if (filters.sewer) q = q.eq('sewer', filters.sewer)
    if (filters.zoning) q = q.ilike('zoning', `%${filters.zoning}%`)
    q = q.order('sale_date', {ascending:false}).limit(200)
    const {data,error} = await q
    if (error) { alert('Search error: ' + error.message); setLoading(false); return }
    const scored = (data||[]).map((c: Comp) => ({...c, score: subject ? scoreComp(c, subject) : 75}))
    if (subject) scored.sort((a: Comp,b: Comp) => (b.score||0)-(a.score||0))
    setResults(scored); setSearched(true); setLoading(false)
  }

  const toggleSelect = (id: string) => setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const addSelected = () => {
    const toAdd = results.filter(r=>selected.has(r.id) && !comps.find(c=>c.id===r.id))
    setComps([...comps, ...toAdd]); alert(`${toAdd.length} comp${toAdd.length!==1?'s':''} added to your OPV`); setSelected(new Set())
  }
  const sf = (k:string,v:string) => setFilters(f=>({...f,[k]:v}))
  const scoreColor = (s:number) => s>=85?D.green:s>=70?D.gold:D.red

  return (
    <div className="anim-in">
      <SectionTitle sub="Search 812 real Long Island industrial transactions from your Supabase database.">Sale Comp Search</SectionTitle>
      {!subject&&<Card style={{textAlign:'center' as const,padding:'48px 20px',marginBottom:20}}><p style={{fontSize:13,color:D.textSec,marginBottom:16}}>Save your subject property first.</p><Btn onClick={()=>setPage('subject')}>← Enter Subject Property</Btn></Card>}
      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20,alignItems:'start'}}>
        <div>
          {subject&&<Card style={{marginBottom:14,border:`1px solid rgba(217,119,6,0.25)`}}>
            <SL>Subject Property</SL>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:D.gold,marginBottom:10}}>{subject.address}</div>
            {([['Size',subject.size?`${Number(subject.size).toLocaleString()} SF`:'—'],['Ceiling',subject.ceiling?`${subject.ceiling} ft`:'—'],['County',subject.county]] as [string,string][]).map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${D.border}`,fontSize:11}}>
                <span style={{color:D.textSec}}>{l}</span><span style={{fontWeight:600,color:D.text}}>{v}</span>
              </div>
            ))}
          </Card>}
          <Card>
            <SL>Search Filters</SL>
            <Field label="County"><Sel value={filters.county} onChange={e=>sf('county',e.target.value)}><option value="">All Counties</option>{COUNTIES.map(c=><option key={c}>{c}</option>)}</Sel></Field>
            <Field label="City"><Input placeholder="e.g. Hauppauge" value={filters.city} onChange={e=>sf('city',e.target.value)}/></Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Field label="Min SF"><Input type="number" placeholder="0" value={filters.min_sf} onChange={e=>sf('min_sf',e.target.value)}/></Field>
              <Field label="Max SF"><Input type="number" placeholder="Any" value={filters.max_sf} onChange={e=>sf('max_sf',e.target.value)}/></Field>
              <Field label="Min Price"><Input type="number" placeholder="0" value={filters.min_price} onChange={e=>sf('min_price',e.target.value)}/></Field>
              <Field label="Max Price"><Input type="number" placeholder="Any" value={filters.max_price} onChange={e=>sf('max_price',e.target.value)}/></Field>
              <Field label="Date From"><Input type="date" value={filters.min_date} onChange={e=>sf('min_date',e.target.value)}/></Field>
              <Field label="Date To"><Input type="date" value={filters.max_date} onChange={e=>sf('max_date',e.target.value)}/></Field>
            </div>
            <Field label="Sewer"><Sel value={filters.sewer} onChange={e=>sf('sewer',e.target.value)}><option value="">Any</option><option value="City">City Sewer</option><option value="Septic">Septic</option></Sel></Field>
            <Field label="Zoning"><Input placeholder="e.g. I, M1" value={filters.zoning} onChange={e=>sf('zoning',e.target.value)}/></Field>
            <Btn onClick={search} disabled={loading} style={{width:'100%',padding:11}}>{loading?'Searching...':'🔎 Search Comps'}</Btn>
          </Card>
          {comps.length>0&&<Card style={{marginTop:14}}>
            <SL>Added to OPV</SL>
            <div style={{fontSize:12,color:D.textSec,marginBottom:10}}>{comps.length} comp{comps.length!==1?'s':''} selected</div>
            <Btn onClick={()=>setPage('avail-search')} style={{width:'100%',padding:10,fontSize:12}}>Next: Avail Search →</Btn>
          </Card>}
        </div>
        <div>
          {loading&&<Card><div style={{textAlign:'center' as const,padding:'40px 20px'}}><div className="spin" style={{width:32,height:32,border:`2px solid ${D.border}`,borderTopColor:D.blue,borderRadius:'50%',margin:'0 auto 16px'}}/><p style={{fontSize:13,color:D.textSec}}>Searching Supabase database...</p></div></Card>}
          {!loading&&!searched&&<Card style={{textAlign:'center' as const,padding:'64px 20px'}}><div style={{fontSize:48,opacity:.15,marginBottom:16}}>🔎</div><p style={{fontSize:15,fontWeight:600,marginBottom:8,color:D.text}}>Ready to Search</p><p style={{fontSize:13,color:D.textSec,maxWidth:380,margin:'0 auto'}}>Set your filters and click Search to pull from your database.</p></Card>}
          {!loading&&searched&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <span style={{fontSize:13,color:D.textSec}}>{results.length} results {results.length===200?'(showing first 200)':''}</span>
                <div style={{display:'flex',gap:8}}>
                  {results.length>0&&<Btn variant="ghost" size="sm" onClick={()=>setSelected(new Set(results.map(r=>r.id)))}>Select All</Btn>}
                  {selected.size>0&&<Btn size="sm" onClick={addSelected}>＋ Add {selected.size} to OPV</Btn>}
                </div>
              </div>
              {results.length===0?<Card style={{textAlign:'center' as const,padding:'48px 20px'}}><p style={{color:D.textSec}}>No results. Try broadening your filters.</p></Card>:null}
              {results.length>0&&(
                <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
                  {results.map((r,idx)=>{
                    const psf=r.price_per_sf||(r.sale_price&&r.building_sf?Number(r.sale_price)/Number(r.building_sf):0)
                    const isAdded=comps.some(c=>c.id===r.id)
                    const sc=(label:string,val:unknown)=>(
                      <div key={label}>
                        <div style={{fontSize:10,fontWeight:600,color:D.textMuted,textTransform:'uppercase' as const,letterSpacing:'.06em',marginBottom:2}}>{label}</div>
                        <div style={{fontSize:12,fontWeight:600,color:D.text}}>{val?String(val):'—'}</div>
                      </div>
                    )
                    return (
                      <Card key={r.id} style={{padding:'16px 20px',border:selected.has(r.id)?`1px solid ${D.blue}`:`1px solid ${D.border}`,background:selected.has(r.id)?`rgba(59,130,246,0.05)`:D.surface}}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                          <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:8,flexShrink:0,paddingTop:2}}>
                            <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSelect(r.id)} style={{width:15,height:15,cursor:'pointer',accentColor:D.blue}}/>
                            <div style={{width:28,height:28,borderRadius:'50%',background:`rgba(217,119,6,0.15)`,border:`1px solid ${D.gold}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:D.gold}}>#{idx+1}</div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:15,fontWeight:700,color:D.text,marginBottom:5}}>{r.address}</div>
                                <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:10}}>
                                  <Tag color={D.blue}>{r.county||'—'}</Tag>
                                  {r.city&&<Tag color={D.textMuted}>{r.city}</Tag>}
                                  {r.sale_date&&<Tag color={D.textMuted}>{fmtDate(r.sale_date)}</Tag>}
                                </div>
                                <StreetViewPhoto address={`${r.address}, ${r.city||''}, NY`}/>
                              </div>
                              {r.score&&<div style={{textAlign:'right' as const,flexShrink:0}}>
                                <div style={{fontSize:10,color:D.textMuted,letterSpacing:'.06em',marginBottom:2}}>MATCH</div>
                                <div style={{fontSize:20,fontWeight:700,color:scoreColor(r.score)}}>{r.score}</div>
                                <div style={{width:40,height:3,background:D.surface2,borderRadius:2,marginTop:3}}><div style={{height:'100%',background:scoreColor(r.score),borderRadius:2,width:`${r.score}%`}}/></div>
                              </div>}
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px 16px',marginBottom:12}}>
                              {sc('Building SF', r.building_sf?Number(r.building_sf).toLocaleString()+' SF':null)}
                              {sc('Lot Size', r.lot_size_ac?r.lot_size_ac+' AC':null)}
                              {sc('Sale Price', r.sale_price?'$'+Number(r.sale_price).toLocaleString():null)}
                              {sc('Price / SF', psf?'$'+Number(psf).toFixed(2):null)}
                              {sc('Ceiling Height', r.ceiling_height)}
                              {sc('Loading Docks', r.loading_docks)}
                              {sc('Drive-In Doors', r.drive_ins)}
                              {sc('Power', r.power)}
                              {sc('Heat', (r as Comp&{heat?:string}).heat)}
                              {sc('Sprinkler', (r as Comp&{sprinkler?:string}).sprinkler)}
                              {sc('Sewer', r.sewer)}
                              {sc('Parking', (r as Comp&{parking?:string}).parking)}
                              {sc('Zoning', r.zoning)}
                              {sc('RE Taxes', (r as Comp&{real_estate_taxes?:number}).real_estate_taxes?'$'+Number((r as Comp&{real_estate_taxes?:number}).real_estate_taxes).toLocaleString():null)}
                              {sc('Cap Rate', (r as Comp&{actual_cap_rate?:number}).actual_cap_rate?(r as Comp&{actual_cap_rate?:number}).actual_cap_rate+'%':null)}
                              {sc('Sale Type', r.sale_type)}
                              {sc('Buyer', r.buyer)}
                              {sc('Seller', r.seller)}
                            </div>
                            <div style={{display:'flex',gap:8,alignItems:'center',paddingTop:10,borderTop:`1px solid ${D.border}`}}>
                              {isAdded
                                ? <Tag color={D.green}>✓ Added to OPV</Tag>
                                : <button onClick={()=>setComps([...comps,r])} style={{background:`rgba(59,130,246,0.12)`,border:`1px solid rgba(59,130,246,0.25)`,borderRadius:6,color:D.blue,fontSize:12,fontWeight:700,padding:'6px 14px',cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>＋ Add to OPV</button>
                              }
                              <div style={{position:'relative'}}>
                                <button onClick={()=>setFolderDropdown(folderDropdown===r.id?null:r.id)} style={{background:'transparent',border:`1px solid ${D.border}`,borderRadius:6,color:D.textSec,fontSize:12,fontWeight:600,padding:'6px 12px',cursor:'pointer',fontFamily:"'Inter',sans-serif",display:'flex',alignItems:'center',gap:5}}>
                                  📁 Add to Folder
                                </button>
                                {folderDropdown===r.id&&(
                                  <div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:D.surface,border:`1px solid ${D.border}`,borderRadius:8,padding:6,zIndex:100,minWidth:220,boxShadow:'0 8px 32px rgba(0,0,0,.5)'}}>
                                    {folders.filter(f=>f.type==='comps').length===0&&<div style={{fontSize:11,color:D.textMuted,padding:'6px 8px'}}>No comp folders yet. Save a subject property first.</div>}
                                    {folders.filter(f=>f.type==='comps').map(f=>(
                                      <div key={f.id} onClick={()=>{
                                        const alreadyIn=f.items.find(i=>i.id===r.id)
                                        if (!alreadyIn) setFolders(folders.map(fl=>fl.id===f.id?{...fl,items:[...fl.items,r]}:fl))
                                        setFolderDropdown(null); alert(alreadyIn?'Already in this folder!':`Added to "${f.name}"`)
                                      }} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:6,cursor:'pointer',fontSize:12,color:D.text}}>
                                        <div style={{width:8,height:8,borderRadius:'50%',background:f.color,flexShrink:0}}/>{f.name}
                                      </div>
                                    ))}
                                    <div onClick={()=>{setFolderDropdown(null);setPage('folders')}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:6,cursor:'pointer',fontSize:11,color:D.blue,marginTop:4,borderTop:`1px solid ${D.border}`}}>＋ Create folder</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
              {comps.length>0&&(
                <div style={{marginTop:12,padding:'12px 16px',borderRadius:8,background:`rgba(59,130,246,0.08)`,border:`1px solid rgba(59,130,246,0.2)`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:13,fontWeight:600,color:D.text}}>{comps.length} comp{comps.length!==1?'s':''} added to OPV</span>
                  <Btn size="sm" onClick={()=>setPage('avail-search')}>Next: Avail Search →</Btn>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AVAIL SEARCH ──────────────────────────────────────────────────────────────
function AvailSearch({subject,avails,setAvails,setPage,folders,setFolders}: {subject:SubjectForm|null,avails:Avail[],setAvails:(a:Avail[])=>void,setPage:(p:string)=>void,folders:Folder[],setFolders:(f:Folder[])=>void}) {
  const [results,setResults]=useState<Avail[]>([])
  const [loading,setLoading]=useState(false)
  const [searched,setSearched]=useState(false)
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [filters,setFilters]=useState({county:'',city:'',min_sf:'',max_sf:'',min_price:'',max_price:''})
  const [showAdd,setShowAdd]=useState(false)
  const [folderDropdown, setFolderDropdown] = useState<string|null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const toggleExpand = (id:string) => setExpandedRows(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})

  const search = async () => {
    setLoading(true); setResults([]); setSearched(false)
    let q = supabase.from('market_availabilities').select('*')
    if (filters.county) q = q.eq('county', filters.county)
    if (filters.city) q = q.ilike('city', `%${filters.city}%`)
    if (filters.min_sf) q = q.gte('building_sf', Number(filters.min_sf))
    if (filters.max_sf) q = q.lte('building_sf', Number(filters.max_sf))
    if (filters.min_price) q = q.gte('asking_price', Number(filters.min_price))
    if (filters.max_price) q = q.lte('asking_price', Number(filters.max_price))
    q = q.order('created_at', {ascending:false}).limit(200)
    const {data,error} = await q
    if (error) { alert('Search error: ' + error.message); setLoading(false); return }
    setResults(data||[]); setSearched(true); setLoading(false)
  }

  const toggleSelect = (id:string) => setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const addSelected = () => {
    const toAdd = results.filter(r=>selected.has(r.id) && !avails.find(a=>a.id===r.id))
    setAvails([...avails, ...toAdd]); alert(`${toAdd.length} listing${toAdd.length!==1?'s':''} added to your OPV`); setSelected(new Set())
  }
  const sf = (k:string,v:string) => setFilters(f=>({...f,[k]:v}))
  const [newAvail,setNewAvail]=useState({address:'',city:'',county:'Nassau',building_sf:'',ceiling_height:'',loading_docks:'',drive_ins:'',asking_price:'',pricing_guidance:'',sewer:'Municipal',zoning:'',loopnet_url:''})
  const saveNewAvail = async () => {
    if (!newAvail.address) { alert('Address required'); return }
    const {data,error} = await supabase.from('market_availabilities').insert([{...newAvail,building_sf:parseFloat(newAvail.building_sf)||null,asking_price:parseFloat(newAvail.asking_price)||null,status:'Available'}]).select()
    if (error) { alert('Save error: ' + error.message); return }
    if (data) { setResults(prev=>[data[0],...prev]); setShowAdd(false); setNewAvail({address:'',city:'',county:'Nassau',building_sf:'',ceiling_height:'',loading_docks:'',drive_ins:'',asking_price:'',pricing_guidance:'',sewer:'Municipal',zoning:'',loopnet_url:''}) }
  }
  return (
    <div className="anim-in">
      <SectionTitle sub="Search active Long Island industrial listings. Add them directly from LoopNet, CoStar, or your own database.">Market Availability Search</SectionTitle>
      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20,alignItems:'start'}}>
        <div>
          <Card style={{marginBottom:14}}>
            <SL>Search Filters</SL>
            <Field label="County"><Sel value={filters.county} onChange={e=>sf('county',e.target.value)}><option value="">All Counties</option>{COUNTIES.map(c=><option key={c}>{c}</option>)}</Sel></Field>
            <Field label="City"><Input placeholder="e.g. Hauppauge" value={filters.city} onChange={e=>sf('city',e.target.value)}/></Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Field label="Min SF"><Input type="number" placeholder="0" value={filters.min_sf} onChange={e=>sf('min_sf',e.target.value)}/></Field>
              <Field label="Max SF"><Input type="number" placeholder="Any" value={filters.max_sf} onChange={e=>sf('max_sf',e.target.value)}/></Field>
              <Field label="Min Price"><Input type="number" placeholder="0" value={filters.min_price} onChange={e=>sf('min_price',e.target.value)}/></Field>
              <Field label="Max Price"><Input type="number" placeholder="Any" value={filters.max_price} onChange={e=>sf('max_price',e.target.value)}/></Field>
            </div>
            <Btn onClick={search} disabled={loading} style={{width:'100%',padding:11,background:`rgba(59,130,246,0.15)`,border:`1px solid rgba(59,130,246,0.3)`,color:D.blue}}>{loading?'Searching...':'🔍 Search Availabilities'}</Btn>
          </Card>
          <Card>
            <SL>Add New Listing</SL>
            <p style={{fontSize:12,color:D.textSec,marginBottom:12,lineHeight:1.5}}>Add listings from LoopNet, CoStar, or your own research directly to your database.</p>
            <Btn onClick={()=>setShowAdd(v=>!v)} style={{width:'100%',padding:9,fontSize:12}}>＋ Add Listing to Database</Btn>
          </Card>
          {avails.length>0&&<Card style={{marginTop:14}}>
            <SL>Added to OPV</SL>
            <div style={{fontSize:12,color:D.textSec,marginBottom:10}}>{avails.length} listing{avails.length!==1?'s':''} selected</div>
            <Btn onClick={()=>setPage('lease-comps')} style={{width:'100%',padding:10,fontSize:12}}>Next: Lease Comps →</Btn>
          </Card>}
        </div>
        <div>
          {showAdd&&(
            <Card style={{marginBottom:16,border:`1px solid rgba(217,119,6,0.25)`}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:D.gold,marginBottom:14}}>Add New Listing to Database</div>
              <Field label="Address" full><Input placeholder="85 Davids Drive, Hauppauge, NY 11788" value={newAvail.address} onChange={e=>setNewAvail(v=>({...v,address:e.target.value}))}/></Field>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <Field label="City"><Input value={newAvail.city} onChange={e=>setNewAvail(v=>({...v,city:e.target.value}))}/></Field>
                <Field label="County"><Sel value={newAvail.county} onChange={e=>setNewAvail(v=>({...v,county:e.target.value}))}>{COUNTIES.map(c=><option key={c}>{c}</option>)}</Sel></Field>
                <Field label="Building SF"><Input type="number" value={newAvail.building_sf} onChange={e=>setNewAvail(v=>({...v,building_sf:e.target.value}))}/></Field>
                <Field label="Ceiling Height"><Input placeholder='24 ft' value={newAvail.ceiling_height} onChange={e=>setNewAvail(v=>({...v,ceiling_height:e.target.value}))}/></Field>
                <Field label="Loading Docks"><Input value={newAvail.loading_docks} onChange={e=>setNewAvail(v=>({...v,loading_docks:e.target.value}))}/></Field>
                <Field label="Drive-In Doors"><Input value={newAvail.drive_ins} onChange={e=>setNewAvail(v=>({...v,drive_ins:e.target.value}))}/></Field>
                <Field label="Asking Price ($)"><Input type="number" value={newAvail.asking_price} onChange={e=>setNewAvail(v=>({...v,asking_price:e.target.value}))}/></Field>
                <Field label="Pricing Guidance"><Input placeholder="$180/SF" value={newAvail.pricing_guidance} onChange={e=>setNewAvail(v=>({...v,pricing_guidance:e.target.value}))}/></Field>
                <Field label="Zoning"><Input value={newAvail.zoning} onChange={e=>setNewAvail(v=>({...v,zoning:e.target.value}))}/></Field>
              </div>
              <Field label="LoopNet URL" full><Input placeholder="https://www.loopnet.com/..." value={newAvail.loopnet_url} onChange={e=>setNewAvail(v=>({...v,loopnet_url:e.target.value}))}/></Field>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <Btn onClick={saveNewAvail} style={{flex:1,padding:10}}>💾 Save to Database</Btn>
                <Btn variant="ghost" onClick={()=>setShowAdd(false)} style={{padding:'10px 16px'}}>Cancel</Btn>
              </div>
            </Card>
          )}
          {loading&&<Card><div style={{textAlign:'center' as const,padding:'40px'}}><div className="spin" style={{width:32,height:32,border:`2px solid ${D.border}`,borderTopColor:D.blue,borderRadius:'50%',margin:'0 auto 16px'}}/><p style={{fontSize:13,color:D.textSec}}>Searching database...</p></div></Card>}
          {!loading&&!searched&&!showAdd&&<Card style={{textAlign:'center' as const,padding:'64px 20px'}}><div style={{fontSize:48,opacity:.15,marginBottom:16}}>🔍</div><p style={{fontSize:15,fontWeight:600,marginBottom:8,color:D.text}}>Search or Add Listings</p></Card>}
          {!loading&&searched&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <span style={{fontSize:13,color:D.textSec}}>{results.length} listings found</span>
                <div style={{display:'flex',gap:8}}>
                  {results.length>0&&<Btn variant="ghost" size="sm" onClick={()=>setSelected(new Set(results.map(r=>r.id)))}>Select All</Btn>}
                  {selected.size>0&&<Btn size="sm" onClick={addSelected}>＋ Add {selected.size} to OPV</Btn>}
                </div>
              </div>
              {results.length===0?<Card style={{textAlign:'center' as const,padding:'48px 20px'}}><p style={{color:D.textSec}}>No availabilities found.</p></Card>:
              <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
                {results.map((r,idx)=>{
                  const psf=r.price_per_sf||(r.asking_price&&r.building_sf?Number(r.asking_price)/Number(r.building_sf):0)
                  const isAdded=avails.some(a=>a.id===r.id)
                  const sc=(label:string,val:unknown)=>(
                    <div key={label}>
                      <div style={{fontSize:10,fontWeight:600,color:D.textMuted,textTransform:'uppercase' as const,letterSpacing:'.06em',marginBottom:2}}>{label}</div>
                      <div style={{fontSize:12,fontWeight:600,color:D.text}}>{val?String(val):'—'}</div>
                    </div>
                  )
                  return (
                    <Card key={r.id} style={{padding:'16px 20px',border:selected.has(r.id)?`1px solid ${D.blue}`:`1px solid ${D.border}`,background:selected.has(r.id)?`rgba(59,130,246,0.05)`:D.surface}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                        <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:8,flexShrink:0,paddingTop:2}}>
                          <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSelect(r.id)} style={{width:15,height:15,cursor:'pointer',accentColor:D.blue}}/>
                          <div style={{width:28,height:28,borderRadius:'50%',background:`rgba(59,130,246,0.15)`,border:`1px solid ${D.blue}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:D.blue}}>#{idx+1}</div>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:15,fontWeight:700,color:D.text,marginBottom:5}}>{r.address||'—'}</div>
                              <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:10}}>
                                <Tag color={D.blue}>{r.county||'—'}</Tag>
                                {r.city&&<Tag color={D.textMuted}>{r.city}</Tag>}
                                {r.listing_broker&&<Tag color={D.textMuted}>{r.listing_broker}</Tag>}
                              </div>
                              <StreetViewPhoto address={`${r.address||''}, ${r.city||''}, NY`}/>
                            </div>
                            {r.asking_price&&<div style={{textAlign:'right' as const,flexShrink:0}}>
                              <div style={{fontSize:10,color:D.textMuted,letterSpacing:'.06em',marginBottom:2}}>ASKING</div>
                              <div style={{fontSize:16,fontWeight:700,color:D.blue}}>${Number(r.asking_price).toLocaleString()}</div>
                              {psf&&<div style={{fontSize:11,color:D.textSec}}>${Number(psf).toFixed(2)}/SF</div>}
                            </div>}
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px 16px',marginBottom:12}}>
                            {sc('Building SF', r.building_sf?Number(r.building_sf).toLocaleString()+' SF':null)}
                            {sc('Lot Size', r.lot_size_ac?r.lot_size_ac+' AC':null)}
                            {sc('Pricing Guidance', r.pricing_guidance)}
                            {sc('RE Taxes', (r as Avail&{real_estate_taxes?:number}).real_estate_taxes?'$'+Number((r as Avail&{real_estate_taxes?:number}).real_estate_taxes).toLocaleString():null)}
                            {sc('Ceiling Height', r.ceiling_height)}
                            {sc('Loading Docks', r.loading_docks)}
                            {sc('Drive-In Doors', r.drive_ins)}
                            {sc('Power', r.power)}
                            {sc('Heat', (r as Avail&{heat?:string}).heat)}
                            {sc('Sprinkler', (r as Avail&{sprinkler?:string}).sprinkler)}
                            {sc('Sewer', r.sewer)}
                            {sc('Parking', (r as Avail&{parking?:string}).parking)}
                            {sc('Zoning', r.zoning)}
                            {sc('Submarket', (r as Avail&{submarket?:string}).submarket)}
                          </div>
                          <div style={{display:'flex',gap:8,alignItems:'center',paddingTop:10,borderTop:`1px solid ${D.border}`}}>
                            {isAdded
                              ? <Tag color={D.green}>✓ Added to OPV</Tag>
                              : <button onClick={()=>setAvails([...avails,r])} style={{background:`rgba(59,130,246,0.12)`,border:`1px solid rgba(59,130,246,0.25)`,borderRadius:6,color:D.blue,fontSize:12,fontWeight:700,padding:'6px 14px',cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>＋ Add to OPV</button>
                            }
                            {r.loopnet_url&&<a href={r.loopnet_url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:D.blue,padding:'6px 10px',textDecoration:'none',border:`1px solid ${D.blue}33`,borderRadius:6,fontWeight:600}}>↗ LoopNet</a>}
                            <div style={{position:'relative'}}>
                              <button onClick={()=>setFolderDropdown(folderDropdown===r.id?null:r.id)} style={{background:'transparent',border:`1px solid ${D.border}`,borderRadius:6,color:D.textSec,fontSize:12,fontWeight:600,padding:'6px 12px',cursor:'pointer',fontFamily:"'Inter',sans-serif",display:'flex',alignItems:'center',gap:5}}>
                                📁 Add to Folder
                              </button>
                              {folderDropdown===r.id&&(
                                <div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:D.surface,border:`1px solid ${D.border}`,borderRadius:8,padding:6,zIndex:100,minWidth:220,boxShadow:'0 8px 32px rgba(0,0,0,.5)'}}>
                                  {folders.filter(f=>f.type==='avails').length===0&&<div style={{fontSize:11,color:D.textMuted,padding:'6px 8px'}}>No availability folders yet.</div>}
                                  {folders.filter(f=>f.type==='avails').map(f=>(
                                    <div key={f.id} onClick={()=>{
                                      const alreadyIn=f.items.find(i=>i.id===r.id)
                                      if (!alreadyIn) setFolders(folders.map(fl=>fl.id===f.id?{...fl,items:[...fl.items,r]}:fl))
                                      setFolderDropdown(null); alert(alreadyIn?'Already in this folder!':`Added to "${f.name}"`)
                                    }} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:6,cursor:'pointer',fontSize:12,color:D.text}}>
                                      <div style={{width:8,height:8,borderRadius:'50%',background:f.color,flexShrink:0}}/>{f.name}
                                    </div>
                                  ))}
                                  <div onClick={()=>{setFolderDropdown(null);setPage('folders')}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:6,cursor:'pointer',fontSize:11,color:D.blue,marginTop:4,borderTop:`1px solid ${D.border}`}}>＋ Create folder</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


// ── LEASE COMP SEARCH ─────────────────────────────────────────────────────────
function LeaseCompSearch({subject,leaseComps,setLeaseComps,setPage,folders,setFolders}: {subject:SubjectForm|null,leaseComps:LeaseComp[],setLeaseComps:(c:LeaseComp[])=>void,setPage:(p:string)=>void,folders:Folder[],setFolders:(f:Folder[])=>void}) {
  const [results,setResults]=useState<LeaseComp[]>([])
  const [loading,setLoading]=useState(false)
  const [searched,setSearched]=useState(false)
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [filters,setFilters]=useState({county:'',city:'',min_sf:'',max_sf:'',min_price:'',max_price:'',min_date:'',max_date:''})
  const [showManual,setShowManual]=useState(false)
  const [manual,setManual]=useState<Partial<LeaseComp>>({})
  const [folderDropdown, setFolderDropdown] = useState<string|null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const toggleExpand = (id:string) => setExpandedRows(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})

  const search = async () => {
    setLoading(true); setResults([]); setSearched(false)
    let q = supabase.from('lease_comps').select('*')
    if (filters.county) q = q.eq('county', filters.county)
    if (filters.city) q = q.ilike('city', `%${filters.city}%`)
    if (filters.min_sf) q = q.gte('building_sf', Number(filters.min_sf))
    if (filters.max_sf) q = q.lte('building_sf', Number(filters.max_sf))
    if (filters.min_price) q = q.gte('lease_price', Number(filters.min_price))
    if (filters.max_price) q = q.lte('lease_price', Number(filters.max_price))
    if (filters.min_date) q = q.gte('lease_date', filters.min_date)
    if (filters.max_date) q = q.lte('lease_date', filters.max_date)
    q = q.order('lease_date', {ascending:false}).limit(200)
    const {data,error} = await q
    if (error) { alert('Search error: ' + error.message); setLoading(false); return }
    setResults(data||[]); setSearched(true); setLoading(false)
  }
  const toggleSelect = (id:string) => setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const addSelected = () => {
    const toAdd = results.filter(r=>selected.has(r.id) && !leaseComps.find(c=>c.id===r.id))
    setLeaseComps([...leaseComps, ...toAdd]); alert(`${toAdd.length} lease comp${toAdd.length!==1?'s':''} added`); setSelected(new Set())
  }
  const sf = (k:string,v:string) => setFilters(f=>({...f,[k]:v}))
  const sm = (k:string,v:string) => setManual(m=>({...m,[k]:v}))
  const addManual = () => {
    if (!manual.address) { alert('Address required'); return }
    setLeaseComps([...leaseComps, {...manual, id:`manual_${Date.now()}`} as LeaseComp]); setManual({}); setShowManual(false); alert('Lease comp added manually.')
  }
  return (
    <div className="anim-in">
      <SectionTitle sub="Search lease comparables from your database, or add them manually.">Lease Comparable Search</SectionTitle>
      {!subject&&<Card style={{textAlign:'center' as const,padding:'48px 20px',marginBottom:20}}><p style={{fontSize:13,color:D.textSec,marginBottom:16}}>Save your subject property first.</p><Btn onClick={()=>setPage('subject')}>← Enter Subject Property</Btn></Card>}
      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20,alignItems:'start'}}>
        <div>
          {subject&&<Card style={{marginBottom:14,border:`1px solid rgba(217,119,6,0.25)`}}>
            <SL>Subject Property</SL>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:D.gold,marginBottom:8}}>{subject.address}</div>
            <div style={{fontSize:11,color:D.textSec}}>OPV Type: <strong style={{color:D.text}}>{subject.opvType||'sale'}</strong></div>
          </Card>}
          <Card>
            <SL>Search Filters</SL>
            <Field label="County"><Sel value={filters.county} onChange={e=>sf('county',e.target.value)}><option value="">All Counties</option>{COUNTIES.map(c=><option key={c}>{c}</option>)}</Sel></Field>
            <Field label="City"><Input placeholder="e.g. Hauppauge" value={filters.city} onChange={e=>sf('city',e.target.value)}/></Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Field label="Min SF"><Input type="number" placeholder="0" value={filters.min_sf} onChange={e=>sf('min_sf',e.target.value)}/></Field>
              <Field label="Max SF"><Input type="number" placeholder="Any" value={filters.max_sf} onChange={e=>sf('max_sf',e.target.value)}/></Field>
              <Field label="Min Rent ($/SF)"><Input type="number" placeholder="0" value={filters.min_price} onChange={e=>sf('min_price',e.target.value)}/></Field>
              <Field label="Max Rent ($/SF)"><Input type="number" placeholder="Any" value={filters.max_price} onChange={e=>sf('max_price',e.target.value)}/></Field>
              <Field label="Lease Date From"><Input type="date" value={filters.min_date} onChange={e=>sf('min_date',e.target.value)}/></Field>
              <Field label="Lease Date To"><Input type="date" value={filters.max_date} onChange={e=>sf('max_date',e.target.value)}/></Field>
            </div>
            <Btn onClick={search} disabled={loading} style={{width:'100%',padding:11}}>{loading?'Searching...':'🔎 Search Lease Comps'}</Btn>
          </Card>
          {leaseComps.length>0&&<Card style={{marginTop:14}}>
            <SL>Added to OPV</SL>
            <div style={{fontSize:12,color:D.textSec,marginBottom:10}}>{leaseComps.length} lease comp{leaseComps.length!==1?'s':''} selected</div>
            {leaseComps.map(c=>(
              <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11,padding:'5px 0',borderBottom:`1px solid ${D.border}`}}>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,color:D.text}}>{c.address}</span>
                <button onClick={()=>setLeaseComps(leaseComps.filter(x=>x.id!==c.id))} style={{background:'transparent',border:'none',color:D.red,cursor:'pointer',fontSize:13,padding:'0 4px',flexShrink:0}}>×</button>
              </div>
            ))}
            <Btn onClick={()=>setPage('folders')} style={{width:'100%',padding:10,fontSize:12,marginTop:10}}>Next: OPV Folders →</Btn>
          </Card>}
          <Btn variant="ghost" onClick={()=>setPage('folders')} style={{width:'100%',padding:10,fontSize:12,marginTop:10}}>Skip — Go to Folders →</Btn>
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <Btn variant="blue" size="sm" onClick={()=>setShowManual(!showManual)}>＋ Add Manual Lease Comp</Btn>
          </div>
          {showManual&&(
            <Card style={{marginBottom:16,border:`1px solid rgba(59,130,246,0.3)`}}>
              <SL style={{color:D.blue}}>Manual Lease Comp Entry</SL>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Field label="Address" full><Input placeholder="Street address" value={manual.address||''} onChange={e=>sm('address',e.target.value)}/></Field>
                <Field label="City"><Input placeholder="City/Town" value={manual.city||''} onChange={e=>sm('city',e.target.value)}/></Field>
                <Field label="County"><Sel value={manual.county||'Nassau'} onChange={e=>sm('county',e.target.value)}>{COUNTIES.map(c=><option key={c}>{c}</option>)}</Sel></Field>
                <Field label="Building SF"><Input type="number" value={manual.building_sf?.toString()||''} onChange={e=>sm('building_sf',e.target.value)}/></Field>
                <Field label="Ceiling Height"><Input placeholder="22'" value={manual.ceiling_height||''} onChange={e=>sm('ceiling_height',e.target.value)}/></Field>
                <Field label="Loading Docks"><Input type="number" value={manual.loading_docks||''} onChange={e=>sm('loading_docks',e.target.value)}/></Field>
                <Field label="Drive-In Doors"><Input type="number" value={manual.drive_ins||''} onChange={e=>sm('drive_ins',e.target.value)}/></Field>
                <Field label="Power"><Input placeholder="400A/3ph" value={manual.power||''} onChange={e=>sm('power',e.target.value)}/></Field>
                <Field label="Lease Rate ($/SF/yr)"><Input type="number" step="0.01" placeholder="16.00" value={manual.price_per_sf?.toString()||''} onChange={e=>sm('price_per_sf',e.target.value)}/></Field>
                <Field label="Annual Base Rent ($)"><Input type="number" value={manual.lease_price?.toString()||''} onChange={e=>sm('lease_price',e.target.value)}/></Field>
                <Field label="Lease Date"><Input type="date" value={manual.lease_date||''} onChange={e=>sm('lease_date',e.target.value)}/></Field>
                <Field label="Lease Term"><Input placeholder="3 years NNN" value={manual.lease_term||''} onChange={e=>sm('lease_term',e.target.value)}/></Field>
                <Field label="Tenant"><Input placeholder="Tenant name" value={manual.tenant||''} onChange={e=>sm('tenant',e.target.value)}/></Field>
                <Field label="Landlord"><Input placeholder="Landlord name" value={manual.landlord||''} onChange={e=>sm('landlord',e.target.value)}/></Field>
              </div>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <Btn onClick={addManual} style={{flex:1}}>＋ Add Comp</Btn>
                <Btn variant="ghost" onClick={()=>{setShowManual(false);setManual({})}} style={{flex:1}}>Cancel</Btn>
              </div>
            </Card>
          )}
          {loading&&<Card><div style={{textAlign:'center' as const,padding:'40px 20px'}}><div className="spin" style={{width:32,height:32,border:`2px solid ${D.border}`,borderTopColor:D.gold,borderRadius:'50%',margin:'0 auto 16px'}}/><p style={{fontSize:13,color:D.textSec}}>Searching lease comps...</p></div></Card>}
          {!loading&&!searched&&!showManual&&<Card style={{textAlign:'center' as const,padding:'64px 20px'}}><div style={{fontSize:48,opacity:.15,marginBottom:16}}>📋</div><p style={{fontSize:15,fontWeight:600,marginBottom:8,color:D.text}}>Search or Add Manually</p></Card>}
          {!loading&&searched&&results.length>0&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <span style={{fontSize:13,color:D.textSec}}>{results.length} results</span>
                <div style={{display:'flex',gap:8}}>
                  <Btn variant="ghost" size="sm" onClick={()=>setSelected(new Set(results.map(r=>r.id)))}>Select All</Btn>
                  {selected.size>0&&<Btn size="sm" onClick={addSelected}>＋ Add {selected.size} to OPV</Btn>}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
                {results.map((r,idx)=>{
                  const isAdded=leaseComps.some(c=>c.id===r.id)
                  const sc=(label:string,val:unknown)=>(
                    <div key={label}>
                      <div style={{fontSize:10,fontWeight:600,color:D.textMuted,textTransform:'uppercase' as const,letterSpacing:'.06em',marginBottom:2}}>{label}</div>
                      <div style={{fontSize:12,fontWeight:600,color:D.text}}>{val?String(val):'—'}</div>
                    </div>
                  )
                  return (
                    <Card key={r.id} style={{padding:'16px 20px',border:selected.has(r.id)?`1px solid ${D.blue}`:`1px solid ${D.border}`,background:selected.has(r.id)?`rgba(59,130,246,0.05)`:D.surface}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                        <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:8,flexShrink:0,paddingTop:2}}>
                          <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSelect(r.id)} style={{width:15,height:15,cursor:'pointer',accentColor:D.blue}}/>
                          <div style={{width:28,height:28,borderRadius:'50%',background:`rgba(16,185,129,0.15)`,border:`1px solid ${D.green}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:D.green}}>#{idx+1}</div>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12}}>
                            <div>
                              <div style={{fontSize:15,fontWeight:700,color:D.text,marginBottom:5}}>{r.address||'—'}</div>
                              <div style={{display:'flex',gap:6,flexWrap:'wrap' as const}}>
                                <Tag color={D.green}>{r.county||'—'}</Tag>
                                {r.city&&<Tag color={D.textMuted}>{r.city}</Tag>}
                                {r.lease_date&&<Tag color={D.textMuted}>{fmtDate(r.lease_date)}</Tag>}
                                {r.lease_term&&<Tag color={D.textMuted}>{r.lease_term}</Tag>}
                              </div>
                            </div>
                            {r.price_per_sf&&<div style={{textAlign:'right' as const,flexShrink:0}}>
                              <div style={{fontSize:10,color:D.textMuted,letterSpacing:'.06em',marginBottom:2}}>LEASE RATE</div>
                              <div style={{fontSize:18,fontWeight:700,color:D.green}}>${Number(r.price_per_sf).toFixed(2)}</div>
                              <div style={{fontSize:11,color:D.textSec}}>per SF / yr</div>
                            </div>}
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px 16px',marginBottom:12}}>
                            {sc('Building SF', r.building_sf?Number(r.building_sf).toLocaleString()+' SF':null)}
                            {sc('Annual Rent', r.lease_price?'$'+Number(r.lease_price).toLocaleString():null)}
                            {sc('Tenant', r.tenant)}
                            {sc('Landlord', r.landlord)}
                            {sc('Ceiling Height', r.ceiling_height)}
                            {sc('Loading Docks', r.loading_docks)}
                            {sc('Drive-In Doors', r.drive_ins)}
                            {sc('Power', r.power)}
                            {sc('Sewer', r.sewer)}
                            {sc('Zoning', r.zoning)}
                            {sc('Annual Escalations', r.annual_escalations)}
                            {sc('Landlord Work', r.landlord_work)}
                            {sc('Taxes PSF', r.taxes_psf?'$'+r.taxes_psf+'/SF':null)}
                            {sc('Office %', r.office_pct?r.office_pct+'%':null)}
                          </div>
                          <div style={{display:'flex',gap:8,alignItems:'center',paddingTop:10,borderTop:`1px solid ${D.border}`}}>
                            {isAdded
                              ? <Tag color={D.green}>✓ Added to OPV</Tag>
                              : <button onClick={()=>setLeaseComps([...leaseComps,r])} style={{background:`rgba(59,130,246,0.12)`,border:`1px solid rgba(59,130,246,0.25)`,borderRadius:6,color:D.blue,fontSize:12,fontWeight:700,padding:'6px 14px',cursor:'pointer',fontFamily:"'Inter',sans-serif"}}>＋ Add to OPV</button>
                            }
                            <div style={{position:'relative'}}>
                              <button onClick={()=>setFolderDropdown(folderDropdown===r.id?null:r.id)} style={{background:'transparent',border:`1px solid ${D.border}`,borderRadius:6,color:D.textSec,fontSize:12,fontWeight:600,padding:'6px 12px',cursor:'pointer',fontFamily:"'Inter',sans-serif",display:'flex',alignItems:'center',gap:5}}>
                                📁 Add to Folder
                              </button>
                              {folderDropdown===r.id&&(
                                <div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:D.surface,border:`1px solid ${D.border}`,borderRadius:8,padding:6,zIndex:100,minWidth:220,boxShadow:'0 8px 32px rgba(0,0,0,.5)'}}>
                                  {folders.filter(f=>f.type==='lease-comps').length===0&&<div style={{fontSize:11,color:D.textMuted,padding:'6px 8px'}}>No lease comp folders yet.</div>}
                                  {folders.filter(f=>f.type==='lease-comps').map(f=>(
                                    <div key={f.id} onClick={()=>{
                                      const alreadyIn=f.items.find(i=>i.id===r.id)
                                      if (!alreadyIn) setFolders(folders.map(fl=>fl.id===f.id?{...fl,items:[...fl.items,r]}:fl))
                                      setFolderDropdown(null); alert(alreadyIn?'Already in this folder!':`Added to "${f.name}"`)
                                    }} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:6,cursor:'pointer',fontSize:12,color:D.text}}>
                                      <div style={{width:8,height:8,borderRadius:'50%',background:f.color,flexShrink:0}}/>{f.name}
                                    </div>
                                  ))}
                                  <div onClick={()=>{setFolderDropdown(null);setPage('folders')}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:6,cursor:'pointer',fontSize:11,color:D.blue,marginTop:4,borderTop:`1px solid ${D.border}`}}>＋ Create folder</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SCORING ───────────────────────────────────────────────────────────────────
function Scoring({subject,comps,scoredComps,setScoredComps,setPage}: {subject:SubjectForm|null,comps:Comp[],scoredComps:Comp[],setScoredComps:(c:Comp[])=>void,setPage:(p:string)=>void}) {
  const [ran,setRan]=useState(scoredComps.length>0)
  const [overrides,setOverrides]=useState<Record<string,number>>({})
  const runScoring = () => {
    const subSize=parseFloat(subject?.size||'0')||28000; const subCeil=parseFloat(subject?.ceiling||'0')||22
    const scored = comps.map(c=>{
      const sf=c.building_sf||0; const sizeDiff=Math.abs(sf-subSize)/subSize
      const sizeScore=Math.max(0,100-(sizeDiff*200))
      const ch=parseFloat(c.ceiling_height)||0; const ceilDiff=Math.abs(ch-subCeil)
      const ceilScore=Math.max(0,100-(ceilDiff*10))
      const dockScore=c.loading_docks?80:65
      const total=Math.round(sizeScore*.35+ceilScore*.25+75*.25+dockScore*.15)
      return {...c,score:Math.min(99,Math.max(55,total))}
    }).sort((a,b)=>(b.score||0)-(a.score||0))
    setScoredComps(scored); setRan(true)
  }
  const finalScore = (c: Comp) => overrides[c.id]!==undefined?overrides[c.id]:(c.score||75)
  const scoreColor = (s:number) => s>=85?D.green:s>=70?D.gold:D.red
  return (
    <div className="anim-in">
      <SectionTitle sub="Automatically score and rank your comparable sales by similarity to the subject property.">Comparable Scoring Engine</SectionTitle>
      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:20,alignItems:'start'}}>
        <Card>
          <SL>Scoring Weights</SL>
          {([['Building Size Similarity','35%'],['Ceiling Height','25%'],['Location / Proximity','20%'],['Loading Configuration','10%'],['Year Built / Age','10%']] as [string,string][]).map(([l,w])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:10,fontSize:12}}>
              <span style={{color:D.text}}>{l}</span><span style={{color:D.gold,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{w}</span>
            </div>
          ))}
          <Divider/>
          {comps.length===0?<p style={{fontSize:12,color:D.textSec}}>Add comps from Sale Comp Search first.</p>:
          <Btn onClick={runScoring} style={{width:'100%',padding:11}}>Run Scoring →</Btn>}
          {ran&&<Btn variant="ghost" onClick={()=>setPage('analytics')} style={{width:'100%',padding:11,marginTop:10}}>Next: Analytics →</Btn>}
        </Card>
        <div>
          {!ran&&<Card style={{textAlign:'center' as const,padding:'56px 20px'}}><div style={{fontSize:40,opacity:.2,marginBottom:12}}>⭐</div><p style={{color:D.textSec}}>Click Run Scoring to rank your comparables.</p></Card>}
          {ran&&scoredComps.map((c,i)=>(
            <Card key={c.id} style={{marginBottom:10,border:`1px solid ${i===0?`rgba(217,119,6,0.3)`:D.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:i===0?`rgba(217,119,6,0.15)`:'transparent',border:`1.5px solid ${i===0?D.gold:D.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:i===0?D.gold:D.textMuted,flexShrink:0}}>#{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:3,color:D.text}}>{c.address}{c.city?`, ${c.city}`:''}</div>
                  <div style={{fontSize:11,color:D.textSec}}>{c.building_sf?`${Number(c.building_sf).toLocaleString()} SF`:''} · {c.ceiling_height||''} · {c.price_per_sf?`$${Number(c.price_per_sf).toFixed(2)}/SF`:''} · {fmtDate(c.sale_date)}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{textAlign:'center' as const}}>
                    <div style={{fontSize:10,color:D.textSec,marginBottom:3}}>Score</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:scoreColor(finalScore(c))}}>{finalScore(c)}</div>
                  </div>
                  <div style={{textAlign:'center' as const}}>
                    <div style={{fontSize:10,color:D.textSec,marginBottom:3}}>Override</div>
                    <Input type="number" min="0" max="100" placeholder="—" value={overrides[c.id]||''} onChange={e=>setOverrides(o=>({...o,[c.id]:parseInt(e.target.value)||0}))} style={{width:60,padding:'5px 8px',fontSize:12,textAlign:'center' as const}}/>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
function Analytics({comps,avails,analytics,setAnalytics,setPage}: {comps:Comp[],avails:Avail[],analytics:AnalyticsData|null,setAnalytics:(a:AnalyticsData)=>void,setPage:(p:string)=>void}) {
  const [ran,setRan]=useState(!!analytics)
  const run = () => {
    const psfs=comps.filter(c=>c.price_per_sf>0).map(c=>c.price_per_sf)
    if (psfs.length===0) { alert('Add comps with sale prices first.'); return }
    const mean=psfs.reduce((a,b)=>a+b,0)/psfs.length
    const sorted=[...psfs].sort((a,b)=>a-b)
    const median=sorted[Math.floor(sorted.length/2)]
    const std=Math.sqrt(psfs.map(p=>(p-mean)**2).reduce((a,b)=>a+b,0)/psfs.length)
    const totalSF=comps.filter(c=>c.building_sf&&c.price_per_sf).reduce((a,c)=>a+c.building_sf,0)
    const weighted=totalSF>0?comps.filter(c=>c.building_sf&&c.price_per_sf).reduce((a,c)=>a+c.price_per_sf*c.building_sf,0)/totalSF:mean
    const aPsfs=avails.filter(a=>a.price_per_sf>0).map(a=>a.price_per_sf)
    const aMean=aPsfs.length>0?aPsfs.reduce((a,b)=>a+b,0)/aPsfs.length:0
    const low=mean-std*0.5,market=mean,high=mean+std*0.5
    const suggested=Math.round(market*1.05/5)*5
    setAnalytics({mean,median,std,weighted,min:Math.min(...psfs),max:Math.max(...psfs),low,market,high,suggested,aMean,count:comps.length})
    setRan(true)
  }
  const Stat=({l,v,c,note}: {l:string,v:string,c?:string,note?:string})=>(
    <div style={{background:D.surface2,borderRadius:6,padding:'12px 14px',marginBottom:8}}>
      <div style={{fontSize:11,color:D.textSec,marginBottom:3}}>{l}</div>
      <div style={{fontSize:20,fontWeight:700,color:c||D.text,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
      {note&&<div style={{fontSize:11,color:D.textMuted,marginTop:2}}>{note}</div>}
    </div>
  )
  return (
    <div className="anim-in">
      <SectionTitle sub="Statistical analysis of your sale comps to establish value range and suggested listing price.">Analytics & Valuation</SectionTitle>
      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <Btn onClick={run} style={{padding:'10px 20px'}}>Run Analytics →</Btn>
        {ran&&<Btn variant="ghost" onClick={()=>setPage('broker-review')} style={{padding:'10px 20px'}}>Next: Broker Review →</Btn>}
      </div>
      {!ran&&<Card style={{textAlign:'center' as const,padding:'56px 20px'}}><div style={{fontSize:40,opacity:.2,marginBottom:12}}>📈</div><p style={{color:D.textSec}}>{comps.length===0?'Add comps from Sale Comp Search first.':'Click Run Analytics to calculate valuation metrics.'}</p></Card>}
      {ran&&analytics&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="anim-in">
          <Card>
            <SL>Sale Comp Statistics ({analytics.count} comps)</SL>
            <Stat l="Average Price/SF" v={`$${analytics.mean.toFixed(2)}`}/>
            <Stat l="Median Price/SF" v={`$${analytics.median.toFixed(2)}`}/>
            <Stat l="Weighted Average PSF" v={`$${analytics.weighted.toFixed(2)}`} c={D.gold} note="Weighted by building size"/>
            <Stat l="Standard Deviation" v={`$${analytics.std.toFixed(2)}`}/>
            <Stat l="Min PSF" v={`$${analytics.min.toFixed(2)}`} c={D.red}/>
            <Stat l="Max PSF" v={`$${analytics.max.toFixed(2)}`} c={D.green}/>
          </Card>
          <Card>
            <SL>Value Range Conclusion</SL>
            <Stat l="Conservative Value" v={`$${analytics.low.toFixed(2)}/SF`} c={D.red} note="Low scenario"/>
            <Stat l="Market Value" v={`$${analytics.market.toFixed(2)}/SF`} note="Most probable value"/>
            <Stat l="Optimistic Value" v={`$${analytics.high.toFixed(2)}/SF`} c={D.green} note="High scenario"/>
            <div style={{background:`rgba(217,119,6,0.1)`,border:`1px solid rgba(217,119,6,0.25)`,borderRadius:8,padding:'14px 16px',marginTop:12}}>
              <div style={{fontSize:11,color:D.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:6}}>Suggested Listing Price</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:26,fontWeight:700,color:D.gold}}>${analytics.suggested}/SF</div>
            </div>
          </Card>
          <Card>
            <SL>Market Benchmarks</SL>
            <Stat l="Avg Asking Price/SF (Listings)" v={analytics.aMean>0?`$${analytics.aMean.toFixed(2)}`:'No listings yet'} c={D.blue}/>
            <SL style={{marginTop:16}}>Price Distribution</SL>
            {comps.filter(c=>c.price_per_sf>0).map((c,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <div style={{width:80,fontSize:10,color:D.textSec,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{c.address?.split(',')[0]||'—'}</div>
                <div style={{flex:1,height:4,background:D.surface2,borderRadius:2}}><div style={{height:'100%',background:D.gold,borderRadius:2,width:`${analytics.max>analytics.min?((c.price_per_sf-analytics.min)/(analytics.max-analytics.min)*100).toFixed(0):'50'}%`}}/></div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:D.text,width:48,textAlign:'right' as const}}>${Number(c.price_per_sf).toFixed(0)}</div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}


// ── BROKER REVIEW ─────────────────────────────────────────────────────────────
function BrokerReview({subject,comps,analytics,setAnalytics,aiText,setAiText,setPage,setSubject}: {subject:SubjectForm|null,comps:Comp[],analytics:AnalyticsData|null,setAnalytics:(a:AnalyticsData)=>void,aiText:string,setAiText:(t:string)=>void,setPage:(p:string)=>void,setSubject:(s:SubjectForm)=>void}) {
  const computeAnalytics = () => {
    const psfs=comps.filter(c=>c.price_per_sf>0).map(c=>c.price_per_sf)
    if (psfs.length===0) return null
    const mean=psfs.reduce((a,b)=>a+b,0)/psfs.length
    const sorted=[...psfs].sort((a,b)=>a-b)
    const median=sorted[Math.floor(sorted.length/2)]
    const std=Math.sqrt(psfs.map(p=>(p-mean)**2).reduce((a,b)=>a+b,0)/psfs.length)
    const totalSF=comps.filter(c=>c.building_sf&&c.price_per_sf).reduce((a,c)=>a+c.building_sf,0)
    const weighted=totalSF>0?comps.filter(c=>c.building_sf&&c.price_per_sf).reduce((a,c)=>a+c.price_per_sf*c.building_sf,0)/totalSF:mean
    const low=mean-std*0.5, market=mean, high=mean+std*0.5
    const suggested=Math.round(market*1.05/5)*5
    return {mean,median,std,weighted,min:Math.min(...psfs),max:Math.max(...psfs),low,market,high,suggested,aMean:0,count:comps.length}
  }
  const a = analytics || computeAnalytics()
  const updateSubjectValue = (k: string, v: string) => {
    if (!subject) return
    setSubject({...subject, [k]: v})
  }
  return (
    <div className="anim-in">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
        <SectionTitle sub="Write your broker narrative and finalize value conclusions for the OPV report.">Broker Review</SectionTitle>
        {aiText.trim().length>50&&<Btn onClick={()=>setPage('opv-report')} style={{background:D.blue,color:'#fff',border:'none'}}>Next: Generate Package →</Btn>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:20,alignItems:'start'}}>
        <div>
          <Card style={{marginBottom:16}}>
            <SL>Analytics Summary</SL>
            {!a&&<p style={{fontSize:12,color:D.textSec}}>No comp data yet. Add sale comps first.</p>}
            {a&&<>
              {([
                ['Avg PSF',`$${a.mean.toFixed(2)}`,D.gold],
                ['Median PSF',`$${a.median.toFixed(2)}`,D.text],
                ['Weighted Avg PSF',`$${a.weighted.toFixed(2)}`,D.gold],
                ['Min PSF',`$${a.min.toFixed(2)}`,D.red],
                ['Max PSF',`$${a.max.toFixed(2)}`,D.green],
                ['Std Deviation',`$${a.std.toFixed(2)}`,D.textSec],
              ] as [string,string,string][]).map(([l,v,c])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${D.border}`,fontSize:12}}>
                  <span style={{color:D.textSec}}>{l}</span><span style={{fontWeight:700,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</span>
                </div>
              ))}
              <div style={{marginTop:12,padding:'12px 14px',borderRadius:8,background:`rgba(217,119,6,0.1)`,border:`1px solid rgba(217,119,6,0.25)`}}>
                <div style={{fontSize:10,color:D.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:4}}>Value Range</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:D.text}}>${a.low.toFixed(2)} – ${a.high.toFixed(2)}/SF</div>
                <div style={{fontSize:11,color:D.textSec,marginTop:4}}>Suggested: <strong style={{color:D.gold}}>${a.suggested}/SF</strong></div>
              </div>
              <SL style={{marginTop:16}}>Distribution</SL>
              {comps.filter(c=>c.price_per_sf>0).map((c,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                  <div style={{width:70,fontSize:9,color:D.textMuted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{c.address?.split(',')[0]}</div>
                  <div style={{flex:1,height:3,background:D.surface2,borderRadius:2}}><div style={{height:'100%',background:D.gold,borderRadius:2,width:`${a.max>a.min?((c.price_per_sf-a.min)/(a.max-a.min)*100).toFixed(0):'50'}%`}}/></div>
                  <div style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:D.textSec,width:40,textAlign:'right' as const}}>${c.price_per_sf.toFixed(0)}</div>
                </div>
              ))}
            </>}
          </Card>
          <Card>
            <SL>Value Inputs</SL>
            <Field label="Est. Value Low ($/SF)"><Input placeholder="e.g. 175" value={subject?.estimatedValueLow||''} onChange={e=>updateSubjectValue('estimatedValueLow',e.target.value)}/></Field>
            <Field label="Est. Value High ($/SF)"><Input placeholder="e.g. 210" value={subject?.estimatedValueHigh||''} onChange={e=>updateSubjectValue('estimatedValueHigh',e.target.value)}/></Field>
            {(subject?.opvType==='investment'||subject?.opvType==='Investment Sale')&&<>
              <Field label="Cap Rate Low (%)"><Input placeholder="5.5" value={subject?.capRateLow||''} onChange={e=>updateSubjectValue('capRateLow',e.target.value)}/></Field>
              <Field label="Cap Rate High (%)"><Input placeholder="7.0" value={subject?.capRateHigh||''} onChange={e=>updateSubjectValue('capRateHigh',e.target.value)}/></Field>
            </>}
            {(subject?.opvType==='lease'||subject?.opvType==='For Lease')&&<>
              <Field label="Lease PSF Low ($/SF/yr)"><Input placeholder="14.00" value={subject?.leasePsfLow||''} onChange={e=>updateSubjectValue('leasePsfLow',e.target.value)}/></Field>
              <Field label="Lease PSF High ($/SF/yr)"><Input placeholder="18.00" value={subject?.leasePsfHigh||''} onChange={e=>updateSubjectValue('leasePsfHigh',e.target.value)}/></Field>
            </>}
          </Card>
        </div>
        <Card style={{minHeight:480}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' as const,color:D.textSec}}>Broker Narrative</span>
            {aiText.trim().length>50&&<Tag color={D.green}>Ready</Tag>}
          </div>
          <textarea
            value={aiText}
            onChange={e=>setAiText(e.target.value)}
            placeholder={`Write your broker analysis here...\n\nExample structure:\n\nMARKET OVERVIEW\nThe Long Island industrial market continues to experience strong demand...\n\nLOCATION ANALYSIS\n${subject?.address||'The subject property'} benefits from...\n\nBUILDING ASSESSMENT\nThe subject improvements consist of...\n\nCOMPARABLE SALES\nBased on ${comps.length} comparable transactions...\n\nVALUE CONCLUSION\nBased on our analysis, we estimate the market value at...`}
            style={{width:'100%',minHeight:420,background:D.surface2,border:`1px solid ${D.border}`,borderRadius:8,padding:16,fontSize:13,color:D.text,lineHeight:1.85,resize:'vertical',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
          />
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <Btn variant="ghost" onClick={()=>navigator.clipboard.writeText(aiText)} style={{fontSize:11,padding:'7px 14px'}}>Copy</Btn>
            <Btn variant="ghost" onClick={()=>setAiText('')} style={{fontSize:11,padding:'7px 14px',color:D.red}}>Clear</Btn>
            {aiText.trim().length>50&&<Btn onClick={()=>setPage('opv-report')} style={{marginLeft:'auto',padding:'7px 20px',fontSize:12}}>Next: Generate Package →</Btn>}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── PHOTO SLOT (stable component, defined outside OPVReport so React doesn't remount on state changes) ──
function PhotoSlot({photoKey,defaultSrc,height=280,override,isEditing,canEdit=false,onToggleEdit,onSetPhoto,onClearPhoto,onFileUpload}: {
  photoKey:string, defaultSrc:string, height?:number,
  override:string|undefined, isEditing:boolean, canEdit?:boolean,
  onToggleEdit:()=>void, onSetPhoto:(key:string,url:string)=>void,
  onClearPhoto:(key:string)=>void, onFileUpload:(key:string,file:File)=>void,
}) {
  const [urlInput, setUrlInput] = useState('')
  const [imgError, setImgError] = useState(false)
  const src = override || defaultSrc

  // Reset error flag whenever src changes
  useEffect(()=>{ setImgError(false) }, [src])

  const applyUrl = () => {
    const v = urlInput.trim()
    if(!v) return
    // Proxy external http URLs through our server to bypass CORS / hotlink protection
    const proxied = v.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(v)}` : v
    onSetPhoto(photoKey, proxied)
    setUrlInput('')
  }

  return (
    <div style={{width:'100%',alignSelf:'stretch' as const,marginBottom:20}}>
      <div style={{width:'100%',height,borderRadius:6,overflow:'hidden' as const,background:'#f0ede6',border:'1px solid #ddd',position:'relative' as const,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {imgError ? (
          <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:6,color:'#aaa',fontSize:12,textAlign:'center' as const}}>
            <span style={{fontSize:24}}>📍</span>
            <span>No photo available</span>
            <span style={{fontSize:10}}>Click Edit Photo to add one</span>
          </div>
        ) : (
          <img src={src} alt=""
            style={{width:'100%',height:'100%',objectFit:'cover' as const,display:'block',position:'absolute' as const,inset:0}}
            onError={()=>setImgError(true)}
            onLoad={()=>setImgError(false)}/>
        )}
        {canEdit&&<button onClick={onToggleEdit} style={{position:'absolute' as const,top:8,right:8,background:'rgba(0,0,0,0.6)',color:'#fff',border:'none',borderRadius:5,padding:'5px 11px',fontSize:11,cursor:'pointer',fontWeight:600,zIndex:2}}>
          ✏️ {isEditing?'Cancel':'Edit Photo'}
        </button>}
      </div>
      {isEditing&&(
        <div style={{background:'#f7f7f5',border:'1px solid #ddd',borderTop:'none',borderRadius:'0 0 6px 6px',padding:'12px 14px',display:'flex',flexDirection:'column' as const,gap:8}}>
          <div style={{fontSize:11,fontWeight:700,color:'#555'}}>Replace Photo</div>
          <label style={{display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer',width:'fit-content'}}>
            <span style={{background:'#1a1a1a',color:'#fff',padding:'6px 14px',borderRadius:5,fontSize:11,fontWeight:600,cursor:'pointer'}}>📁 Upload from Computer</span>
            <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f) onFileUpload(photoKey,f)}}/>
          </label>
          <div style={{fontSize:10,color:'#888',fontStyle:'italic'}}>Right-click any photo online → "Save image as…" → Upload here</div>
          {override&&(
            <button onClick={()=>onClearPhoto(photoKey)} style={{background:'none',border:'1px solid #ccc',borderRadius:5,padding:'5px 10px',fontSize:11,cursor:'pointer',color:'#666',width:'fit-content'}}>
              ↺ Reset to Street View
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── OPV REPORT ────────────────────────────────────────────────────────────────
function OPVReport({subject,comps,leaseComps,avails,analytics,aiText,setPage,frozenHTML,setFrozenHTML}: {subject:SubjectForm|null,comps:Comp[],leaseComps:LeaseComp[],avails:Avail[],analytics:AnalyticsData|null,aiText:string,setPage:(p:string)=>void,frozenHTML:string|null,setFrozenHTML:(h:string|null)=>void}) {
  const today = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase()
  const [downloading, setDownloading] = useState(false)
  const [includeLeaseComps, setIncludeLeaseComps] = useState(leaseComps.length>0)
  const [includeAvails, setIncludeAvails] = useState(true)
  const [includeMarketingStrategy, setIncludeMarketingStrategy] = useState(true)
  const [includePcreProfile, setIncludePcreProfile] = useState(true)
  const [photoOverrides, setPhotoOverrides] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem('opv_photo_overrides') || '{}') } catch { return {} }
  })
  const [editingKey, setEditingKey] = useState<string|null>(null)
  const [editMode, setEditMode] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const editFrameRef = useRef<HTMLIFrameElement>(null)

  const toggleEditMode = () => {
    if (!editMode) {
      // Capture the current report HTML and load it into the edit iframe
      const html = reportRef.current?.innerHTML || ''
      const iframe = editFrameRef.current
      if (iframe) {
        const doc = iframe.contentDocument!
        doc.open()
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          html,body{margin:0;padding:60px 72px;font-family:Arial,sans-serif;font-size:13px;
            line-height:1.7;color:#1a1a1a;background:#fff;box-sizing:border-box;}
          *{box-sizing:border-box;pointer-events:auto!important;user-select:text!important;}
          table{border-collapse:collapse;width:100%;}
          td,th{padding:6px 10px;border:1px solid #ccc;font-size:11px;vertical-align:middle;}
          img{max-width:100%;height:auto;}
          [contenteditable=false]{contenteditable:true!important;}
        </style></head><body>${html}</body>
        <script>
          // Enable editing as soon as the document is parsed
          document.designMode='on';
          // Strip any contenteditable=false attributes that block editing
          document.querySelectorAll('[contenteditable]').forEach(function(el){
            el.removeAttribute('contenteditable');
          });
        </script>
        </html>`)
        doc.close()
      }
      setEditMode(true)
    } else {
      // Pull the edited HTML back out of the iframe
      const iframe = editFrameRef.current
      if (iframe?.contentDocument?.body) {
        setFrozenHTML(iframe.contentDocument.body.innerHTML)
      }
      setEditMode(false)
    }
  }

  // ── INLINE TEXT EDITING ──
  const [textEdits, setTextEdits] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem('opv_text_edits') || '{}') } catch { return {} }
  })
  const [activeTextKey, setActiveTextKey] = useState<string|null>(null)
  useEffect(() => {
    try { localStorage.setItem('opv_text_edits', JSON.stringify(textEdits)) } catch {}
  }, [textEdits])
  const getText = (key: string, def: string) => textEdits[key] !== undefined ? textEdits[key] : def
  const saveText = (key: string, val: string, def: string) => {
    if (val === def) { setTextEdits(p=>{const n={...p};delete n[key];return n}) }
    else setTextEdits(p=>({...p,[key]:val}))
    setActiveTextKey(null)
  }
  // Editable inline span — click to edit, blur to save
  const E = ({k, d, multi=false, style={}}: {k:string, d:string, multi?:boolean, style?:React.CSSProperties}) => {
    const val = getText(k, d)
    const isActive = activeTextKey === k
    const changed = textEdits[k] !== undefined
    const editStyle: React.CSSProperties = {
      background: isActive ? '#fffde7' : changed ? '#fff8e1' : 'transparent',
      border: isActive ? '1.5px solid #f59e0b' : changed ? '1px dashed #f59e0b' : '1px dashed transparent',
      borderRadius: 3, padding: isActive ? '2px 6px' : changed ? '2px 6px' : '2px 4px',
      cursor: 'text', outline: 'none', width: '100%', fontFamily: 'inherit',
      fontSize: 'inherit', color: 'inherit', lineHeight: 'inherit', resize: 'none' as const,
      ...style,
    }
    if (isActive) {
      if (multi) return <textarea autoFocus rows={Math.max(3, val.split('\n').length+1)} defaultValue={val}
        onBlur={e=>saveText(k, e.target.value, d)}
        onKeyDown={e=>{ if(e.key==='Escape'){setActiveTextKey(null)} }}
        style={{...editStyle,display:'block',minHeight:60}}/>
      return <input autoFocus type="text" defaultValue={val}
        onBlur={e=>saveText(k, e.target.value, d)}
        onKeyDown={e=>{ if(e.key==='Enter')e.currentTarget.blur(); if(e.key==='Escape'){setActiveTextKey(null)} }}
        style={editStyle}/>
    }
    return (
      <span title="Click to edit" onClick={()=>setActiveTextKey(k)}
        style={{...editStyle, display:'inline-block', minWidth:20,
          ':hover':{borderColor:'#f59e0b'}} as React.CSSProperties}>
        {val || <span style={{color:'#aaa',fontStyle:'italic'}}>Click to add text…</span>}
        {!isActive && <span className="no-print" style={{fontSize:9,marginLeft:4,color:'#bbb',verticalAlign:'middle'}}>✏</span>}
      </span>
    )
  }

  // Persist photo overrides to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem('opv_photo_overrides', JSON.stringify(photoOverrides)) } catch {}
  }, [photoOverrides])

  // Live PCRE transaction data from Supabase (last 3 years)
  type PcreRow = {address:string,city:string,property_type?:string,building_sf?:number|string,sale_price_text?:string,sale_date?:string,tenant?:string,landlord?:string,lease_price?:string,lease_date?:string}
  const [pcreSalesData, setPcreSalesData] = useState<string[][]>([])
  const [pcreLeaseData, setPcreLeaseData] = useState<string[][]>([])
  const toQtr = (ds:string) => {
    if(!ds) return '—'
    const d = new Date(ds+'T12:00:00')
    const q = Math.ceil((d.getMonth()+1)/3)
    return `${['1st','2nd','3rd','4th'][q-1]} Qtr ${d.getFullYear()}`
  }
  useEffect(()=>{
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear()-3)
    const cutoffStr = cutoff.toISOString().slice(0,10)
    supabase.from('pcre_sale_transactions').select('*').gte('sale_date',cutoffStr).order('sale_date',{ascending:false})
      .then(({data})=>{
        if(data?.length) setPcreSalesData((data as PcreRow[]).map(r=>[
          r.address||'—', r.city||'—', r.property_type||'Industrial',
          r.building_sf ? Number(r.building_sf).toLocaleString() : '—',
          r.sale_price_text||'—', toQtr(r.sale_date||'')
        ]))
      })
    supabase.from('pcre_lease_transactions').select('*').gte('lease_date',cutoffStr).order('lease_date',{ascending:false})
      .then(({data})=>{
        if(data?.length) setPcreLeaseData((data as PcreRow[]).map(r=>[
          r.address||'—', r.city||'—', r.tenant||'—',
          r.building_sf ? Number(r.building_sf).toLocaleString() : '—',
          r.lease_price||'—', toQtr(r.lease_date||'')
        ]))
      })
  },[])

  const setCustomPhoto = (key: string, url: string) => {
    setPhotoOverrides(p=>({...p,[key]:url}))
    setEditingKey(null)
  }
  const handleFileUpload = (key: string, file: File) => {
    const reader = new FileReader()
    reader.onload = e => { if(e.target?.result) setCustomPhoto(key, e.target.result as string) }
    reader.readAsDataURL(file)
  }
  const clearPhoto = (key: string) => {
    setPhotoOverrides(p=>{const n={...p};delete n[key];return n})
    setEditingKey(null)
  }
  // Shorthand to render a PhotoSlot with OPVReport state wired in
  const Photo = (photoKey: string, defaultSrc: string, height=280) => (
    <PhotoSlot
      photoKey={photoKey} defaultSrc={defaultSrc} height={height}
      override={photoOverrides[photoKey]}
      isEditing={editingKey===photoKey}
      canEdit={editMode}
      onToggleEdit={()=>setEditingKey(editingKey===photoKey?null:photoKey)}
      onSetPhoto={setCustomPhoto}
      onClearPhoto={clearPhoto}
      onFileUpload={handleFileUpload}
    />
  )

  // ── Shared export helpers ────────────────────────────────────────────────────
  const embedImages = async (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll('img'))
    await Promise.all(imgs.map(async img => {
      try {
        const src = img.getAttribute('src')
        if (!src || src.startsWith('data:')) return
        const fetchUrl = src.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(src)}` : src
        const res = await fetch(fetchUrl)
        if (!res.ok) return
        const blob = await res.blob()
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        img.setAttribute('src', b64)
      } catch { /* leave as-is */ }
    }))
  }

  const convertGrids = (root: HTMLElement) => {
    const parents = new Set<HTMLElement>()
    root.querySelectorAll<HTMLElement>('[style]').forEach(el => {
      if (el.style.display === 'grid' || el.style.gridTemplateColumns) {
        if (el.parentElement) parents.add(el.parentElement)
      }
    })
    parents.forEach(parent => {
      const gridRows = Array.from(parent.children).filter(
        c => (c as HTMLElement).style?.display === 'grid' || (c as HTMLElement).style?.gridTemplateColumns
      ) as HTMLElement[]
      if (!gridRows.length) return
      const table = document.createElement('table')
      table.setAttribute('border', '1')
      table.style.cssText = 'width:100%;border-collapse:collapse;margin-bottom:2px;'
      // First pass: determine max column count for consistent widths
      const colCounts = gridRows.map(r => r.children.length)
      const maxCols = Math.max(...colCounts)
      gridRows.forEach(row => {
        const tr = document.createElement('tr')
        const cells = Array.from(row.children)
        cells.forEach((cell, i) => {
          const td = document.createElement('td')
          const c = cell as HTMLElement
          td.innerHTML = c.innerHTML
          td.style.padding = '6px 10px'
          td.style.fontSize = '11px'
          td.style.border = '1px solid #ccc'
          td.style.verticalAlign = 'middle'
          // Lock label column width to 200px for consistent label/value split
          if (i === 0 && maxCols === 2) td.style.width = '200px'
          if (c.style.background) td.style.background = c.style.background
          if (c.style.backgroundColor) td.style.backgroundColor = c.style.backgroundColor
          if (c.style.color) td.style.color = c.style.color
          if (c.style.fontWeight) td.style.fontWeight = c.style.fontWeight
          if (c.style.textAlign) td.style.textAlign = c.style.textAlign
          // Span remaining cols if this row has fewer cells than max
          if (i === cells.length - 1 && cells.length < maxCols) {
            td.setAttribute('colspan', String(maxCols - cells.length + 1))
          }
          tr.appendChild(td)
        })
        table.appendChild(tr)
      })
      const first = gridRows[0]
      parent.insertBefore(table, first)
      gridRows.forEach(r => parent.removeChild(r))
    })
    root.querySelectorAll<HTMLElement>('[style]').forEach(el => {
      if (el.style.display === 'grid' || el.style.gridTemplateColumns) el.style.display = 'block'
    })
  }

  const cloneReport = () => {
    let clone: HTMLElement | null = null
    if (editMode && editFrameRef.current?.contentDocument?.body) {
      clone = editFrameRef.current.contentDocument.body.cloneNode(true) as HTMLElement
    } else if (reportRef.current) {
      clone = reportRef.current.cloneNode(true) as HTMLElement
    }
    if (!clone) return null
    clone.querySelectorAll('.no-print, button, input, textarea').forEach(el => el.remove())
    return clone
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      const clone = cloneReport()
      if (!clone) { setDownloading(false); return }
      await embedImages(clone)
      convertGrids(clone)

      const addr = (subject?.address || 'OPV').replace(/[^a-zA-Z0-9\s]/g,'').trim().replace(/\s+/g,'_')
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>OPV_${addr}</title>
<style>
  @page{size:8.5in 11in;margin:0.9in 1in;}
  *{box-sizing:border-box}
  html,body{background:#fff;color:#1a1a1a;font-family:Arial,sans-serif;font-size:13px;line-height:1.7;margin:0;padding:0}
  img{max-width:100%;height:auto}
  table{border-collapse:collapse;width:100%}
  td,th{padding:6px 10px;border:1px solid #ccc;font-size:11px;vertical-align:middle}
  td:first-child{font-weight:bold;width:200px;background:#f5f5f5}
  @media print{body{margin:0}}
</style></head>
<body>${clone.innerHTML}</body></html>`

      // Use a hidden iframe — avoids popup blocker entirely
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none'
      document.body.appendChild(iframe)
      const iDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iDoc) { document.body.removeChild(iframe); setDownloading(false); return }
      iDoc.open(); iDoc.write(html); iDoc.close()
      // Wait for images to fully render, then print
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      }, 800)
    } catch(e) { alert('PDF export failed: ' + (e as Error).message) }
    setDownloading(false)
  }

  if (!subject) return (
    <div className="anim-in">
      <Card style={{textAlign:'center' as const,padding:'56px 20px'}}><p style={{color:D.textSec,marginBottom:16}}>Complete the workflow before generating the OPV report.</p><Btn onClick={()=>setPage('subject')}>Start with Subject Property →</Btn></Card>
    </div>
  )

  // ── DOC STYLES ────────────────────────────────────────────────────────────────
  const doc: React.CSSProperties = {background:'#fff',color:'#1a1a1a',fontFamily:'Arial,sans-serif',fontSize:13,lineHeight:1.7}
  const gold = '#C9A227'
  const darkBg = '#2D2D2D'

  const SecHeading = ({num,title}:{num:string,title:string}) => (
    <div style={{marginBottom:20,marginTop:32,paddingBottom:8,borderBottom:`3px solid ${gold}`}}>
      <span style={{color:gold,fontWeight:700,fontSize:16,marginRight:8}}>{num}.</span>
      <span style={{fontWeight:700,fontSize:16,color:'#1a1a1a'}}>{title}</span>
    </div>
  )
  const SubHead = ({children}:{children:React.ReactNode}) => (
    <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a',margin:'20px 0 10px'}}>{children}</div>
  )
  const Bullet = ({children}:{children:React.ReactNode}) => (
    <div style={{display:'flex',gap:8,padding:'4px 0 4px 16px',fontSize:12,lineHeight:1.6}}>
      <span style={{color:gold,fontWeight:700,flexShrink:0}}>→</span>
      <span>{children}</span>
    </div>
  )
  const LabelRow = ({label,value,shade}:{label:string,value:string,shade?:boolean}) => (
    <div style={{display:'grid',gridTemplateColumns:'240px 1fr',borderBottom:'1px solid #ccc'}}>
      <div style={{background:'#EBEBEB',padding:'7px 12px',fontWeight:700,fontSize:11,color:'#1a1a1a',borderRight:'1px solid #ccc'}}>{label}</div>
      <div style={{background:shade?'#F2F2F2':'#fff',padding:'7px 12px',fontSize:11}}>{value||'—'}</div>
    </div>
  )
  const TblHeader = ({cols}:{cols:string[]}) => (
    <div style={{display:'grid',gridTemplateColumns:`repeat(${cols.length},1fr)`}}>
      {cols.map(c=><div key={c} style={{background:darkBg,color:'#fff',padding:'8px 8px',fontSize:10,fontWeight:700,textAlign:'center' as const,borderRight:'1px solid #444'}}>{c}</div>)}
    </div>
  )
  const TblRow = ({cells,shade}:{cells:string[],shade?:boolean}) => (
    <div style={{display:'grid',gridTemplateColumns:`repeat(${cells.length},1fr)`,background:shade?'#F2F2F2':'#fff'}}>
      {cells.map((c,i)=><div key={i} style={{padding:'7px 8px',fontSize:11,borderRight:'1px solid #ddd',borderBottom:'1px solid #ddd',textAlign:'center' as const}}>{c||'—'}</div>)}
    </div>
  )

  const fmt = (n:number|string|null|undefined,pre='',suf='') => n ? `${pre}${Number(n).toLocaleString()}${suf}` : '—'
  const bldgSF = parseInt(subject.size||'0')
  const valLowPsf  = parseFloat(subject.estimatedValueLow||'0')
  const valHighPsf = parseFloat(subject.estimatedValueHigh||'0')
  const avgPsf = analytics?.market || (comps.length ? comps.reduce((s,c)=>s+(c.price_per_sf||0),0)/comps.length : 0)

  const FALLBACK_SALES = [
    ['128 Spagnoli Rd','Melville','Redevelopment','150,000','$21,000,000','3rd Qtr 2025'],
    ['48 Mall Dr','Commack','Industrial','20,000','$4,700,000','2nd Qtr 2025'],
    ['22 Sutton Place','Brewster','Industrial','70,000','Undisclosed','1st Qtr 2025'],
    ['474 Grand Blvd','Westbury','Industrial','71,000','$14,250,000','4th Qtr 2024'],
    ['145 Kennedy Dr','Hauppauge','Industrial','40,000','$8,150,000','3rd Qtr 2024'],
    ['200 Central Ave','Farmingdale','Industrial','25,000','$5,875,000','2nd Qtr 2024'],
    ['218 Front St','Hempstead','Industrial','30,183','$4,750,000','1st Qtr 2024'],
    ['30 Eastern Ave','Deer Park','Industrial','11,940','$2,200,000','1st Qtr 2024'],
    ['81 Modular Ave','Commack','Industrial','30,000','$6,150,000','4th Qtr 2023'],
  ]
  const FALLBACK_LEASES = [
    ['1460 N Clinton Ave','Bay Shore','Absolute Home Contracting','2,000','$20.00 PSF','3rd Qtr 2025'],
    ['99 Seaview Blvd','Port Washington','Pyramid Flooring','9,000','$18.00 PSF','2nd Qtr 2025'],
    ['80 13th Ave','Ronkonkoma','Demil Corp','7,500','$15.00 PSF','2nd Qtr 2025'],
    ['170 Express St','Plainview','Life Plus Style Gourmet','42,000','$12.00 Gross','2nd Qtr 2025'],
    ['40 Rabro Dr','Hauppauge','Blue Point Dance','6,900','$17.40 Gross','3rd Qtr 2025'],
    ['260 Spagnoli Rd','Melville','LIBM Inc.','54,000','$17.00 Gross','2nd Qtr 2025'],
    ['47 Mall Dr','Commack','eBizware','10,000','$17.50 Gross','2nd Qtr 2025'],
    ['1980 New Highway','Farmingdale','Top Bright Inc.','26,500','$16.00 Gross','1st Qtr 2025'],
  ]
  const RECENT_SALES = pcreSalesData.length > 0 ? pcreSalesData : FALLBACK_SALES
  const RECENT_LEASES = pcreLeaseData.length > 0 ? pcreLeaseData : FALLBACK_LEASES

  return (
    <div className="anim-in">
      {/* Controls */}
      <div className="no-print" style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <SectionTitle>Generate Package</SectionTitle>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <Btn onClick={toggleEditMode} style={{padding:'9px 16px',fontSize:12,background:editMode?'rgba(16,185,129,0.15)':frozenHTML?'rgba(217,119,6,0.1)':'rgba(59,130,246,0.1)',color:editMode?D.green:frozenHTML?D.gold:D.blue,border:`1px solid ${editMode?'rgba(16,185,129,0.4)':frozenHTML?'rgba(217,119,6,0.3)':'rgba(59,130,246,0.3)'}`}}>
              {editMode ? '✅ Done Editing' : frozenHTML ? '✏️ Edit Report (edited)' : '✏️ Edit Report'}
            </Btn>
            {frozenHTML&&!editMode&&<Btn variant="ghost" onClick={()=>setFrozenHTML(null)} style={{padding:'9px 12px',fontSize:11,color:D.textMuted}}>↩ Reset</Btn>}
            <Btn onClick={downloadPDF} disabled={downloading} style={{padding:'9px 20px',fontSize:12,background:`rgba(239,68,68,0.10)`,color:'#EF4444',border:`1px solid rgba(239,68,68,0.3)`}}>
              {downloading ? 'Generating...' : '📕 Download PDF'}
            </Btn>
          </div>
        </div>
        <Card style={{padding:'14px 18px'}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' as const,color:D.textSec,marginBottom:10}}>Report Sections</div>
          <div style={{display:'flex',gap:20,flexWrap:'wrap' as const}}>
            {([
              ['Include Lease Comps', includeLeaseComps, setIncludeLeaseComps],
              ['Include Availabilities', includeAvails, setIncludeAvails],
              ['Include Marketing Strategy', includeMarketingStrategy, setIncludeMarketingStrategy],
              ['Include PCRE Profile', includePcreProfile, setIncludePcreProfile],
            ] as [string,boolean,(v:boolean)=>void][]).map(([lbl,val,setter])=>(
              <label key={lbl} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontSize:12,fontWeight:500,color:val?D.text:D.textSec}}>
                <input type="checkbox" checked={val} onChange={e=>setter(e.target.checked)} style={{width:14,height:14,cursor:'pointer',accentColor:D.gold}}/>
                {lbl}
              </label>
            ))}
          </div>
        </Card>
      </div>

      {/* Edit mode banner */}
      {editMode&&<div className="no-print" style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:8,padding:'10px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:10,fontSize:13,color:D.green}}>
        <span style={{fontSize:18}}>✏️</span>
        <span><strong>Edit Mode is on</strong> — click any text in the report to edit it. Use the photo panel below to swap photos. Click <strong>Done Editing</strong> when finished.</span>
      </div>}

      {/* Photo editing panel — React-driven, only visible in edit mode */}
      {editMode&&<div className="no-print" style={{background:D.surface2,border:`1px solid ${D.border}`,borderRadius:10,padding:16,marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase' as const,color:D.textSec,marginBottom:12}}>📸 Edit Photos</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
          <div>
            <div style={{fontSize:11,color:D.textMuted,marginBottom:4,fontWeight:600}}>Subject Property</div>
            {Photo('subject_cover',`/api/street-view?address=${encodeURIComponent(subject.address+(subject.city?', '+subject.city:'')+', NY')}`,140)}
          </div>
          {comps.map((c,i)=>(
            <div key={c.id}>
              <div style={{fontSize:11,color:D.textMuted,marginBottom:4,fontWeight:600}}>Comp {i+1}: {c.address?.split(' ').slice(0,3).join(' ')}</div>
              {Photo(`comp_${c.id}`,`/api/street-view?address=${encodeURIComponent(c.address+(c.city?', '+c.city:'')+', NY')}`,140)}
            </div>
          ))}
          {includeLeaseComps&&leaseComps.map((c,i)=>(
            <div key={c.id}>
              <div style={{fontSize:11,color:D.textMuted,marginBottom:4,fontWeight:600}}>Lease {i+1}: {c.address?.split(' ').slice(0,3).join(' ')}</div>
              {Photo(`lease_${c.id}`,`/api/street-view?address=${encodeURIComponent(c.address+(c.city?', '+c.city:'')+', NY')}`,140)}
            </div>
          ))}
          {includeAvails&&avails.map((a,i)=>(
            <div key={a.id}>
              <div style={{fontSize:11,color:D.textMuted,marginBottom:4,fontWeight:600}}>Avail {i+1}: {a.address?.split(' ').slice(0,3).join(' ')}</div>
              {Photo(`avail_${a.id}`,`/api/street-view?address=${encodeURIComponent(a.address+(a.city?', '+a.city:'')+', NY')}`,140)}
            </div>
          ))}
        </div>
      </div>}

      {/* Full OPV Document */}

      {/* Edit iframe — text editing, shown only in edit mode */}
      <iframe
        ref={editFrameRef}
        title="OPV Editor"
        style={{
          display: editMode ? 'block' : 'none',
          width: '100%', minHeight: 1400, border: '2px solid rgba(16,185,129,0.5)',
          borderRadius: 10, background: '#fff',
        }}
      />

      {!editMode && frozenHTML ? (
        /* Read mode with saved edits */
        <div ref={reportRef} className="print-area"
          dangerouslySetInnerHTML={{__html: frozenHTML}}
          style={{...doc,borderRadius:10,padding:'60px 72px',maxWidth:960,margin:'0 auto',boxShadow:'0 4px 32px rgba(0,0,0,.25)'}}
        />
      ) : !editMode ? (
      /* Normal React-rendered report */
      <div ref={reportRef} className="print-area"
        style={{...doc,borderRadius:10,padding:'60px 72px',maxWidth:960,margin:'0 auto',boxShadow:'0 4px 32px rgba(0,0,0,.25)'}}>

        {/* ── COVER PAGE ── */}
        <div style={{textAlign:'center' as const,minHeight:600,display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',marginBottom:60,paddingBottom:60,borderBottom:`3px solid ${gold}`}}>
          <div style={{fontSize:12,fontStyle:'italic',color:'#555',marginBottom:24}}><E k="tagline" d='"Complex Issues – Simple Solutions"'/></div>
          <div style={{fontSize:28,fontWeight:900,color:'#1a1a1a',letterSpacing:'.15em',marginBottom:4}}>PREMIER COMMERCIAL REAL ESTATE</div>
          <div style={{width:120,height:3,background:gold,margin:'12px auto 40px'}}/>
          <div style={{fontSize:42,fontWeight:900,color:'#1a1a1a',letterSpacing:'.08em',marginBottom:8}}>OPINION OF VALUE</div>
          <div style={{width:80,height:1,background:'#ccc',margin:'16px auto'}}/>
          <div style={{marginTop:32,marginBottom:6,fontSize:11,color:'#888',textTransform:'uppercase' as const,letterSpacing:'.1em'}}>Date Prepared</div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:32}}>{today}</div>
          <div style={{marginBottom:6,fontSize:11,color:'#888',textTransform:'uppercase' as const,letterSpacing:'.1em'}}>Property Address</div>
          <div style={{fontSize:24,fontWeight:900,color:'#1a1a1a',textTransform:'uppercase' as const,marginBottom:4}}>{subject.address}</div>
          {subject.city&&<div style={{fontSize:16,color:'#444',marginBottom:24}}>{subject.city.toUpperCase()}, NEW YORK</div>}
          {Photo('subject_cover', `/api/street-view?address=${encodeURIComponent(subject.address+(subject.city?', '+subject.city:'')+', NY')}`, 320)}
          <div style={{fontSize:10,color:'#aaa',marginBottom:8,fontStyle:'italic'}}>Property Photo  ·  {subject.address}{subject.city?', '+subject.city:''}</div>
          <div style={{width:'100%',height:1,background:'#ddd',margin:'24px 0'}}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:24,width:'100%',marginBottom:24}}>
            {[
              ['Jason Miller','Managing Principal','516.413.1690','Jmiller@pcrellc.com'],
              ['JB (Jeff) Schwartzberg','Managing Principal','516.857.8013','Jbs@pcrellc.com'],
              ['Desmond Mullins','Partner, Executive Director','631.398.5654','Dmullins@pcrellc.com'],
            ].map(([name,title,phone,email],i,arr)=>(
              <div key={name} style={{textAlign:'center' as const,padding:'0 16px',borderRight:i<arr.length-1?'1px solid #ddd':'none'}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>{name}</div>
                <div style={{fontSize:11,color:'#555',marginBottom:2}}>{title}</div>
                <div style={{fontSize:11,color:'#555',marginBottom:2}}>{phone}</div>
                <div style={{fontSize:11,color:'#555'}}>{email}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:'#666',fontStyle:'italic'}}>Premier Commercial Real Estate, LLC  |  500 N. Broadway, Suite 105, Jericho, NY 11753</div>
          <div style={{fontSize:11,color:'#666'}}>Main: 516.284.8000  |  www.pcrellc.com</div>
        </div>

        {/* ── TABLE OF CONTENTS ── */}
        <div style={{marginBottom:60,paddingBottom:60,borderBottom:'1px solid #ddd'}}>
          <div style={{textAlign:'center' as const,fontWeight:700,fontSize:18,marginBottom:20,letterSpacing:'.08em'}}>TABLE OF CONTENTS</div>
          <div style={{borderBottom:`2px solid ${gold}`,marginBottom:20}}/>
          {[
            'I.  EXECUTIVE SUMMARY',
            'II.  BUILDING DESCRIPTION',
            'III.  OPINION OF VALUE',
            ...(comps.length>0?['IV.  RECENT INVESTMENT/SALE TRANSACTIONS']:[]),
            ...(includeLeaseComps&&leaseComps.length>0?['V.  RECENT LEASE TRANSACTIONS']:[]),
            ...(includeAvails&&avails.length>0?['VI.  MARKET AVAILABILITIES']:[]),
            ...(includeMarketingStrategy?['VII.  MARKETING STRATEGY']:[]),
            ...(includePcreProfile?['VIII.  PREMIER COMMERCIAL REAL ESTATE PROFILE']:[]),
          ].map((entry,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px dotted #ccc',fontSize:13}}>
              <span>{entry}</span>
              <span style={{color:'#999'}}>{i+2}</span>
            </div>
          ))}
        </div>

        {/* ── SECTION I: EXECUTIVE SUMMARY ── */}
        <SecHeading num="I" title="EXECUTIVE SUMMARY"/>
        <div style={{marginBottom:24}}>
          <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:'0',marginBottom:20}}>
            {[
              ['PURPOSE OF OPINION:', subject.opvType==='investment'?'DETERMINE CURRENT MARKET VALUE AS AN INVESTMENT SALE':subject.opvType==='lease'?'DETERMINE CURRENT MARKET RENTAL RATE':'DETERMINE CURRENT MARKET VALUE FOR SALE'],
              ['DATE OF OPINION:', today],
              ['ADDRESS:', `${subject.address}${subject.city?', '+subject.city.toUpperCase()+', NEW YORK':''}`.toUpperCase()],
              ['COUNTY:', (subject.county||'—').toUpperCase()],
              ...(subject.municipality?[['MUNICIPALITY:', subject.municipality]]:[]),
              ...(subject.parcelId?[['PARCEL ID:', subject.parcelId]]:[]),
            ].map(([l,v])=>(
              <Fragment key={l as string}>
                <div style={{padding:'7px 0',fontWeight:700,fontSize:12,color:'#1a1a1a',borderBottom:'1px solid #eee'}}>{l as string}</div>
                <div style={{padding:'7px 0 7px 12px',fontSize:12,borderBottom:'1px solid #eee'}}>{v as string}</div>
              </Fragment>
            ))}
          </div>
          <SubHead>PROPERTY SUMMARY HIGHLIGHTS AND ASSUMPTIONS:</SubHead>
          {[
            subject.size?`The building is approximately ${Number(subject.size).toLocaleString()} sq. ft. in total.`:null,
            subject.ceiling?`Ceiling height of ${subject.ceiling}' clear.`:null,
            (subject.docks||subject.driveIn)?`${subject.docks||'—'} loading dock(s) and ${subject.driveIn||'—'} drive-in door(s).`:null,
            subject.sprinkler?`${subject.sprinkler} sprinkler system.`:null,
            subject.sewer?`Sewer: ${subject.sewer}.`:null,
            subject.power?`Electrical service: ${subject.power}.`:null,
            subject.taxes?`Real Estate Taxes are $${Number(subject.taxes).toLocaleString()} or approximately $${subject.size?(Number(subject.taxes)/Number(subject.size)).toFixed(2):'—'} PSF.`:null,
            subject.lot?`The building sits on a parcel of approximately ${subject.lot} acres.`:null,
            subject.notes||null,
          ].filter(Boolean).map((t,i)=><Bullet key={i}>{t as string}</Bullet>)}
          <SubHead>HIGHEST AND BEST USE:</SubHead>
          {subject.highestBestUse
            ? (subject.highestBestUse as string).split('\n').filter(Boolean).map((u,i)=><Bullet key={i}>{u.trim()}</Bullet>)
            : [<Bullet key="1">Manufacturing</Bullet>,<Bullet key="2">Wholesale Operation</Bullet>,<Bullet key="3">Warehouse / Distribution</Bullet>]}
        </div>

        {/* ── SECTION II: BUILDING DESCRIPTION ── */}
        <SecHeading num="II" title="BUILDING DESCRIPTION"/>
        <div style={{border:'1px solid #ccc',marginBottom:32}}>
          <LabelRow label="PROPERTY ADDRESS" value={`${subject.address}${subject.city?', '+subject.city:''}`}/>
          <LabelRow label="TOTAL BUILDING SF" value={fmt(subject.size,'',' SF')} shade/>
          {subject.officePct&&<LabelRow label="OFFICE" value={`${subject.officePct}%`}/>}
          <LabelRow label="TOTAL SITE ACREAGE" value={subject.lot?`${subject.lot} AC`:'—'} shade={!subject.officePct}/>
          <LabelRow label="CEILING HEIGHT" value={subject.ceiling?`${subject.ceiling}' clear`:'—'} shade={!!subject.officePct}/>
          <LabelRow label="DRIVE-IN DOORS" value={subject.driveIn||'—'} shade={!subject.officePct}/>
          <LabelRow label="LOADING DOCKS" value={subject.docks||'—'} shade/>
          <LabelRow label="HEAT" value={subject.heat||'—'}/>
          <LabelRow label="POWER" value={subject.power||'—'} shade/>
          <LabelRow label="PARKING" value={subject.parking||'—'}/>
          <LabelRow label="SPRINKLER SYSTEM" value={subject.sprinkler||'—'} shade/>
          <LabelRow label="SEWER CONNECTION" value={subject.sewer||'—'}/>
          <LabelRow label="ZONING" value={subject.zoning||'—'} shade/>
          <LabelRow label="REAL ESTATE TAXES" value={subject.taxes?`$${Number(subject.taxes).toLocaleString()}/yr${subject.size?` / $${(Number(subject.taxes)/Number(subject.size)).toFixed(2)} PSF`:''}`:  '—'}/>
          {subject.yearBuilt&&<LabelRow label="YEAR BUILT" value={subject.yearBuilt} shade/>}
          {subject.construction&&<LabelRow label="CONSTRUCTION" value={subject.construction}/>}
          {subject.condition&&<LabelRow label="CONDITION" value={subject.condition} shade/>}
        </div>

        {/* ── SECTION III: OPINION OF VALUE ── */}
        <SecHeading num="III" title="OPINION OF VALUE"/>
        <p style={{fontSize:13,marginBottom:16,lineHeight:1.7}}><E k="opv_intro" d="Based upon the aforementioned assumptions, our knowledge of current market conditions, and a review of the Comparables found in Section IV." multi style={{width:'100%'}}/></p>
        <div style={{display:'grid',gridTemplateColumns:'200px 1fr 1fr',border:'1px solid #ccc',marginBottom:24}}>
          <div style={{background:darkBg,color:'#fff',padding:'10px 12px',fontWeight:700,fontSize:11,borderRight:'1px solid #444'}}>Estimated Value For Sale</div>
          <div style={{background:darkBg,color:'#fff',padding:'10px 12px',fontWeight:700,fontSize:11,textAlign:'center' as const,borderRight:'1px solid #444'}}>Per SF</div>
          <div style={{background:darkBg,color:'#fff',padding:'10px 12px',fontWeight:700,fontSize:11,textAlign:'center' as const}}>Total</div>
          <div style={{background:'#EBEBEB',padding:'14px 12px',borderRight:'1px solid #ccc',borderTop:'1px solid #ccc'}}/>
          <div style={{background:'#FFF8E1',padding:'14px 12px',textAlign:'center' as const,borderRight:'1px solid #ccc',borderTop:'1px solid #ccc'}}>
            <span style={{fontSize:20,fontWeight:700,color:gold}}>
              {valLowPsf&&valHighPsf?`$${valLowPsf.toFixed(2)} – $${valHighPsf.toFixed(2)}`:avgPsf?`$${Number(avgPsf).toFixed(2)}`:'[ __________ ]'}
            </span>
          </div>
          <div style={{background:'#FFF8E1',padding:'14px 12px',textAlign:'center' as const,borderTop:'1px solid #ccc'}}>
            <span style={{fontSize:20,fontWeight:700,color:gold}}>
              {valLowPsf&&valHighPsf&&bldgSF?`$${Math.round(valLowPsf*bldgSF).toLocaleString()} – $${Math.round(valHighPsf*bldgSF).toLocaleString()}`:bldgSF&&avgPsf?`$${Math.round(bldgSF*avgPsf).toLocaleString()}`:'[ __________ ]'}
            </span>
          </div>
        </div>
        {(subject.opvType==='investment'||subject.capRateLow)&&(
          <div style={{marginBottom:24}}>
            <div style={{fontSize:13,marginBottom:12}}>The value shall be established as a function of:</div>
            <Bullet>A "Fair Market" Rental Rate for an acceptable lease term.</Bullet>
            <Bullet>An acceptable Rate of Return (Cap Rate) to the investor/Purchaser.</Bullet>
            {(subject.leasePsfLow||subject.leasePsfHigh)&&<div style={{border:'1px solid #ccc',marginTop:16}}><LabelRow label="Lease/Rental Rate (Year 1)" value={`$${subject.leasePsfLow} to $${subject.leasePsfHigh} PSF NNN`}/></div>}
            {(subject.capRateLow||subject.capRateHigh)&&<div style={{border:'1px solid #ccc',marginTop:4}}><LabelRow label="Cap Rate" value={`${subject.capRateLow}% to ${subject.capRateHigh}%`}/></div>}
          </div>
        )}

        {/* ── SECTION IV: SALE COMPS ── */}
        {comps.length>0&&<>
          <SecHeading num="IV" title={subject.opvType==='investment'?'RECENT INVESTMENT TRANSACTIONS':'RECENT SALE TRANSACTIONS'}/>
          <div style={{border:'1px solid #ccc',marginBottom:16}}>
            <TblHeader cols={['Property Address','City','Building Size (SF)','Sale Price','Price PSF']}/>
            {comps.map((c,i)=><TblRow key={c.id} shade={i%2===1} cells={[
              c.address,c.city||'',
              c.building_sf?`${Number(c.building_sf).toLocaleString()} SF`:'—',
              c.sale_price?`$${Number(c.sale_price).toLocaleString()}`:'—',
              (c.price_per_sf||(c.sale_price&&c.building_sf?Number(c.sale_price)/Number(c.building_sf):0))?`$${(c.price_per_sf||Number(c.sale_price)/Number(c.building_sf)).toFixed(2)}`:'—',
            ]}/>)}
          </div>
          <p style={{fontSize:12,color:'#555',marginBottom:24,fontStyle:'italic'}}>Each comparable transaction is detailed on the following pages.</p>
          {comps.map((c,i)=>{
            const psf = c.price_per_sf||(c.sale_price&&c.building_sf?Number(c.sale_price)/Number(c.building_sf):0)
            return (
              <div key={c.id} style={{marginBottom:48,paddingBottom:48,borderBottom:'2px dashed #ddd'}}>
                <div style={{fontWeight:700,fontSize:14,paddingBottom:8,borderBottom:`2px solid ${gold}`,marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <span>COMPARABLE {i+1}  —  {(c.address||'').toUpperCase()}{c.city?', '+c.city.toUpperCase():''}</span>
                  {psf>0&&<span style={{color:gold,fontSize:16}}>${Number(psf).toFixed(2)}/SF</span>}
                </div>
                {Photo(`comp_${c.id}`, `/api/street-view?address=${encodeURIComponent(c.address+(c.city?', '+c.city:'')+', NY')}`)}
                <div style={{border:'1px solid #ccc'}}>
                  <LabelRow label="PROPERTY ADDRESS" value={`${c.address||'—'}${c.city?', '+c.city:''}`}/>
                  <LabelRow label="BUILDING SIZE" value={fmt(c.building_sf,'',c.building_sf?' SF':'')} shade/>
                  {c.lot_size_ac&&<LabelRow label="LOT SIZE" value={`${c.lot_size_ac} Acres`}/>}
                  <LabelRow label="CEILING HEIGHT" value={c.ceiling_height?`${c.ceiling_height} ft`:'—'} shade={!!c.lot_size_ac}/>
                  <LabelRow label="LOADING DOCKS" value={c.loading_docks||'—'} shade={!c.lot_size_ac}/>
                  <LabelRow label="DRIVE INS" value={c.drive_ins||'—'} shade={!!c.lot_size_ac}/>
                  {c.power&&<LabelRow label="POWER" value={c.power as string} shade={!c.lot_size_ac}/>}
                  {c.sewer&&<LabelRow label="SEWERS" value={c.sewer} shade={!!c.power}/>}
                  {(c as any).heat&&<LabelRow label="HEAT" value={(c as any).heat}/>}
                  {c.zoning&&<LabelRow label="ZONING" value={c.zoning} shade/>}
                  <LabelRow label="SALE PRICE" value={`${fmt(c.sale_price,'$')}${psf?` ($${Number(psf).toFixed(2)} PSF)`:''}`}/>
                  <LabelRow label="TRANSACTION DATE" value={c.sale_date?new Date(c.sale_date).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'—'} shade/>
                  {c.buyer&&<LabelRow label="BUYER" value={c.buyer}/>}
                  {c.seller&&<LabelRow label="SELLER" value={c.seller} shade/>}
                </div>
              </div>
            )
          })}
        </>}

        {/* ── SECTION V: LEASE COMPS ── */}
        {includeLeaseComps&&leaseComps.length>0&&<>
          <SecHeading num="V" title="RECENT LEASE TRANSACTIONS"/>
          <div style={{border:'1px solid #ccc',marginBottom:16}}>
            <TblHeader cols={['Property Address','City','Building Size (SF)','Lease Price (PSF)']}/>
            {leaseComps.map((c,i)=><TblRow key={c.id} shade={i%2===1} cells={[
              c.address,c.city||'',
              c.building_sf?`${Number(c.building_sf).toLocaleString()} SF`:'—',
              c.lease_price?`$${Number(c.lease_price).toFixed(2)} PSF NNN`:c.price_per_sf?`$${Number(c.price_per_sf).toFixed(2)} PSF NNN`:'—',
            ]}/>)}
          </div>
          {leaseComps.map((c,i)=>(
            <div key={c.id} style={{marginBottom:48,paddingBottom:48,borderBottom:'2px dashed #ddd'}}>
              <div style={{fontWeight:700,fontSize:14,paddingBottom:8,borderBottom:`2px solid ${gold}`,marginBottom:16}}>
                LEASE COMPARABLE {i+1}  —  {(c.address||'').toUpperCase()}{c.city?', '+c.city.toUpperCase():''}
              </div>
              {Photo(`lease_${c.id}`, `/api/street-view?address=${encodeURIComponent(c.address+(c.city?', '+c.city:'')+', NY')}`)}
              <div style={{border:'1px solid #ccc'}}>
                <LabelRow label="PROPERTY ADDRESS" value={`${c.address||'—'}${c.city?', '+c.city:''}`}/>
                <LabelRow label="BUILDING SIZE" value={fmt(c.building_sf,'',c.building_sf?' SF':'')} shade/>
                <LabelRow label="CEILING HEIGHT" value={c.ceiling_height?`${c.ceiling_height} ft`:'—'}/>
                <LabelRow label="LOADING DOCKS" value={c.loading_docks||'—'} shade/>
                <LabelRow label="DRIVE INS" value={c.drive_ins||'—'}/>
                <LabelRow label="LEASE PRICE" value={c.lease_price?`$${Number(c.lease_price).toFixed(2)} PSF NNN`:c.price_per_sf?`$${Number(c.price_per_sf).toFixed(2)} PSF NNN`:'—'} shade/>
                {c.lease_term&&<LabelRow label="TERM" value={c.lease_term}/>}
                {c.annual_escalations&&<LabelRow label="ESCALATIONS" value={c.annual_escalations} shade/>}
                {c.tenant&&<LabelRow label="TENANT" value={c.tenant}/>}
                {c.landlord&&<LabelRow label="LANDLORD" value={c.landlord} shade/>}
                {c.comments&&<LabelRow label="COMMENTS" value={c.comments}/>}
              </div>
            </div>
          ))}
        </>}

        {/* ── SECTION VI: MARKET AVAILABILITIES ── */}
        {includeAvails&&avails.length>0&&<>
          <SecHeading num="VI" title="MARKET AVAILABILITIES"/>
          <div style={{border:'1px solid #ccc',marginBottom:16}}>
            <TblHeader cols={['Property Address','City','Bldg SF','Lot Size','Asking Price','Price PSF']}/>
            {avails.map((a,i)=><TblRow key={a.id} shade={i%2===1} cells={[
              a.address,a.city||'',
              a.building_sf?`${Number(a.building_sf).toLocaleString()} SF`:'—',
              a.lot_size_ac?`${a.lot_size_ac} AC`:'—',
              a.asking_price?`$${Number(a.asking_price).toLocaleString()}`:'—',
              a.asking_price&&a.building_sf?`$${(Number(a.asking_price)/Number(a.building_sf)).toFixed(2)}`:'—',
            ]}/>)}
          </div>
          <p style={{fontSize:12,color:'#555',marginBottom:24,fontStyle:'italic'}}>Each market availability is detailed on the following pages.</p>
          {avails.map((a,i)=>{
            const psf = a.price_per_sf||(a.asking_price&&a.building_sf?Number(a.asking_price)/Number(a.building_sf):0)
            return (
              <div key={a.id} style={{marginBottom:48,paddingBottom:48,borderBottom:'2px dashed #ddd'}}>
                <div style={{fontWeight:700,fontSize:14,paddingBottom:8,borderBottom:`2px solid ${gold}`,marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <span>AVAILABILITY {i+1}  —  {(a.address||'').toUpperCase()}{a.city?', '+a.city.toUpperCase():''}</span>
                  {psf>0&&<span style={{color:'#3b82f6',fontSize:16}}>${Number(psf).toFixed(2)}/SF</span>}
                </div>
                {Photo(`avail_${a.id}`, `/api/street-view?address=${encodeURIComponent(a.address+(a.city?', '+a.city:'')+', NY')}`)}
                <div style={{border:'1px solid #ccc'}}>
                  <LabelRow label="PROPERTY ADDRESS" value={`${a.address||'—'}${a.city?', '+a.city:''}`}/>
                  <LabelRow label="BUILDING SIZE" value={fmt(a.building_sf,'',a.building_sf?' SF':'')} shade/>
                  {a.lot_size_ac&&<LabelRow label="LOT SIZE" value={`${a.lot_size_ac} Acres`}/>}
                  <LabelRow label="CEILING HEIGHT" value={a.ceiling_height?`${a.ceiling_height} ft`:'—'} shade={!!a.lot_size_ac}/>
                  <LabelRow label="LOADING DOCKS" value={a.loading_docks||'—'} shade={!a.lot_size_ac}/>
                  <LabelRow label="DRIVE INS" value={a.drive_ins||'—'} shade={!!a.lot_size_ac}/>
                  {a.power&&<LabelRow label="POWER" value={a.power}/>}
                  {a.sewer&&<LabelRow label="SEWERS" value={a.sewer} shade/>}
                  <LabelRow label="ASKING PRICE" value={a.asking_price?`$${Number(a.asking_price).toLocaleString()}`:'—'} shade={!a.sewer}/>
                  <LabelRow label="ASKING $/SF" value={psf?`$${Number(psf).toFixed(2)} PSF`:'—'} shade/>
                  {a.pricing_guidance&&<LabelRow label="PRICING GUIDANCE" value={a.pricing_guidance}/>}
                  {a.listing_broker&&<LabelRow label="LISTING BROKER" value={a.listing_broker} shade/>}
                </div>
              </div>
            )
          })}
        </>}

        {/* ── AI TEXT ── */}
        {aiText&&<>
          <SecHeading num="" title="MARKET COMMENTARY & BROKER ANALYSIS"/>
          <div style={{fontSize:13,lineHeight:1.85,whiteSpace:'pre-wrap' as const,marginBottom:32}}>{aiText}</div>
        </>}

        {/* ── SECTION VII: MARKETING STRATEGY ── */}
        {includeMarketingStrategy&&<>
          <SecHeading num="VII" title="MARKETING STRATEGY"/>
          <SubHead>FOCUSED DEDICATION / HARD WORK… TO INCLUDE:</SubHead>
          <Bullet><E k="mkt1" d='PREMIER COMMERCIAL REAL ESTATE will prepare electronic marketing material and meet with selected "Highly qualified" buyers.'/></Bullet>
          <Bullet><E k="mkt2" d="PREMIER COMMERCIAL REAL ESTATE will distribute e-Blast marketing flyers to the local brokerage community (including the outer NYC Boroughs)."/></Bullet>
          <Bullet><E k="mkt3" d="PREMIER COMMERCIAL REAL ESTATE will prepare all proposals and respond to proposals submitted by prospective purchasers after receiving authorization from ownership."/></Bullet>
          <Bullet><E k="mkt4" d="PREMIER COMMERCIAL REAL ESTATE will conduct all site inspections and conduct marketing presentations for purchasers."/></Bullet>
          <Bullet><E k="mkt5" d="PREMIER COMMERCIAL REAL ESTATE will implement and follow up on a direct marketing program including: Identification of qualified prospects; Mailings (electronic and regular) to prospective Investors; Regular follow-up phone canvassing; Regular follow-up &quot;in-person&quot; canvassing; and Follow-up correspondence."/></Bullet>
          <SubHead>HOW DOES PARTNERING WITH PREMIER DIFFER FROM "THE CROWD"?</SubHead>
          <Bullet><E k="diff1" d='We always maintain a "Client First" philosophy.'/></Bullet>
          <Bullet><E k="diff2" d="We view our clients as &quot;Partners&quot; – our economic interests are precisely aligned."/></Bullet>
          <Bullet><E k="diff3" d="Industrial leasing & sales are all that we do."/></Bullet>
          <Bullet><E k="diff4" d='Our market knowledge is "top in the business" which will serve us to maximize value.'/></Bullet>
          <Bullet><E k="diff5" d="Combined over 40 years experience – specializing in Industrial Properties (Total Sales Transactions exceed $500 Million)."/></Bullet>
          <Bullet><E k="diff6" d="In 2020 we brokered the largest industrial sales transactions in both Suffolk and Nassau counties ($35.5 Million and $33 Million respectively)."/></Bullet>
          <Bullet><E k="diff7" d="We have built strong relationships with highly qualified purchasers and investors over several decades."/></Bullet>
          <Bullet><E k="diff8" d='We are recognized as "leaders" within the commercial brokerage community.'/></Bullet>
        </>}

        {/* ── SECTION VIII: PCRE PROFILE ── */}
        {includePcreProfile&&<>
          <SecHeading num="VIII" title="PREMIER COMMERCIAL REAL ESTATE PROFILE"/>
          <p style={{fontSize:13,lineHeight:1.8,marginBottom:12}}><E k="pcre_p1" d="Premier Commercial Real Estate, LLC is a full-service commercial real estate service provider offering personalized and strategic solutions for investors, property owners, tenants and diverse businesses. With a laser-sharp focus on, and in-depth knowledge of the Long Island market, Premier's seasoned professionals work together as a team to identify the best real estate opportunities for its clients." multi style={{width:'100%'}}/></p>
          <p style={{fontSize:13,lineHeight:1.8,marginBottom:24}}><E k="pcre_p2" d="From property sales and leasing to tax-advantaged 1031 exchanges and portfolio development, Premier applies the full force of its experience, know-how and network to effectively achieve the real estate goals of its clients." multi style={{width:'100%'}}/></p>
          <SubHead>PCRE'S SAMPLE OF OUR RECENTLY COMPLETED SALES TRANSACTIONS</SubHead>
          <div style={{border:'1px solid #ccc',marginBottom:24}}>
            <TblHeader cols={['Property Address','City','Property Type','Building Size (SF)','Sale Price','Transaction Date']}/>
            {RECENT_SALES.map((row,i)=><TblRow key={i} shade={i%2===1} cells={row}/>)}
          </div>
          <SubHead>PCRE'S SAMPLE OF OUR RECENTLY COMPLETED LEASE TRANSACTIONS</SubHead>
          <div style={{border:'1px solid #ccc',marginBottom:32}}>
            <TblHeader cols={['Property Address','City','Tenant','Leased SF','Lease Price (PSF)','Transaction Date']}/>
            {RECENT_LEASES.map((row,i)=><TblRow key={i} shade={i%2===1} cells={row}/>)}
          </div>
          {/* Jason bio */}
          <div style={{marginBottom:32,paddingBottom:32,borderBottom:'1px solid #eee'}}>
            <div style={{fontWeight:900,fontSize:20,paddingBottom:6,borderBottom:`2px solid ${gold}`,marginBottom:8}}>JASON D. MILLER</div>
            <div style={{fontWeight:600,fontSize:13,color:'#555',marginBottom:12}}>Managing Principal</div>
            <p style={{fontSize:12,lineHeight:1.8,marginBottom:8}}>Jason Miller is Co-Founder and Managing Principal at Premier Commercial Real Estate with over 17 years experience, and is widely recognized as one of Long Island's top commercial real estate professionals.</p>
            <p style={{fontSize:12,lineHeight:1.8,marginBottom:8}}>Mr. Miller began his real estate career as a Sales Associate at Sutton & Edwards Inc (now Colliers International, LI Inc.) and was quickly promoted to the position of Senior Director, Industrial Properties for Long Island. In October of 2013, along with his partner Jeff Schwartzberg, he created Premier Commercial Real Estate, a brokerage firm strictly focused on delivering ultimate customer service.</p>
            <p style={{fontSize:12,lineHeight:1.8}}>Since Premier's inception, Jason and his company have received a number of the industry's top awards, including: "Commercial Brokerage Company of the Year" (LIBN 2015); Largest Industrial Sales Transactions in Nassau and Suffolk Counties (2015 & 2016); and Co-Star Power Broker Award each year.</p>
          </div>
          {/* Jeff bio */}
          <div style={{marginBottom:32}}>
            <div style={{fontWeight:900,fontSize:20,paddingBottom:6,borderBottom:`2px solid ${gold}`,marginBottom:8}}>JEFFREY SCHWARTZBERG</div>
            <div style={{fontWeight:600,fontSize:13,color:'#555',marginBottom:12}}>Managing Principal</div>
            <p style={{fontSize:12,lineHeight:1.8,marginBottom:8}}>JB (Jeff) Schwartzberg, Co-Founder and Managing Principal at Premier Commercial Real Estate, has developed a vast background and proven track record in commercial real estate spanning over three decades. Mr. Schwartzberg brings that knowledge to Premier, leading its day-to-day business operations.</p>
            <p style={{fontSize:12,lineHeight:1.8,marginBottom:8}}>Before becoming a full time Broker, Jeff enjoyed a successful and extensive 20-year career, holding several key "senior executive" positions in the Defense Industry. Immediately prior to creating Premier in 2013, Mr. Schwartzberg spent more than a decade with Colliers International, ultimately rising to the position of Senior Executive Director, Industrial Properties-Long Island.</p>
            <p style={{fontSize:12,lineHeight:1.8}}>He has been named a Co-Star "Power Broker" every year and has participated in industrial property sales and leases involving millions of square feet. In 2023, Jeff was honored & received Long Island Business News' most prestigious award "Top Commercial Broker on Long Island."</p>
          </div>
        </>}

        {/* Disclaimer */}
        <div style={{borderTop:'1px solid #ddd',paddingTop:16,marginTop:16,fontSize:10,color:'#999',lineHeight:1.7}}>
          <strong>DISCLAIMER:</strong> This Opinion of Value has been prepared by Premier Commercial Real Estate for informational purposes only and does not constitute a certified appraisal. It is based upon data available at the time of preparation and may not reflect subsequent market changes. This report should not be relied upon as a substitute for a formal appraisal by a licensed appraiser.
        </div>
      </div>
      ) : null}
    </div>
  )
}

// ── SIDEBAR NAV ITEMS ─────────────────────────────────────────────────────────
const PAGE_TITLES: Record<string,string> = {
  dashboard:'Dashboard',assignment:'Assignment',subject:'Subject Property',
  'comp-search':'Sale Comps','avail-search':'Market Availabilities',
  'lease-comps':'Lease Comps','broker-review':'Broker Analysis',
  'opv-report':'Generate Package',folders:'OPV Folders',
  analytics:'Analytics',database:'Database Manager',
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState<{name:string,role:string,init:string}>({name:'Premier',role:'Commercial Broker',init:'PC'})
  const [page,setPage]=useState('dashboard')
  const [assignmentData,setAssignmentData]=useState<AssignmentData>(()=>{
    if(typeof window==='undefined') return {clientName:'',propertyAddress:'',opvType:'For Sale',dueDate:'',preparedBy:'',notes:''}
    try{return JSON.parse(localStorage.getItem('opv_assignment')||'null')||{clientName:'',propertyAddress:'',opvType:'For Sale',dueDate:'',preparedBy:'',notes:''}}catch{return {clientName:'',propertyAddress:'',opvType:'For Sale',dueDate:'',preparedBy:'',notes:''}}
  })
  const [subject,setSubject]=useState<SubjectForm|null>(()=>{
    if(typeof window==='undefined') return null
    try{return JSON.parse(localStorage.getItem('opv_subject')||'null')}catch{return null}
  })
  const [comps,setComps]=useState<Comp[]>(()=>{
    if(typeof window==='undefined') return []
    try{return JSON.parse(localStorage.getItem('opv_comps')||'[]')}catch{return []}
  })
  const [avails,setAvails]=useState<Avail[]>(()=>{
    if(typeof window==='undefined') return []
    try{return JSON.parse(localStorage.getItem('opv_avails')||'[]')}catch{return []}
  })
  const [leaseComps,setLeaseComps]=useState<LeaseComp[]>(()=>{
    if(typeof window==='undefined') return []
    try{return JSON.parse(localStorage.getItem('opv_lease_comps')||'[]')}catch{return []}
  })
  const [scoredComps,setScoredComps]=useState<Comp[]>([])
  const [analytics,setAnalytics]=useState<AnalyticsData|null>(()=>{
    if(typeof window==='undefined') return null
    try{return JSON.parse(localStorage.getItem('opv_analytics')||'null')}catch{return null}
  })
  const [aiText,setAiText]=useState<string>(()=>{
    if(typeof window==='undefined') return ''
    try{return localStorage.getItem('opv_aitext')||''}catch{return ''}
  })
  const [photoUrls,setPhotoUrls]=useState<Record<string,string>>(()=>{
    if(typeof window==='undefined') return {}
    try{return JSON.parse(localStorage.getItem('opv_photos')||'{}')}catch{return {}}
  })
  const [verificationStatus,setVerificationStatus]=useState<Record<string,VerifyStatus>>(()=>{
    if(typeof window==='undefined') return {}
    try{return JSON.parse(localStorage.getItem('opv_verification')||'{}')}catch{return {}}
  })
  const [reports,setReports]=useState<OPVReportData[]>([])
  const [savedOPVId,setSavedOPVId]=useState<string|null>(()=>{
    if(typeof window==='undefined') return null
    return localStorage.getItem('opv_saved_id')||null
  })
  const [lastSaved,setLastSaved]=useState<Date|null>(null)
  const [saving,setSaving]=useState(false)
  const [savedOPVs,setSavedOPVs]=useState<{id:string,address:string,current_step:string,updated_at:string,saved_by:string}[]>([])
  const [showSavedPanel,setShowSavedPanel]=useState(false)
  const [editedReportHTML,setEditedReportHTML]=useState<string|null>(null)

  // Save editedReportHTML to localStorage whenever it's set — never delete on state clear
  useEffect(()=>{
    if (!savedOPVId || !editedReportHTML) return
    try { localStorage.setItem(`opv_edited_html_${savedOPVId}`, editedReportHTML) } catch {}
  }, [editedReportHTML, savedOPVId])

  const [folders,setFolders]=useState<Folder[]>(()=>{
    if (typeof window==='undefined') return []
    try { return JSON.parse(localStorage.getItem('opv_folders')||'[]') } catch { return [] }
  })

  const updateFolders = useCallback((f: Folder[]|((prev:Folder[])=>Folder[])) => {
    setFolders(prev => {
      const next = typeof f==='function' ? f(prev) : f
      try { localStorage.setItem('opv_folders', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Autosave effects
  useEffect(()=>{try{localStorage.setItem('opv_assignment',JSON.stringify(assignmentData))}catch{}},[assignmentData])
  useEffect(()=>{try{localStorage.setItem('opv_subject',JSON.stringify(subject))}catch{}},[subject])
  useEffect(()=>{try{localStorage.setItem('opv_comps',JSON.stringify(comps))}catch{}},[comps])
  useEffect(()=>{try{localStorage.setItem('opv_avails',JSON.stringify(avails))}catch{}},[avails])
  useEffect(()=>{try{localStorage.setItem('opv_lease_comps',JSON.stringify(leaseComps))}catch{}},[leaseComps])
  useEffect(()=>{if(savedOPVId)try{localStorage.setItem('opv_saved_id',savedOPVId)}catch{}},[savedOPVId])
  useEffect(()=>{try{localStorage.setItem('opv_analytics',JSON.stringify(analytics))}catch{}},[analytics])
  useEffect(()=>{try{localStorage.setItem('opv_aitext',aiText)}catch{}},[aiText])
  useEffect(()=>{try{localStorage.setItem('opv_photos',JSON.stringify(photoUrls))}catch{}},[photoUrls])
  useEffect(()=>{try{localStorage.setItem('opv_verification',JSON.stringify(verificationStatus))}catch{}},[verificationStatus])

  const handleSetPage=useCallback((p:string)=>setPage(p),[])

  if (!user) return null

  // Step completion logic
  const completedSteps: Record<string,boolean> = {
    assignment: assignmentData.propertyAddress !== '',
    subject: subject !== null,
    'comp-search': comps.length > 0,
    'avail-search': avails.length > 0,
    'lease-comps': leaseComps.length > 0,
    photos: false,
    verification: Object.values(verificationStatus).some(v => v === 'verified'),
    'broker-review': aiText.trim().length > 50,
    'opv-report': false,
  }

  const saveReport=async(silent=false)=>{
    if(!subject){if(!silent)alert('Enter a subject property address first.');return}
    setSaving(true)
    try {
      const res = await fetch('/api/opv-history',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({savedBy:user.name, address:subject.address, subject, comps, leaseComps, avails, analytics, aiText, currentStep:page, existingId:savedOPVId, assignmentData, folders})
      })
      const data = await res.json()
      if(data.error) throw new Error(data.error)
      setSavedOPVId(data.id)
      setLastSaved(new Date())
      setReports(r=>[{id:Date.now(),subject,comps,avails,analytics,date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})},...r])
      if(!silent) alert('✓ OPV progress saved.')
    } catch(e) { if(!silent) alert('Save failed: '+(e as Error).message) }
    setSaving(false)
  }

  // Auto-save every 2 minutes when a subject property exists
  const saveReportRef = useRef(saveReport)
  useEffect(() => { saveReportRef.current = saveReport })
  useEffect(() => {
    const id = setInterval(() => {
      if (saveReportRef.current) saveReportRef.current(true)
    }, 120000)
    return () => clearInterval(id)
  }, [])

  const restoreOPV=async(id:string)=>{
    try {
      const res = await fetch(`/api/opv-history?id=${id}`,{method:'PATCH'})
      const data = await res.json()
      if(data.error) throw new Error(data.error)
      if(data.subject) setSubject(data.subject)
      if(data.comps?.length) setComps(data.comps)
      if(data.leaseComps?.length) setLeaseComps(data.leaseComps)
      if(data.avails?.length) setAvails(data.avails)
      if(data.analytics) setAnalytics(data.analytics)
      if(data.aiText) setAiText(data.aiText)
      if(data.assignmentData) setAssignmentData(data.assignmentData)
      if(data.folders?.length) updateFolders(data.folders)
      // Restore edited report HTML from localStorage
      try {
        const localHTML = localStorage.getItem(`opv_edited_html_${id}`)
        setEditedReportHTML(localHTML || null)
      } catch { setEditedReportHTML(null) }
      setSavedOPVId(id)
      setLastSaved(new Date(data.updatedAt||data.createdAt))
      setShowSavedPanel(false)
      setPage(data.currentStep||'subject')
    } catch(e) { alert('Load failed: '+(e as Error).message) }
  }

  const loadSavedOPVs=async()=>{
    try {
      const res = await fetch('/api/opv-history')
      const data = await res.json()
      if(data.error) throw new Error(data.error)
      setSavedOPVs(data.reports||[])
    } catch {}
  }

  const startNewOPV=()=>{
    if(!confirm('Start a new OPV? Your current progress is saved — you can reload it anytime.')) return
    setSubject(null)
    setComps([])
    setLeaseComps([])
    setAvails([])
    setScoredComps([])
    setAnalytics(null)
    setAiText('')
    setAssignmentData({clientName:'',propertyAddress:'',opvType:'For Sale',dueDate:'',preparedBy:'',notes:''})
    setPhotoUrls({})
    setVerificationStatus({})
    setFolders([])
    setEditedReportHTML(null)
    setSavedOPVId(null)
    setLastSaved(null)
    try{localStorage.removeItem('opv_saved_id')}catch{}
    setPage('assignment')
  }

  const isWorkflowPage = WORKFLOW_STEPS.some(s=>s.id===page)

  // Sidebar step items
  const sidebarWorkflow = WORKFLOW_STEPS.map((s,i) => ({...s, index:i}))

  return (
    <>
      <style>{css}</style>
      <div style={{display:'flex',minHeight:'100vh',background:D.bg}}>
        {/* ── SIDEBAR ── */}
        <div className="no-print" style={{width:240,flexShrink:0,background:D.surface,borderRight:`1px solid ${D.border}`,display:'flex',flexDirection:'column',minHeight:'100vh',position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
          {/* Brand */}
          <div style={{padding:'20px 18px 16px',borderBottom:`1px solid ${D.border}`}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:D.text,marginBottom:3}}>Premier OPV</div>
            <div style={{fontSize:9,color:D.textMuted,letterSpacing:'.14em',textTransform:'uppercase' as const}}>Long Island Industrial</div>
          </div>
          {/* User */}
          <div style={{padding:'12px 18px',borderBottom:`1px solid ${D.border}`,display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:D.blue,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#FFFFFF',flexShrink:0}}>{user.init}</div>
            <div><div style={{fontSize:12,fontWeight:600,color:D.text}}>{user.name}</div><div style={{fontSize:10,color:D.textMuted}}>{user.role}</div></div>
          </div>
          {/* Nav */}
          <div style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
            {/* Workflow section */}
            <div style={{fontSize:9,fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase' as const,color:D.textMuted,padding:'8px 10px 5px'}}>Workflow</div>
            {sidebarWorkflow.map(s=>{
              const isActive=page===s.id
              const isDone=completedSteps[s.id]
              return (
                <div key={s.id} onClick={()=>setPage(s.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:2,border:`1px solid ${isActive?`${D.blue}55`:'transparent'}`,background:isActive?`rgba(59,130,246,0.12)`:'transparent',transition:'all .15s'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0,
                    background:isActive?D.blue:isDone?`rgba(16,185,129,0.2)`:'transparent',
                    color:isActive?'#FFFFFF':isDone?D.green:D.textMuted,
                    border:`2px solid ${isActive?D.blue:isDone?D.green:D.border}`
                  }}>
                    {isDone&&!isActive?'✓':s.index+1}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6,flex:1,minWidth:0}}>
                    <span style={{fontSize:13}}>{s.icon}</span>
                    <span style={{fontSize:11,fontWeight:isActive?600:400,color:isActive?D.text:isDone?D.textSec:D.textMuted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{s.label}</span>
                  </div>
                  {s.id==='comp-search'&&comps.length>0&&<span style={{fontSize:9,background:`rgba(59,130,246,0.2)`,color:D.blue,padding:'2px 5px',borderRadius:4,fontWeight:700,flexShrink:0}}>{comps.length}</span>}
                  {s.id==='avail-search'&&avails.length>0&&<span style={{fontSize:9,background:`rgba(59,130,246,0.2)`,color:D.blue,padding:'2px 5px',borderRadius:4,fontWeight:700,flexShrink:0}}>{avails.length}</span>}
                  {s.id==='lease-comps'&&leaseComps.length>0&&<span style={{fontSize:9,background:`rgba(59,130,246,0.2)`,color:D.blue,padding:'2px 5px',borderRadius:4,fontWeight:700,flexShrink:0}}>{leaseComps.length}</span>}
                </div>
              )
            })}
            {/* Tools section */}
            <div style={{fontSize:9,fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase' as const,color:D.textMuted,padding:'14px 10px 5px'}}>Tools</div>
            {[{id:'database',icon:'🗄️',label:'Database Manager'}].map(item=>{
              const isActive=page===item.id
              return (
                <div key={item.id} onClick={()=>setPage(item.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:2,border:`1px solid ${isActive?`${D.purple}55`:'transparent'}`,background:isActive?`rgba(139,92,246,0.12)`:'transparent',transition:'all .15s'}}>
                  <span style={{fontSize:13}}>{item.icon}</span>
                  <span style={{fontSize:11,fontWeight:isActive?600:400,color:isActive?D.text:D.textMuted}}>{item.label}</span>
                </div>
              )
            })}
            <div style={{margin:'12px 10px',height:'1px',background:D.border}}/>
          </div>
          {/* Bottom actions */}
          <div style={{padding:'12px',borderTop:`1px solid ${D.border}`,display:'flex',flexDirection:'column',gap:6}}>
            <button onClick={()=>saveReport(false)} disabled={saving} style={{background:D.blue,border:'none',color:'#FFFFFF',fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,padding:'10px 12px',borderRadius:7,cursor:saving?'not-allowed':'pointer',width:'100%',opacity:saving?.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              {saving?<><span className="spin" style={{display:'inline-block',width:10,height:10,border:'1.5px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%'}}/>Saving...</>:'💾 Save Progress'}
            </button>
            {lastSaved&&<div style={{fontSize:9,color:D.textMuted,textAlign:'center' as const,lineHeight:1.4}}>
              ✓ Auto-saved {lastSaved.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
              {savedOPVId&&<span> · #{savedOPVId.slice(0,6)}</span>}
            </div>}
            <button onClick={()=>{setShowSavedPanel(true);loadSavedOPVs()}} style={{background:`rgba(255,255,255,0.04)`,border:`1px solid ${D.border}`,color:D.textSec,fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,padding:'8px 12px',borderRadius:7,cursor:'pointer',width:'100%'}}>
              📂 Load Saved OPV
            </button>
            <button onClick={startNewOPV} style={{background:'transparent',border:`1px solid ${D.border}`,color:D.textMuted,fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:500,padding:'7px 12px',borderRadius:7,cursor:'pointer',width:'100%'}}>
              ＋ New OPV
            </button>
            <div onClick={async()=>{ await fetch('/api/auth',{method:'DELETE'}); window.location.href='/login' }} style={{fontSize:11,color:D.textMuted,cursor:'pointer',display:'flex',alignItems:'center',gap:7,padding:'4px',marginTop:2}}>
              <span>⏻</span> Sign Out
            </div>
          </div>
        </div>

        {/* ── SAVED PANEL ── */}
        {showSavedPanel&&(
          <div style={{position:'fixed',inset:0,zIndex:200,display:'flex'}}>
            <div onClick={()=>setShowSavedPanel(false)} style={{flex:1,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}}/>
            <div style={{width:440,background:D.surface,borderLeft:`1px solid ${D.border}`,boxShadow:'-8px 0 40px rgba(0,0,0,.4)',display:'flex',flexDirection:'column',overflowY:'auto'}}>
              <div style={{padding:'22px 24px',borderBottom:`1px solid ${D.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:D.text}}>Saved OPVs</div>
                <button onClick={()=>setShowSavedPanel(false)} style={{background:'transparent',border:'none',fontSize:18,cursor:'pointer',color:D.textSec,padding:'4px 8px',borderRadius:6}}>×</button>
              </div>
              {savedOPVId&&<div style={{padding:'12px 24px',background:`rgba(16,185,129,0.08)`,borderBottom:`1px solid ${D.border}`}}>
                <div style={{fontSize:11,color:D.green,fontWeight:600,marginBottom:2}}>✓ Current session is saved</div>
                <div style={{fontSize:11,color:D.textSec}}>{lastSaved?`Last saved ${lastSaved.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`:'Saved'} · ID: {savedOPVId.slice(0,8)}…</div>
              </div>}
              <div style={{padding:'16px 24px',flex:1}}>
                {savedOPVs.length===0&&<div style={{textAlign:'center' as const,padding:'48px 20px',color:D.textSec,fontSize:13}}>
                  <div style={{fontSize:36,opacity:.2,marginBottom:12}}>📂</div>
                  No saved OPVs yet. Hit "Save Progress" to save your current session.
                </div>}
                {savedOPVs.map(s=>{
                  const isCurrent = s.id===savedOPVId
                  const stepLabel: Record<string,string> = {'assignment':'Assignment','subject':'Subject','comp-search':'Sale Comps','avail-search':'Availabilities','lease-comps':'Lease Comps','photos':'Photos','verification':'Verification','broker-review':'Broker Review','opv-report':'Report'}
                  const updatedAt = new Date(s.updated_at||'')
                  const now = new Date()
                  const diffMs = now.getTime()-updatedAt.getTime()
                  const diffMins = Math.floor(diffMs/60000)
                  const timeAgo = diffMins<2?'just now':diffMins<60?`${diffMins}m ago`:diffMins<1440?`${Math.floor(diffMins/60)}h ago`:`${Math.floor(diffMins/1440)}d ago`
                  return (
                    <div key={s.id} style={{borderRadius:10,border:`1.5px solid ${isCurrent?D.blue:D.border}`,marginBottom:10,overflow:'hidden'}}>
                      <div style={{padding:'14px 16px',background:isCurrent?`rgba(59,130,246,0.08)`:'transparent'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,marginBottom:2,color:D.text}}>{s.address||'No address'}</div>
                            <div style={{fontSize:10,color:D.textSec}}>By {s.saved_by} · {timeAgo}</div>
                          </div>
                          {isCurrent&&<Tag color={D.blue}>Current</Tag>}
                        </div>
                        {s.current_step&&<div style={{fontSize:11,color:D.blue,marginBottom:10}}>Saved at: <strong>{stepLabel[s.current_step]||s.current_step}</strong></div>}
                        <div style={{display:'flex',gap:8}}>
                          <Btn onClick={()=>restoreOPV(s.id)} style={{flex:1,padding:'8px',fontSize:11}}>{isCurrent?'✓ Continue':'▶ Load & Resume'}</Btn>
                          <Btn variant="danger" size="sm" onClick={async()=>{
                            if(!confirm('Delete this saved OPV?')) return
                            await fetch(`/api/opv-history?id=${s.id}`,{method:'DELETE'})
                            setSavedOPVs(prev=>prev.filter(x=>x.id!==s.id))
                            if(isCurrent){setSavedOPVId(null);setLastSaved(null)}
                          }}>Delete</Btn>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{padding:'16px 24px',borderTop:`1px solid ${D.border}`}}>
                <Btn onClick={()=>{saveReport(false);setTimeout(loadSavedOPVs,800)}} disabled={saving||!subject} style={{width:'100%',padding:11}}>
                  {saving?'Saving...':'💾 Save Current Progress'}
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div style={{flex:1,minHeight:'100vh',overflowY:'auto',background:D.bg}}>
          {/* Header */}
          <div className="no-print" style={{height:56,padding:'0 32px',borderBottom:`1px solid ${D.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:D.surface,position:'sticky',top:0,zIndex:50}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:D.text}}>{PAGE_TITLES[page]||page}</div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {lastSaved&&<span style={{fontSize:10,color:D.textMuted}}>Saved {lastSaved.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span>}
              <button onClick={()=>saveReport(false)} disabled={saving||!subject} style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,padding:'6px 14px',borderRadius:7,cursor:saving||!subject?'not-allowed':'pointer',background:`rgba(59,130,246,0.12)`,color:D.blue,border:`1px solid rgba(59,130,246,0.25)`,opacity:!subject?.5:1}}>
                {saving?'Saving…':'💾 Save'}
              </button>
              {subject&&<span style={{fontSize:10,padding:'3px 10px',borderRadius:999,background:`rgba(16,185,129,0.12)`,color:D.green,border:`1px solid rgba(16,185,129,0.2)`}}>{subject.address?.split(',')[0]}</span>}
            </div>
          </div>
          {/* Page content */}
          <div style={{padding:'28px 32px'}}>
            {isWorkflowPage&&page!=='dashboard'&&(
              <ProgressStepper current={page} completedSteps={completedSteps}/>
            )}
            {page==='dashboard'&&<Dashboard user={user} subject={subject} comps={comps} avails={avails} leaseComps={leaseComps} analytics={analytics} savedOPVs={savedOPVs} setPage={handleSetPage} loadSavedOPVs={loadSavedOPVs} restoreOPV={restoreOPV} onNewOPV={startNewOPV}/>}
            {page==='assignment'&&<Assignment assignmentData={assignmentData} setAssignmentData={setAssignmentData} user={user} setPage={handleSetPage} setSubject={setSubject} subject={subject}/>}
            {page==='subject'&&<SubjectProperty subject={subject} setSubject={setSubject} setPage={handleSetPage} folders={folders} setFolders={updateFolders} assignmentData={assignmentData}/>}
            {page==='database'&&<DatabaseManager/>}
            {page==='comp-search'&&<CompSearch subject={subject} comps={comps} setComps={setComps} setPage={handleSetPage} folders={folders} setFolders={updateFolders}/>}
            {page==='avail-search'&&<AvailSearch subject={subject} avails={avails} setAvails={setAvails} setPage={handleSetPage} folders={folders} setFolders={updateFolders}/>}
            {page==='lease-comps'&&<LeaseCompSearch subject={subject} leaseComps={leaseComps} setLeaseComps={setLeaseComps} setPage={handleSetPage} folders={folders} setFolders={updateFolders}/>}
            {page==='folders'&&<FolderManager folders={folders} setFolders={updateFolders} setPage={handleSetPage} comps={comps} setComps={setComps} avails={avails} setAvails={setAvails}/>}
            {page==='analytics'&&<Analytics comps={scoredComps.length>0?scoredComps:comps} avails={avails} analytics={analytics} setAnalytics={setAnalytics} setPage={handleSetPage}/>}
            {page==='broker-review'&&<BrokerReview subject={subject} comps={scoredComps.length>0?scoredComps:comps} analytics={analytics} setAnalytics={setAnalytics} aiText={aiText} setAiText={setAiText} setPage={handleSetPage} setSubject={setSubject}/>}
            {page==='opv-report'&&<OPVReport subject={subject} comps={scoredComps.length>0?scoredComps:comps} leaseComps={leaseComps} avails={avails} analytics={analytics} aiText={aiText} setPage={handleSetPage} frozenHTML={editedReportHTML} setFrozenHTML={setEditedReportHTML}/>}
          </div>
          {/* ── Sticky Step Nav Bar ── */}
          {(()=>{
            const wfIdx = WORKFLOW_STEPS.findIndex(s=>s.id===page)
            if (wfIdx < 1) return null // hide on dashboard and non-workflow pages
            const prev = WORKFLOW_STEPS[wfIdx-1]
            const next = WORKFLOW_STEPS[wfIdx+1]
            return (
              <div className="no-print" style={{position:'sticky',bottom:0,zIndex:50,background:`rgba(10,14,26,0.92)`,backdropFilter:'blur(12px)',borderTop:`1px solid ${D.border}`,padding:'12px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                <button
                  onClick={()=>setPage(prev.id)}
                  style={{display:'flex',alignItems:'center',gap:8,background:'transparent',border:`1px solid ${D.border}`,color:D.textSec,fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:500,padding:'8px 18px',borderRadius:8,cursor:'pointer',transition:'all .15s'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=D.blue;(e.currentTarget as HTMLButtonElement).style.color=D.text}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=D.border;(e.currentTarget as HTMLButtonElement).style.color=D.textSec}}
                >
                  ← {prev.icon} {prev.label}
                </button>
                <div style={{fontSize:11,color:D.textMuted,fontWeight:500}}>
                  Step {wfIdx} of {WORKFLOW_STEPS.length - 1}
                </div>
                {next ? (
                  <button
                    onClick={()=>setPage(next.id)}
                    style={{display:'flex',alignItems:'center',gap:8,background:D.blue,border:'none',color:'#fff',fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:600,padding:'8px 20px',borderRadius:8,cursor:'pointer',transition:'all .15s',boxShadow:'0 2px 8px rgba(59,130,246,0.35)'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background=D.blueHover}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background=D.blue}}
                  >
                    Next: {next.icon} {next.label} →
                  </button>
                ) : (
                  <div style={{fontSize:11,color:D.green,fontWeight:600,padding:'8px 16px',borderRadius:8,background:`rgba(16,185,129,0.12)`,border:`1px solid rgba(16,185,129,0.25)`}}>
                    ✓ Workflow Complete
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </>
  )
}
