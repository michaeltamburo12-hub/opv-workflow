'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── TYPES ──────────────────────────────────────────────────────────────────────
type SubjectForm = {
  address:string; city:string; county:string; type:string; size:string; lot:string
  ceiling:string; docks:string; driveIn:string; power:string; heat:string
  parking:string; sprinkler:string; sewer:string; zoning:string; taxes:string
  yearBuilt:string; officePct:string; condition:string; notes:string; preparedBy:string
}
type Comp = {
  id:string; address:string; city:string; county:string; building_sf:number
  lot_size_ac:number; ceiling_height:string; loading_docks:string; drive_ins:string
  power:string; heat:string; parking:string; sprinkler:string; sewer:string
  zoning:string; taxes:number; sale_price:number; price_per_sf:number
  sale_date:string; buyer:string; seller:string; photo_url?:string; score?:number
  [key:string]:unknown
}
type Avail = {
  id:string; address:string; city:string; county:string; building_sf:number
  lot_size_ac:number; ceiling_height:string; loading_docks:string; drive_ins:string
  power:string; heat:string; parking:string; sprinkler:string; sewer:string
  zoning:string; taxes:number; asking_price:number; price_per_sf:number
  pricing_guidance:string; listing_broker:string; photo_url?:string; score?:number
  [key:string]:unknown
}

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────────
const D = {
  bg:      '#090c15',
  surface: '#0f1424',
  card:    '#141928',
  border:  'rgba(120,130,190,0.14)',
  borderM: 'rgba(120,130,190,0.26)',
  white:   '#eef0ff',
  muted:   '#7a85a8',
  faint:   '#2e3550',
  gold:    '#e8aa2a',
  goldDim: 'rgba(232,170,42,0.10)',
  goldB:   'rgba(232,170,42,0.22)',
  green:   '#22c985',
  greenD:  'rgba(34,201,133,0.10)',
  blue:    '#4d97ff',
  blueD:   'rgba(77,151,255,0.10)',
  orange:  '#ff8a42',
  red:     '#ff4d6d',
  purple:  '#a855f7',
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:${D.bg};color:${D.white};-webkit-font-smoothing:antialiased}
  input,select,textarea{font-family:'Inter',sans-serif}
  input:focus,select:focus,textarea:focus{outline:none;border-color:${D.borderM}!important}
  input::placeholder,textarea::placeholder{color:${D.faint}}
  select option{background:#111827;color:${D.white}}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${D.faint};border-radius:4px}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .au{animation:fadeIn .25s ease forwards}
  .spin{animation:spin .7s linear infinite}
  @media print{
    body{background:#fff!important;color:#111!important}
    .no-print{display:none!important}
  }
`

// ── SHARED COMPONENTS ──────────────────────────────────────────────────────────
const Label = ({children}:{children:React.ReactNode}) => (
  <div style={{fontSize:10,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase' as const,color:D.muted,marginBottom:5}}>{children}</div>
)

const inputSt: React.CSSProperties = {
  background:D.card,border:`1px solid ${D.border}`,borderRadius:6,color:D.white,
  fontSize:13,padding:'9px 12px',width:'100%',transition:'border-color .15s',
}

const Inp = ({style={}, ...p}: React.InputHTMLAttributes<HTMLInputElement> & {style?:React.CSSProperties}) => (
  <input {...p} style={{...inputSt,...style}}/>
)

const Sel = ({children,style={}, ...p}: React.SelectHTMLAttributes<HTMLSelectElement> & {style?:React.CSSProperties}) => (
  <select {...p} style={{...inputSt,appearance:'none' as const,
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%237a85a8' d='M5 6L0 0h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat',backgroundPosition:'calc(100% - 10px) center',paddingRight:28,...style}}>
    {children}
  </select>
)

const Field = ({label,children,full,style={}}:{label:string,children:React.ReactNode,full?:boolean,style?:React.CSSProperties}) => (
  <div style={{display:'flex',flexDirection:'column' as const,gap:4,marginBottom:12,...(full?{gridColumn:'1/-1' as const}:{}), ...style}}>
    <Label>{label}</Label>{children}
  </div>
)

const Btn = ({children,onClick,variant='gold',disabled,style={},size='md'}:{children:React.ReactNode,onClick?:()=>void,variant?:string,disabled?:boolean,style?:React.CSSProperties,size?:'sm'|'md'}) => {
  const pad = size==='sm' ? '5px 12px' : '9px 18px'
  const fs  = size==='sm' ? 11 : 13
  const vars: Record<string,React.CSSProperties> = {
    gold:  {background:'linear-gradient(135deg,#e8aa2a,#f0c040)',color:'#0a0c14',border:'none',fontWeight:700,boxShadow:'0 2px 12px rgba(232,170,42,0.22)'},
    ghost: {background:'transparent',color:D.muted,border:`1px solid ${D.border}`,fontWeight:500},
    blue:  {background:D.blueD,color:D.blue,border:`1px solid rgba(77,151,255,0.25)`,fontWeight:500},
    green: {background:D.greenD,color:D.green,border:`1px solid rgba(34,201,133,0.25)`,fontWeight:500},
    danger:{background:'rgba(255,77,109,0.1)',color:D.red,border:`1px solid rgba(255,77,109,0.25)`,fontWeight:500},
  }
  return (
    <button onClick={onClick} disabled={disabled}
      style={{...vars[variant],padding:pad,fontSize:fs,borderRadius:6,cursor:disabled?'not-allowed':'pointer',
        opacity:disabled?.5:1,transition:'all .15s',display:'inline-flex' as const,alignItems:'center',
        justifyContent:'center',gap:6,whiteSpace:'nowrap' as const,fontFamily:"'Inter',sans-serif",...style}}>
      {children}
    </button>
  )
}

const Card = ({children,style={},accent}:{children:React.ReactNode,style?:React.CSSProperties,accent?:string}) => (
  <div style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:10,padding:'20px 22px',
    ...(accent?{borderTop:`2px solid ${accent}`,boxShadow:`0 0 16px ${accent}14`}:{}), ...style}}>
    {children}
  </div>
)

const Tag = ({children,color=D.gold}:{children:React.ReactNode,color?:string}) => (
  <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:4,
    background:`${color}18`,color,border:`1px solid ${color}28`,display:'inline-flex' as const,
    alignItems:'center',gap:3,whiteSpace:'nowrap' as const}}>{children}</span>
)

const Divider = ({label}:{label?:string}) => (
  <div style={{display:'flex',alignItems:'center',gap:10,margin:'14px 0'}}>
    <div style={{flex:1,height:'1px',background:`linear-gradient(90deg,transparent,${D.border})`}}/>
    {label&&<span style={{fontSize:9,color:D.faint,letterSpacing:'.1em',textTransform:'uppercase' as const,fontWeight:600}}>{label}</span>}
    {label&&<div style={{flex:1,height:'1px',background:`linear-gradient(90deg,${D.border},transparent)`}}/>}
  </div>
)

// ── STREET VIEW PHOTO ─────────────────────────────────────────────────────────
function StreetViewPhoto({address,style={}}:{address:string,style?:React.CSSProperties}) {
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
  const box: React.CSSProperties = {width:160,height:118,borderRadius:7,overflow:'hidden',
    border:`1px solid ${D.border}`,flexShrink:0,...style}
  if (state==='idle') return (
    <div style={{...box,display:'flex',alignItems:'center',justifyContent:'center',
      background:D.surface,cursor:'pointer',flexDirection:'column' as const,gap:5}}
      onClick={load}>
      <span style={{fontSize:20,opacity:.4}}>📷</span>
      <span style={{fontSize:10,color:D.muted,fontWeight:600}}>Load Photo</span>
    </div>
  )
  if (state==='loading') return (
    <div style={{...box,display:'flex',alignItems:'center',justifyContent:'center',background:D.surface}}>
      <div className="spin" style={{width:18,height:18,border:`2px solid ${D.border}`,borderTopColor:D.blue,borderRadius:'50%'}}/>
    </div>
  )
  if (state==='err') return (
    <div style={{...box,display:'flex',alignItems:'center',justifyContent:'center',background:D.surface}}>
      <span style={{fontSize:10,color:D.muted}}>No photo</span>
    </div>
  )
  return <img src={src} alt={address} style={{...box,objectFit:'cover' as const}}/>
}

// ── STEP BAR ──────────────────────────────────────────────────────────────────
const STEPS = [
  {id:'subject', label:'Subject'},
  {id:'comps',   label:'Sale Comps'},
  {id:'avails',  label:'Availabilities'},
  {id:'report',  label:'OPV Report'},
]
function StepBar({current}:{current:string}) {
  const ci = STEPS.findIndex(s=>s.id===current)
  if (ci<0) return null
  return (
    <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:22,padding:'12px 20px',
      background:D.surface,borderRadius:8,border:`1px solid ${D.border}`}}>
      {STEPS.map((s,i)=>(
        <div key={s.id} style={{display:'flex',alignItems:'center',flex:i<STEPS.length-1?1:'auto' as unknown as number}}>
          <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:4}}>
            <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:11,fontWeight:700,transition:'all .3s',
              background:i<ci?'linear-gradient(135deg,#22c985,#4d97ff)':i===ci?'linear-gradient(135deg,#e8aa2a,#f0c040)':'transparent',
              color:i<=ci?'#0a0c14':D.faint,
              border:`1.5px solid ${i<ci?D.green+'80':i===ci?D.gold+'90':D.faint+'40'}`,
              boxShadow:i===ci?'0 0 10px rgba(232,170,42,0.35)':i<ci?'0 0 8px rgba(34,201,133,0.3)':'none',
            }}>{i<ci?'✓':i+1}</div>
            <span style={{fontSize:9,fontWeight:i===ci?600:400,letterSpacing:'.06em',textTransform:'uppercase' as const,
              color:i===ci?D.gold:i<ci?D.green:D.faint,whiteSpace:'nowrap' as const}}>{s.label}</span>
          </div>
          {i<STEPS.length-1&&(
            <div style={{flex:1,height:'1.5px',margin:'0 6px',marginBottom:14,
              background:i<ci?`linear-gradient(90deg,${D.green}70,${D.blue}40)`:D.border}}/>
          )}
        </div>
      ))}
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({subject,comps,avails,setPage}:{subject:SubjectForm|null,comps:Comp[],avails:Avail[],setPage:(p:string)=>void}) {
  const hr = new Date().getHours()
  const greet = hr<12?'Good morning':hr<17?'Good afternoon':'Good evening'
  const steps = [
    {n:'01',label:'Subject Property',sub:'Enter building specs & details',id:'subject',color:D.gold,  done:!!subject},
    {n:'02',label:'Sale Comps',       sub:'Search & select comparables',   id:'comps',  color:D.blue,  done:comps.length>0},
    {n:'03',label:'Availabilities',   sub:'Active listings for context',   id:'avails', color:D.green, done:avails.length>0},
    {n:'04',label:'OPV Report',        sub:'Generate opinion of value',    id:'report', color:D.purple,done:false},
  ]
  return (
    <div className="au">
      <div style={{marginBottom:26,paddingBottom:20,borderBottom:`1px solid ${D.border}`}}>
        <p style={{fontSize:11,color:D.muted,letterSpacing:'.1em',textTransform:'uppercase' as const,marginBottom:6}}>Premier Commercial Real Estate · Long Island Industrial</p>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:600,letterSpacing:'-.02em',marginBottom:4,lineHeight:1.1}}>{greet}</h1>
        <p style={{fontSize:13,color:D.muted,fontWeight:300}}>Your OPV workspace. Follow the steps below to build your Opinion of Value.</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
        {([
          {l:'Subject',    v:subject?subject.address.split(',')[0]:'—', c:D.gold},
          {l:'Sale Comps', v:String(comps.length),  c:D.blue},
          {l:'Avails',     v:String(avails.length), c:D.green},
        ] as {l:string,v:string,c:string}[]).map((k,i)=>(
          <div key={i} style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:10,padding:'16px 18px',position:'relative' as const,overflow:'hidden'}}>
            <div style={{position:'absolute' as const,top:0,left:0,right:0,height:2,background:k.c,opacity:.7}}/>
            <div style={{fontSize:10,color:D.muted,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase' as const,marginBottom:6}}>{k.l}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:i===0?16:34,fontWeight:600,color:k.c,lineHeight:1.1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {steps.map(s=>(
          <div key={s.id} onClick={()=>setPage(s.id)}
            style={{background:D.card,border:`1px solid ${s.done?s.color+'55':D.border}`,borderRadius:10,
              padding:'18px 20px',cursor:'pointer',transition:'all .2s',
              boxShadow:s.done?`0 0 14px ${s.color}12`:''}}
            onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=s.color+'80';(e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=s.done?s.color+'55':D.border;(e.currentTarget as HTMLDivElement).style.transform=''}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:11,color:D.muted}}>{s.n}</div>
              {s.done&&<span style={{fontSize:10,background:D.greenD,color:D.green,border:'1px solid rgba(34,201,133,.25)',padding:'2px 7px',borderRadius:4,fontWeight:600}}>✓ Done</span>}
            </div>
            <div style={{fontSize:14,fontWeight:600,color:s.done?s.color:D.white,marginBottom:3}}>{s.label}</div>
            <div style={{fontSize:11,color:D.muted,fontWeight:300}}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SUBJECT PROPERTY ──────────────────────────────────────────────────────────
const EMPTY_SUBJ: SubjectForm = {
  address:'',city:'',county:'Nassau',type:'Warehouse',size:'',lot:'',ceiling:'',
  docks:'',driveIn:'',power:'',heat:'Gas',parking:'',sprinkler:'Yes',sewer:'Municipal',
  zoning:'',taxes:'',yearBuilt:'',officePct:'',condition:'Good',notes:'',preparedBy:''
}

function SubjectProperty({subject,setSubject,setPage}:{subject:SubjectForm|null,setSubject:(s:SubjectForm)=>void,setPage:(p:string)=>void}) {
  const [f,setF] = useState<SubjectForm>(subject||EMPTY_SUBJ)
  const set = (k:keyof SubjectForm,v:string) => setF(p=>({...p,[k]:v}))
  const save = () => {
    if(!f.address||!f.size){alert('Address and building size are required.');return}
    setSubject(f); setPage('comps')
  }
  const G2: React.CSSProperties = {display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}
  const G3: React.CSSProperties = {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}
  return (
    <div className="au">
      <StepBar current="subject"/>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:600,marginBottom:4}}>Subject Property</h2>
      <p style={{fontSize:13,color:D.muted,marginBottom:20,fontWeight:300}}>Enter the property being valued. All specs populate the OPV report.</p>
      <div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:18,alignItems:'start'}}>
        <div>
          <Card style={{marginBottom:14}}>
            <Label>ADDRESS & CLASSIFICATION</Label>
            <div style={{height:6}}/>
            <Field label="Property Address" full>
              <Inp placeholder="80 Modular Ave, Commack, NY 11725" value={f.address} onChange={e=>set('address',e.target.value)}/>
            </Field>
            <div style={G2}>
              <Field label="City"><Inp placeholder="Commack" value={f.city} onChange={e=>set('city',e.target.value)}/></Field>
              <Field label="County">
                <Sel value={f.county} onChange={e=>set('county',e.target.value)}>
                  <option>Nassau</option><option>Suffolk</option>
                </Sel>
              </Field>
              <Field label="Property Type">
                <Sel value={f.type} onChange={e=>set('type',e.target.value)}>
                  <option>Warehouse</option><option>Manufacturing</option><option>Flex</option><option>Distribution</option><option>Industrial</option>
                </Sel>
              </Field>
              <Field label="Prepared By"><Inp placeholder="Your name" value={f.preparedBy} onChange={e=>set('preparedBy',e.target.value)}/></Field>
            </div>
          </Card>
          <Card style={{marginBottom:14}}>
            <Label>BUILDING SPECS</Label><div style={{height:6}}/>
            <div style={G3}>
              <Field label="Building Size (SF)"><Inp type="number" placeholder="20000" value={f.size} onChange={e=>set('size',e.target.value)}/></Field>
              <Field label="Lot Size"><Inp placeholder="1.4 acres" value={f.lot} onChange={e=>set('lot',e.target.value)}/></Field>
              <Field label="Year Built"><Inp type="number" placeholder="2000" value={f.yearBuilt} onChange={e=>set('yearBuilt',e.target.value)}/></Field>
              <Field label="Ceiling Height (ft)"><Inp type="number" placeholder="14" value={f.ceiling} onChange={e=>set('ceiling',e.target.value)}/></Field>
              <Field label="Loading Docks"><Inp type="number" placeholder="1" value={f.docks} onChange={e=>set('docks',e.target.value)}/></Field>
              <Field label="Drive-In Doors"><Inp type="number" placeholder="1" value={f.driveIn} onChange={e=>set('driveIn',e.target.value)}/></Field>
              <Field label="Parking Spaces"><Inp type="number" placeholder="40" value={f.parking} onChange={e=>set('parking',e.target.value)}/></Field>
              <Field label="Office %"><Inp type="number" placeholder="10" value={f.officePct} onChange={e=>set('officePct',e.target.value)}/></Field>
            </div>
          </Card>
          <Card>
            <Label>SYSTEMS & FINANCIALS</Label><div style={{height:6}}/>
            <div style={G3}>
              <Field label="Electrical Power"><Inp placeholder="400A/3ph" value={f.power} onChange={e=>set('power',e.target.value)}/></Field>
              <Field label="Heat">
                <Sel value={f.heat} onChange={e=>set('heat',e.target.value)}>
                  <option>Gas</option><option>Oil</option><option>Electric</option><option>None</option>
                </Sel>
              </Field>
              <Field label="Sprinkler">
                <Sel value={f.sprinkler} onChange={e=>set('sprinkler',e.target.value)}>
                  <option>Yes</option><option>No</option><option>ESFR</option><option>Wet</option><option>Dry</option>
                </Sel>
              </Field>
              <Field label="Sewer">
                <Sel value={f.sewer} onChange={e=>set('sewer',e.target.value)}>
                  <option>Municipal</option><option>Septic</option>
                </Sel>
              </Field>
              <Field label="Zoning"><Inp placeholder="Light Industrial" value={f.zoning} onChange={e=>set('zoning',e.target.value)}/></Field>
              <Field label="RE Taxes ($/yr)"><Inp type="number" placeholder="42000" value={f.taxes} onChange={e=>set('taxes',e.target.value)}/></Field>
              <Field label="Condition">
                <Sel value={f.condition} onChange={e=>set('condition',e.target.value)}>
                  <option>Excellent</option><option>Good</option><option>Average</option><option>Fair</option>
                </Sel>
              </Field>
            </div>
            <Field label="Broker Notes" full>
              <textarea value={f.notes} onChange={e=>set('notes',e.target.value)}
                placeholder="Special features, recent improvements, market notes..."
                style={{background:D.card,border:`1px solid ${D.border}`,borderRadius:6,color:D.white,
                  fontSize:13,padding:'9px 12px',width:'100%',minHeight:70,resize:'vertical' as const,
                  fontFamily:"'Inter',sans-serif",lineHeight:1.6}}/>
            </Field>
            <Btn onClick={save} style={{width:'100%',padding:11}}>Save & Go to Comp Search →</Btn>
          </Card>
        </div>
        <div>
          <Card style={{border:`1px solid ${D.goldB}`,position:'sticky' as const,top:20}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,color:D.gold,marginBottom:12}}>Live Preview</div>
            {([
              ['Address',f.address||'—'],['County',f.county],['Type',f.type],
              ['Size',f.size?`${parseInt(f.size).toLocaleString()} SF`:'—'],
              ['Lot',f.lot||'—'],['Ceiling',f.ceiling?`${f.ceiling} ft`:'—'],
              ['Docks',f.docks||'—'],['Drive-Ins',f.driveIn||'—'],
              ['Power',f.power||'—'],['Heat',f.heat],['Sprinkler',f.sprinkler],
              ['Sewer',f.sewer],['Zoning',f.zoning||'—'],
              ['Year Built',f.yearBuilt||'—'],['Office %',f.officePct?`${f.officePct}%`:'—'],
              ['Taxes',f.taxes?`$${parseInt(f.taxes).toLocaleString()}/yr`:'—'],
              ['Condition',f.condition],
            ] as [string,string][]).map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',
                borderBottom:`1px solid ${D.border}`,fontSize:12}}>
                <span style={{color:D.muted}}>{l}</span>
                <span style={{fontWeight:500,maxWidth:'55%',textAlign:'right' as const,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── SALE COMPS ────────────────────────────────────────────────────────────────
function SaleComps({subject,comps,setComps,setPage}:{subject:SubjectForm|null,comps:Comp[],setComps:(c:Comp[])=>void,setPage:(p:string)=>void}) {
  const [filters,setFilters] = useState({county:'',city:'',min_sf:'',max_sf:'',min_price:'',max_price:'',min_date:'',max_date:'',sewer:'',zoning:''})
  const [results,setResults] = useState<Comp[]>([])
  const [loading,setLoading] = useState(false)
  const [searched,setSearched] = useState(false)
  const [selected,setSelected] = useState<Set<string>>(new Set(comps.map(c=>c.id)))
  const sf = (k:string,v:string) => setFilters(f=>({...f,[k]:v}))

  const scoreComp = (c:Comp) => {
    if(!subject) return 75
    const subSF = parseFloat(subject.size)||0; const compSF = c.building_sf||0
    const sizeDiff = subSF>0 ? Math.abs(compSF-subSF)/subSF : .5
    const sizeScore = Math.max(0,100-(sizeDiff*120))
    const subCeil = parseFloat(subject.ceiling)||0; const compCeil = parseFloat(c.ceiling_height)||0
    const ceilScore = subCeil>0 ? Math.max(0,100-(Math.abs(compCeil-subCeil)*10)) : 65
    return Math.min(99,Math.max(40,Math.round(sizeScore*0.5+ceilScore*0.3+65*0.2)))
  }

  const search = async () => {
    setLoading(true); setResults([]); setSearched(false)
    let q = supabase.from('industrial_sale_comps').select('*')
    if(filters.county) q = q.eq('county',filters.county)
    if(filters.city) q = q.ilike('city',`%${filters.city}%`)
    if(filters.min_sf) q = q.gte('building_sf',Number(filters.min_sf))
    if(filters.max_sf) q = q.lte('building_sf',Number(filters.max_sf))
    if(filters.min_price) q = q.gte('sale_price',Number(filters.min_price))
    if(filters.max_price) q = q.lte('sale_price',Number(filters.max_price))
    if(filters.min_date) q = q.gte('sale_date',filters.min_date)
    if(filters.max_date) q = q.lte('sale_date',filters.max_date)
    if(filters.sewer) q = q.eq('sewer',filters.sewer)
    if(filters.zoning) q = q.ilike('zoning',`%${filters.zoning}%`)
    q = q.order('sale_date',{ascending:false}).limit(200)
    const {data,error} = await q
    if(error){alert('Search error: '+error.message);setLoading(false);return}
    const scored = (data||[]).map((c:Comp)=>({...c,score:scoreComp(c)}))
    if(subject) scored.sort((a:Comp,b:Comp)=>((b.score||0)-(a.score||0)))
    setResults(scored); setSearched(true); setLoading(false)
  }

  const toggle = (id:string) => setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const addSelected = () => {
    const toAdd = results.filter(r=>selected.has(r.id)&&!comps.find(c=>c.id===r.id))
    setComps([...comps,...toAdd])
  }
  const remove = (id:string) => { setComps(comps.filter(c=>c.id!==id)); setSelected(prev=>{const n=new Set(prev);n.delete(id);return n}) }
  const scoreColor = (s:number) => s>=85?D.green:s>=70?D.gold:D.red

  return (
    <div className="au">
      <StepBar current="comps"/>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:600,marginBottom:4}}>Sale Comps</h2>
      <p style={{fontSize:13,color:D.muted,marginBottom:20,fontWeight:300}}>Search your database and select comps to include in the OPV.</p>
      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:18,alignItems:'start'}}>
        {/* Filters */}
        <div>
          <Card style={{marginBottom:12}}>
            <Label>SEARCH FILTERS</Label><div style={{height:6}}/>
            <Field label="County">
              <Sel value={filters.county} onChange={e=>sf('county',e.target.value)}>
                <option value="">All Counties</option><option>Nassau</option><option>Suffolk</option>
              </Sel>
            </Field>
            <Field label="City"><Inp placeholder="e.g. Hauppauge" value={filters.city} onChange={e=>sf('city',e.target.value)}/></Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Field label="Min SF"><Inp type="number" placeholder="0" value={filters.min_sf} onChange={e=>sf('min_sf',e.target.value)}/></Field>
              <Field label="Max SF"><Inp type="number" placeholder="Any" value={filters.max_sf} onChange={e=>sf('max_sf',e.target.value)}/></Field>
              <Field label="Min Price"><Inp type="number" placeholder="0" value={filters.min_price} onChange={e=>sf('min_price',e.target.value)}/></Field>
              <Field label="Max Price"><Inp type="number" placeholder="Any" value={filters.max_price} onChange={e=>sf('max_price',e.target.value)}/></Field>
              <Field label="Date From"><Inp type="date" value={filters.min_date} onChange={e=>sf('min_date',e.target.value)}/></Field>
              <Field label="Date To"><Inp type="date" value={filters.max_date} onChange={e=>sf('max_date',e.target.value)}/></Field>
            </div>
            <Field label="Sewer">
              <Sel value={filters.sewer} onChange={e=>sf('sewer',e.target.value)}>
                <option value="">Any</option><option value="City">City Sewer</option><option value="Septic">Septic</option>
              </Sel>
            </Field>
            <Field label="Zoning"><Inp placeholder="e.g. I, M1" value={filters.zoning} onChange={e=>sf('zoning',e.target.value)}/></Field>
            <Btn onClick={search} disabled={loading} style={{width:'100%',padding:10}}>
              {loading?'Searching…':'🔎 Search Comps'}
            </Btn>
          </Card>
          {comps.length>0&&(
            <Card style={{border:`1px solid ${D.goldB}`}}>
              <div style={{fontSize:11,fontWeight:600,color:D.gold,marginBottom:8}}>OPV COMPS ({comps.length})</div>
              {comps.map(c=>(
                <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'5px 0',borderBottom:`1px solid ${D.border}`,fontSize:11}}>
                  <span style={{color:D.white,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,marginRight:8}}>
                    {c.address.split(',')[0]}
                  </span>
                  <button onClick={()=>remove(c.id)} style={{background:'none',border:'none',color:D.red,cursor:'pointer',fontSize:14,flexShrink:0}}>✕</button>
                </div>
              ))}
              <Btn onClick={()=>setPage('avails')} style={{width:'100%',padding:9,marginTop:10}}>Next: Availabilities →</Btn>
            </Card>
          )}
        </div>
        {/* Results */}
        <div>
          {loading&&(
            <Card style={{textAlign:'center' as const,padding:'40px'}}>
              <div className="spin" style={{width:28,height:28,border:`2px solid ${D.border}`,borderTopColor:D.blue,borderRadius:'50%',margin:'0 auto 12px'}}/>
              <p style={{fontSize:13,color:D.muted}}>Searching database…</p>
            </Card>
          )}
          {!loading&&!searched&&(
            <Card style={{textAlign:'center' as const,padding:'60px 20px'}}>
              <div style={{fontSize:42,opacity:.1,marginBottom:12}}>📊</div>
              <p style={{fontSize:14,fontWeight:600,marginBottom:6}}>Set filters and search</p>
              <p style={{fontSize:13,color:D.muted,maxWidth:320,margin:'0 auto',fontWeight:300}}>Results will be scored by similarity to your subject property.</p>
            </Card>
          )}
          {!loading&&searched&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <span style={{fontSize:13,color:D.muted}}>{results.length} results {results.length===200?'(first 200)':''}</span>
                {selected.size>0&&(
                  <Btn onClick={addSelected} size="sm" variant="green">
                    + Add {selected.size} to OPV
                  </Btn>
                )}
              </div>
              {results.map(c=>(
                <div key={c.id}
                  style={{background:D.card,border:`1px solid ${selected.has(c.id)?D.goldB:D.border}`,
                    borderRadius:10,padding:'14px 16px',marginBottom:10,cursor:'pointer',transition:'border-color .2s'}}
                  onClick={()=>toggle(c.id)}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor=D.goldB}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=selected.has(c.id)?D.goldB:D.border}>
                  <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                    {/* Checkbox */}
                    <div style={{width:18,height:18,borderRadius:4,flexShrink:0,marginTop:2,
                      background:selected.has(c.id)?'linear-gradient(135deg,#e8aa2a,#f0c040)':D.surface,
                      border:`1.5px solid ${selected.has(c.id)?D.gold:D.border}`,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#0a0c14',fontWeight:700}}>
                      {selected.has(c.id)&&'✓'}
                    </div>
                    {/* Photo */}
                    <StreetViewPhoto address={`${c.address}, ${c.city||''}, NY`}
                      style={{width:160,height:118,borderRadius:7,flexShrink:0}}/>
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{c.address}{c.city?`, ${c.city}`:''}</div>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap' as const}}>
                            {c.price_per_sf>0&&<Tag color={D.gold}>${c.price_per_sf.toFixed(2)}/SF</Tag>}
                            {c.sale_price>0&&<Tag color={D.green}>${Number(c.sale_price).toLocaleString()}</Tag>}
                            {c.sale_date&&<Tag color={D.muted}>{c.sale_date.slice(0,7)}</Tag>}
                            {c.score&&<Tag color={scoreColor(c.score)}>{c.score}% match</Tag>}
                          </div>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'2px 10px',fontSize:11}}>
                        {([
                          ['Size',c.building_sf?`${Number(c.building_sf).toLocaleString()} SF`:'—'],
                          ['Lot',c.lot_size_ac?`${c.lot_size_ac} ac`:'—'],
                          ['Ceiling',c.ceiling_height?`${c.ceiling_height} ft`:'—'],
                          ['Docks',c.loading_docks||'—'],
                          ['Drive-Ins',c.drive_ins||'—'],
                          ['Power',c.power||'—'],
                          ['Sewer',c.sewer||'—'],
                          ['Zoning',c.zoning||'—'],
                          ['Buyer',c.buyer||'—'],
                          ['Seller',c.seller||'—'],
                        ] as [string,string][]).map(([l,v])=>(
                          <div key={l}><span style={{color:D.muted}}>{l}: </span><span style={{fontWeight:500}}>{v}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AVAILABILITIES ────────────────────────────────────────────────────────────
function Availabilities({subject,avails,setAvails,setPage}:{subject:SubjectForm|null,avails:Avail[],setAvails:(a:Avail[])=>void,setPage:(p:string)=>void}) {
  const [filters,setFilters] = useState({county:'',city:'',min_sf:'',max_sf:'',min_price:'',max_price:'',sewer:'',zoning:''})
  const [results,setResults] = useState<Avail[]>([])
  const [loading,setLoading] = useState(false)
  const [searched,setSearched] = useState(false)
  const [selected,setSelected] = useState<Set<string>>(new Set(avails.map(a=>a.id)))
  const sf = (k:string,v:string) => setFilters(f=>({...f,[k]:v}))

  const search = async () => {
    setLoading(true); setResults([]); setSearched(false)
    let q = supabase.from('market_availabilities').select('*')
    if(filters.county) q = q.eq('county',filters.county)
    if(filters.city) q = q.ilike('city',`%${filters.city}%`)
    if(filters.min_sf) q = q.gte('building_sf',Number(filters.min_sf))
    if(filters.max_sf) q = q.lte('building_sf',Number(filters.max_sf))
    if(filters.min_price) q = q.gte('asking_price',Number(filters.min_price))
    if(filters.max_price) q = q.lte('asking_price',Number(filters.max_price))
    if(filters.sewer) q = q.eq('sewer',filters.sewer)
    if(filters.zoning) q = q.ilike('zoning',`%${filters.zoning}%`)
    q = q.order('created_at',{ascending:false}).limit(200)
    const {data,error} = await q
    if(error){alert('Search error: '+error.message);setLoading(false);return}
    setResults(data||[]); setSearched(true); setLoading(false)
  }

  const toggle = (id:string) => setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const addSelected = () => {
    const toAdd = results.filter(r=>selected.has(r.id)&&!avails.find(a=>a.id===r.id))
    setAvails([...avails,...toAdd])
  }
  const remove = (id:string) => { setAvails(avails.filter(a=>a.id!==id)); setSelected(prev=>{const n=new Set(prev);n.delete(id);return n}) }

  return (
    <div className="au">
      <StepBar current="avails"/>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:600,marginBottom:4}}>Market Availabilities</h2>
      <p style={{fontSize:13,color:D.muted,marginBottom:20,fontWeight:300}}>Active for-sale listings — competitive context for your OPV.</p>
      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:18,alignItems:'start'}}>
        <div>
          <Card style={{marginBottom:12}}>
            <Label>SEARCH FILTERS</Label><div style={{height:6}}/>
            <Field label="County">
              <Sel value={filters.county} onChange={e=>sf('county',e.target.value)}>
                <option value="">All Counties</option><option>Nassau</option><option>Suffolk</option>
              </Sel>
            </Field>
            <Field label="City"><Inp placeholder="e.g. Melville" value={filters.city} onChange={e=>sf('city',e.target.value)}/></Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <Field label="Min SF"><Inp type="number" placeholder="0" value={filters.min_sf} onChange={e=>sf('min_sf',e.target.value)}/></Field>
              <Field label="Max SF"><Inp type="number" placeholder="Any" value={filters.max_sf} onChange={e=>sf('max_sf',e.target.value)}/></Field>
              <Field label="Min Price"><Inp type="number" placeholder="0" value={filters.min_price} onChange={e=>sf('min_price',e.target.value)}/></Field>
              <Field label="Max Price"><Inp type="number" placeholder="Any" value={filters.max_price} onChange={e=>sf('max_price',e.target.value)}/></Field>
            </div>
            <Field label="Sewer">
              <Sel value={filters.sewer} onChange={e=>sf('sewer',e.target.value)}>
                <option value="">Any</option><option value="City">City Sewer</option><option value="Septic">Septic</option>
              </Sel>
            </Field>
            <Field label="Zoning"><Inp placeholder="e.g. I, M1" value={filters.zoning} onChange={e=>sf('zoning',e.target.value)}/></Field>
            <Btn onClick={search} disabled={loading} style={{width:'100%',padding:10}}
              variant="blue">
              {loading?'Searching…':'🔎 Search Availabilities'}
            </Btn>
          </Card>
          {avails.length>0&&(
            <Card style={{border:'1px solid rgba(77,151,255,.3)'}}>
              <div style={{fontSize:11,fontWeight:600,color:D.blue,marginBottom:8}}>OPV AVAILS ({avails.length})</div>
              {avails.map(a=>(
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'5px 0',borderBottom:`1px solid ${D.border}`,fontSize:11}}>
                  <span style={{color:D.white,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,marginRight:8}}>
                    {a.address.split(',')[0]}
                  </span>
                  <button onClick={()=>remove(a.id)} style={{background:'none',border:'none',color:D.red,cursor:'pointer',fontSize:14,flexShrink:0}}>✕</button>
                </div>
              ))}
              <Btn onClick={()=>setPage('report')} style={{width:'100%',padding:9,marginTop:10}}>Next: OPV Report →</Btn>
            </Card>
          )}
        </div>
        <div>
          {loading&&(
            <Card style={{textAlign:'center' as const,padding:'40px'}}>
              <div className="spin" style={{width:28,height:28,border:`2px solid ${D.border}`,borderTopColor:D.blue,borderRadius:'50%',margin:'0 auto 12px'}}/>
              <p style={{fontSize:13,color:D.muted}}>Searching database…</p>
            </Card>
          )}
          {!loading&&!searched&&(
            <Card style={{textAlign:'center' as const,padding:'60px 20px'}}>
              <div style={{fontSize:42,opacity:.1,marginBottom:12}}>🔍</div>
              <p style={{fontSize:14,fontWeight:600,marginBottom:6}}>Set filters and search</p>
              <p style={{fontSize:13,color:D.muted,maxWidth:320,margin:'0 auto',fontWeight:300}}>Active listings from your Supabase database.</p>
            </Card>
          )}
          {!loading&&searched&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <span style={{fontSize:13,color:D.muted}}>{results.length} results</span>
                {selected.size>0&&(
                  <Btn onClick={addSelected} size="sm" variant="green">
                    + Add {selected.size} to OPV
                  </Btn>
                )}
              </div>
              {results.map(a=>(
                <div key={a.id}
                  style={{background:D.card,border:`1px solid ${selected.has(a.id)?'rgba(77,151,255,.35)':D.border}`,
                    borderRadius:10,padding:'14px 16px',marginBottom:10,cursor:'pointer',transition:'border-color .2s'}}
                  onClick={()=>toggle(a.id)}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor='rgba(77,151,255,.4)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor=selected.has(a.id)?'rgba(77,151,255,.35)':D.border}>
                  <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                    <div style={{width:18,height:18,borderRadius:4,flexShrink:0,marginTop:2,
                      background:selected.has(a.id)?'linear-gradient(135deg,#4d97ff,#00d4f5)':D.surface,
                      border:`1.5px solid ${selected.has(a.id)?D.blue:D.border}`,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#0a0c14',fontWeight:700}}>
                      {selected.has(a.id)&&'✓'}
                    </div>
                    <StreetViewPhoto address={`${a.address}, ${a.city||''}, NY`}
                      style={{width:160,height:118,borderRadius:7,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>{a.address}{a.city?`, ${a.city}`:''}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:6}}>
                        {a.price_per_sf>0&&<Tag color={D.blue}>${a.price_per_sf.toFixed(2)}/SF</Tag>}
                        {a.asking_price>0&&<Tag color={D.purple}>${Number(a.asking_price).toLocaleString()}</Tag>}
                        {a.pricing_guidance&&<Tag color={D.muted}>{a.pricing_guidance}</Tag>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'2px 10px',fontSize:11}}>
                        {([
                          ['Size',a.building_sf?`${Number(a.building_sf).toLocaleString()} SF`:'—'],
                          ['Lot',a.lot_size_ac?`${a.lot_size_ac} ac`:'—'],
                          ['Ceiling',a.ceiling_height?`${a.ceiling_height} ft`:'—'],
                          ['Docks',a.loading_docks||'—'],
                          ['Drive-Ins',a.drive_ins||'—'],
                          ['Power',a.power||'—'],
                          ['Sewer',a.sewer||'—'],
                          ['Zoning',a.zoning||'—'],
                          ['Broker',a.listing_broker||'—'],
                        ] as [string,string][]).map(([l,v])=>(
                          <div key={l}><span style={{color:D.muted}}>{l}: </span><span style={{fontWeight:500}}>{v}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── OPV REPORT ────────────────────────────────────────────────────────────────
function OPVReport({subject,comps,avails,setPage}:{subject:SubjectForm|null,comps:Comp[],avails:Avail[],setPage:(p:string)=>void}) {
  const [downloading,setDownloading] = useState(false)
  const today = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})

  if(!subject) return (
    <div className="au">
      <StepBar current="report"/>
      <Card style={{textAlign:'center' as const,padding:'56px 20px'}}>
        <div style={{fontSize:36,opacity:.15,marginBottom:12}}>📄</div>
        <p style={{fontSize:13,color:D.muted,marginBottom:16}}>Complete the workflow first — start with the Subject Property.</p>
        <Btn onClick={()=>setPage('subject')}>← Enter Subject Property</Btn>
      </Card>
    </div>
  )

  const psfs = comps.filter(c=>c.price_per_sf>0).map(c=>c.price_per_sf)
  const hasPsf = psfs.length>0
  const avg  = hasPsf ? psfs.reduce((a,b)=>a+b,0)/psfs.length : 0
  const minP = hasPsf ? Math.min(...psfs) : 0
  const maxP = hasPsf ? Math.max(...psfs) : 0
  const low  = hasPsf ? avg-(avg-minP)*0.4 : 0
  const high = hasPsf ? avg+(maxP-avg)*0.4 : 0
  const subjSF = parseInt(subject.size)||0

  const analytics = hasPsf ? {mean:avg,median:0,std:0,weighted:avg,min:minP,max:maxP,low,market:avg,high,suggested:avg,aMean:0,count:psfs.length} : null

  const downloadWord = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/generate-opv',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({subject,comps,leaseComps:[],avails,analytics,aiText:'',includeLeaseComps:false,includeAvails:true,includeMarketingStrategy:true,includePcreProfile:true})
      })
      if(!res.ok){alert('Error: '+await res.text());return}
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href=url; a.download=res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]||'OPV_Report.docx'
      a.click(); URL.revokeObjectURL(url)
    } catch(e){alert('Download failed: '+(e as Error).message)}
    setDownloading(false)
  }

  const Row = ({l,v}:{l:string,v:string}) => (
    <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #ece8e0',fontSize:13}}>
      <span style={{color:'#555',fontWeight:600}}>{l}</span>
      <span style={{color:'#1a1a2e'}}>{v}</span>
    </div>
  )
  const DocSection = ({title,children}:{title:string,children:React.ReactNode}) => (
    <div style={{marginBottom:30}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,color:'#c9a84c',
        borderBottom:'1px solid #e0d0a0',paddingBottom:7,marginBottom:14}}>{title}</div>
      {children}
    </div>
  )

  return (
    <div className="au">
      <StepBar current="report"/>
      <div className="no-print" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:600,marginBottom:2}}>OPV Report Preview</h2>
          <p style={{fontSize:13,color:D.muted,fontWeight:300}}>Review the report, then download as a Word document.</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={downloadWord} disabled={downloading} style={{padding:'9px 18px'}}>
            {downloading?'Generating…':'📄 Download Word'}
          </Btn>
          <Btn onClick={()=>window.print()} variant="ghost" style={{padding:'9px 14px'}}>🖨 Print</Btn>
        </div>
      </div>

      {/* White paper */}
      <div style={{background:'#fff',borderRadius:10,padding:'52px 60px',color:'#1a1a2e',maxWidth:860,
        margin:'0 auto',fontFamily:'Georgia,serif',fontSize:13,lineHeight:1.75,
        boxShadow:'0 8px 48px rgba(0,0,0,.55)'}}>

        {/* Cover */}
        <div style={{textAlign:'center' as const,marginBottom:44,paddingBottom:44,borderBottom:'2px solid #1a1a2e'}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'.2em',textTransform:'uppercase' as const,color:'#888',marginBottom:14}}>
            PREMIER COMMERCIAL REAL ESTATE · LONG ISLAND
          </div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:38,fontWeight:600,lineHeight:1.15,marginBottom:10}}>
            Opinion of Value
          </div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:'#c9a84c',marginBottom:18}}>
            {subject.address}
          </div>
          <div style={{display:'inline-block',background:'#0a0c14',color:'#c9a84c',
            padding:'5px 16px',borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' as const}}>
            {subject.type} · {subject.county} County
          </div>
          <div style={{marginTop:20,fontSize:12,color:'#999'}}>Date Prepared: {today}</div>
          {subject.preparedBy&&<div style={{marginTop:4,fontSize:12,color:'#999'}}>Prepared by: {subject.preparedBy}</div>}
          <div style={{marginTop:4,fontSize:12,color:'#999'}}>Premier Commercial Real Estate, LLC · 500 N. Broadway, Suite 105, Jericho, NY 11753</div>
        </div>

        {/* Executive Summary */}
        <DocSection title="I. Executive Summary">
          <p style={{marginBottom:10}}>
            This Opinion of Value has been prepared by Premier Commercial Real Estate for the industrial
            property located at <strong>{subject.address}</strong>. The subject is a{' '}
            {parseInt(subject.size||'0').toLocaleString()} square foot{' '}
            {(subject.type||'industrial').toLowerCase()} facility in {subject.county} County, NY
            {subject.yearBuilt?`, built in ${subject.yearBuilt}`:''}
            {subject.lot?` on a ${subject.lot} parcel`:''}.
          </p>
          <p style={{marginBottom:14}}>
            Based upon our analysis of {comps.length} comparable sale transaction{comps.length!==1?'s':''} and{' '}
            {avails.length} active market listing{avails.length!==1?'s':''}, and current Long Island
            industrial market conditions, we have established the following value conclusion:
          </p>
          {hasPsf&&(
            <div style={{background:'#f8f5ec',border:'1px solid #e0d0a0',borderRadius:6,padding:'18px 24px',textAlign:'center' as const}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20,marginBottom:14}}>
                {([['Low Value',`$${low.toFixed(2)}/SF`],['Market Value',`$${avg.toFixed(2)}/SF`],['High Value',`$${high.toFixed(2)}/SF`]] as [string,string][]).map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:10,color:'#888',textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:4}}>{l}</div>
                    <div style={{fontSize:18,fontWeight:700,color:'#1a1a2e'}}>{v}</div>
                    {subjSF>0&&<div style={{fontSize:11,color:'#888',marginTop:2}}>${(parseFloat(v)*subjSF).toLocaleString()} total</div>}
                  </div>
                ))}
              </div>
              {subjSF>0&&(
                <div style={{borderTop:'1px solid #e0d0a0',paddingTop:14}}>
                  <div style={{fontSize:10,color:'#888',textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:6}}>Estimated Value Range</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:'#c9a84c'}}>
                    ${Math.round(low*subjSF).toLocaleString()} – ${Math.round(high*subjSF).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}
        </DocSection>

        {/* Building Description */}
        <DocSection title="II. Building Description">
          <Row l="Property Address"    v={subject.address}/>
          <Row l="Building Size"       v={subject.size?`+/- ${parseInt(subject.size).toLocaleString()} SF`:'—'}/>
          <Row l="Lot Size"            v={subject.lot||'—'}/>
          <Row l="Clear Ceiling Height" v={subject.ceiling?`${subject.ceiling}' Clear`:'—'}/>
          <Row l="Loading Docks"       v={subject.docks||'—'}/>
          <Row l="Drive-In Doors"      v={subject.driveIn||'—'}/>
          <Row l="Electrical Power"    v={subject.power||'—'}/>
          <Row l="Heat"                v={subject.heat||'—'}/>
          <Row l="Sprinkler System"    v={subject.sprinkler||'—'}/>
          <Row l="Sewer"               v={subject.sewer||'—'}/>
          <Row l="Parking"             v={subject.parking||'—'}/>
          <Row l="Year Built"          v={subject.yearBuilt||'—'}/>
          <Row l="Office Percentage"   v={subject.officePct?`+/- ${subject.officePct}%`:'—'}/>
          <Row l="Condition"           v={subject.condition||'—'}/>
          <Row l="Zoning"              v={subject.zoning||'—'}/>
          <Row l="Real Estate Taxes"   v={subject.taxes?`$${parseInt(subject.taxes).toLocaleString()}${subjSF>0?` ($${(parseInt(subject.taxes)/subjSF).toFixed(2)} PSF)`:''}`:'—'}/>
          {subject.notes&&<div style={{marginTop:12,padding:'10px 14px',background:'#f8f5ec',borderRadius:5,fontSize:12,color:'#555',lineHeight:1.6}}>{subject.notes}</div>}
        </DocSection>

        {/* Sale Comps */}
        {comps.length>0&&(
          <DocSection title="III. Comparable Sale Transactions">
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11,marginBottom:12}}>
              <thead>
                <tr style={{background:'#f0ede0'}}>
                  {['#','Address','Size (SF)','Ceiling','Docks','Drive-In','Sale Price','$/SF','Date'].map(h=>(
                    <th key={h} style={{padding:'6px 8px',textAlign:'left' as const,color:'#555',fontWeight:700,whiteSpace:'nowrap' as const}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comps.map((c,i)=>(
                  <tr key={c.id} style={{background:i%2===0?'#fff':'#faf9f5'}}>
                    <td style={{padding:'6px 8px',color:'#888'}}>{i+1}</td>
                    <td style={{padding:'6px 8px',fontWeight:600,color:'#1a1a2e'}}>{c.address}{c.city?`, ${c.city}`:''}</td>
                    <td style={{padding:'6px 8px'}}>{c.building_sf?Number(c.building_sf).toLocaleString():'—'}</td>
                    <td style={{padding:'6px 8px'}}>{c.ceiling_height?`${c.ceiling_height} ft`:'—'}</td>
                    <td style={{padding:'6px 8px'}}>{c.loading_docks||'—'}</td>
                    <td style={{padding:'6px 8px'}}>{c.drive_ins||'—'}</td>
                    <td style={{padding:'6px 8px',fontWeight:600}}>{c.sale_price?`$${Number(c.sale_price).toLocaleString()}`:'—'}</td>
                    <td style={{padding:'6px 8px',fontWeight:700,color:'#c9a84c'}}>{c.price_per_sf?`$${c.price_per_sf.toFixed(2)}`:'—'}</td>
                    <td style={{padding:'6px 8px',color:'#666'}}>{c.sale_date?c.sale_date.slice(0,7):'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasPsf&&(
              <div style={{marginTop:8,padding:'10px 14px',background:'#f8f5ec',borderRadius:5,fontSize:12,color:'#555'}}>
                <strong>Range:</strong> ${minP.toFixed(2)} – ${maxP.toFixed(2)}/SF &nbsp;|&nbsp;
                <strong>Average:</strong> ${avg.toFixed(2)}/SF &nbsp;|&nbsp;
                <strong>Comps:</strong> {comps.length}
              </div>
            )}
            {comps.map((c,i)=>(
              <div key={c.id} style={{marginTop:22,paddingTop:22,borderTop:'1px solid #ece8e0'}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:'#1a1a2e'}}>Comparable {i+1} — {c.address}{c.city?`, ${c.city}`:''}</div>
                <div style={{marginBottom:10,borderRadius:6,overflow:'hidden' as const,height:200,background:'#f0ede0'}}>
                  <img src={`/api/street-view?address=${encodeURIComponent((c.address+(c.city?', '+c.city:'')+', NY'))}`}
                    alt={c.address} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}
                    style={{width:'100%',height:'100%',objectFit:'cover' as const}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px'}}>
                  {([
                    ['Building Size',c.building_sf?`+/- ${Number(c.building_sf).toLocaleString()} SF`:'—'],
                    ['Lot Size',c.lot_size_ac?`${c.lot_size_ac} acres`:'—'],
                    ['Ceiling Height',c.ceiling_height?`${c.ceiling_height}' Clear`:'—'],
                    ['Loading Docks',c.loading_docks||'—'],
                    ['Drive-In Doors',c.drive_ins||'—'],
                    ['Power',c.power||'—'],
                    ['Sewer',c.sewer||'—'],
                    ['Zoning',c.zoning||'—'],
                    ['Sale Price',c.sale_price?`$${Number(c.sale_price).toLocaleString()}`:'—'],
                    ['Price Per SF',c.price_per_sf?`$${c.price_per_sf.toFixed(2)} PSF`:'—'],
                    ['Sale Date',c.sale_date?c.sale_date.slice(0,10):'—'],
                    ['Buyer',c.buyer||'—'],
                    ['Seller',c.seller||'—'],
                  ] as [string,string][]).map(([l,v])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #f0ede0',fontSize:12}}>
                      <span style={{color:'#666',fontWeight:600}}>{l}</span><span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </DocSection>
        )}

        {/* Availabilities */}
        {avails.length>0&&(
          <DocSection title="IV. Market Availabilities">
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11,marginBottom:12}}>
              <thead>
                <tr style={{background:'#f0ede0'}}>
                  {['#','Address','Size (SF)','Ceiling','Docks','Drive-In','Asking Price','$/SF','Guidance'].map(h=>(
                    <th key={h} style={{padding:'6px 8px',textAlign:'left' as const,color:'#555',fontWeight:700,whiteSpace:'nowrap' as const}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {avails.map((a,i)=>(
                  <tr key={a.id} style={{background:i%2===0?'#fff':'#faf9f5'}}>
                    <td style={{padding:'6px 8px',color:'#888'}}>{i+1}</td>
                    <td style={{padding:'6px 8px',fontWeight:600,color:'#1a1a2e'}}>{a.address}{a.city?`, ${a.city}`:''}</td>
                    <td style={{padding:'6px 8px'}}>{a.building_sf?Number(a.building_sf).toLocaleString():'—'}</td>
                    <td style={{padding:'6px 8px'}}>{a.ceiling_height?`${a.ceiling_height} ft`:'—'}</td>
                    <td style={{padding:'6px 8px'}}>{a.loading_docks||'—'}</td>
                    <td style={{padding:'6px 8px'}}>{a.drive_ins||'—'}</td>
                    <td style={{padding:'6px 8px',fontWeight:600}}>{a.asking_price?`$${Number(a.asking_price).toLocaleString()}`:'—'}</td>
                    <td style={{padding:'6px 8px',fontWeight:700,color:'#c9a84c'}}>{a.price_per_sf?`$${a.price_per_sf.toFixed(2)}`:'—'}</td>
                    <td style={{padding:'6px 8px',color:'#666'}}>{a.pricing_guidance||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {avails.map((a,i)=>(
              <div key={a.id} style={{marginTop:22,paddingTop:22,borderTop:'1px solid #ece8e0'}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:'#1a1a2e'}}>Availability {i+1} — {a.address}{a.city?`, ${a.city}`:''}</div>
                <div style={{marginBottom:10,borderRadius:6,overflow:'hidden' as const,height:200,background:'#f0ede0'}}>
                  <img src={`/api/street-view?address=${encodeURIComponent((a.address+(a.city?', '+a.city:'')+', NY'))}`}
                    alt={a.address} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}
                    style={{width:'100%',height:'100%',objectFit:'cover' as const}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px'}}>
                  {([
                    ['Building Size',a.building_sf?`+/- ${Number(a.building_sf).toLocaleString()} SF`:'—'],
                    ['Lot Size',a.lot_size_ac?`${a.lot_size_ac} acres`:'—'],
                    ['Ceiling Height',a.ceiling_height?`${a.ceiling_height}' Clear`:'—'],
                    ['Loading Docks',a.loading_docks||'—'],
                    ['Drive-In Doors',a.drive_ins||'—'],
                    ['Power',a.power||'—'],
                    ['Sewer',a.sewer||'—'],
                    ['Zoning',a.zoning||'—'],
                    ['Asking Price',a.asking_price?`$${Number(a.asking_price).toLocaleString()}`:'—'],
                    ['Asking $/SF',a.price_per_sf?`$${a.price_per_sf.toFixed(2)} PSF`:'—'],
                    ['Guidance',a.pricing_guidance||'—'],
                    ['Broker',a.listing_broker||'—'],
                  ] as [string,string][]).map(([l,v])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #f0ede0',fontSize:12}}>
                      <span style={{color:'#666',fontWeight:600}}>{l}</span><span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </DocSection>
        )}

        {/* Value Conclusion */}
        {hasPsf&&subjSF>0&&(
          <DocSection title="V. Value Conclusion">
            <p style={{marginBottom:14}}>
              Based upon our analysis of {comps.length} comparable sale transaction{comps.length!==1?'s':''} and
              current Long Island industrial market conditions, it is our opinion that the subject property
              has a current market value in the following range:
            </p>
            <div style={{background:'#f8f5ec',border:'2px solid #c9a84c',borderRadius:6,padding:'20px 28px',textAlign:'center' as const,marginBottom:14}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:'#c9a84c',marginBottom:8}}>
                ${Math.round(low*subjSF).toLocaleString()} – ${Math.round(high*subjSF).toLocaleString()}
              </div>
              <div style={{fontSize:13,color:'#555'}}>${low.toFixed(2)} – ${high.toFixed(2)} Per Square Foot</div>
            </div>
            <p style={{fontSize:11,color:'#777',lineHeight:1.7}}>
              <strong>DISCLAIMER:</strong> This Opinion of Value has been prepared for informational purposes
              only and does not constitute a certified appraisal. It is based upon data available at the time
              of preparation and should not be relied upon as a substitute for a formal USPAP-compliant
              appraisal by a licensed appraiser.
            </p>
          </DocSection>
        )}
      </div>
    </div>
  )
}

// ── NAV ───────────────────────────────────────────────────────────────────────
const NAV = [
  {id:'dashboard', icon:'⊞', label:'Dashboard'},
  {id:'subject',   icon:'🏢', label:'Subject Property'},
  {id:'comps',     icon:'📊', label:'Sale Comps'},
  {id:'avails',    icon:'🔍', label:'Availabilities'},
  {id:'report',    icon:'📄', label:'OPV Report'},
]

const PAGE_LABELS: Record<string,string> = {
  dashboard:'Dashboard', subject:'Subject Property', comps:'Sale Comps',
  avails:'Availabilities', report:'OPV Report',
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function Page() {
  const [page,setPage]       = useState('dashboard')
  const [subject,setSubject] = useState<SubjectForm|null>(null)
  const [comps,setComps]     = useState<Comp[]>([])
  const [avails,setAvails]   = useState<Avail[]>([])

  // Persist state across navigation
  useEffect(()=>{
    try {
      const s = localStorage.getItem('opv_subject'); if(s) setSubject(JSON.parse(s))
      const c = localStorage.getItem('opv_comps');   if(c) setComps(JSON.parse(c))
      const a = localStorage.getItem('opv_avails');  if(a) setAvails(JSON.parse(a))
    } catch {}
  },[])
  useEffect(()=>{ try{localStorage.setItem('opv_subject',JSON.stringify(subject))}catch{} },[subject])
  useEffect(()=>{ try{localStorage.setItem('opv_comps',JSON.stringify(comps))}catch{} },[comps])
  useEffect(()=>{ try{localStorage.setItem('opv_avails',JSON.stringify(avails))}catch{} },[avails])

  return (
    <>
      <style>{css}</style>
      <div style={{display:'flex',minHeight:'100vh',background:D.bg}}>
        {/* Sidebar */}
        <div style={{width:208,flexShrink:0,background:D.surface,borderRight:`1px solid ${D.border}`,
          display:'flex',flexDirection:'column' as const,position:'sticky' as const,top:0,height:'100vh',overflowY:'auto' as const}}>
          {/* Logo */}
          <div style={{padding:'20px 18px 16px',borderBottom:`1px solid ${D.border}`}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,
              background:'linear-gradient(135deg,#e8aa2a,#f0c040)',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:2}}>
              Premier OPV
            </div>
            <div style={{fontSize:9,color:D.faint,letterSpacing:'.14em',textTransform:'uppercase' as const}}>Long Island Industrial</div>
          </div>
          {/* Nav */}
          <nav style={{flex:1,padding:'10px 8px'}}>
            {NAV.map(n=>{
              const active = page===n.id
              const accent = n.id==='comps'?D.blue:n.id==='avails'?D.green:n.id==='report'?D.purple:D.gold
              const badge  = n.id==='comps'&&comps.length>0?comps.length:n.id==='avails'&&avails.length>0?avails.length:0
              const dot    = n.id==='subject'&&!!subject
              return (
                <div key={n.id} onClick={()=>setPage(n.id)}
                  style={{display:'flex',alignItems:'center',gap:9,padding:'9px 10px',borderRadius:7,
                    fontSize:12,fontWeight:active?600:400,cursor:'pointer',marginBottom:2,transition:'all .15s',
                    color:active?accent:D.muted,
                    background:active?`${accent}18`:'transparent',
                    border:`1px solid ${active?accent+'44':'transparent'}`}}>
                  <span style={{fontSize:14,width:16,textAlign:'center' as const}}>{n.icon}</span>
                  <span style={{flex:1}}>{n.label}</span>
                  {dot&&<div style={{width:6,height:6,borderRadius:'50%',background:D.green,flexShrink:0}}/>}
                  {badge>0&&<span style={{fontSize:9,background:active?accent:D.card,color:active?'#0a0c14':accent,
                    padding:'1px 6px',borderRadius:4,fontWeight:700,border:`1px solid ${accent}33`}}>{badge}</span>}
                </div>
              )
            })}
          </nav>
          {/* Footer */}
          <div style={{padding:'12px',borderTop:`1px solid ${D.border}`}}>
            {subject&&(
              <div style={{padding:'8px 10px',background:D.goldDim,border:`1px solid ${D.goldB}`,borderRadius:6,marginBottom:8}}>
                <div style={{fontSize:9,color:D.muted,letterSpacing:'.08em',textTransform:'uppercase' as const,marginBottom:3}}>Subject</div>
                <div style={{fontSize:11,fontWeight:600,color:D.gold,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>
                  {subject.address.split(',')[0]}
                </div>
              </div>
            )}
            <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap' as const}}>
              {comps.length>0&&<Tag color={D.blue}>{comps.length} comps</Tag>}
              {avails.length>0&&<Tag color={D.green}>{avails.length} avails</Tag>}
            </div>
            <div style={{fontSize:10,color:D.faint,textAlign:'center' as const,marginTop:8}}>PCRE · OPV Platform</div>
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1,minHeight:'100vh',overflowY:'auto' as const}}>
          {/* Topbar */}
          <div style={{padding:'13px 28px',borderBottom:`1px solid ${D.border}`,
            display:'flex',alignItems:'center',justifyContent:'space-between',
            background:D.surface,position:'sticky' as const,top:0,zIndex:50}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,letterSpacing:'-.01em'}}>
              {PAGE_LABELS[page]||page}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {subject&&<Tag color={D.gold}>{subject.address.split(',')[0]}</Tag>}
            </div>
          </div>
          {/* Content */}
          <div style={{padding:'24px 28px'}}>
            {page==='dashboard'&&<Dashboard subject={subject} comps={comps} avails={avails} setPage={setPage}/>}
            {page==='subject'  &&<SubjectProperty subject={subject} setSubject={setSubject} setPage={setPage}/>}
            {page==='comps'    &&<SaleComps subject={subject} comps={comps} setComps={setComps} setPage={setPage}/>}
            {page==='avails'   &&<Availabilities subject={subject} avails={avails} setAvails={setAvails} setPage={setPage}/>}
            {page==='report'   &&<OPVReport subject={subject} comps={comps} avails={avails} setPage={setPage}/>}
          </div>
        </div>
      </div>
    </>
  )
}
