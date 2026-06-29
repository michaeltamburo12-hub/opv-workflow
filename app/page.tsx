'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const G = {
  bg:'#FFFFFF', bg2:'#F7F7F7', bg3:'#F0F0F0', bg4:'#FFFFFF', bg5:'#E8E8E8',
  white:'#111111', muted:'#666666', faint:'#AAAAAA',
  border:'rgba(0,0,0,0.09)', borderMid:'rgba(0,0,0,0.14)', borderStrong:'rgba(0,0,0,0.22)',
  gold:'#C8870A', gold2:'#F0B429', gold3:'#FDE68A', goldDim:'rgba(200,135,10,0.09)', goldBorder:'rgba(200,135,10,0.30)',
  green:'#16A34A', greenDim:'rgba(22,163,74,0.08)',
  red:'#DC2626', redDim:'rgba(220,38,38,0.08)',
  blue:'#2563EB', blueDim:'rgba(37,99,235,0.08)',
  cyan:'#0891B2', cyanDim:'rgba(8,145,178,0.08)',
  orange:'#EA580C', orangeDim:'rgba(234,88,12,0.08)',
  purple:'#7C3AED', purpleDim:'rgba(124,58,237,0.08)',
  pink:'#DB2777',
  gradGold:'linear-gradient(135deg,#C8870A,#F0B429)',
  gradBlue:'linear-gradient(135deg,#2563EB,#0891B2)',
  gradGreen:'linear-gradient(135deg,#16A34A,#2563EB)',
  gradPurple:'linear-gradient(135deg,#7C3AED,#DB2777)',
  gradOrange:'linear-gradient(135deg,#EA580C,#C8870A)',
  gradSidebar:'linear-gradient(180deg,#1A1A1A 0%,#111111 100%)',
}

