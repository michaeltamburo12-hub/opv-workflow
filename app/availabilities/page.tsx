'use client'
import { useState, useCallback } from 'react'

type Avail = {
  id: string
  address: string
  city: string
  county: string
  building_sf: number
  lot_size_ac: number
  ceiling_height: string
  loading_docks: string
  drive_ins: string
  power: string
  sewer: string
  zoning: string
  asking_price: number
  price_per_sf: number
  pricing_guidance: string
  availability_type: string
  status: string
  listing_broker: string
  submarket: string
  loopnet_url: string
}

const fmt = (n: number | null) => n ? `$${n.toLocaleString()}` : '—'
const fmtSF = (n: number | null) => n ? `${n.toLocaleString()} SF` : '—'

export default function AvailabilitiesPage() {
  const [results, setResults] = useState<Avail[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    county: '', city: '', address: '', zoning: '',
    min_sf: '', max_sf: '', min_price: '', max_price: '', status: 'Available'
  })

  const search = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    const res = await fetch(`/api/availabilities?${params}`)
    const data = await res.json()
    setResults(Array.isArray(data) ? data : [])
    setSearched(true)
    setLoading(false)
  }, [filters])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const set = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <a href="/" className="text-gray-400 hover:text-gray-600">← Home</a>
        <h1 className="text-xl font-bold text-gray-900">Market Availabilities</h1>
        <span className="text-sm text-gray-400">Properties For Sale</span>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Search Filters</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">County</label>
              <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.county} onChange={e => set('county', e.target.value)}>
                <option value="">All Counties</option>
                <option value="Nassau">Nassau</option>
                <option value="Suffolk">Suffolk</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">City</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Hauppauge" value={filters.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Address</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Street name or number" value={filters.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Zoning</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. I, M1" value={filters.zoning} onChange={e => set('zoning', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Min Building SF</label>
              <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0" value={filters.min_sf} onChange={e => set('min_sf', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Max Building SF</label>
              <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="No limit" value={filters.max_sf} onChange={e => set('max_sf', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Min Asking Price</label>
              <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0" value={filters.min_price} onChange={e => set('min_price', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Max Asking Price</label>
              <input type="number" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="No limit" value={filters.max_price} onChange={e => set('max_price', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={search} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Searching...' : 'Search Availabilities'}
            </button>
            <button onClick={() => { setFilters({ county:'',city:'',address:'',zoning:'',min_sf:'',max_sf:'',min_price:'',max_price:'',status:'Available' }); setResults([]); setSearched(false) }} className="text-gray-500 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm">
              Clear
            </button>
            <a href="/availabilities/new" className="ml-auto border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
              + Add Listing
            </a>
            {selected.size > 0 && (
              <a href={`/opv/new?avails=${[...selected].join(',')}`} className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
                Use {selected.size} Selected in OPV →
              </a>
            )}
          </div>
        </div>

        {searched && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">{results.length} results</span>
              {results.length > 0 && (
                <button onClick={() => setSelected(new Set(results.map(r => r.id)))} className="text-sm text-blue-600 hover:underline">Select all</button>
              )}
            </div>
            {results.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No availabilities found. Try broadening your filters or add new listings.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="w-8 px-4 py-3"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Bldg SF</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Asking Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">$/SF</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ceiling</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Docks</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Drive-In</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sewer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Zoning</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">County</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">LoopNet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map(r => (
                      <tr key={r.id} className={`hover:bg-gray-50 ${selected.has(r.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-gray-300" />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{r.address || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.city || '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtSF(r.building_sf)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(r.asking_price)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.price_per_sf ? `$${Number(r.price_per_sf).toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.ceiling_height || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.loading_docks || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.drive_ins || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.sewer || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.zoning || '—'}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.county === 'Nassau' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{r.county}</span></td>
                        <td className="px-4 py-3">{r.loopnet_url ? <a href={r.loopnet_url} target="_blank" className="text-blue-500 hover:underline text-xs">View</a> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
