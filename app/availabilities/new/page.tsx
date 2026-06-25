'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewAvailabilityPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    address: '', city: '', state: 'NY', zip_code: '', county: 'Nassau',
    building_sf: '', lot_size_ac: '', ceiling_height: '', loading_docks: '',
    drive_ins: '', power: '', heat: '', parking: '', sprinkler: '', sewer: '',
    zoning: '', real_estate_taxes: '', asking_price: '', price_per_sf: '',
    pricing_guidance: '', availability_type: 'For Sale', listing_broker: '',
    loopnet_url: '', notes: '', submarket: '', property_type: 'Industrial'
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const inputCls = "mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
  const labelCls = "text-xs text-gray-500 font-medium uppercase tracking-wide"

  const save = async () => {
    if (!form.address) return alert('Address is required')
    setSaving(true)
    const body: Record<string, string | number | null> = {}
    Object.entries(form).forEach(([k, v]) => {
      if (!v) { body[k] = null; return }
      if (['building_sf','lot_size_ac','real_estate_taxes','asking_price','price_per_sf'].includes(k)) {
        body[k] = Number(v)
      } else {
        body[k] = v
      }
    })
    body.status = 'Available'
    const res = await fetch('/api/availabilities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { router.push('/availabilities') }
    else { alert('Error saving. Please try again.'); setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <a href="/availabilities" className="text-gray-400 hover:text-gray-600">← Availabilities</a>
        <h1 className="text-xl font-bold text-gray-900">Add New Availability</h1>
      </div>
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelCls}>Address *</label>
              <input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div><label className={labelCls}>City</label><input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><label className={labelCls}>County</label>
              <select className={inputCls} value={form.county} onChange={e => set('county', e.target.value)}>
                <option value="Nassau">Nassau</option>
                <option value="Suffolk">Suffolk</option>
              </select>
            </div>
            <div><label className={labelCls}>Zip Code</label><input className={inputCls} value={form.zip_code} onChange={e => set('zip_code', e.target.value)} /></div>
            <div><label className={labelCls}>Submarket</label><input className={inputCls} value={form.submarket} onChange={e => set('submarket', e.target.value)} /></div>
            <div><label className={labelCls}>Building SF</label><input type="number" className={inputCls} value={form.building_sf} onChange={e => set('building_sf', e.target.value)} /></div>
            <div><label className={labelCls}>Lot Size (AC)</label><input type="number" className={inputCls} step="0.01" value={form.lot_size_ac} onChange={e => set('lot_size_ac', e.target.value)} /></div>
            <div><label className={labelCls}>Ceiling Height</label><input className={inputCls} placeholder='18&apos;0"' value={form.ceiling_height} onChange={e => set('ceiling_height', e.target.value)} /></div>
            <div><label className={labelCls}>Loading Docks</label><input className={inputCls} value={form.loading_docks} onChange={e => set('loading_docks', e.target.value)} /></div>
            <div><label className={labelCls}>Drive-In Doors</label><input className={inputCls} value={form.drive_ins} onChange={e => set('drive_ins', e.target.value)} /></div>
            <div><label className={labelCls}>Power</label><input className={inputCls} value={form.power} onChange={e => set('power', e.target.value)} /></div>
            <div><label className={labelCls}>Heat</label><input className={inputCls} value={form.heat} onChange={e => set('heat', e.target.value)} /></div>
            <div><label className={labelCls}>Parking</label><input className={inputCls} value={form.parking} onChange={e => set('parking', e.target.value)} /></div>
            <div><label className={labelCls}>Sprinkler</label>
              <select className={inputCls} value={form.sprinkler} onChange={e => set('sprinkler', e.target.value)}>
                <option value="">Unknown</option><option value="Yes">Yes</option><option value="No">No</option><option value="Partial">Partial</option>
              </select>
            </div>
            <div><label className={labelCls}>Sewer</label>
              <select className={inputCls} value={form.sewer} onChange={e => set('sewer', e.target.value)}>
                <option value="">Unknown</option><option value="City">City Sewer</option><option value="Septic">Septic</option>
              </select>
            </div>
            <div><label className={labelCls}>Zoning</label><input className={inputCls} value={form.zoning} onChange={e => set('zoning', e.target.value)} /></div>
            <div><label className={labelCls}>Real Estate Taxes ($/yr)</label><input type="number" className={inputCls} value={form.real_estate_taxes} onChange={e => set('real_estate_taxes', e.target.value)} /></div>
            <div><label className={labelCls}>Asking Price ($)</label><input type="number" className={inputCls} value={form.asking_price} onChange={e => set('asking_price', e.target.value)} /></div>
            <div><label className={labelCls}>Price Per SF ($/SF)</label><input type="number" className={inputCls} step="0.01" value={form.price_per_sf} onChange={e => set('price_per_sf', e.target.value)} /></div>
            <div><label className={labelCls}>Pricing Guidance</label><input className={inputCls} placeholder="Call for pricing, etc." value={form.pricing_guidance} onChange={e => set('pricing_guidance', e.target.value)} /></div>
            <div><label className={labelCls}>Availability Type</label>
              <select className={inputCls} value={form.availability_type} onChange={e => set('availability_type', e.target.value)}>
                <option value="For Sale">For Sale</option><option value="For Lease">For Lease</option><option value="For Sale or Lease">For Sale or Lease</option>
              </select>
            </div>
            <div><label className={labelCls}>Listing Broker</label><input className={inputCls} value={form.listing_broker} onChange={e => set('listing_broker', e.target.value)} /></div>
            <div className="md:col-span-2"><label className={labelCls}>LoopNet URL</label><input className={inputCls} placeholder="https://www.loopnet.com/..." value={form.loopnet_url} onChange={e => set('loopnet_url', e.target.value)} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Notes</label><textarea className={inputCls + ' h-24 resize-none'} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div className="flex gap-3 mt-8">
            <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
            <a href="/availabilities" className="px-6 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</a>
          </div>
        </div>
      </div>
    </div>
  )
}
