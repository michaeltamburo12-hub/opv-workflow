'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const STEPS = [
  { id: 1, label: 'Subject Property', icon: '🏢' },
  { id: 2, label: 'Sale Comps', icon: '🏭' },
  { id: 3, label: 'Availabilities', icon: '📋' },
  { id: 4, label: 'Value Opinion', icon: '💰' },
  { id: 5, label: 'Generate Report', icon: '📄' },
]

type SubjectProperty = {
  address: string; city: string; state: string; zip: string; county: string
  building_sf: string; lot_size_ac: string; year_built: string; num_floors: string
  ceiling_height: string; loading_docks: string; drive_ins: string; power: string
  heat: string; parking: string; sprinkler: string; sewer: string; zoning: string
  real_estate_taxes: string; owner: string; property_type: string
}

function OPVForm() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [subject, setSubject] = useState<SubjectProperty>({
    address: '', city: '', state: 'NY', zip: '', county: 'Nassau',
    building_sf: '', lot_size_ac: '', year_built: '', num_floors: '',
    ceiling_height: '', loading_docks: '', drive_ins: '', power: '',
    heat: '', parking: '', sprinkler: '', sewer: '', zoning: '',
    real_estate_taxes: '', owner: '', property_type: 'Industrial'
  })
  const [valueOpinion, setValueOpinion] = useState({ low: '', mid: '', high: '', notes: '' })
  const [generating, setGenerating] = useState(false)

  const setSub = (k: keyof SubjectProperty, v: string) => setSubject(s => ({ ...s, [k]: v }))

  const inputCls = "mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "text-xs text-gray-500 font-medium uppercase tracking-wide"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-gray-400 hover:text-gray-600">← Home</a>
        <h1 className="text-xl font-bold text-gray-900">New Opinion of Value</h1>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => step > s.id - 1 && setStep(s.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    step === s.id ? 'bg-blue-600 text-white' :
                    step > s.id ? 'bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200' :
                    'bg-gray-100 text-gray-400 cursor-default'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span className="hidden md:inline">{s.label}</span>
                  <span className="md:hidden">{s.id}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`h-0.5 w-6 ${step > s.id ? 'bg-blue-300' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">

        {/* STEP 1: Subject Property */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Subject Property Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className={labelCls}>Property Address *</label>
                <input className={inputCls} placeholder="123 Industrial Blvd" value={subject.address} onChange={e => setSub('address', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} placeholder="Hauppauge" value={subject.city} onChange={e => setSub('city', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>County</label>
                <select className={inputCls} value={subject.county} onChange={e => setSub('county', e.target.value)}>
                  <option value="Nassau">Nassau</option>
                  <option value="Suffolk">Suffolk</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Zip Code</label>
                <input className={inputCls} placeholder="11787" value={subject.zip} onChange={e => setSub('zip', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Zoning</label>
                <input className={inputCls} placeholder="I-1, M1, etc." value={subject.zoning} onChange={e => setSub('zoning', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Building Size (SF) *</label>
                <input type="number" className={inputCls} placeholder="10000" value={subject.building_sf} onChange={e => setSub('building_sf', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Lot Size (Acres)</label>
                <input type="number" className={inputCls} placeholder="0.75" step="0.01" value={subject.lot_size_ac} onChange={e => setSub('lot_size_ac', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Year Built</label>
                <input type="number" className={inputCls} placeholder="1985" value={subject.year_built} onChange={e => setSub('year_built', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Number of Floors</label>
                <input type="number" className={inputCls} placeholder="1" value={subject.num_floors} onChange={e => setSub('num_floors', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Ceiling Height</label>
                <input className={inputCls} placeholder='18&apos;0"' value={subject.ceiling_height} onChange={e => setSub('ceiling_height', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Loading Docks</label>
                <input className={inputCls} placeholder="2" value={subject.loading_docks} onChange={e => setSub('loading_docks', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Drive-In Doors</label>
                <input className={inputCls} placeholder="1" value={subject.drive_ins} onChange={e => setSub('drive_ins', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Power</label>
                <input className={inputCls} placeholder="200A / 3-Phase" value={subject.power} onChange={e => setSub('power', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Heat</label>
                <input className={inputCls} placeholder="Gas / Oil / Electric" value={subject.heat} onChange={e => setSub('heat', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Parking</label>
                <input className={inputCls} placeholder="20 spaces" value={subject.parking} onChange={e => setSub('parking', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Sprinkler</label>
                <select className={inputCls} value={subject.sprinkler} onChange={e => setSub('sprinkler', e.target.value)}>
                  <option value="">Unknown</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Partial">Partial</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Sewer</label>
                <select className={inputCls} value={subject.sewer} onChange={e => setSub('sewer', e.target.value)}>
                  <option value="">Unknown</option>
                  <option value="City">City Sewer</option>
                  <option value="Septic">Septic</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Annual Real Estate Taxes ($)</label>
                <input type="number" className={inputCls} placeholder="25000" value={subject.real_estate_taxes} onChange={e => setSub('real_estate_taxes', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Owner / Client</label>
                <input className={inputCls} placeholder="Property owner or client name" value={subject.owner} onChange={e => setSub('owner', e.target.value)} />
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => subject.address && subject.building_sf ? setStep(2) : alert('Please fill in Address and Building Size')}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Next: Select Sale Comps →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Sale Comps */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Sale Comparables</h2>
            <p className="text-gray-500 text-sm mb-6">
              Search and select comparable sales for <strong>{subject.address}, {subject.city}</strong>.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-sm font-medium">Go to the Sale Comps page to search and select your comps, then come back to continue.</p>
              <a href="/comps" target="_blank" className="mt-2 inline-flex items-center gap-1 text-blue-600 font-semibold text-sm hover:underline">
                Open Sale Comps Search ↗
              </a>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-3">Or enter comparable sales manually:</p>
              <p className="text-xs text-gray-400">Full inline comp entry coming soon. Use the sale comps page for now.</p>
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(1)} className="text-gray-500 px-6 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">← Back</button>
              <button onClick={() => setStep(3)} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700">Next: Availabilities →</button>
            </div>
          </div>
        )}

        {/* STEP 3: Availabilities */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Market Availabilities</h2>
            <p className="text-gray-500 text-sm mb-6">
              Select current listings competing with <strong>{subject.address}</strong>.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-sm font-medium">Search available properties and select those most comparable to the subject.</p>
              <a href="/availabilities" target="_blank" className="mt-2 inline-flex items-center gap-1 text-blue-600 font-semibold text-sm hover:underline">
                Open Availabilities Search ↗
              </a>
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(2)} className="text-gray-500 px-6 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">← Back</button>
              <button onClick={() => setStep(4)} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700">Next: Value Opinion →</button>
            </div>
          </div>
        )}

        {/* STEP 4: Value Opinion */}
        {step === 4 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Opinion of Value</h2>
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <label className={labelCls}>Conservative Value ($)</label>
                <input type="number" className={inputCls + ' text-lg font-semibold'} placeholder="0" value={valueOpinion.low} onChange={e => setValueOpinion(v => ({ ...v, low: e.target.value }))} />
                {subject.building_sf && valueOpinion.low && (
                  <p className="text-xs text-gray-400 mt-1">${(Number(valueOpinion.low) / Number(subject.building_sf)).toFixed(2)}/SF</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Most Likely Value ($) *</label>
                <input type="number" className={inputCls + ' text-lg font-semibold border-blue-300 bg-blue-50'} placeholder="0" value={valueOpinion.mid} onChange={e => setValueOpinion(v => ({ ...v, mid: e.target.value }))} />
                {subject.building_sf && valueOpinion.mid && (
                  <p className="text-xs text-blue-500 mt-1">${(Number(valueOpinion.mid) / Number(subject.building_sf)).toFixed(2)}/SF</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Optimistic Value ($)</label>
                <input type="number" className={inputCls + ' text-lg font-semibold'} placeholder="0" value={valueOpinion.high} onChange={e => setValueOpinion(v => ({ ...v, high: e.target.value }))} />
                {subject.building_sf && valueOpinion.high && (
                  <p className="text-xs text-gray-400 mt-1">${(Number(valueOpinion.high) / Number(subject.building_sf)).toFixed(2)}/SF</p>
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>Value Rationale & Notes</label>
              <textarea
                className={inputCls + ' h-32 resize-none'}
                placeholder="Describe the basis for your value opinion, market conditions, adjustments made, etc."
                value={valueOpinion.notes}
                onChange={e => setValueOpinion(v => ({ ...v, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(3)} className="text-gray-500 px-6 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">← Back</button>
              <button onClick={() => setStep(5)} disabled={!valueOpinion.mid} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                Next: Generate Report →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Generate Report */}
        {step === 5 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Generate OPV Report</h2>

            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-gray-700 mb-4">Report Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Subject Property:</span>
                  <span className="ml-2 font-medium text-gray-800">{subject.address}, {subject.city}, NY {subject.zip}</span>
                </div>
                <div>
                  <span className="text-gray-500">County:</span>
                  <span className="ml-2 font-medium text-gray-800">{subject.county}</span>
                </div>
                <div>
                  <span className="text-gray-500">Building Size:</span>
                  <span className="ml-2 font-medium text-gray-800">{subject.building_sf ? Number(subject.building_sf).toLocaleString() + ' SF' : '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Zoning:</span>
                  <span className="ml-2 font-medium text-gray-800">{subject.zoning || '—'}</span>
                </div>
                <div className="md:col-span-2 mt-2 pt-4 border-t border-gray-200">
                  <span className="text-gray-500">Opinion of Value:</span>
                  <span className="ml-2 font-bold text-xl text-blue-700">${Number(valueOpinion.mid).toLocaleString()}</span>
                  {valueOpinion.low && valueOpinion.high && (
                    <span className="ml-2 text-gray-400 text-sm">(Range: ${Number(valueOpinion.low).toLocaleString()} – ${Number(valueOpinion.high).toLocaleString()})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setGenerating(true)
                  setTimeout(() => {
                    const data = { subject, valueOpinion, date: new Date().toLocaleDateString() }
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `OPV_${subject.address.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0,10)}.json`
                    a.click()
                    setGenerating(false)
                  }, 500)
                }}
                disabled={generating}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {generating ? 'Generating...' : '📄 Download OPV Data'}
              </button>
              <button onClick={() => { setStep(1); setSubject({ address:'',city:'',state:'NY',zip:'',county:'Nassau',building_sf:'',lot_size_ac:'',year_built:'',num_floors:'',ceiling_height:'',loading_docks:'',drive_ins:'',power:'',heat:'',parking:'',sprinkler:'',sewer:'',zoning:'',real_estate_taxes:'',owner:'',property_type:'Industrial' }); setValueOpinion({ low:'',mid:'',high:'',notes:'' }) }} className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
                Start New OPV
              </button>
            </div>

            <div className="flex justify-start mt-4">
              <button onClick={() => setStep(4)} className="text-gray-400 text-sm hover:text-gray-600">← Back to Value Opinion</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewOPVPage() {
  return (
    <Suspense>
      <OPVForm />
    </Suspense>
  )
}