const COUNTIES = ['Nassau', 'Suffolk']
const PROP_TYPES = ['Warehouse','Manufacturing','Flex','Distribution','Industrial']

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:#FFFFFF;color:#111111;-webkit-font-smoothing:antialiased}
  input,select,textarea{font-family:'Inter',sans-serif}
  input:focus,select:focus,textarea:focus{outline:none;border-color:rgba(200,135,10,0.6)!important;box-shadow:0 0 0 3px rgba(200,135,10,0.08)}
  input::placeholder,textarea::placeholder{color:#AAAAAA}
  select option{background:#FFFFFF;color:#111111}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#C8870A,#F0B429);border-radius:4px}
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
    <label style={{fontSize:10,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:G.muted}}>{label}</label>
    {children}
    {note&&<span style={{fontSize:10,color:G.faint,marginTop:2}}>{note}</span>}
  </div>
)

const inputStyle = {background:'#F7F7F7',border:`1px solid rgba(0,0,0,0.14)`,borderRadius:7,color:'#111111',fontSize:13,padding:'10px 13px',width:'100%',transition:'all .18s'}
const Input = ({style={}, ...props}: React.InputHTMLAttributes<HTMLInputElement> & {style?: React.CSSProperties}) => (
  <input {...props} style={{...inputStyle,...style}}/>
)
const Sel = ({children, style={}, ...props}: React.SelectHTMLAttributes<HTMLSelectElement> & {style?: React.CSSProperties}) => (
  <select {...props} style={{...inputStyle,appearance:'none' as const,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238892b0' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'calc(100% - 12px) center',paddingRight:32,...style}}>
    {children}
  </select>
)

const ComboSel = ({options, value, onChange, placeholder, style={}}: {options:string[], value:string, onChange:(v:string)=>void, placeholder?:string, style?:React.CSSProperties}) => {
  const [custom, setCustom] = useState(!options.includes(value) && value !== '')
  if (custom) {
    return (
      <div style={{display:'flex',gap:6}}>
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Type value...'} style={{...inputStyle,flex:1,...style} as React.CSSProperties}/>
        <button onClick={()=>{setCustom(false);onChange(options[0]||'')}} style={{background:G.bg4,border:`1px solid ${G.border}`,borderRadius:7,color:G.muted,fontSize:11,padding:'8px 10px',cursor:'pointer',flexShrink:0,fontFamily:"'Inter',sans-serif"}}>↩ List</button>
      </div>
    )
  }
  return (
    <div style={{display:'flex',gap:6}}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{...inputStyle,appearance:'none' as const,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238892b0' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'calc(100% - 12px) center',paddingRight:32,flex:1,...style} as React.CSSProperties}>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      <button onClick={()=>{setCustom(true);onChange('')}} style={{background:G.bg4,border:`1px solid ${G.border}`,borderRadius:7,color:G.muted,fontSize:11,padding:'8px 10px',cursor:'pointer',flexShrink:0,fontFamily:"'Inter',sans-serif"}} title="Type custom value">✏️</button>
    </div>
  )
}

interface BtnProps { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; variant?: 'primary'|'ghost'|'danger'|'success'|'blue'; disabled?: boolean; size?: 'sm'|'md' }
const Btn = ({children,onClick,style={},variant='primary',disabled,size='md'}: BtnProps) => {
  const base: React.CSSProperties = {fontFamily:"'Inter',sans-serif",fontWeight:600,border:'1px solid transparent',borderRadius:7,cursor:disabled?'not-allowed':'pointer',transition:'all .18s',opacity:disabled?.4:1,fontSize:size==='sm'?11:13,padding:size==='sm'?'6px 13px':'10px 20px',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,whiteSpace:'nowrap' as const}
  const vars: Record<string, React.CSSProperties> = {
    primary:{background:G.gradGold,color:'#111111',boxShadow:'0 2px 16px rgba(240,180,41,0.25)'},
    ghost:{background:'rgba(0,0,0,0.04)',color:'#555555',borderColor:'rgba(0,0,0,0.14)'},
    danger:{background:G.redDim,color:G.red,borderColor:'rgba(255,92,124,0.25)'},
    success:{background:G.greenDim,color:G.green,borderColor:'rgba(0,212,161,0.25)'},
    blue:{background:G.blueDim,color:G.blue,borderColor:'rgba(79,158,255,0.25)'},
  }
  return <button onClick={onClick} disabled={disabled} style={{...base,...vars[variant],...style}}>{children}</button>
}

const Card = ({children,style={},accent}: {children:React.ReactNode,style?: React.CSSProperties,accent?:string}) => (
  <div style={{background:'#FFFFFF',border:`1px solid rgba(0,0,0,0.10)`,borderRadius:12,padding:'22px 24px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',...(accent?{borderTop:`3px solid ${accent}`}:{}),...style}}>
    {children}
  </div>
)

const SectionTitle = ({children,sub,gradient}: {children:React.ReactNode,sub?:string,gradient?:string}) => (
  <div style={{marginBottom:24}}>
    <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:600,letterSpacing:'-.02em',lineHeight:1.15,marginBottom:sub?6:0,...(gradient?{background:gradient,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}:{color:'#111111'})}}>{children}</h2>
    {sub&&<p style={{fontSize:13,color:'#666666',fontWeight:400,lineHeight:1.5,maxWidth:600}}>{sub}</p>}
  </div>
)

const Tag = ({children,color=G.gold}: {children:React.ReactNode,color?:string}) => (
  <span style={{fontSize:10,fontWeight:600,padding:'3px 9px',borderRadius:5,background:`${color}16`,color,letterSpacing:'.04em',border:`1px solid ${color}30`,display:'inline-flex',alignItems:'center',gap:4,whiteSpace:'nowrap' as const}}>{children}</span>
)

const SL = ({children,style={}}: {children:React.ReactNode,style?:React.CSSProperties}) => (
  <p style={{fontSize:10,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase' as const,color:G.muted,marginBottom:10,...style}}>{children}</p>
)

const Divider = ({label}: {label?:string}) => (
  <div style={{display:'flex',alignItems:'center',gap:12,margin:'20px 0'}}>
    <div style={{flex:1,height:'1px',background:`linear-gradient(90deg,transparent,${G.border})`}}/>
    {label&&<span style={{fontSize:10,color:G.faint,letterSpacing:'.1em',textTransform:'uppercase' as const,fontWeight:600,flexShrink:0}}>{label}</span>}
    {label&&<div style={{flex:1,height:'1px',background:`linear-gradient(90deg,${G.border},transparent)`}}/>}
  </div>
)

const WorkflowSteps = ({current}: {current:string}) => {
  const steps = [{id:'subject',label:'Subject'},{id:'comp-search',label:'Sale Comps'},{id:'avail-search',label:'Availabilities'},{id:'lease-comps',label:'Lease Comps'},{id:'scoring',label:'Scoring'},{id:'analytics',label:'Analytics'},{id:'ai-analysis',label:'AI Analysis'},{id:'opv-report',label:'Report'}]
  const idx = steps.findIndex(s=>s.id===current)
  return (
    <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:28,overflowX:'auto',paddingBottom:4}}>
      {steps.map((s,i)=>(
        <div key={s.id} style={{display:'flex',alignItems:'center',flexShrink:0}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
            <div style={{width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,background:i<idx?G.gradGold:i===idx?'#111111':'transparent',color:i<=idx?'#FFFFFF':'#AAAAAA',border:`1.5px solid ${i<idx?G.gold+'80':i===idx?'#111111':'#CCCCCC'}`,boxShadow:i===idx?'0 2px 8px rgba(0,0,0,0.18)':i<idx?`0 2px 8px ${G.gold}40`:'none'}}>{i<idx?'✓':i+1}</div>
            <span style={{fontSize:9,color:i===idx?'#111111':i<idx?G.gold:'#AAAAAA',fontWeight:i===idx?700:400,whiteSpace:'nowrap' as const,letterSpacing:'.04em',textTransform:'uppercase' as const}}>{s.label}</span>
          </div>
          {i<steps.length-1&&<div style={{width:28,height:'1.5px',background:i<idx?`linear-gradient(90deg,${G.gold}60,${G.gold2}40)`:'rgba(0,0,0,0.10)',margin:'0 4px',marginBottom:18,flexShrink:0}}/>}
        </div>
      ))}
    </div>
  )
}

type Folder = {id:string, name:string, type:'comps'|'avails', color:string, items:(Comp|Avail)[], opvAddress?:string, createdAt:number}

const FOLDER_COLORS = [G.gold, G.blue, G.green, G.purple, G.cyan, G.pink, G.orange, G.red]

function FolderManager({folders, setFolders, setPage, comps, setComps, avails, setAvails}: {folders:Folder[], setFolders:(f:Folder[])=>void, setPage:(p:string)=>void, comps:Comp[], setComps:(c:Comp[])=>void, avails:Avail[], setAvails:(a:Avail[])=>void}) {
  const [activeFolder, setActiveFolder] = useState<string|null>(null)
  const [activeOPV, setActiveOPV] = useState<string|null>(null)
  const [manualName, setManualName] = useState('')
  const [manualType, setManualType] = useState<'comps'|'avails'>('comps')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fetchingPhoto, setFetchingPhoto] = useState<string|null>(null)

  const fetchPhoto = async (item: Comp|Avail) => {
    const url = (item as Comp).loopnet_url
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
      } else {
        alert('Could not find a photo on LoopNet for this property. You can paste a photo URL manually.')
      }
    } catch { alert('Photo fetch failed.') }
    setFetchingPhoto(null)
  }

  // Group folders by OPV address
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
    setFolders(folders.map(f=>f.id===folderId?{...f,items:f.items.filter((i:Comp|Avail)=>i.id!==itemId)}:f))
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
        {/* LEFT — OPV list */}
        <div>
          {/* Manual folder creation */}
          <Card style={{marginBottom:16}}>
            <SL>Add Manual Folder</SL>
            <Field label="Folder Name"><Input placeholder="Custom folder name" value={manualName} onChange={e=>setManualName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createManual()}/></Field>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              {(['comps','avails'] as const).map(t=>(
                <div key={t} onClick={()=>setManualType(t)} style={{flex:1,padding:'8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,textAlign:'center' as const,background:manualType===t?t==='comps'?G.goldDim:G.cyanDim:'transparent',color:manualType===t?t==='comps'?G.gold:G.cyan:G.muted,border:`1px solid ${manualType===t?t==='comps'?G.goldBorder:G.cyan+'44':G.border}`}}>
                  {t==='comps'?'📊 Sale Comps':'🏭 Availabilities'}
                </div>
              ))}
            </div>
            <Btn onClick={createManual} style={{width:'100%',padding:9,fontSize:12}}>＋ Add Folder</Btn>
          </Card>

          {/* OPV Groups */}
          {folders.length===0&&(
            <Card style={{textAlign:'center' as const,padding:'32px 16px'}}>
              <div style={{fontSize:32,opacity:.2,marginBottom:10}}>📁</div>
              <p style={{fontSize:12,color:G.faint,lineHeight:1.6}}>Folders appear here automatically when you save a subject property.</p>
            </Card>
          )}
          {opvGroups.map(([key, grpFolders])=>{
            const label = key==='__manual__' ? 'Manual Folders' : key
            const isOpen = activeOPV===key
            const color = grpFolders[0]?.color || G.gold
            return (
              <div key={key} style={{marginBottom:10}}>
                <div onClick={()=>setActiveOPV(isOpen?null:key)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:9,cursor:'pointer',background:isOpen?`${color}12`:G.bg3,border:`1px solid ${isOpen?color+'44':G.border}`,transition:'all .2s',userSelect:'none' as const}}>
                  <div style={{width:10,height:10,borderRadius:3,background:color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,color:isOpen?G.white:G.muted}}>{label}</div>
                    <div style={{fontSize:10,color:G.faint}}>{grpFolders.length} folder{grpFolders.length!==1?'s':''} · {grpFolders.reduce((s,f)=>s+f.items.length,0)} items</div>
                  </div>
                  <span style={{fontSize:10,color:G.faint}}>{isOpen?'▲':'▼'}</span>
                </div>
                {isOpen&&(
                  <div style={{paddingLeft:8,marginTop:4}}>
                    {grpFolders.map(f=>(
                      <div key={f.id} onClick={()=>{setActiveFolder(activeFolder===f.id?null:f.id);setSelected(new Set())}} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 12px',borderRadius:7,cursor:'pointer',marginBottom:4,border:`1px solid ${activeFolder===f.id?f.color+'66':G.border}`,background:activeFolder===f.id?`${f.color}15`:G.bg4,transition:'all .15s'}}>
                        <div style={{fontSize:14}}>{f.type==='comps'?'📊':'🏭'}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{f.name}</div>
                          <div style={{fontSize:10,color:G.faint}}>{f.items.length} item{f.items.length!==1?'s':''}</div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();deleteFolder(f.id)}} style={{background:'transparent',border:'none',color:G.faint,cursor:'pointer',fontSize:13,padding:'2px 4px',lineHeight:1}} title="Delete">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* RIGHT — Folder contents */}
        <div>
          {!activeFolder&&(
            <Card style={{textAlign:'center' as const,padding:'64px 20px'}}>
              <div style={{fontSize:48,opacity:.12,marginBottom:16}}>📂</div>
              <p style={{fontSize:15,fontWeight:600,marginBottom:8}}>Select a Folder</p>
              <p style={{fontSize:13,color:G.muted,maxWidth:380,margin:'0 auto 20px'}}>Click an OPV on the left, then select its sale comp or availability folder to view and manage items.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <Btn variant="ghost" onClick={()=>setPage('comp-search')} style={{fontSize:12,padding:'9px 16px'}}>→ Comp Search</Btn>
                <Btn variant="ghost" onClick={()=>setPage('avail-search')} style={{fontSize:12,padding:'9px 16px'}}>→ Avail Search</Btn>
              </div>
            </Card>
          )}
          {active&&(
            <Card>
              {/* Header */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                    <div style={{width:12,height:12,borderRadius:3,background:active.color}}/>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600}}>{active.name}</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center',paddingLeft:22}}>
                    <Tag color={active.type==='comps'?G.gold:G.cyan}>{active.type==='comps'?'📊 Sale Comps':'🏭 Availabilities'}</Tag>
                    {active.opvAddress&&<Tag color={G.muted}>{active.opvAddress}</Tag>}
                  </div>
                </div>
                <div style={{textAlign:'right' as const}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:active.color}}>{active.items.length}</div>
                  <div style={{fontSize:10,color:G.faint}}>item{active.items.length!==1?'s':''}</div>
                </div>
              </div>

              {active.items.length===0&&(
                <div style={{textAlign:'center' as const,padding:'40px 20px',borderTop:`1px solid ${G.border}`}}>
                  <p style={{color:G.muted,fontSize:13,marginBottom:14}}>No items yet. Search for properties and click "Add to Folder".</p>
                  <Btn variant="ghost" onClick={()=>setPage(active.type==='comps'?'comp-search':'avail-search')} style={{fontSize:12,padding:'9px 16px'}}>Go to {active.type==='comps'?'Comp Search':'Avail Search'} →</Btn>
                </div>
              )}

              {active.items.length>0&&(
                <>
                  {/* Select controls */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderTop:`1px solid ${G.border}`,borderBottom:`1px solid ${G.border}`,marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <input type="checkbox"
                        checked={selected.size===active.items.length}
                        onChange={()=>setSelected(selected.size===active.items.length?new Set():new Set(active.items.map(i=>i.id)))}
                        style={{width:15,height:15,cursor:'pointer',accentColor:active.color}}
                      />
                      <span style={{fontSize:11,color:G.muted}}>{selected.size===0?'Select all':`${selected.size} of ${active.items.length} selected`}</span>
                    </div>
                    {selected.size>0&&(
                      <span onClick={()=>setSelected(new Set())} style={{fontSize:11,color:G.muted,cursor:'pointer',textDecoration:'underline'}}>Clear</span>
                    )}
                  </div>

                  {/* Items */}
                  {active.items.map((item,i)=>{
                    const c = item as Comp; const a = item as Avail
                    const isChecked = selected.has(item.id)
                    const alreadyInOPV = active.type==='comps'
                      ? comps.some(x=>x.id===item.id)
                      : avails.some(x=>x.id===item.id)
                    return (
                      <div key={item.id} onClick={()=>{const s=new Set(selected);isChecked?s.delete(item.id):s.add(item.id);setSelected(s)}}
                        style={{padding:'11px 8px',borderBottom:i<active.items.length-1?`1px solid ${G.border}`:'none',display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer',borderRadius:7,background:isChecked?`${active.color}0D`:'transparent',transition:'background .12s'}}>
                        <input type="checkbox" checked={isChecked} onChange={()=>{}} onClick={e=>e.stopPropagation()} style={{width:15,height:15,marginTop:2,cursor:'pointer',accentColor:active.color,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                            <div style={{fontSize:13,fontWeight:600}}>{item.address}{(item as Comp).city?`, ${(item as Comp).city}`:''}</div>
                            {alreadyInOPV&&<Tag color={G.green}>✓ In OPV</Tag>}
                          </div>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:6}}>
                            {item.building_sf&&<Tag color={G.blue}>{Number(item.building_sf).toLocaleString()} SF</Tag>}
                            {active.type==='comps'&&(c.price_per_sf||(c.sale_price&&c.building_sf))&&<Tag color={G.gold}>${(c.price_per_sf||Number(c.sale_price)/Number(c.building_sf)).toFixed(2)}/SF</Tag>}
                            {active.type==='comps'&&c.sale_date&&<Tag color={G.muted}>{fmtDate(c.sale_date)}</Tag>}
                            {active.type==='avails'&&a.asking_price&&<Tag color={G.purple}>${Number(a.asking_price).toLocaleString()}</Tag>}
                            {active.type==='avails'&&a.pricing_guidance&&<Tag color={G.muted}>{a.pricing_guidance}</Tag>}
                          </div>
                          {/* Photo strip */}
                          <div style={{display:'flex',alignItems:'center',gap:8}} onClick={e=>e.stopPropagation()}>
                            {(item as Comp & {photo_url?:string}).photo_url
                              ? <img src={(item as Comp & {photo_url?:string}).photo_url} alt={item.address} style={{width:120,height:68,objectFit:'cover',borderRadius:5,border:`1px solid ${G.border}`,flexShrink:0}}/>
                              : item.address
                                ? <img src={`/api/street-view?address=${encodeURIComponent(item.address + (((item as Comp).city) ? ', ' + (item as Comp).city + ', NY' : ', NY'))}`} alt={item.address} style={{width:120,height:68,objectFit:'cover',borderRadius:5,border:`1px solid ${G.border}`,flexShrink:0}} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                                : <div style={{width:120,height:68,background:G.bg3,borderRadius:5,border:`1px dashed ${G.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:G.faint,flexShrink:0}}>No Photo</div>
                            }
                            <div style={{display:'flex',flexDirection:'column',gap:4}}>
                              {(item as Comp).loopnet_url&&<Btn variant="ghost" size="sm" disabled={fetchingPhoto===item.id} onClick={()=>fetchPhoto(item)} style={{fontSize:10,padding:'4px 10px'}}>{fetchingPhoto===item.id?'Fetching...':'📸 Fetch from LoopNet'}</Btn>}
                              <input placeholder="Or paste photo URL..." style={{...{background:'#F7F7F7',border:'1px solid rgba(0,0,0,0.14)',borderRadius:5,color:'#111',fontSize:10,padding:'4px 8px',width:180}}} onClick={e=>e.stopPropagation()} onChange={e=>{
                                const val=e.target.value.trim()
                                if(val) setFolders(folders.map(f=>f.id===activeFolder?{...f,items:f.items.map(i=>i.id===item.id?{...i,photo_url:val}:i)}:f))
                              }}/>
                            </div>
                          </div>
                        </div>
                        <button onClick={e=>{e.stopPropagation();removeItem(active.id,item.id);setSelected(s=>{const n=new Set(s);n.delete(item.id);return n})}} style={{background:'transparent',border:'none',color:G.faint,cursor:'pointer',fontSize:16,padding:'2px 6px',flexShrink:0}} title="Remove from folder">×</button>
                      </div>
                    )
                  })}

                  {/* Add to OPV action bar */}
                  <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${G.border}`,display:'flex',gap:10,alignItems:'center'}}>
                    <Btn
                      disabled={selected.size===0}
                      onClick={()=>{
                        const items = active.items.filter(i=>selected.has(i.id))
                        if(active.type==='comps'){
                          const existing = comps.map(c=>c.id)
                          const toAdd = items.filter(i=>!existing.includes(i.id)) as Comp[]
                          setComps([...comps,...toAdd])
                        } else {
                          const existing = avails.map(a=>a.id)
                          const toAdd = items.filter(i=>!existing.includes(i.id)) as Avail[]
                          setAvails([...avails,...toAdd])
                        }
                        alert(`${items.length} propert${items.length===1?'y':'ies'} added to your OPV.`)
                        setPage(active.type==='comps'?'scoring':'analytics')
                      }}
                      style={{flex:1,padding:'11px 16px',fontSize:13}}
                    >
                      {selected.size===0?'Select properties to add':'➕ Add ' + selected.size + ' to OPV Report'}
                    </Btn>
                    {(active.type==='comps'?comps.length:avails.length)>0&&(
                      <Btn variant="ghost" onClick={()=>setPage(active.type==='comps'?'scoring':'analytics')} style={{fontSize:12,padding:'10px 14px',flexShrink:0}}>
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

const NAV = [
  {id:'dashboard',icon:'⊞',label:'Dashboard',section:'main'},
  {id:'subject',icon:'🏢',label:'Subject Property',section:'main'},
  {id:'database',icon:'🗄',label:'Database Manager',section:'main'},
  {id:'comp-search',icon:'🔎',label:'Sale Comp Search',section:'workflow'},
  {id:'avail-search',icon:'🔍',label:'Availability Search',section:'workflow'},
  {id:'lease-comps',icon:'📋',label:'Lease Comps',section:'workflow'},
  {id:'folders',icon:'📁',label:'OPV Folders',section:'workflow'},
  {id:'scoring',icon:'⭐',label:'Comp Scoring',section:'workflow'},
  {id:'analytics',icon:'📈',label:'Analytics',section:'workflow'},
  {id:'ai-analysis',icon:'🤖',label:'AI Broker Analysis',section:'workflow'},
  {id:'opv-report',icon:'📄',label:'OPV Report',section:'exports'},
]
const PAGE_TITLES: Record<string,string> = {
  dashboard:'Dashboard',subject:'Subject Property',database:'Database Manager',
  'comp-search':'Sale Comp Search','avail-search':'Market Availability Search',
  'lease-comps':'Lease Comparable Search',
  folders:'OPV Folders',
  scoring:'Comparable Scoring',analytics:'Analytics & Valuation','ai-analysis':'AI Broker Analysis','opv-report':'OPV Report',
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
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File) => {
    setParsing(true); setParsed(null); setResult(null); setCreateSQL(''); setNewTableName(''); setIsNewTable(false)
    const form = new FormData(); form.append('file', file)
    try {
      const res = await fetch('/api/import', {method:'POST', body:form})
      const data = await res.json()
      if (data.error) { alert('Parse error: ' + data.error); setParsing(false); return }
      setParsed(data)
      if (data.existingTables?.length) setTargetTable(data.existingTables[0])
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

  const handleNewTableName = (v: string) => {
    setNewTableName(v)
    const clean = sanitizeTableName(v)
    setCreateSQL(clean ? genSQL(clean) : '')
  }

  const runImport = async () => {
    if (!parsed) return
    const table = isNewTable ? sanitizeTableName(newTableName) : targetTable
    if (!table) { alert('Select or name a table first'); return }
    setImporting(true); setResult(null); setImportError(''); setImportProgress('')

    try {
      const numFields = parsed.columnTypes.filter(c=>c.type==='number').map(c=>c.name)
      const rowsToInsert = parsed.allRows.map(row => {
        const mapped: Record<string,unknown> = {}
        Object.entries(row).forEach(([k,v]) => {
          if (numFields.includes(k)) mapped[k] = v ? parseFloat(v.replace(/[$,]/g,''))||null : null
          else mapped[k] = v || null
        })
        return mapped
      })

      // Send in chunks of 200 rows to avoid Vercel body size limits
      const CHUNK = 200
      let totalInserted = 0, totalFailed = 0, lastError = ''
      const chunks = Math.ceil(rowsToInsert.length / CHUNK)

      for (let i = 0; i < chunks; i++) {
        const chunk = rowsToInsert.slice(i * CHUNK, (i + 1) * CHUNK)
        setImportProgress(`Importing batch ${i+1} of ${chunks}...`)

        // Only send createSQL on first chunk
        const body: Record<string,unknown> = {tableName: table, rows: chunk}
        if (i === 0 && isNewTable && createSQL) body.createSQL = createSQL

        const res = await fetch('/api/import?action=insert', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(body)
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Server error: ${res.status} — ${text.slice(0,200)}`)
        }

        const data = await res.json()
        if (data.error) throw new Error(data.error)
        totalInserted += data.inserted || 0
        totalFailed += data.failed || 0
        if (data.firstError && !lastError) lastError = data.firstError
      }

      setResult({inserted: totalInserted, failed: totalFailed, total: rowsToInsert.length, firstError: lastError})
    } catch(e) {
      setImportError((e as Error).message)
    }
    setImporting(false); setImportProgress('')
  }

  const ACCEPTED = '.csv,.tsv,.xlsx,.xls,.numbers,.txt'

  return (
    <div>
      {/* Drop zone */}
      {!parsed&&(
        <div
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={handleDrop}
          onClick={()=>fileRef.current?.click()}
          style={{border:`2px dashed ${dragging?G.blue:G.border}`,borderRadius:14,padding:'56px 32px',textAlign:'center' as const,cursor:'pointer',background:dragging?`${G.blue}08`:G.bg3,transition:'all .2s',marginBottom:20}}>
          <div style={{fontSize:48,marginBottom:16,opacity:.5}}>📂</div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:G.white}}>Drop your file here</div>
          <div style={{fontSize:12,color:G.muted,marginBottom:16}}>Supports CSV, Excel (.xlsx), TSV, and Apple Numbers (.numbers) files</div>
          <Btn variant="blue" style={{padding:'10px 24px'}}>Browse Files</Btn>
          <input ref={fileRef} type="file" accept={ACCEPTED} style={{display:'none'}} onChange={e=>{ const f=e.target.files?.[0]; if(f) processFile(f) }}/>
        </div>
      )}

      {parsing&&<Card style={{textAlign:'center' as const,padding:48}}>
        <div style={{width:36,height:36,border:`2px solid ${G.border}`,borderTopColor:G.gold,borderRadius:'50%',margin:'0 auto 16px',animation:'spin 1s linear infinite'}}/>
        <p style={{color:G.muted}}>Reading file...</p>
      </Card>}

      {parsed&&!result&&(
        <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:20,alignItems:'start'}}>
          {/* Left panel */}
          <div>
            <Card style={{marginBottom:14,border:`1px solid ${G.goldBorder}`}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:G.gold,marginBottom:6}}>📄 {parsed.fileName}</div>
              <div style={{fontSize:12,color:G.muted,marginBottom:16}}><strong style={{color:G.white}}>{parsed.totalRows.toLocaleString()}</strong> rows · <strong style={{color:G.white}}>{parsed.headers.length}</strong> columns detected</div>

              <Divider label="Target Table"/>
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <div onClick={()=>{setIsNewTable(false)}} style={{flex:1,padding:'8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,textAlign:'center' as const,background:!isNewTable?G.blueDim:'transparent',color:!isNewTable?G.blue:G.muted,border:`1px solid ${!isNewTable?G.blue+'55':G.border}`}}>Existing Table</div>
                <div onClick={()=>{setIsNewTable(true)}} style={{flex:1,padding:'8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,textAlign:'center' as const,background:isNewTable?G.greenDim:'transparent',color:isNewTable?G.green:G.muted,border:`1px solid ${isNewTable?G.green+'55':G.border}`}}>New Table</div>
              </div>

              {!isNewTable&&(
                <Field label="Select or type table name">
                  <Sel value={parsed.existingTables.includes(targetTable)?targetTable:'__custom__'} onChange={e=>{if(e.target.value!=='__custom__')setTargetTable(e.target.value)}}>
                    {parsed.existingTables.map(t=><option key={t} value={t}>{t}</option>)}
                    <option value="__custom__">Type a name...</option>
                  </Sel>
                  {(!parsed.existingTables.includes(targetTable)||targetTable==='__custom__')&&(
                    <Input placeholder="table_name" style={{marginTop:8}} value={targetTable==='__custom__'?'':targetTable} onChange={e=>setTargetTable(sanitizeTableName(e.target.value))}/>
                  )}
                </Field>
              )}

              {isNewTable&&(
                <div>
                  <Field label="New Table Name">
                    <Input placeholder="e.g. market_availabilities" value={newTableName} onChange={e=>handleNewTableName(e.target.value)}/>
                  </Field>
                  {newTableName.trim()&&(
                    <div style={{padding:'10px 12px',borderRadius:8,background:G.greenDim,border:`1px solid ${G.green}44`,fontSize:11,color:G.green,marginTop:4,lineHeight:1.6}}>
                      ✓ Table will be created automatically on import<br/>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,opacity:.8}}>→ {sanitizeTableName(newTableName)}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Btn
              onClick={runImport}
              disabled={importing || (isNewTable && !newTableName.trim())}
              style={{width:'100%',padding:13,fontSize:13}}>
              {importing ? (importProgress||'Starting import...') : '📥 Import to Supabase'}
            </Btn>
            {importError&&(
              <div style={{marginTop:10,padding:'10px 14px',borderRadius:8,background:'#2a0a0a',border:'1px solid #ff444433',fontSize:11,color:'#ff6b6b',lineHeight:1.6}}>
                <strong>Import failed:</strong> {importError}
              </div>
            )}
            <Btn variant="ghost" onClick={()=>{setParsed(null);setResult(null);if(fileRef.current)fileRef.current.value=''}} style={{width:'100%',padding:10,marginTop:8,fontSize:12}}>Upload Different File</Btn>
          </div>

          {/* Right panel — preview */}
          <Card>
            <SL>Column Preview ({parsed.headers.length} columns)</SL>
            <div style={{display:'flex',flexWrap:'wrap' as const,gap:6,marginBottom:16}}>
              {parsed.columnTypes.map(c=>(
                <div key={c.name} style={{padding:'4px 10px',borderRadius:5,background:c.type==='number'?G.goldDim:c.type==='date'?G.cyanDim:G.bg4,border:`1px solid ${c.type==='number'?G.goldBorder:c.type==='date'?G.cyan+'33':G.border}`,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
                  <span style={{color:c.type==='number'?G.gold:c.type==='date'?G.cyan:G.muted}}>{c.name}</span>
                  <span style={{color:G.faint,marginLeft:5}}>{c.type==='number'?'#':c.type==='date'?'📅':'T'}</span>
                </div>
              ))}
            </div>
            <SL>Data Preview — First 8 Rows</SL>
            <div style={{overflowX:'auto',fontSize:11}}>
              <table style={{width:'100%',borderCollapse:'collapse' as const,minWidth:600}}>
                <thead><tr style={{background:G.bg4}}>
                  {parsed.headers.slice(0,8).map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left' as const,fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:G.muted,whiteSpace:'nowrap' as const,borderBottom:`1px solid ${G.border}`}}>{h}</th>)}
                  {parsed.headers.length>8&&<th style={{padding:'7px 10px',color:G.faint,fontSize:9,borderBottom:`1px solid ${G.border}`}}>+{parsed.headers.length-8} more</th>}
                </tr></thead>
                <tbody>{parsed.preview.map((row,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${G.border}`}}>
                    {parsed!.headers.slice(0,8).map(h=><td key={h} style={{padding:'6px 10px',color:G.white,fontSize:11,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{row[h]||'—'}</td>)}
                    {parsed!.headers.length>8&&<td style={{padding:'6px 10px',color:G.faint}}>…</td>}
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
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,marginBottom:12}}>Import Complete</div>
          <div style={{display:'flex',gap:24,justifyContent:'center',marginBottom:20}}>
            <div style={{textAlign:'center' as const}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:28,fontWeight:700,color:G.green}}>{result.inserted.toLocaleString()}</div>
              <div style={{fontSize:11,color:G.muted}}>Rows imported</div>
            </div>
            {result.failed>0&&<div style={{textAlign:'center' as const}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:28,fontWeight:700,color:G.red}}>{result.failed.toLocaleString()}</div>
              <div style={{fontSize:11,color:G.muted}}>Failed</div>
            </div>}
          </div>
          {result?.firstError&&(
            <div style={{margin:'0 auto 16px',maxWidth:480,padding:'10px 14px',borderRadius:8,background:'#2a0a0a',border:'1px solid #ff444433',fontSize:11,color:'#ff6b6b',lineHeight:1.6,textAlign:'left' as const}}>
              <strong>Insert error:</strong> {result.firstError}
            </div>
          )}
          <p style={{fontSize:12,color:G.muted,marginBottom:20}}>{result?.failed===0?'Data is now live in your Supabase database.':'Check the error above — fix it and try again.'}</p>
          <Btn onClick={()=>{setParsed(null);setResult(null);if(fileRef.current)fileRef.current.value=''}} style={{padding:'10px 24px'}}>Import Another File</Btn>
        </Card>
      )}
    </div>
  )
}

// ── DATABASE MANAGER ──────────────────────────────────────────────────────────
function DatabaseManager() {
  const [tab, setTab] = useState<'comps'|'avails'>('comps')
  const [subTab, setSubTab] = useState<'add'|'import'|'file'|'browse'>('add')
  const [saving, setSaving] = useState(false)
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<Record<string,string>[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ok:number,fail:number}|null>(null)
  type BrowseRow = {id:string,address?:string,city?:string,county?:string,building_sf?:number,price_per_sf?:number,sale_date?:string,asking_price?:number,status?:string,[key:string]:unknown}
  const [browseData, setBrowseData] = useState<BrowseRow[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseCount, setBrowseCount] = useState(0)
  const [browseOffset, setBrowseOffset] = useState(0)
  const PAGE_SIZE = 20

  const blankComp = {address:'',city:'',county:'Nassau',state:'NY',property_type:'Warehouse',building_sf:'',lot_size_ac:'',ceiling_height:'',loading_docks:'',drive_ins:'',power:'',heat:'',parking:'',sprinkler:'',sewer:'Municipal',zoning:'',real_estate_taxes:'',sale_price:'',price_per_sf:'',sale_date:'',sale_type:'Arm\'s Length',buyer:'',seller:'',listing_broker:'',market:'',submarket:'',zip_code:'',notes:''}
  const blankAvail = {address:'',city:'',county:'Nassau',state:'NY',property_type:'Warehouse',building_sf:'',lot_size_ac:'',ceiling_height:'',loading_docks:'',drive_ins:'',power:'',heat:'',parking:'',sprinkler:'',sewer:'Municipal',zoning:'',real_estate_taxes:'',asking_price:'',price_per_sf:'',pricing_guidance:'',availability_type:'For Sale',status:'Available',listing_broker:'',market:'',submarket:'',zip_code:'',loopnet_url:'',notes:''}
  const [compForm, setCompForm] = useState({...blankComp})
  const [availForm, setAvailForm] = useState({...blankAvail})

  const setC = (k:string,v:string) => setCompForm(f=>({...f,[k]:v}))
  const setA = (k:string,v:string) => setAvailForm(f=>({...f,[k]:v}))

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

  // Maps common CoStar/LoopNet column names to our database column names
  const COLUMN_ALIASES: Record<string,string> = {
    'street_address':'address', 'property_address':'address', 'full_address':'address',
    'property_name':'address', 'building_address':'address',
    'rentable_building_area_(sf)':'building_sf', 'rentable_building_area':'building_sf',
    'building_size':'building_sf', 'bldg_sf':'building_sf', 'total_sf':'building_sf',
    'gla_(sf)':'building_sf', 'building_size_(sf)':'building_sf',
    'clear_ceiling_height':'ceiling_height', 'clear_height':'ceiling_height',
    'number_of_loading_docks':'loading_docks', 'dock_doors':'loading_docks', 'docks':'loading_docks',
    'drive_in_doors':'drive_ins', 'grade_level_doors':'drive_ins', 'drive-in_doors':'drive_ins',
    'electric_service':'power', 'electrical_service':'power', 'electrical':'power',
    'sewer_connection':'sewer',
    'for_sale_price':'asking_price', 'sale_price':'asking_price', 'list_price':'asking_price',
    'price/sf':'price_per_sf', 'price_/_sf':'price_per_sf', 'asking_price/sf':'price_per_sf',
    'sprinkler_system':'sprinkler', 'fire_sprinklers':'sprinkler',
    'real_estate_taxes':'real_estate_taxes', 're_taxes':'real_estate_taxes', 'annual_taxes':'real_estate_taxes',
    'lot_size_(ac)':'lot_size_ac', 'land_area':'lot_size_ac', 'land_area_(ac)':'lot_size_ac', 'lot_acres':'lot_size_ac',
    'cap_rate':'actual_cap_rate', 'capitalization_rate':'actual_cap_rate',
    'transaction_date':'sale_date', 'close_of_escrow':'sale_date',
    'grantor':'seller', 'grantee':'buyer', 'vendor':'seller', 'purchaser':'buyer',
    'listing_agent':'listing_broker', 'broker':'listing_broker',
    'sub_market':'submarket', 'sub-market':'submarket',
    'zip':'zip_code', 'postal_code':'zip_code',
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
    if (!rows.length) { alert('No data found. Paste CSV or tab-separated data with a header row.'); return }
    setImportPreview(rows.slice(0,5))
  }

  const numFields = tab==='comps'
    ? ['building_sf','lot_size_ac','real_estate_taxes','sale_price','price_per_sf']
    : ['building_sf','lot_size_ac','real_estate_taxes','asking_price','price_per_sf']

  const runImport = async () => {
    const rows = parseCSV(importText)
    if (!rows.length) return
    setImporting(true); setImportResult(null)
    const table = tab==='comps'?'industrial_sale_comps':'market_availabilities'
    let ok=0, fail=0
    const BATCH=50
    for (let i=0;i<rows.length;i+=BATCH) {
      const batch = rows.slice(i,i+BATCH).map(r=>{
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
    setImporting(false); setImportResult({ok,fail})
    if (ok>0) { setImportText(''); setImportPreview([]) }
  }

  const loadBrowse = async (offset=0) => {
    setBrowseLoading(true)
    const table = tab==='comps'?'industrial_sale_comps':'market_availabilities'
    const {data, count, error} = await supabase.from(table).select('*',{count:'exact'}).order('created_at',{ascending:false}).range(offset,offset+PAGE_SIZE-1)
    if (!error) { setBrowseData((data||[]) as BrowseRow[]); setBrowseCount(count||0); setBrowseOffset(offset) }
    setBrowseLoading(false)
  }

  const deleteRow = async (id: string) => {
    if (!confirm('Delete this record?')) return
    const table = tab==='comps'?'industrial_sale_comps':'market_availabilities'
    await supabase.from(table).delete().eq('id',id)
    setBrowseData((prev: BrowseRow[])=>prev.filter((r: BrowseRow)=>r.id!==id))
    setBrowseCount(c=>c-1)
  }

  const G2 = {display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}
  const G3 = {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}

  const tabBtn = (id: 'comps'|'avails', label: string) => (
    <div onClick={()=>{setTab(id);setSubTab('add');setBrowseData([]);setImportPreview([]);setImportResult(null)}} style={{padding:'8px 20px',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700,background:tab===id?G.gradGold:'transparent',color:tab===id?'#111111':G.muted,border:`1px solid ${tab===id?'transparent':G.border}`,transition:'all .2s'}}>{label}</div>
  )
  const subTabBtn = (id: 'add'|'import'|'file'|'browse', label: string, icon: string) => (
    <div onClick={()=>{ setSubTab(id); if(id==='browse') loadBrowse(0) }} style={{padding:'7px 16px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:600,display:'flex',alignItems:'center',gap:6,background:subTab===id?`${G.blue}22`:'transparent',color:subTab===id?G.blue:G.muted,border:`1px solid ${subTab===id?G.blue+'55':G.border}`,transition:'all .2s'}}><span>{icon}</span>{label}</div>
  )

  return (
    <div className="anim-in">
      <SectionTitle sub="Add single records, upload files, paste CSV, or browse and manage your Supabase database directly.">Database Manager</SectionTitle>

      {/* Table selector */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {tabBtn('comps','📊 Sale Comps')}
        {tabBtn('avails','🏭 Availabilities')}
      </div>

      {/* Sub-tab selector */}
      <div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap' as const}}>
        {subTabBtn('add','Add Record','➕')}
        {subTabBtn('file','Upload File','📂')}
        {subTabBtn('import','Paste CSV','📥')}
        {subTabBtn('browse','Browse & Manage','📋')}
      </div>

      {/* ── FILE UPLOAD IMPORT ── */}
      {subTab==='file' && <FileImport/>}

      {/* ── ADD SINGLE RECORD ── */}
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

      {/* ── BULK IMPORT ── */}
      {subTab==='import' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}}>
          <Card>
            <SL>Paste CSV or Tab-Separated Data</SL>
            <p style={{fontSize:12,color:G.muted,marginBottom:8,lineHeight:1.6}}>
              Export from Excel, Numbers, or CoStar and paste below. First row must be a header row. Column names are matched automatically — use names like <span style={{color:G.gold,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>address, building_sf, sale_price, sale_date, buyer, seller</span>, etc.
            </p>
            <p style={{fontSize:11,color:G.faint,marginBottom:14,lineHeight:1.5}}>
              💡 CoStar &amp; LoopNet exports are supported — common column names like <em>Street Address, Building Size, Clear Ceiling Height, Loading Docks</em> are automatically mapped to the correct database fields.
            </p>
            <Field label="Paste data here" full>
              <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={"address,city,county,building_sf,sale_price,sale_date,buyer,seller\n45 Orville Dr,Bohemia,Suffolk,28500,4250000,2024-03-15,Acme LLC,Smith Realty"} style={{...inputStyle as React.CSSProperties,minHeight:220,resize:'vertical' as const,lineHeight:1.5,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}/>
            </Field>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" onClick={handleImportPreview} style={{flex:1,padding:10}}>Preview First 5 Rows</Btn>
              <Btn onClick={runImport} disabled={importing||!importText.trim()} style={{flex:1,padding:10}}>{importing?'Importing...':'📥 Import All Rows'}</Btn>
            </div>
            {importResult&&(
              <div style={{marginTop:12,padding:'12px 16px',borderRadius:8,background:importResult.fail>0?G.redDim:G.greenDim,border:`1px solid ${importResult.fail>0?G.red+'33':G.green+'33'}`}}>
                <div style={{fontSize:13,fontWeight:700,color:importResult.fail>0?G.red:G.green,marginBottom:4}}>
                  {importResult.ok>0?`✅ ${importResult.ok} records imported successfully`:''}
                  {importResult.fail>0?` · ⚠️ ${importResult.fail} failed`:''}
                </div>
                <div style={{fontSize:11,color:G.muted}}>Check Supabase dashboard to verify. Failures may be duplicate records or missing required fields.</div>
              </div>
            )}
          </Card>
          <Card>
            <SL>Column Name Reference</SL>
            <p style={{fontSize:11,color:G.muted,marginBottom:12}}>Use these exact column names in your header row for automatic mapping:</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 12px'}}>
              {(tab==='comps'
                ? ['address','city','county','zip_code','property_type','building_sf','lot_size_ac','ceiling_height','loading_docks','drive_ins','power','heat','sprinkler','sewer','zoning','real_estate_taxes','sale_price','price_per_sf','sale_date','sale_type','buyer','seller','listing_broker','submarket','notes']
                : ['address','city','county','zip_code','property_type','building_sf','lot_size_ac','ceiling_height','loading_docks','drive_ins','power','sprinkler','sewer','zoning','real_estate_taxes','asking_price','price_per_sf','pricing_guidance','availability_type','status','listing_broker','submarket','loopnet_url','notes']
              ).map(col=>(
                <div key={col} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:G.cyan,padding:'3px 0',borderBottom:`1px solid ${G.border}`}}>{col}</div>
              ))}
            </div>
            {importPreview.length>0&&(
              <div style={{marginTop:18}}>
                <SL>Preview — First 5 Rows</SL>
                <div style={{overflowX:'auto',fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
                  {importPreview.map((row,i)=>(
                    <div key={i} style={{padding:'6px 0',borderBottom:`1px solid ${G.border}`,display:'flex',gap:12,flexWrap:'wrap' as const}}>
                      {Object.entries(row).slice(0,6).map(([k,v])=>(
                        <span key={k} style={{color:G.muted}}>{k}: <span style={{color:G.white}}>{v||'—'}</span></span>
                      ))}
                      {Object.keys(row).length>6&&<span style={{color:G.faint}}>+{Object.keys(row).length-6} more</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── BROWSE & MANAGE ── */}
      {subTab==='browse' && (
        <Card>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <SL style={{marginBottom:0}}>{browseCount.toLocaleString()} total records in {tab==='comps'?'industrial_sale_comps':'market_availabilities'}</SL>
            <Btn variant="ghost" size="sm" onClick={()=>loadBrowse(browseOffset)}>↻ Refresh</Btn>
          </div>
          {browseLoading&&<div style={{textAlign:'center' as const,padding:40}}><div className="spin" style={{width:28,height:28,border:`2px solid ${G.border}`,borderTopColor:G.gold,borderRadius:'50%',margin:'0 auto 12px'}}/><p style={{color:G.muted,fontSize:12}}>Loading...</p></div>}
          {!browseLoading&&browseData.length===0&&<p style={{color:G.muted,fontSize:12,textAlign:'center' as const,padding:32}}>No records found.</p>}
          {!browseLoading&&browseData.map((row,i)=>(
            <div key={String(row.id)} style={{padding:'12px 0',borderBottom:`1px solid ${G.border}`,display:'flex',alignItems:'flex-start',gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{row.address||'—'}{row.city?`, ${row.city}`:''}</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
                  {row.building_sf&&<Tag color={G.blue}>{Number(row.building_sf).toLocaleString()} SF</Tag>}
                  {tab==='comps'&&row.price_per_sf&&<Tag color={G.gold}>${Number(row.price_per_sf).toFixed(2)}/SF</Tag>}
                  {tab==='comps'&&row.sale_date&&<Tag color={G.muted}>{fmtDate(row.sale_date)}</Tag>}
                  {tab==='avails'&&row.asking_price&&<Tag color={G.purple}>${Number(row.asking_price).toLocaleString()}</Tag>}
                  {tab==='avails'&&row.status&&<Tag color={row.status==='Available'?G.green:G.muted}>{row.status}</Tag>}
                  <Tag color={row.county==='Nassau'?G.blue:G.cyan}>{row.county||'—'}</Tag>
                </div>
              </div>
              <Btn variant="danger" size="sm" onClick={()=>deleteRow(String(row.id))} style={{fontSize:10,padding:'5px 10px',flexShrink:0}}>Delete</Btn>
            </div>
          ))}
          {!browseLoading&&browseCount>PAGE_SIZE&&(
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16}}>
              <Btn variant="ghost" size="sm" disabled={browseOffset===0} onClick={()=>loadBrowse(Math.max(0,browseOffset-PAGE_SIZE))}>← Prev</Btn>
              <span style={{fontSize:11,color:G.muted}}>Showing {browseOffset+1}–{Math.min(browseOffset+PAGE_SIZE,browseCount)} of {browseCount.toLocaleString()}</span>
              <Btn variant="ghost" size="sm" disabled={browseOffset+PAGE_SIZE>=browseCount} onClick={()=>loadBrowse(browseOffset+PAGE_SIZE)}>Next →</Btn>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function Auth({onLogin}: {onLogin: (u:{name:string,role:string,init:string})=>void}) {
  const [email,setEmail]=useState(''); const [pass,setPass]=useState('')
  const [fname,setFname]=useState(''); const [lname,setLname]=useState('')
  const [tab,setTab]=useState('sign')
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,background:`radial-gradient(ellipse 60% 40% at 30% 20%,rgba(79,158,255,0.08) 0%,transparent 55%),radial-gradient(ellipse 50% 35% at 70% 80%,rgba(181,127,255,0.07) 0%,transparent 55%),${G.bg}`}}>
      <div style={{marginBottom:36,textAlign:'center'}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:50,fontWeight:600,background:G.gradGold,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:6}}>Premier OPV</div>
        <p style={{fontSize:11,color:G.faint,letterSpacing:'.1em',textTransform:'uppercase' as const}}>Opinion of Value Platform · Long Island Industrial</p>
      </div>
      <div style={{background:G.bg2,border:`1px solid ${G.border}`,borderRadius:14,padding:'32px 36px',width:'100%',maxWidth:420,boxShadow:'0 24px 64px rgba(0,0,0,.5)'}}>
        <div style={{display:'flex',borderBottom:`1px solid ${G.border}`,marginBottom:24}}>
          {[['sign','Sign In'],['reg','Create Account']].map(([t,l])=>(
            <div key={t} onClick={()=>setTab(t)} style={{flex:1,textAlign:'center' as const,padding:'8px 0',fontSize:11,fontWeight:700,cursor:'pointer',color:tab===t?G.blue:G.faint,borderBottom:`2px solid ${tab===t?G.blue:'transparent'}`,marginBottom:-1,transition:'all .2s',letterSpacing:'.06em',textTransform:'uppercase' as const}}>{l}</div>
          ))}
        </div>
        {tab==='sign'?(
          <div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,marginBottom:20,color:G.white}}>Welcome back</p>
            <Field label="Email"><Input type="email" placeholder="broker@firma.com" value={email} onChange={e=>setEmail(e.target.value)}/></Field>
            <Field label="Password"><Input type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)}/></Field>
            <Btn onClick={()=>{if(!email){alert('Enter email');return;}const n=email.split('@')[0].replace(/[^a-z]/gi,' ').trim()||'Broker';onLogin({name:n,role:'Commercial Broker',init:n.slice(0,2).toUpperCase()})}} style={{width:'100%',padding:12}}>Sign In</Btn>
            <div style={{textAlign:'center' as const,fontSize:11,color:G.faint,margin:'14px 0'}}>or</div>
            <Btn onClick={()=>onLogin({name:'Alex Rivera',role:'Senior Broker',init:'AR'})} variant="ghost" style={{width:'100%',padding:11,fontSize:12}}>Continue with Demo Account</Btn>
          </div>
        ):(
          <div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,marginBottom:20,color:G.white}}>Create account</p>
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

type OPVReportData = {id:number,subject:SubjectForm,comps:Comp[],avails:Avail[],analytics:AnalyticsData|null,date:string}

type SavedOPV = {id:string, created_at:string, saved_by:string, address:string}
function Dashboard({user,reports,setPage,onRestore}: {user:{name:string},reports: OPVReportData[],setPage:(p:string)=>void,onRestore:(id:string)=>void}) {
  const hr=new Date().getHours()
  const greet=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening'
  const [savedOPVs, setSavedOPVs] = useState<SavedOPV[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingId, setDeletingId] = useState<string|null>(null)

  useEffect(()=>{
    fetch('/api/opv-history').then(r=>r.json()).then(d=>{setSavedOPVs(d.reports||[]);setLoadingHistory(false)}).catch(()=>setLoadingHistory(false))
  },[])

  const deleteOPV = async (id:string) => {
    if(!confirm('Delete this saved OPV?')) return
    setDeletingId(id)
    await fetch(`/api/opv-history?id=${id}`,{method:'DELETE'})
    setSavedOPVs(prev=>prev.filter(r=>r.id!==id))
    setDeletingId(null)
  }
  const kpis=[
    {l:'OPV Reports',v:String(reports.length),grad:G.gradGold,glow:G.gold},
    {l:'Comps in Database',v:'812',grad:G.gradGreen,glow:G.green},
    {l:'Avg $/SF · LI Industrial',v:'$158',grad:G.gradBlue,glow:G.blue},
    {l:'Market Vacancy',v:'3.8%',grad:G.gradOrange,glow:G.orange},
  ]
  const steps = [{id:'subject',n:'01',label:'Subject Property',grad:G.gradGold,glow:G.gold},{id:'comp-search',n:'02',label:'Sale Comp Search',grad:G.gradBlue,glow:G.blue},{id:'avail-search',n:'03',label:'Avail Search',grad:G.gradGreen,glow:G.green},{id:'scoring',n:'04',label:'Score Comps',grad:G.gradOrange,glow:G.orange},{id:'analytics',n:'05',label:'Analytics',grad:G.gradGreen,glow:G.green},{id:'ai-analysis',n:'06',label:'AI Analysis',grad:G.gradPurple,glow:G.purple},{id:'opv-report',n:'07',label:'OPV Report',grad:G.gradGold,glow:G.gold}]
  return (
    <div className="anim-in">
      <div style={{marginBottom:32,paddingBottom:24,borderBottom:`1px solid ${G.border}`}}>
        <p style={{fontSize:11,color:G.faint,letterSpacing:'.1em',textTransform:'uppercase' as const,marginBottom:8}}>Long Island Industrial · {new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</p>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:600,marginBottom:8}}>{greet}, {user.name.split(' ')[0]}</h1>
        <p style={{fontSize:13,color:G.muted,maxWidth:480}}>Your Opinion of Value platform is ready. 812 Long Island industrial transactions are in your database.</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:30}}>
        {kpis.map((k,i)=>(
          <div key={i} style={{background:G.bg2,border:`1px solid ${G.border}`,borderRadius:12,padding:'20px 22px',position:'relative',overflow:'hidden',boxShadow:`0 0 24px ${k.glow}14`}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:k.grad}}/>
            <div style={{fontSize:10,color:G.muted,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase' as const,marginBottom:12}}>{k.l}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:600,background:k.grad,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1.6fr 1fr',gap:20}}>
        <Card>
          <SL>OPV Workflow — 7 Steps</SL>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:4}}>
            {steps.map(s=>(
              <div key={s.id} onClick={()=>setPage(s.id)} style={{padding:'16px 14px',borderRadius:10,cursor:'pointer',border:`1px solid ${G.border}`,background:G.bg3,transition:'all .2s'}}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLDivElement;el.style.borderColor=s.glow+'55';el.style.transform='translateY(-2px)'}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLDivElement;el.style.borderColor=G.border;el.style.transform='translateY(0)'}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:G.faint,marginBottom:8}}>{s.n}</div>
                <div style={{fontSize:12,fontWeight:600,background:s.grad,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <Card>
            <SL>Market — $/SF by Submarket</SL>
            {[{label:'Melville',psf:171.50,trend:'+5.3%'},{label:'Farmingdale',psf:162.00,trend:'+7.1%'},{label:'Hauppauge',psf:158.40,trend:'+6.2%'},{label:'Ronkonkoma',psf:147.20,trend:'+4.8%'},{label:'Bohemia',psf:143.80,trend:'+3.9%'}].map((m,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:i<4?9:0}}>
                <div style={{fontSize:11,color:G.muted,width:88,flexShrink:0}}>{m.label}</div>
                <div style={{flex:1,height:4,background:G.bg4,borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',background:G.gradGold,borderRadius:2,width:`${((m.psf-130)/60*100).toFixed(0)}%`}}/>
                </div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:G.white,width:44,textAlign:'right' as const}}>${m.psf}</div>
                <div style={{fontSize:9,color:G.green,width:32,textAlign:'right' as const,fontWeight:600}}>{m.trend}</div>
              </div>
            ))}
          </Card>
          <Card>
            <SL>Saved OPV Reports</SL>
            {loadingHistory?(
              <div style={{fontSize:12,color:G.faint,padding:'12px 0',textAlign:'center' as const}}>Loading history...</div>
            ):savedOPVs.length===0?(
              <div style={{padding:'18px 0',textAlign:'center' as const}}>
                <p style={{fontSize:12,color:G.faint,lineHeight:1.6}}>No saved OPVs yet.<br/>Save one from the sidebar button.</p>
                <Btn onClick={()=>setPage('subject')} style={{marginTop:12,padding:'8px 16px',fontSize:12}}>Start OPV</Btn>
              </div>
            ):savedOPVs.slice(0,5).map((r,i)=>(
              <div key={r.id} style={{padding:'9px 0',borderBottom:i<Math.min(savedOPVs.length,5)-1?`1px solid ${G.border}`:'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{r.address?.split(',')[0]||'Untitled'}</div>
                  <div style={{fontSize:10,color:G.faint,marginTop:1}}>{new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · {r.saved_by}</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <Btn variant="ghost" size="sm" onClick={()=>{onRestore(r.id);setPage('opv-report')}} style={{fontSize:10,padding:'4px 10px'}}>Restore</Btn>
                  <Btn variant="danger" size="sm" disabled={deletingId===r.id} onClick={()=>deleteOPV(r.id)} style={{fontSize:10,padding:'4px 8px'}}>×</Btn>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

type SubjectForm = {address:string,city:string,county:string,municipality:string,parcelId:string,type:string,opvType:string,size:string,lot:string,ceiling:string,docks:string,driveIn:string,power:string,heat:string,parking:string,sprinkler:string,sewer:string,zoning:string,taxes:string,yearBuilt:string,officePct:string,construction:string,condition:string,notes:string,highestBestUse:string,capRateLow:string,capRateHigh:string,leasePsfLow:string,leasePsfHigh:string,estimatedValueLow:string,estimatedValueHigh:string,preparedBy:string}

function SubjectProperty({subject,setSubject,setPage,folders,setFolders}: {subject:SubjectForm|null,setSubject:(s:SubjectForm)=>void,setPage:(p:string)=>void,folders:Folder[],setFolders:(f:Folder[]|((prev:Folder[])=>Folder[]))=>void}) {
  const [form,setForm]=useState<SubjectForm>(subject||{address:'',city:'',county:'Nassau',municipality:'',parcelId:'',type:'Warehouse',opvType:'sale',size:'',lot:'',ceiling:'',docks:'',driveIn:'',power:'',heat:'Gas FHA',parking:'',sprinkler:'ESFR',sewer:'Municipal',zoning:'',taxes:'',yearBuilt:'',officePct:'',construction:'Masonry/Steel',condition:'Good',notes:'',highestBestUse:'',capRateLow:'',capRateHigh:'',leasePsfLow:'',leasePsfHigh:'',estimatedValueLow:'',estimatedValueHigh:'',preparedBy:''})
  const set=(k:string,v:string)=>setForm((f:SubjectForm)=>({...f,[k]:v}))

  const autoCreateFolders = (address: string) => {
    const already = folders.some(f=>f.opvAddress===address)
    if (already) return
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length]
    const now = Date.now()
    const shortAddr = address.split(',')[0]
    setFolders((prev: Folder[]) => [...prev,
      {id:`${now}-comps`, name:`${shortAddr} — Sale Comps`, type:'comps', color, items:[], opvAddress:address, createdAt:now},
      {id:`${now}-avails`, name:`${shortAddr} — Availabilities`, type:'avails', color, items:[], opvAddress:address, createdAt:now+1}
    ])
  }
  const G2={display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}
  return (
    <div className="anim-in">
      <WorkflowSteps current="subject"/>
      <SectionTitle sub="Enter subject property specifications. All fields populate the OPV report.">Subject Property Details</SectionTitle>
      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:20,alignItems:'start'}}>
        <Card>
          <SL>OPV Type</SL>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {([['sale','🏷 For Sale'],['investment','📊 Investment Sale'],['lease','📋 Lease']] as [string,string][]).map(([val,lbl])=>(
              <div key={val} onClick={()=>set('opvType',val)} style={{flex:1,padding:'10px 8px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:700,textAlign:'center' as const,background:form.opvType===val?G.goldDim:'transparent',color:form.opvType===val?G.gold:G.muted,border:`1.5px solid ${form.opvType===val?G.gold:G.border}`,transition:'all .15s'}}>
                {lbl}
              </div>
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
          <Card style={{background:G.bg4,border:`1px solid ${G.goldBorder}`}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:G.gold,marginBottom:14}}>Subject Property Preview</div>
            {([['Address',form.address||'—'],['County',form.county],['Type',form.type],['Building Size',form.size?`${parseInt(form.size).toLocaleString()} SF`:'—'],['Lot Size',form.lot||'—'],['Clear Height',form.ceiling?`${form.ceiling} ft`:'—'],['Docks',form.docks||'—'],['Drive-In',form.driveIn||'—'],['Power',form.power||'—'],['Sprinkler',form.sprinkler],['Sewer',form.sewer],['Zoning',form.zoning||'—'],['Year Built',form.yearBuilt||'—'],['Taxes',form.taxes?`$${parseInt(form.taxes).toLocaleString()}/yr`:'—']] as [string,string][]).map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${G.border}`,fontSize:12}}>
                <span style={{color:G.muted}}>{l}</span>
                <span style={{fontWeight:500,textAlign:'right' as const,maxWidth:'55%'}}>{v}</span>
              </div>
            ))}
          </Card>
          <Card style={{marginTop:14}}>
            <SL>OPV Checklist</SL>
            {[{l:'Subject property saved',done:!!subject},{l:'Sale comps found',done:false},{l:'Availabilities found',done:false},{l:'Comps scored',done:false},{l:'Analytics run',done:false},{l:'AI analysis generated',done:false},{l:'Report complete',done:false}].map((c,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 0',fontSize:12}}>
                <div style={{width:16,height:16,borderRadius:'50%',background:c.done?'rgba(0,212,161,.2)':G.bg4,border:`1.5px solid ${c.done?G.green:G.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:G.green,flexShrink:0}}>{c.done?'✓':''}</div>
                <span style={{color:c.done?G.white:G.muted}}>{c.l}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

type Comp = {id:string,address:string,city:string,county:string,building_sf:number,lot_size_ac:number,ceiling_height:string,loading_docks:string,drive_ins:string,power:string,sewer:string,zoning:string,sale_price:number,price_per_sf:number,sale_date:string,sale_type:string,buyer:string,seller:string,submarket:string,score?:number}

function CompSearch({subject,comps,setComps,setPage,folders,setFolders}: {subject:SubjectForm|null,comps:Comp[],setComps:(c:Comp[])=>void,setPage:(p:string)=>void,folders:Folder[],setFolders:(f:Folder[])=>void}) {
  const [results,setResults]=useState<Comp[]>([])
  const [loading,setLoading]=useState(false)
  const [searched,setSearched]=useState(false)
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [filters,setFilters]=useState({county:'',city:'',min_sf:'',max_sf:'',min_price:'',max_price:'',min_date:'',max_date:'',sewer:'',zoning:''})
  const [folderDropdown, setFolderDropdown] = useState<string|null>(null)

  const scoreComp = (c: Comp, s: SubjectForm): number => {
    const subSF = parseFloat(s.size)||0
    const compSF = c.building_sf||0
    const sizeDiff = subSF>0 ? Math.abs(compSF-subSF)/subSF : 0.5
    const sizeScore = Math.max(0, 100-(sizeDiff*200))
    const subCeil = parseFloat(s.ceiling)||0
    const compCeil = parseFloat(c.ceiling_height)||0
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
    setComps([...comps, ...toAdd])
    alert(`${toAdd.length} comp${toAdd.length!==1?'s':''} added to your OPV`)
    setSelected(new Set())
  }

  const sf = (k:string,v:string) => setFilters(f=>({...f,[k]:v}))
  const scoreColor = (s:number) => s>=85?G.green:s>=70?G.gold:G.orange

  return (
    <div className="anim-in">
      <WorkflowSteps current="comp-search"/>
      <SectionTitle sub="Search 812 real Long Island industrial transactions from your Supabase database. Select comps and add them to your OPV.">Sale Comp Search</SectionTitle>
      {!subject&&<Card style={{textAlign:'center' as const,padding:'48px 20px',marginBottom:20}}><p style={{fontSize:13,color:G.muted,marginBottom:16}}>Save your subject property first.</p><Btn onClick={()=>setPage('subject')}>← Enter Subject Property</Btn></Card>}
      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20,alignItems:'start'}}>
        <div>
          {subject&&<Card style={{marginBottom:14,border:`1px solid ${G.goldBorder}`}}>
            <SL>Subject Property</SL>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:G.gold,marginBottom:10}}>{subject.address}</div>
            {([['Size',subject.size?`${Number(subject.size).toLocaleString()} SF`:'—'],['Ceiling',subject.ceiling?`${subject.ceiling} ft`:'—'],['County',subject.county]] as [string,string][]).map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${G.border}`,fontSize:11}}>
                <span style={{color:G.muted}}>{l}</span><span style={{fontWeight:600}}>{v}</span>
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
              <Field label="Sale Date From"><Input type="date" value={filters.min_date} onChange={e=>sf('min_date',e.target.value)}/></Field>
              <Field label="Sale Date To"><Input type="date" value={filters.max_date} onChange={e=>sf('max_date',e.target.value)}/></Field>
            </div>
            <Field label="Sewer"><Sel value={filters.sewer} onChange={e=>sf('sewer',e.target.value)}><option value="">Any</option><option value="City">City Sewer</option><option value="Septic">Septic</option></Sel></Field>
            <Field label="Zoning"><Input placeholder="e.g. I, M1" value={filters.zoning} onChange={e=>sf('zoning',e.target.value)}/></Field>
            <Btn onClick={search} disabled={loading} style={{width:'100%',padding:11}}>{loading?'Searching...':'🔎 Search Comps'}</Btn>
          </Card>
          {comps.length>0&&<Card style={{marginTop:14}}>
            <SL>Added to OPV</SL>
            <div style={{fontSize:12,color:G.muted,marginBottom:10}}>{comps.length} comp{comps.length!==1?'s':''} selected</div>
            <Btn onClick={()=>setPage('avail-search')} style={{width:'100%',padding:10,fontSize:12}}>Next: Avail Search →</Btn>
          </Card>}
        </div>
        <div>
          {loading&&<Card><div style={{textAlign:'center' as const,padding:'40px 20px'}}><div className="spin" style={{width:32,height:32,border:`2px solid ${G.border}`,borderTopColor:G.gold,borderRadius:'50%',margin:'0 auto 16px'}}/><p style={{fontSize:13,color:G.muted}}>Searching Supabase database...</p></div></Card>}
          {!loading&&!searched&&<Card style={{textAlign:'center' as const,padding:'64px 20px'}}><div style={{fontSize:48,opacity:.15,marginBottom:16}}>🔎</div><p style={{fontSize:15,fontWeight:600,marginBottom:8}}>Ready to Search</p><p style={{fontSize:13,color:G.muted,maxWidth:380,margin:'0 auto'}}>Set your filters and click Search to pull from your 812 real transactions.</p></Card>}
          {!loading&&searched&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <span style={{fontSize:13,color:G.muted}}>{results.length} results {results.length===200?'(showing first 200)':''}</span>
                <div style={{display:'flex',gap:8}}>
                  {results.length>0&&<Btn variant="ghost" size="sm" onClick={()=>setSelected(new Set(results.map(r=>r.id)))}>Select All</Btn>}
                  {selected.size>0&&<Btn size="sm" onClick={addSelected}>＋ Add {selected.size} to OPV</Btn>}
                </div>
              </div>
              {results.length===0?<Card style={{textAlign:'center' as const,padding:'48px 20px'}}><p style={{color:G.muted}}>No results. Try broadening your filters.</p></Card>:
              results.map((r,idx)=>(
                <Card key={r.id} style={{marginBottom:12,border:`1px solid ${selected.has(r.id)?G.gold+'55':G.border}`,transition:'border-color .2s'}}>
                  <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                    <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:8,alignItems:'center'}}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSelect(r.id)} style={{width:16,height:16,cursor:'pointer',accentColor:G.gold}}/>
                      <div style={{width:28,height:28,borderRadius:'50%',background:idx===0?G.goldDim:G.bg4,border:`1.5px solid ${idx===0?G.gold:G.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:idx===0?G.gold:G.muted}}>#{idx+1}</div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:8}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{r.address}{r.city?`, ${r.city}`:''}</div>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap' as const}}>
                            {(r.price_per_sf>0||( r.sale_price>0&&r.building_sf>0))&&<Tag color={G.gold}>${(r.price_per_sf||Number(r.sale_price)/Number(r.building_sf)).toFixed(2)}/SF</Tag>}
                            {r.sale_price>0&&<Tag color={G.green}>${Number(r.sale_price).toLocaleString()}</Tag>}
                            {r.sale_date&&<Tag color={G.muted}>{fmtDate(r.sale_date)}</Tag>}
                            <Tag color={r.county==='Nassau'?G.blue:G.purple}>{r.county}</Tag>
                          </div>
                        </div>
                        {r.score&&<div style={{textAlign:'right' as const,flexShrink:0}}>
                          <div style={{fontSize:10,color:G.muted,marginBottom:3}}>Match</div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:scoreColor(r.score)}}>{r.score}</div>
                          <div style={{width:60,height:4,background:G.bg4,borderRadius:2,marginTop:3}}>
                            <div style={{height:'100%',background:scoreColor(r.score),borderRadius:2,width:`${r.score}%`}}/>
                          </div>
                        </div>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'5px 16px',fontSize:11,marginBottom:4}}>
                        {([
                          ['Building SF', r.building_sf ? `${Number(r.building_sf).toLocaleString()} SF` : '—'],
                          ['Lot Size', r.lot_size_ac ? `${r.lot_size_ac} AC` : r.lot_size ? r.lot_size : '—'],
                          ['City / Town', r.city || '—'],
                          ['County', r.county || '—'],
                          ['Ceiling Height', r.ceiling_height || '—'],
                          ['Loading Docks', r.loading_docks || '—'],
                          ['Drive-In Doors', r.drive_ins || r.drive_in_doors || '—'],
                          ['Power', r.power || '—'],
                          ['Heat', r.heat || '—'],
                          ['Sprinkler', r.sprinkler || r.sprinkler_system || '—'],
                          ['Sewer', r.sewer || r.sewer_connection || '—'],
                          ['Parking', r.parking || '—'],
                          ['Zoning', r.zoning || '—'],
                          ['RE Taxes', r.real_estate_taxes ? `$${Number(r.real_estate_taxes).toLocaleString()}/yr` : '—'],
                          ['Buyer', r.buyer || '—'],
                          ['Seller', r.seller || '—'],
                          ['Price / SF', (r.price_per_sf||(r.sale_price&&r.building_sf?Number(r.sale_price)/Number(r.building_sf):0)) ? `$${(r.price_per_sf||Number(r.sale_price)/Number(r.building_sf)).toFixed(2)}` : '—'],
                          ['Sale Price', r.sale_price ? `$${Number(r.sale_price).toLocaleString()}` : '—'],
                          ['Sale Date', r.sale_date ? fmtDate(r.sale_date) : '—'],
                        ] as [string,string][]).map(([l,v])=>(
                          <div key={l}><span style={{color:G.muted,fontWeight:500}}>{l}:</span> <span style={{fontWeight:600,color:'#111111'}}>{v}</span></div>
                        ))}
                      </div>
                      <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
                        <div style={{position:'relative'}}>
                          <Btn variant="ghost" size="sm" onClick={()=>setFolderDropdown(folderDropdown===r.id?null:r.id)} style={{fontSize:11,padding:'5px 12px'}}>📁 Add to Folder</Btn>
                          {folderDropdown===r.id&&(
                            <div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:6,zIndex:100,minWidth:200,boxShadow:'0 8px 32px rgba(0,0,0,.4)'}}>
                              {folders.filter(f=>f.type==='comps').length===0&&<div style={{fontSize:11,color:G.faint,padding:'6px 8px'}}>No comp folders yet. Create one in OPV Folders.</div>}
                              {folders.filter(f=>f.type==='comps').map(f=>(
                                <div key={f.id} onClick={()=>{
                                  const alreadyIn = f.items.find((i:Comp|Avail)=>i.id===r.id)
                                  if (!alreadyIn) setFolders(folders.map(fl=>fl.id===f.id?{...fl,items:[...fl.items,r]}:fl))
                                  setFolderDropdown(null)
                                  alert(alreadyIn?'Already in this folder!':` Added to "${f.name}"`)
                                }} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontSize:12,color:G.white,transition:'background .15s'}}
                                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background=G.bg4}
                                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='transparent'}>
                                  <div style={{width:8,height:8,borderRadius:'50%',background:f.color,flexShrink:0}}/>
                                  {f.name} <span style={{fontSize:10,color:G.faint,marginLeft:'auto'}}>({f.items.length})</span>
                                </div>
                              ))}
                              <div onClick={()=>{setFolderDropdown(null);setPage('folders')}} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontSize:11,color:G.blue,marginTop:4,borderTop:`1px solid ${G.border}`}}>＋ Create new folder</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type Avail = {id:string,address:string,city:string,county:string,building_sf:number,lot_size_ac:number,ceiling_height:string,loading_docks:string,drive_ins:string,power:string,sewer:string,zoning:string,asking_price:number,price_per_sf:number,pricing_guidance:string,listing_broker:string,loopnet_url:string,score?:number}

function AvailSearch({subject,avails,setAvails,setPage,folders,setFolders}: {subject:SubjectForm|null,avails:Avail[],setAvails:(a:Avail[])=>void,setPage:(p:string)=>void,folders:Folder[],setFolders:(f:Folder[])=>void}) {
  const [results,setResults]=useState<Avail[]>([])
  const [loading,setLoading]=useState(false)
  const [searched,setSearched]=useState(false)
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [filters,setFilters]=useState({county:'',city:'',min_sf:'',max_sf:'',min_price:'',max_price:''})
  const [showAdd,setShowAdd]=useState(false)
  const [folderDropdown, setFolderDropdown] = useState<string|null>(null)

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
    setAvails([...avails, ...toAdd])
    alert(`${toAdd.length} listing${toAdd.length!==1?'s':''} added to your OPV`)
    setSelected(new Set())
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
      <WorkflowSteps current="avail-search"/>
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
            <Btn onClick={search} disabled={loading} style={{width:'100%',padding:11,background:`${G.blue}22`,border:`1px solid ${G.blue}55`,color:G.blue}}>{loading?'Searching...':'🔍 Search Availabilities'}</Btn>
          </Card>
          <Card>
            <SL>Add New Listing</SL>
            <p style={{fontSize:12,color:G.muted,marginBottom:12,lineHeight:1.5}}>Add listings from LoopNet, CoStar, or your own research directly to your database.</p>
            <Btn onClick={()=>setShowAdd(v=>!v)} style={{width:'100%',padding:9,fontSize:12}}>＋ Add Listing to Database</Btn>
          </Card>
          {avails.length>0&&<Card style={{marginTop:14}}>
            <SL>Added to OPV</SL>
            <div style={{fontSize:12,color:G.muted,marginBottom:10}}>{avails.length} listing{avails.length!==1?'s':''} selected</div>
            <Btn onClick={()=>setPage('lease-comps')} style={{width:'100%',padding:10,fontSize:12}}>Next: Lease Comps →</Btn>
          </Card>}
        </div>
        <div>
          {showAdd&&(
            <Card style={{marginBottom:16,border:`1px solid ${G.goldBorder}`}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:G.gold,marginBottom:14}}>Add New Listing to Database</div>
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
          {loading&&<Card><div style={{textAlign:'center' as const,padding:'40px'}}>
            <div className="spin" style={{width:32,height:32,border:`2px solid ${G.border}`,borderTopColor:G.blue,borderRadius:'50%',margin:'0 auto 16px'}}/>
            <p style={{fontSize:13,color:G.muted}}>Searching database...</p>
          </div></Card>}
          {!loading&&!searched&&!showAdd&&<Card style={{textAlign:'center' as const,padding:'64px 20px'}}>
            <div style={{fontSize:48,opacity:.15,marginBottom:16}}>🔍</div>
            <p style={{fontSize:15,fontWeight:600,marginBottom:8}}>Search or Add Listings</p>
            <p style={{fontSize:13,color:G.muted,maxWidth:400,margin:'0 auto'}}>Search your availability database or click Add Listing to manually enter properties from LoopNet or CoStar.</p>
          </Card>}
          {!loading&&searched&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <span style={{fontSize:13,color:G.muted}}>{results.length} listings found</span>
                <div style={{display:'flex',gap:8}}>
                  {results.length>0&&<Btn variant="ghost" size="sm" onClick={()=>setSelected(new Set(results.map(r=>r.id)))}>Select All</Btn>}
                  {selected.size>0&&<Btn size="sm" onClick={addSelected} style={{background:`${G.blue}22`,border:`1px solid ${G.blue}55`,color:G.blue}}>＋ Add {selected.size} to OPV</Btn>}
                </div>
              </div>
              {results.length===0?<Card style={{textAlign:'center' as const,padding:'48px 20px'}}><p style={{color:G.muted}}>No availabilities in database yet. Use Add Listing above to populate it.</p></Card>:
              results.map((r,idx)=>(
                <Card key={r.id} style={{marginBottom:12,border:`1px solid ${selected.has(r.id)?G.blue+'55':G.border}`}}>
                  <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                    <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:8,alignItems:'center'}}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSelect(r.id)} style={{width:16,height:16,cursor:'pointer',accentColor:G.blue}}/>
                      <div style={{width:28,height:28,borderRadius:'50%',background:G.bg4,border:`1.5px solid ${G.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:G.muted}}>#{idx+1}</div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>{r.address?`${r.address}${r.city?`, ${r.city}`:''}`:r.city||'(No address on file)'}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:8}}>
                        {r.price_per_sf>0&&<Tag color={G.blue}>${Number(r.price_per_sf).toFixed(2)}/SF</Tag>}
                        {r.asking_price>0&&<Tag color={G.purple}>${Number(r.asking_price).toLocaleString()}</Tag>}
                        {r.pricing_guidance&&<Tag color={G.muted}>{r.pricing_guidance}</Tag>}
                        <Tag color={r.county==='Nassau'?G.blue:G.purple}>{r.county}</Tag>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:'5px 16px',fontSize:11,marginBottom:4}}>
                        {([
                          ['Building SF', r.building_sf ? `${Number(r.building_sf).toLocaleString()} SF` : '—'],
                          ['Lot Size', r.lot_size_ac ? `${r.lot_size_ac} AC` : r.lot_size ? r.lot_size : '—'],
                          ['City / Town', r.city || '—'],
                          ['County', r.county || '—'],
                          ['Ceiling Height', r.ceiling_height || '—'],
                          ['Loading Docks', r.loading_docks || '—'],
                          ['Drive-In Doors', r.drive_ins || r.drive_in_doors || '—'],
                          ['Power', r.power || '—'],
                          ['Heat', r.heat || '—'],
                          ['Sprinkler', r.sprinkler || r.sprinkler_system || '—'],
                          ['Sewer', r.sewer || r.sewer_connection || '—'],
                          ['Parking', r.parking || '—'],
                          ['Zoning', r.zoning || '—'],
                          ['RE Taxes', r.real_estate_taxes ? `$${Number(r.real_estate_taxes).toLocaleString()}/yr` : '—'],
                          ['Asking Price', r.asking_price ? `$${Number(r.asking_price).toLocaleString()}` : '—'],
                          ['Price / SF', (r.price_per_sf||(r.asking_price&&r.building_sf?Number(r.asking_price)/Number(r.building_sf):0)) ? `$${(r.price_per_sf||Number(r.asking_price)/Number(r.building_sf)).toFixed(2)}` : '—'],
                          ['Pricing Guidance', r.pricing_guidance || '—'],
                          ['Listing Broker', r.listing_broker || '—'],
                          ['Status', r.status || '—'],
                        ] as [string,string][]).map(([l,v])=>(
                          <div key={l}><span style={{color:G.muted,fontWeight:500}}>{l}:</span> <span style={{fontWeight:600,color:'#111111'}}>{v}</span></div>
                        ))}
                      </div>
                      {r.loopnet_url&&<a href={r.loopnet_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:G.blue,marginTop:6,display:'inline-block'}}>View on LoopNet ↗</a>}
                      <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
                        <div style={{position:'relative'}}>
                          <Btn variant="ghost" size="sm" onClick={()=>setFolderDropdown(folderDropdown===r.id?null:r.id)} style={{fontSize:11,padding:'5px 12px'}}>📁 Add to Folder</Btn>
                          {folderDropdown===r.id&&(
                            <div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:6,zIndex:100,minWidth:200,boxShadow:'0 8px 32px rgba(0,0,0,.4)'}}>
                              {folders.filter(f=>f.type==='avails').length===0&&<div style={{fontSize:11,color:G.faint,padding:'6px 8px'}}>No avail folders yet. Create one in OPV Folders.</div>}
                              {folders.filter(f=>f.type==='avails').map(f=>(
                                <div key={f.id} onClick={()=>{
                                  const alreadyIn = f.items.find((i:Comp|Avail)=>i.id===r.id)
                                  if (!alreadyIn) setFolders(folders.map(fl=>fl.id===f.id?{...fl,items:[...fl.items,r]}:fl))
                                  setFolderDropdown(null)
                                  alert(alreadyIn?'Already in this folder!':` Added to "${f.name}"`)
                                }} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontSize:12,color:G.white,transition:'background .15s'}}
                                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background=G.bg4}
                                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='transparent'}>
                                  <div style={{width:8,height:8,borderRadius:'50%',background:f.color,flexShrink:0}}/>
                                  {f.name} <span style={{fontSize:10,color:G.faint,marginLeft:'auto'}}>({f.items.length})</span>
                                </div>
                              ))}
                              <div onClick={()=>{setFolderDropdown(null);setPage('folders')}} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontSize:11,color:G.blue,marginTop:4,borderTop:`1px solid ${G.border}`}}>＋ Create new folder</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type LeaseComp = {id:string,address:string,city:string,county:string,building_sf:number,ceiling_height:string,loading_docks:string,drive_ins:string,power:string,sewer:string,zoning:string,lease_price:number,price_per_sf:number,lease_date:string,tenant:string,landlord:string,lease_term:string,annual_escalations:string,landlord_work:string,cap_rate:number,comments:string,taxes_psf:number,office_pct:number,photo_url?:string,loopnet_url?:string}

function LeaseCompSearch({subject,leaseComps,setLeaseComps,setPage}: {subject:SubjectForm|null,leaseComps:LeaseComp[],setLeaseComps:(c:LeaseComp[])=>void,setPage:(p:string)=>void}) {
  const [results,setResults]=useState<LeaseComp[]>([])
  const [loading,setLoading]=useState(false)
  const [searched,setSearched]=useState(false)
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [filters,setFilters]=useState({county:'',city:'',min_sf:'',max_sf:'',min_price:'',max_price:'',min_date:'',max_date:''})
  const [showManual,setShowManual]=useState(false)
  const [manual,setManual]=useState<Partial<LeaseComp>>({})

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
    setLeaseComps([...leaseComps, ...toAdd])
    alert(`${toAdd.length} lease comp${toAdd.length!==1?'s':''} added to your OPV`)
    setSelected(new Set())
  }
  const sf = (k:string,v:string) => setFilters(f=>({...f,[k]:v}))
  const sm = (k:string,v:string) => setManual(m=>({...m,[k]:v}))

  const addManual = () => {
    if (!manual.address) { alert('Address required'); return }
    const id = `manual_${Date.now()}`
    setLeaseComps([...leaseComps, {...manual, id} as LeaseComp])
    setManual({}); setShowManual(false)
    alert('Lease comp added manually.')
  }

  return (
    <div className="anim-in">
      <WorkflowSteps current="lease-comps"/>
      <SectionTitle sub="Search lease comparables from your database, or add them manually. Optional — only include if relevant to this OPV.">Lease Comparable Search</SectionTitle>
      {!subject&&<Card style={{textAlign:'center' as const,padding:'48px 20px',marginBottom:20}}><p style={{fontSize:13,color:G.muted,marginBottom:16}}>Save your subject property first.</p><Btn onClick={()=>setPage('subject')}>← Enter Subject Property</Btn></Card>}
      <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:20,alignItems:'start'}}>
        <div>
          {subject&&<Card style={{marginBottom:14,border:`1px solid ${G.goldBorder}`}}>
            <SL>Subject Property</SL>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:G.gold,marginBottom:8}}>{subject.address}</div>
            <div style={{fontSize:11,color:G.muted}}>OPV Type: <strong>{subject.opvType||'sale'}</strong></div>
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
            <div style={{fontSize:12,color:G.muted,marginBottom:10}}>{leaseComps.length} lease comp{leaseComps.length!==1?'s':''} selected</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {leaseComps.map(c=>(
                <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11,padding:'5px 0',borderBottom:`1px solid ${G.border}`}}>
                  <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{c.address}</span>
                  <button onClick={()=>setLeaseComps(leaseComps.filter(x=>x.id!==c.id))} style={{background:'transparent',border:'none',color:G.red,cursor:'pointer',fontSize:13,padding:'0 4px',flexShrink:0}}>×</button>
                </div>
              ))}
            </div>
            <Btn onClick={()=>setPage('scoring')} style={{width:'100%',padding:10,fontSize:12,marginTop:10}}>Next: Scoring →</Btn>
          </Card>}
          <Btn variant="ghost" onClick={()=>setPage('scoring')} style={{width:'100%',padding:10,fontSize:12,marginTop:10}}>Skip — Go to Scoring →</Btn>
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <Btn variant="blue" size="sm" onClick={()=>setShowManual(!showManual)}>＋ Add Manual Lease Comp</Btn>
          </div>
          {showManual&&(
            <Card style={{marginBottom:16,border:`1px solid ${G.blue}44`}}>
              <SL style={{color:G.blue}}>Manual Lease Comp Entry</SL>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <Field label="Address" full><Input placeholder="Street address" value={manual.address||''} onChange={e=>sm('address',e.target.value)}/></Field>
                <Field label="City"><Input placeholder="City/Town" value={manual.city||''} onChange={e=>sm('city',e.target.value)}/></Field>
                <Field label="County"><Sel value={manual.county||'Nassau'} onChange={e=>sm('county',e.target.value)}>{COUNTIES.map(c=><option key={c}>{c}</option>)}</Sel></Field>
                <Field label="Building SF"><Input type="number" value={manual.building_sf?.toString()||''} onChange={e=>sm('building_sf',e.target.value)}/></Field>
                <Field label="Ceiling Height"><Input placeholder="22'" value={manual.ceiling_height||''} onChange={e=>sm('ceiling_height',e.target.value)}/></Field>
                <Field label="Loading Docks"><Input type="number" value={manual.loading_docks||''} onChange={e=>sm('loading_docks',e.target.value)}/></Field>
                <Field label="Drive-In Doors"><Input type="number" value={manual.drive_ins||''} onChange={e=>sm('drive_ins',e.target.value)}/></Field>
                <Field label="Power"><Input placeholder="400A/3ph" value={manual.power||''} onChange={e=>sm('power',e.target.value)}/></Field>
                <Field label="Sewer"><Sel value={manual.sewer||'Municipal'} onChange={e=>sm('sewer',e.target.value)}><option>Municipal</option><option>Septic</option></Sel></Field>
                <Field label="Zoning"><Input placeholder="M1" value={manual.zoning||''} onChange={e=>sm('zoning',e.target.value)}/></Field>
                <Field label="Lease Rate ($/SF/yr)"><Input type="number" step="0.01" placeholder="16.00" value={manual.price_per_sf?.toString()||''} onChange={e=>sm('price_per_sf',e.target.value)}/></Field>
                <Field label="Annual Base Rent ($)"><Input type="number" value={manual.lease_price?.toString()||''} onChange={e=>sm('lease_price',e.target.value)}/></Field>
                <Field label="Lease Date"><Input type="date" value={manual.lease_date||''} onChange={e=>sm('lease_date',e.target.value)}/></Field>
                <Field label="Lease Term"><Input placeholder="3 years NNN" value={manual.lease_term||''} onChange={e=>sm('lease_term',e.target.value)}/></Field>
                <Field label="Tenant"><Input placeholder="Tenant name" value={manual.tenant||''} onChange={e=>sm('tenant',e.target.value)}/></Field>
                <Field label="Landlord"><Input placeholder="Landlord name" value={manual.landlord||''} onChange={e=>sm('landlord',e.target.value)}/></Field>
                <Field label="Annual Escalations"><Input placeholder="3% annually" value={manual.annual_escalations||''} onChange={e=>sm('annual_escalations',e.target.value)}/></Field>
                <Field label="Landlord Work"><Input placeholder="e.g. None" value={manual.landlord_work||''} onChange={e=>sm('landlord_work',e.target.value)}/></Field>
                <Field label="Taxes PSF ($/SF)"><Input type="number" step="0.01" value={manual.taxes_psf?.toString()||''} onChange={e=>sm('taxes_psf',e.target.value)}/></Field>
                <Field label="Office %"><Input type="number" value={manual.office_pct?.toString()||''} onChange={e=>sm('office_pct',e.target.value)}/></Field>
                <Field label="Photo URL"><Input placeholder="https://..." value={manual.photo_url||''} onChange={e=>sm('photo_url',e.target.value)}/></Field>
                <Field label="Comments" full><textarea value={manual.comments||''} onChange={e=>sm('comments',e.target.value)} placeholder="Any notes..." style={{...inputStyle as React.CSSProperties,minHeight:56,resize:'vertical' as const}}/></Field>
              </div>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <Btn onClick={addManual} style={{flex:1}}>＋ Add Comp</Btn>
                <Btn variant="ghost" onClick={()=>{setShowManual(false);setManual({})}} style={{flex:1}}>Cancel</Btn>
              </div>
            </Card>
          )}
          {loading&&<Card><div style={{textAlign:'center' as const,padding:'40px 20px'}}><div className="spin" style={{width:32,height:32,border:`2px solid ${G.border}`,borderTopColor:G.gold,borderRadius:'50%',margin:'0 auto 16px'}}/><p style={{fontSize:13,color:G.muted}}>Searching lease comps...</p></div></Card>}
          {!loading&&!searched&&!showManual&&<Card style={{textAlign:'center' as const,padding:'64px 20px'}}><div style={{fontSize:48,opacity:.15,marginBottom:16}}>📋</div><p style={{fontSize:15,fontWeight:600,marginBottom:8}}>Search or Add Manually</p><p style={{fontSize:13,color:G.muted,maxWidth:380,margin:'0 auto'}}>Search your Supabase lease comps database, or add lease comparables manually using the button above.</p></Card>}
          {!loading&&searched&&(
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <span style={{fontSize:13,color:G.muted}}>{results.length} results</span>
                <div style={{display:'flex',gap:8}}>
                  {results.length>0&&<Btn variant="ghost" size="sm" onClick={()=>setSelected(new Set(results.map(r=>r.id)))}>Select All</Btn>}
                  {selected.size>0&&<Btn size="sm" onClick={addSelected}>＋ Add {selected.size} to OPV</Btn>}
                </div>
              </div>
              {results.length===0?<Card style={{textAlign:'center' as const,padding:'48px 20px'}}><p style={{color:G.muted}}>No results. Try adding manually.</p></Card>:
              results.map((r,idx)=>(
                <Card key={r.id} style={{marginBottom:12,border:`1px solid ${selected.has(r.id)?G.blue+'55':G.border}`}}>
                  <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSelect(r.id)} style={{width:16,height:16,cursor:'pointer',accentColor:G.blue,marginTop:3}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>{r.address}{r.city?`, ${r.city}`:''}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:8}}>
                        {r.price_per_sf>0&&<Tag color={G.blue}>${Number(r.price_per_sf).toFixed(2)}/SF/yr</Tag>}
                        {r.lease_date&&<Tag color={G.muted}>{fmtDate(r.lease_date)}</Tag>}
                        {r.lease_term&&<Tag color={G.purple}>{r.lease_term}</Tag>}
                        {r.tenant&&<Tag color={G.green}>{r.tenant}</Tag>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'5px 16px',fontSize:11}}>
                        {([
                          ['Building SF', r.building_sf ? `${Number(r.building_sf).toLocaleString()} SF` : '—'],
                          ['Ceiling', r.ceiling_height||'—'],
                          ['Docks', r.loading_docks||'—'],
                          ['Drive-In', r.drive_ins||'—'],
                          ['Power', r.power||'—'],
                          ['Sewer', r.sewer||'—'],
                          ['Zoning', r.zoning||'—'],
                          ['Escalations', r.annual_escalations||'—'],
                          ['Landlord Work', r.landlord_work||'—'],
                          ['Comments', r.comments||'—'],
                        ] as [string,string][]).map(([l,v])=>(
                          <div key={l}><span style={{color:G.muted,fontWeight:500}}>{l}:</span> <span style={{fontWeight:600}}>{v}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Scoring({subject,comps,scoredComps,setScoredComps,setPage}: {subject:SubjectForm|null,comps:Comp[],scoredComps:Comp[],setScoredComps:(c:Comp[])=>void,setPage:(p:string)=>void}) {
  const [ran,setRan]=useState(scoredComps.length>0)
  const [overrides,setOverrides]=useState<Record<string,number>>({})
  const runScoring = () => {
    const subSize=parseFloat(subject?.size||'0')||28000
    const subCeil=parseFloat(subject?.ceiling||'0')||22
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
  const scoreColor = (s:number) => s>=85?G.green:s>=70?G.gold:G.orange
  return (
    <div className="anim-in">
      <WorkflowSteps current="scoring"/>
      <SectionTitle sub="Automatically score and rank your comparable sales by similarity to the subject property.">Comparable Scoring Engine</SectionTitle>
      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:20,alignItems:'start'}}>
        <Card>
          <SL>Scoring Weights</SL>
          {([['Building Size Similarity','35%'],['Ceiling Height','25%'],['Location / Proximity','20%'],['Loading Configuration','10%'],['Year Built / Age','10%']] as [string,string][]).map(([l,w])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:10,fontSize:12}}>
              <span style={{color:G.white}}>{l}</span><span style={{color:G.gold,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{w}</span>
            </div>
          ))}
          <Divider/>
          {comps.length===0?<p style={{fontSize:12,color:G.muted}}>Add comps from Sale Comp Search first.</p>:
          <Btn onClick={runScoring} style={{width:'100%',padding:11}}>Run Scoring →</Btn>}
          {ran&&<Btn onClick={()=>setPage('analytics')} style={{width:'100%',padding:11,marginTop:10}}>Next: Analytics →</Btn>}
        </Card>
        <div>
          {!ran&&<Card style={{textAlign:'center' as const,padding:'56px 20px'}}><div style={{fontSize:40,opacity:.2,marginBottom:12}}>⭐</div><p style={{color:G.muted}}>Click Run Scoring to rank your comparables.</p></Card>}
          {ran&&scoredComps.map((c,i)=>(
            <Card key={c.id} style={{marginBottom:10,border:`1px solid ${i===0?G.goldBorder:G.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:i===0?G.goldDim:G.bg4,border:`1.5px solid ${i===0?G.gold:G.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:i===0?G.gold:G.muted,flexShrink:0}}>#{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:3}}>{c.address}{c.city?`, ${c.city}`:''}</div>
                  <div style={{fontSize:11,color:G.muted}}>{c.building_sf?`${Number(c.building_sf).toLocaleString()} SF`:''} · {c.ceiling_height||''} · {c.price_per_sf?`$${Number(c.price_per_sf).toFixed(2)}/SF`:''} · {fmtDate(c.sale_date)}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{textAlign:'center' as const}}>
                    <div style={{fontSize:10,color:G.muted,marginBottom:3}}>Score</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:scoreColor(finalScore(c))}}>{finalScore(c)}</div>
                  </div>
                  <div style={{textAlign:'center' as const}}>
                    <div style={{fontSize:10,color:G.muted,marginBottom:3}}>Override</div>
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

type AnalyticsData = {mean:number,median:number,std:number,weighted:number,min:number,max:number,low:number,market:number,high:number,suggested:number,aMean:number,count:number}

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
    <div style={{background:G.bg4,borderRadius:6,padding:'12px 14px',marginBottom:8}}>
      <div style={{fontSize:11,color:G.muted,marginBottom:3}}>{l}</div>
      <div style={{fontSize:20,fontWeight:700,color:c||G.white,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
      {note&&<div style={{fontSize:11,color:G.muted,marginTop:2}}>{note}</div>}
    </div>
  )
  return (
    <div className="anim-in">
      <WorkflowSteps current="analytics"/>
      <SectionTitle sub="Statistical analysis of your sale comps to establish value range and suggested listing price.">Analytics & Valuation</SectionTitle>
      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <Btn onClick={run} style={{padding:'10px 20px'}}>Run Analytics →</Btn>
        {ran&&<Btn variant="ghost" onClick={()=>setPage('ai-analysis')} style={{padding:'10px 20px'}}>Next: AI Analysis →</Btn>}
      </div>
      {!ran&&<Card style={{textAlign:'center' as const,padding:'56px 20px'}}><div style={{fontSize:40,opacity:.2,marginBottom:12}}>📈</div><p style={{color:G.muted}}>{comps.length===0?'Add comps from Sale Comp Search first.':'Click Run Analytics to calculate valuation metrics.'}</p></Card>}
      {ran&&analytics&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}} className="anim-in">
          <Card>
            <SL>Sale Comp Statistics ({analytics.count} comps)</SL>
            <Stat l="Average Price/SF" v={`$${analytics.mean.toFixed(2)}`}/>
            <Stat l="Median Price/SF" v={`$${analytics.median.toFixed(2)}`}/>
            <Stat l="Weighted Average PSF" v={`$${analytics.weighted.toFixed(2)}`} c={G.gold} note="Weighted by building size"/>
            <Stat l="Standard Deviation" v={`$${analytics.std.toFixed(2)}`}/>
            <Stat l="Min PSF" v={`$${analytics.min.toFixed(2)}`} c={G.red}/>
            <Stat l="Max PSF" v={`$${analytics.max.toFixed(2)}`} c={G.green}/>
          </Card>
          <Card>
            <SL>Value Range Conclusion</SL>
            <Stat l="Conservative Value" v={`$${analytics.low.toFixed(2)}/SF`} c={G.orange} note="Low scenario"/>
            <Stat l="Market Value" v={`$${analytics.market.toFixed(2)}/SF`} note="Most probable value"/>
            <Stat l="Optimistic Value" v={`$${analytics.high.toFixed(2)}/SF`} c={G.green} note="High scenario"/>
            <div style={{background:`${G.gold}10`,border:`1px solid ${G.goldBorder}`,borderRadius:8,padding:'14px 16px',marginTop:12}}>
              <div style={{fontSize:11,color:G.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:6}}>Suggested Listing Price</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:26,fontWeight:700,color:G.gold}}>${analytics.suggested}/SF</div>
            </div>
          </Card>
          <Card>
            <SL>Market Benchmarks</SL>
            <Stat l="Avg Asking Price/SF (Listings)" v={analytics.aMean>0?`$${analytics.aMean.toFixed(2)}`:'No listings yet'} c={G.blue}/>
            <SL style={{marginTop:16}}>Price Distribution</SL>
            {comps.filter(c=>c.price_per_sf>0).map((c,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <div style={{width:80,fontSize:10,color:G.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{c.address?.split(',')[0]||'—'}</div>
                <div style={{flex:1,height:4,background:G.bg4,borderRadius:2}}><div style={{height:'100%',background:G.gold,borderRadius:2,width:`${analytics.max>analytics.min?((c.price_per_sf-analytics.min)/(analytics.max-analytics.min)*100).toFixed(0):'50'}%`}}/></div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:G.white,width:48,textAlign:'right' as const}}>${Number(c.price_per_sf).toFixed(0)}</div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}

function AIAnalysis({subject,comps,analytics,aiText,setAiText,setPage}: {subject:SubjectForm|null,comps:Comp[],analytics:AnalyticsData|null,aiText:string,setAiText:(t:string)=>void,setPage:(p:string)=>void}) {
  const [loading,setLoading]=useState(false)
  const [done,setDone]=useState(!!aiText)
  const outputRef=useRef<HTMLDivElement>(null)
  const generate = async () => {
    if (!subject||!analytics){alert('Complete subject property and analytics first.');return}
    setLoading(true);setAiText('');setDone(false)
    const prompt=`You are a senior Long Island industrial commercial real estate broker with 30 years of experience. Write a professional Opinion of Value (OPV) Broker Analysis in institutional language similar to CBRE, JLL, Newmark, or Colliers International.

Subject Property: ${subject.address}
Building Size: ${subject.size} SF | Clear Height: ${subject.ceiling} ft | Year Built: ${subject.yearBuilt||'—'}
Construction: ${subject.construction} | Condition: ${subject.condition}
Docks: ${subject.docks||'—'} | Drive-In: ${subject.driveIn||'—'} | Power: ${subject.power||'—'}
County: ${subject.county} | Zoning: ${subject.zoning||'—'}

Sale Comp Analytics (${comps.length} comps):
- Average PSF: $${analytics.mean.toFixed(2)} | Weighted Average: $${analytics.weighted.toFixed(2)}
- Value Range: $${analytics.low.toFixed(2)} – $${analytics.high.toFixed(2)}/SF
- Suggested Listing Price: $${analytics.suggested}/SF

Write a comprehensive broker analysis covering: Market Overview, Location Analysis, Building Quality Assessment, Comparable Sales Discussion, Supply & Demand Dynamics, and Value Conclusion. Use institutional language, data-driven insights, approximately 500-600 words.`
    try {
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})})
      const data=await res.json()
      const text=data.text||'Generation failed. Please try again.'
      setLoading(false);let i=0
      const iv=setInterval(()=>{
        if(i<text.length){setAiText(text.slice(0,i+1));i++;if(outputRef.current)outputRef.current.scrollTop=outputRef.current.scrollHeight}
        else{clearInterval(iv);setDone(true)}
      },8)
    } catch{setLoading(false);setAiText('AI generation failed. Please try again.');setDone(true)}
  }
  return (
    <div className="anim-in">
      <WorkflowSteps current="ai-analysis"/>
      <SectionTitle sub="AI-powered broker narrative in institutional language — CBRE/JLL style.">AI Broker Analysis</SectionTitle>
      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:20,alignItems:'start'}}>
        <Card>
          <SL>Analysis Parameters</SL>
          <p style={{fontSize:12,color:G.muted,marginBottom:14,lineHeight:1.6}}>Behaves as a senior Long Island industrial broker with 30 years of experience. Uses institutional language consistent with CBRE, JLL, Newmark, and Colliers.</p>
          {([['Subject',subject?.address?.split(',')[0]||'—'],['Size',subject?.size?`${parseInt(subject.size).toLocaleString()} SF`:'—'],['Comps',String(comps.length)],['Avg PSF',analytics?`$${analytics.mean.toFixed(2)}`:'-'],['Suggested',analytics?`$${analytics.suggested}/SF`:'-']] as [string,string][]).map(([l,v])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${G.border}`,fontSize:12}}>
              <span style={{color:G.muted}}>{l}</span><span style={{fontWeight:500}}>{v}</span>
            </div>
          ))}
          <Btn onClick={generate} style={{width:'100%',padding:11,marginTop:14}} disabled={loading}>{loading?'Generating...':'Generate AI Analysis →'}</Btn>
          {done&&<>
            <Btn onClick={()=>setPage('opv-report')} style={{width:'100%',padding:11,marginTop:10}}>Next: OPV Report →</Btn>
            <Btn variant="ghost" onClick={()=>navigator.clipboard.writeText(aiText)} style={{width:'100%',padding:10,marginTop:8,fontSize:12}}>Copy to Clipboard</Btn>
          </>}
        </Card>
        <Card style={{minHeight:400}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' as const,color:G.muted}}>AI Broker Analysis</span>
            {loading&&<span className="spin" style={{width:14,height:14,border:`1.5px solid ${G.border}`,borderTopColor:G.gold,borderRadius:'50%',display:'inline-block'}}/>}
            {done&&<Tag color={G.green}>Complete</Tag>}
          </div>
          <div ref={outputRef} style={{fontSize:13,color:aiText?G.white:G.muted,fontStyle:aiText?'normal':'italic',lineHeight:1.85,fontWeight:300,whiteSpace:'pre-wrap' as const,maxHeight:560,overflowY:'auto'}}>
            {loading&&!aiText?'Generating analysis...':aiText||'Click Generate AI Analysis to create the broker narrative.'}
          </div>
        </Card>
      </div>
    </div>
  )
}

function OPVReport({subject,comps,leaseComps,avails,analytics,aiText,setPage}: {subject:SubjectForm|null,comps:Comp[],leaseComps:LeaseComp[],avails:Avail[],analytics:AnalyticsData|null,aiText:string,setPage:(p:string)=>void}) {
  const today=new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
  const [downloading, setDownloading] = useState(false)
  const [includeLeaseComps, setIncludeLeaseComps] = useState(leaseComps.length>0)
  const [includeAvails, setIncludeAvails] = useState(true)
  const [includeMarketingStrategy, setIncludeMarketingStrategy] = useState(true)
  const [includePcreProfile, setIncludePcreProfile] = useState(true)

  const downloadWord = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/generate-opv', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({subject, comps, leaseComps: includeLeaseComps ? leaseComps : [], avails: includeAvails ? avails : [], analytics, aiText, includeLeaseComps, includeAvails, includeMarketingStrategy, includePcreProfile})
      })
      if (!res.ok) { alert('Error generating report: ' + await res.text()); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'OPV_Report.docx'
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) { alert('Download failed: ' + (e as Error).message) }
    setDownloading(false)
  }

  if (!subject) return (
    <div className="anim-in">
      <WorkflowSteps current="opv-report"/>
      <Card style={{textAlign:'center' as const,padding:'56px 20px'}}><p style={{color:G.muted,marginBottom:16}}>Complete the workflow before generating the OPV report.</p><Btn onClick={()=>setPage('subject')}>Start with Subject Property →</Btn></Card>
    </div>
  )
  const Section=({title,children}: {title:string,children:React.ReactNode})=>(
    <div style={{marginBottom:28}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:700,color:'#c9a84c',borderBottom:'1px solid #e8d8a0',paddingBottom:6,marginBottom:14}}>{title}</div>
      {children}
    </div>
  )
  return (
    <div className="anim-in">
      <WorkflowSteps current="opv-report"/>
      <div className="no-print" style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <SectionTitle>OPV Report Preview</SectionTitle>
          <div style={{display:'flex',gap:10}}>
            <Btn onClick={downloadWord} disabled={downloading} style={{padding:'9px 20px',fontSize:12,background:G.goldDim,color:G.gold,border:`1px solid ${G.goldBorder}`}}>
              {downloading ? 'Generating...' : '📄 Download Word Report'}
            </Btn>
            <Btn variant="ghost" onClick={()=>window.print()} style={{padding:'9px 16px',fontSize:12}}>🖨 Print / Save PDF</Btn>
          </div>
        </div>
        <Card style={{padding:'14px 18px'}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' as const,color:G.muted,marginBottom:10}}>Word Report Sections</div>
          <div style={{display:'flex',gap:20,flexWrap:'wrap' as const}}>
            {([
              ['Include Lease Comps', includeLeaseComps, setIncludeLeaseComps],
              ['Include Availabilities', includeAvails, setIncludeAvails],
              ['Include Marketing Strategy', includeMarketingStrategy, setIncludeMarketingStrategy],
              ['Include PCRE Profile', includePcreProfile, setIncludePcreProfile],
            ] as [string,boolean,(v:boolean)=>void][]).map(([lbl,val,setter])=>(
              <label key={lbl} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontSize:12,fontWeight:500,color:val?G.white:G.muted}}>
                <input type="checkbox" checked={val} onChange={e=>setter(e.target.checked)} style={{width:14,height:14,cursor:'pointer',accentColor:G.gold}}/>
                {lbl}
              </label>
            ))}
          </div>
        </Card>
      </div>
      <div className="print-area" style={{background:'#fff',borderRadius:10,padding:'48px 56px',color:'#1a1a2e',maxWidth:900,margin:'0 auto',fontFamily:'Georgia,serif',fontSize:13,lineHeight:1.7,boxShadow:'0 4px 24px rgba(0,0,0,.10)'}}>
        <div style={{textAlign:'center' as const,marginBottom:48,paddingBottom:48,borderBottom:'2px solid #1a1a2e'}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase' as const,color:'#888',marginBottom:16}}>PREMIER COMMERCIAL REAL ESTATE · LONG ISLAND</div>
          <div style={{fontSize:32,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",marginBottom:12}}>Opinion of Value</div>
          <div style={{fontSize:22,color:'#c9a84c',fontFamily:"'Cormorant Garamond',serif",marginBottom:20}}>{subject.address}</div>
          <div style={{display:'inline-block',background:'#0a0c10',color:'#c9a84c',padding:'6px 18px',borderRadius:4,fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase' as const}}>{subject.type} · {subject.county} County</div>
          <div style={{marginTop:24,fontSize:12,color:'#888'}}>Prepared: {today}</div>
        </div>
        <Section title="Executive Summary">
          <p style={{marginBottom:10}}>This Opinion of Value has been prepared by Premier Commercial Real Estate for the property at <strong>{subject.address}</strong>. The subject is a {parseInt(subject.size||'0').toLocaleString()} SF {subject.type?.toLowerCase()} in {subject.county} County, NY.</p>
          {analytics&&<div style={{background:'#f8f6f0',border:'1px solid #e8d8a0',borderRadius:6,padding:'14px 20px',margin:'16px 0'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,textAlign:'center' as const}}>
              {([['Conservative',`$${analytics.low.toFixed(2)}/SF`],['Market Value',`$${analytics.market.toFixed(2)}/SF`],['Optimistic',`$${analytics.high.toFixed(2)}/SF`]] as [string,string][]).map(([l,v])=>(
                <div key={l}><div style={{fontSize:10,color:'#888',textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:4}}>{l}</div><div style={{fontSize:18,fontWeight:700}}>{v}</div></div>
              ))}
            </div>
            <div style={{borderTop:'1px solid #e8d8a0',marginTop:12,paddingTop:12,textAlign:'center' as const}}>
              <div style={{fontSize:10,color:'#888',textTransform:'uppercase' as const,marginBottom:4}}>Recommended Listing Price</div>
              <div style={{fontSize:28,fontWeight:700,color:'#c9a84c',fontFamily:"'Cormorant Garamond',serif"}}>${analytics.suggested} / Square Foot</div>
              {subject.size&&<div style={{fontSize:14,color:'#555',marginTop:4}}>Implied Total: ${(analytics.suggested*parseInt(subject.size)).toLocaleString()}</div>}
            </div>
          </div>}
        </Section>
        <Section title="Subject Property Specifications">
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
            <tbody>
              {([['Address',subject.address],['County',subject.county+' County'],['Property Type',subject.type],['Building Size',`${parseInt(subject.size||'0').toLocaleString()} SF`],['Lot Size',subject.lot||'—'],['Clear Ceiling',subject.ceiling?`${subject.ceiling} ft`:'—'],['Year Built',subject.yearBuilt||'—'],['Construction',subject.construction],['Condition',subject.condition],['Loading Docks',subject.docks||'—'],['Drive-In Doors',subject.driveIn||'—'],['Electrical Power',subject.power||'—'],['Heat',subject.heat],['Sprinkler',subject.sprinkler],['Sewer',subject.sewer],['Office %',subject.officePct?`${subject.officePct}%`:'—'],['Parking',subject.parking||'—'],['Zoning',subject.zoning||'—'],['RE Taxes',subject.taxes?`$${parseInt(subject.taxes).toLocaleString()}/yr`:'—']] as [string,string][]).map(([l,v],i)=>(
                <tr key={l} style={{background:i%2===0?'#f8f8f8':'#fff'}}>
                  <td style={{padding:'7px 12px',fontWeight:700,color:'#555',width:'35%',borderBottom:'1px solid #eee'}}>{l}</td>
                  <td style={{padding:'7px 12px',borderBottom:'1px solid #eee'}}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        {comps.length>0&&<Section title="Comparable Sales Analysis">
          <div style={{overflowX:'auto' as const}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
              <thead><tr style={{background:'#1a1a2e',color:'#fff'}}>
                {['Address','City','Building SF','Ceiling','Docks','Drive-In','Power','Sewer','Zoning','Sale Price','$/SF','Sale Date','Buyer','Seller'].map(h=><th key={h} style={{padding:'8px 8px',textAlign:'left' as const,fontSize:9,whiteSpace:'nowrap' as const}}>{h}</th>)}
              </tr></thead>
              <tbody>{comps.map((c,i)=>(
                <tr key={c.id} style={{background:i%2===0?'#f8f8f8':'#fff'}}>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',minWidth:160,fontWeight:600}}>{c.address}{(c as Comp & {photo_url?:string}).photo_url&&<img src={(c as Comp & {photo_url?:string}).photo_url} alt={c.address} style={{display:'block',width:80,height:50,objectFit:'cover',borderRadius:3,marginTop:4}}/>}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.city||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',whiteSpace:'nowrap' as const}}>{c.building_sf?Number(c.building_sf).toLocaleString():'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.ceiling_height||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.loading_docks||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.drive_ins||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.power||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.sewer||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.zoning||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',whiteSpace:'nowrap' as const}}>{c.sale_price?`$${Number(c.sale_price).toLocaleString()}`:'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',fontWeight:700,color:'#c9a84c',whiteSpace:'nowrap' as const}}>{(c.price_per_sf||(c.sale_price&&c.building_sf?Number(c.sale_price)/Number(c.building_sf):0))?`$${(c.price_per_sf||Number(c.sale_price)/Number(c.building_sf)).toFixed(2)}`:'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',whiteSpace:'nowrap' as const}}>{fmtDate(c.sale_date)}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.buyer||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{c.seller||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Section>}
        {avails.length>0&&<Section title="Active Market Availabilities">
          <div style={{overflowX:'auto' as const}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
              <thead><tr style={{background:'#1a1a2e',color:'#fff'}}>
                {['Address','City','Building SF','Ceiling','Docks','Drive-In','Power','Sewer','Zoning','Asking Price','$/SF','Guidance'].map(h=><th key={h} style={{padding:'8px 8px',textAlign:'left' as const,fontSize:9,whiteSpace:'nowrap' as const}}>{h}</th>)}
              </tr></thead>
              <tbody>{avails.map((a,i)=>(
                <tr key={a.id} style={{background:i%2===0?'#f8f8f8':'#fff'}}>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',minWidth:160,fontWeight:600}}>{a.address}{(a as Avail & {photo_url?:string}).photo_url&&<img src={(a as Avail & {photo_url?:string}).photo_url} alt={a.address} style={{display:'block',width:80,height:50,objectFit:'cover',borderRadius:3,marginTop:4}}/>}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{a.city||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',whiteSpace:'nowrap' as const}}>{a.building_sf?Number(a.building_sf).toLocaleString():'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{a.ceiling_height||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{a.loading_docks||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{a.drive_ins||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{a.power||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{a.sewer||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{a.zoning||'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',whiteSpace:'nowrap' as const}}>{a.asking_price?`$${Number(a.asking_price).toLocaleString()}`:'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee',fontWeight:700,color:'#3b82f6',whiteSpace:'nowrap' as const}}>{(a.price_per_sf||(a.asking_price&&a.building_sf?Number(a.asking_price)/Number(a.building_sf):0))?`$${(a.price_per_sf||Number(a.asking_price)/Number(a.building_sf)).toFixed(2)}`:'—'}</td>
                  <td style={{padding:'7px 8px',borderBottom:'1px solid #eee'}}>{a.pricing_guidance||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Section>}
        {aiText&&<Section title="Market Commentary & Broker Analysis">
          <div style={{fontSize:13,lineHeight:1.85,whiteSpace:'pre-wrap' as const}}>{aiText}</div>
        </Section>}
        {analytics&&<Section title="Value Conclusion">
          <p>Based upon our analysis of {comps.length} comparable industrial sale transactions and {avails.length} active market availabilities in {subject.county} County, it is our opinion that the subject property has a current market value range of <strong>${analytics.low.toFixed(2)} – ${analytics.high.toFixed(2)} per square foot</strong>, with a most probable value of <strong>${analytics.market.toFixed(2)} per square foot</strong>.</p>
          <div style={{background:'#f8f6f0',border:'1px solid #e8d8a0',borderRadius:6,padding:'18px 24px',margin:'16px 0',textAlign:'center' as const}}>
            <div style={{fontSize:10,color:'#888',textTransform:'uppercase' as const,letterSpacing:'.1em',marginBottom:8}}>Recommended Listing Price</div>
            <div style={{fontSize:32,fontWeight:700,color:'#c9a84c',fontFamily:"'Cormorant Garamond',serif"}}>${analytics.suggested} / Square Foot</div>
            {subject.size&&<div style={{fontSize:14,color:'#555',marginTop:6}}>Implied Total Value: ${(analytics.suggested*parseInt(subject.size)).toLocaleString()}</div>}
          </div>
        </Section>}
        <div style={{borderTop:'1px solid #ddd',paddingTop:16,marginTop:16,fontSize:10,color:'#999',lineHeight:1.7}}>
          <strong>DISCLAIMER:</strong> This Opinion of Value has been prepared by Premier Commercial Real Estate for informational purposes only and does not constitute a certified appraisal. It is based upon data available at the time of preparation and may not reflect subsequent market changes. This report should not be relied upon as a substitute for a formal USPAP-compliant appraisal by a licensed appraiser.
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [user,setUser]=useState<{name:string,role:string,init:string}|null>(null)
  const [page,setPage]=useState('dashboard')
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
  const [reports,setReports]=useState<OPVReportData[]>([])
  const [savedOPVId,setSavedOPVId]=useState<string|null>(()=>{
    if(typeof window==='undefined') return null
    return localStorage.getItem('opv_saved_id')||null
  })
  const [lastSaved,setLastSaved]=useState<Date|null>(null)
  const [saving,setSaving]=useState(false)
  const [savedOPVs,setSavedOPVs]=useState<{id:string,address:string,current_step:string,updated_at:string,saved_by:string}[]>([])
  const [showSavedPanel,setShowSavedPanel]=useState(false)
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
  // Autosave OPV state
  useEffect(()=>{try{localStorage.setItem('opv_subject',JSON.stringify(subject))}catch{}},[subject])
  useEffect(()=>{try{localStorage.setItem('opv_comps',JSON.stringify(comps))}catch{}},[comps])
  useEffect(()=>{try{localStorage.setItem('opv_avails',JSON.stringify(avails))}catch{}},[avails])
  useEffect(()=>{try{localStorage.setItem('opv_lease_comps',JSON.stringify(leaseComps))}catch{}},[leaseComps])
  useEffect(()=>{if(savedOPVId)try{localStorage.setItem('opv_saved_id',savedOPVId)}catch{}},[savedOPVId])
  useEffect(()=>{try{localStorage.setItem('opv_analytics',JSON.stringify(analytics))}catch{}},[analytics])
  useEffect(()=>{try{localStorage.setItem('opv_aitext',aiText)}catch{}},[aiText])

  const handleSetPage=useCallback((p:string)=>setPage(p),[])

  if (!user) return <><style>{css}</style><Auth onLogin={setUser}/></>

  const saveReport=async(silent=false)=>{
    if(!subject){if(!silent)alert('Enter a subject property address first.');return}
    setSaving(true)
    try {
      const res = await fetch('/api/opv-history',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({savedBy:user.name, address:subject.address, subject, comps, leaseComps, avails, analytics, aiText, currentStep:page, existingId:savedOPVId})
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
    setSubject(null); setComps([]); setLeaseComps([]); setAvails([]); setAnalytics(null); setAiText('')
    setSavedOPVId(null); setLastSaved(null)
    try{localStorage.removeItem('opv_saved_id')}catch{}
    setPage('subject')
  }

  const accentMap: Record<string,string> = {main:G.cyan,workflow:G.purple,exports:G.green,database:G.orange}

  return (
    <>
      <style>{css}</style>
      <div style={{display:'flex',minHeight:'100vh'}}>
        <div className="no-print" style={{width:224,flexShrink:0,background:'linear-gradient(180deg,#1A1A1A 0%,#111111 100%)',borderRight:'1px solid rgba(255,255,255,0.07)',display:'flex',flexDirection:'column',minHeight:'100vh',position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
          <div style={{padding:'22px 20px 18px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:600,background:G.gradGold,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4}}>Premier OPV</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',letterSpacing:'.14em',textTransform:'uppercase' as const}}>Long Island Industrial</div>
          </div>
          <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:G.gradGold,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#111111',flexShrink:0}}>{user.init}</div>
            <div><div style={{fontSize:12,fontWeight:600,color:'#F0F0F0'}}>{user.name}</div><div style={{fontSize:10,color:'rgba(255,255,255,0.40)'}}>{user.role}</div></div>
          </div>
          <div style={{flex:1,padding:'12px 10px',overflowY:'auto'}}>
            {(['main','workflow','exports'] as const).map(sec=>(
              <div key={sec} style={{marginBottom:6}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase' as const,color:accentMap[sec],padding:'8px 10px 5px',opacity:.9}}>{sec==='main'?'Main':sec==='workflow'?'OPV Workflow':'Reports'}</div>
                {NAV.filter(n=>n.section===sec).map(n=>{
                  const active=page===n.id; const accent=accentMap[sec]
                  return (
                    <div key={n.id} onClick={()=>setPage(n.id)} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:8,fontSize:12,fontWeight:active?600:400,color:active?accent:'rgba(255,255,255,0.52)',background:active?`${accent}22`:'transparent',border:`1px solid ${active?accent+'45':'transparent'}`,cursor:'pointer',marginBottom:2,transition:'all .15s'}}>
                      <span style={{fontSize:13,width:16,textAlign:'center' as const}}>{n.icon}</span>
                      <span style={{flex:1}}>{n.label}</span>
                      {n.id==='subject'&&subject&&<span style={{width:6,height:6,borderRadius:'50%',background:G.green}}/>}
                      {n.id==='comp-search'&&comps.length>0&&<span style={{fontSize:9,background:'rgba(200,135,10,0.18)',color:G.gold2,padding:'2px 6px',borderRadius:4,fontWeight:700}}>{comps.length}</span>}
                      {n.id==='avail-search'&&avails.length>0&&<span style={{fontSize:9,background:'rgba(200,135,10,0.18)',color:G.gold2,padding:'2px 6px',borderRadius:4,fontWeight:700}}>{avails.length}</span>}
                      {n.id==='lease-comps'&&leaseComps.length>0&&<span style={{fontSize:9,background:'rgba(37,99,235,0.18)',color:G.blue,padding:'2px 6px',borderRadius:4,fontWeight:700}}>{leaseComps.length}</span>}
                      {n.id==='folders'&&folders.length>0&&<span style={{fontSize:9,background:'rgba(200,135,10,0.18)',color:G.gold2,padding:'2px 6px',borderRadius:4,fontWeight:700}}>{folders.length}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div style={{padding:'14px',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',flexDirection:'column',gap:6}}>
            <button onClick={()=>saveReport(false)} disabled={saving} style={{background:G.gradGold,border:'none',color:'#111111',fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,padding:'10px 12px',borderRadius:7,cursor:saving?'not-allowed':'pointer',width:'100%',opacity:saving?.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              {saving?<><span className="spin" style={{display:'inline-block',width:10,height:10,border:'1.5px solid #11111155',borderTopColor:'#111111',borderRadius:'50%'}}/>Saving...</>:'💾 Save Progress'}
            </button>
            {lastSaved&&<div style={{fontSize:9,color:'rgba(255,255,255,0.3)',textAlign:'center' as const,lineHeight:1.4}}>
              Last saved {lastSaved.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
              {savedOPVId&&<span style={{color:'rgba(255,255,255,0.2)'}}> · #{savedOPVId.slice(0,6)}</span>}
            </div>}
            <button onClick={()=>{setShowSavedPanel(true);loadSavedOPVs()}} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.55)',fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:500,padding:'8px 12px',borderRadius:7,cursor:'pointer',width:'100%'}}>
              📂 Load Saved OPV
            </button>
            <button onClick={startNewOPV} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.35)',fontFamily:"'Inter',sans-serif",fontSize:10,fontWeight:500,padding:'7px 12px',borderRadius:7,cursor:'pointer',width:'100%'}}>
              ＋ New OPV
            </button>
            <div onClick={()=>setUser(null)} style={{fontSize:11,color:'rgba(255,255,255,0.28)',cursor:'pointer',display:'flex',alignItems:'center',gap:7,padding:'4px'}}>
              <span>⏻</span> Sign Out
            </div>
          </div>
        </div>
        {showSavedPanel&&(
          <div style={{position:'fixed',inset:0,zIndex:200,display:'flex'}}>
            <div onClick={()=>setShowSavedPanel(false)} style={{flex:1,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(4px)'}}/>
            <div style={{width:440,background:'#FFFFFF',boxShadow:'-8px 0 40px rgba(0,0,0,0.18)',display:'flex',flexDirection:'column',overflowY:'auto'}}>
              <div style={{padding:'22px 24px',borderBottom:`1px solid ${G.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>Saved OPVs</div>
                <button onClick={()=>setShowSavedPanel(false)} style={{background:'transparent',border:'none',fontSize:18,cursor:'pointer',color:G.muted,padding:'4px 8px',borderRadius:6}}>×</button>
              </div>
              {savedOPVId&&<div style={{padding:'12px 24px',background:`${G.green}0a`,borderBottom:`1px solid ${G.border}`}}>
                <div style={{fontSize:11,color:G.green,fontWeight:600,marginBottom:2}}>✓ Current session is saved</div>
                <div style={{fontSize:11,color:G.muted}}>{lastSaved?`Last saved ${lastSaved.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`:'Saved'} · ID: {savedOPVId.slice(0,8)}…</div>
              </div>}
              <div style={{padding:'16px 24px',flex:1}}>
                {savedOPVs.length===0&&<div style={{textAlign:'center' as const,padding:'48px 20px',color:G.muted,fontSize:13}}>
                  <div style={{fontSize:36,opacity:.2,marginBottom:12}}>📂</div>
                  No saved OPVs yet. Hit "Save Progress" to save your current session.
                </div>}
                {savedOPVs.map(s=>{
                  const isCurrent = s.id===savedOPVId
                  const stepLabel: Record<string,string> = {'subject':'Subject','comp-search':'Sale Comps','avail-search':'Availabilities','lease-comps':'Lease Comps','scoring':'Scoring','analytics':'Analytics','ai-analysis':'AI Analysis','opv-report':'Report'}
                  const updatedAt = new Date(s.updated_at||'')
                  const today = new Date()
                  const diffMs = today.getTime()-updatedAt.getTime()
                  const diffMins = Math.floor(diffMs/60000)
                  const timeAgo = diffMins<2?'just now':diffMins<60?`${diffMins}m ago`:diffMins<1440?`${Math.floor(diffMins/60)}h ago`:`${Math.floor(diffMins/1440)}d ago`
                  return (
                    <div key={s.id} style={{borderRadius:10,border:`1.5px solid ${isCurrent?G.gold:G.border}`,marginBottom:10,overflow:'hidden'}}>
                      <div style={{padding:'14px 16px',background:isCurrent?G.goldDim:'transparent'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{s.address||'No address'}</div>
                            <div style={{fontSize:10,color:G.muted}}>By {s.saved_by} · {timeAgo}</div>
                          </div>
                          {isCurrent&&<Tag color={G.gold}>Current</Tag>}
                        </div>
                        {s.current_step&&<div style={{fontSize:11,color:G.blue,marginBottom:10}}>Saved at: <strong>{stepLabel[s.current_step]||s.current_step}</strong></div>}
                        <div style={{display:'flex',gap:8}}>
                          <Btn onClick={()=>restoreOPV(s.id)} style={{flex:1,padding:'8px',fontSize:11}}>
                            {isCurrent?'✓ Continue':'▶ Load & Resume'}
                          </Btn>
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
              <div style={{padding:'16px 24px',borderTop:`1px solid ${G.border}`}}>
                <Btn onClick={()=>{saveReport(false);setTimeout(loadSavedOPVs,800)}} disabled={saving||!subject} style={{width:'100%',padding:11}}>
                  {saving?'Saving...':'💾 Save Current Progress'}
                </Btn>
              </div>
            </div>
          </div>
        )}
        <div style={{flex:1,minHeight:'100vh',overflowY:'auto',background:G.bg}}>
          <div className="no-print" style={{padding:'14px 32px',borderBottom:'1px solid rgba(0,0,0,0.08)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(255,255,255,0.92)',position:'sticky',top:0,zIndex:50,backdropFilter:'blur(16px)'}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:'#111111'}}>{PAGE_TITLES[page]||page}</div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {lastSaved&&<span style={{fontSize:10,color:G.muted}}>Saved {lastSaved.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span>}
              <button onClick={()=>saveReport(false)} disabled={saving||!subject} style={{fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:600,padding:'6px 14px',borderRadius:7,cursor:saving||!subject?'not-allowed':'pointer',background:G.goldDim,color:G.gold,border:`1px solid ${G.goldBorder}`,opacity:!subject?.5:1}}>
                {saving?'Saving…':'💾 Save'}
              </button>
              {subject&&<span style={{fontSize:10,padding:'3px 10px',borderRadius:999,background:`${G.green}14`,color:G.green,border:`1px solid ${G.green}22`}}>{subject.address?.split(',')[0]}</span>}
              <span style={{fontSize:10,padding:'3px 10px',borderRadius:999,background:`${G.gold}14`,color:G.gold,border:`1px solid ${G.gold}22`}}>LI Industrial</span>
            </div>
          </div>
          <div style={{padding:'28px 32px'}}>
            {page==='dashboard'&&<Dashboard user={user} reports={reports} setPage={handleSetPage} onRestore={restoreOPV}/>}
            {page==='subject'&&<SubjectProperty subject={subject} setSubject={setSubject} setPage={handleSetPage} folders={folders} setFolders={updateFolders}/>}
            {page==='database'&&<DatabaseManager/>}
            {page==='comp-search'&&<CompSearch subject={subject} comps={comps} setComps={setComps} setPage={handleSetPage} folders={folders} setFolders={updateFolders}/>}
            {page==='avail-search'&&<AvailSearch subject={subject} avails={avails} setAvails={setAvails} setPage={handleSetPage} folders={folders} setFolders={updateFolders}/>}
            {page==='lease-comps'&&<LeaseCompSearch subject={subject} leaseComps={leaseComps} setLeaseComps={setLeaseComps} setPage={handleSetPage}/>}
            {page==='folders'&&<FolderManager folders={folders} setFolders={updateFolders} setPage={handleSetPage} comps={comps} setComps={setComps} avails={avails} setAvails={setAvails}/>}
            {page==='scoring'&&<Scoring subject={subject} comps={comps} scoredComps={scoredComps} setScoredComps={setScoredComps} setPage={handleSetPage}/>}
            {page==='analytics'&&<Analytics comps={scoredComps.length>0?scoredComps:comps} avails={avails} analytics={analytics} setAnalytics={setAnalytics} setPage={handleSetPage}/>}
            {page==='ai-analysis'&&<AIAnalysis subject={subject} comps={scoredComps.length>0?scoredComps:comps} analytics={analytics} aiText={aiText} setAiText={setAiText} setPage={handleSetPage}/>}
            {page==='opv-report'&&<OPVReport subject={subject} comps={scoredComps.length>0?scoredComps:comps} leaseComps={leaseComps} avails={avails} analytics={analytics} aiText={aiText} setPage={handleSetPage}/>}
          </div>
        </div>
      </div>
    </>
  )
}
