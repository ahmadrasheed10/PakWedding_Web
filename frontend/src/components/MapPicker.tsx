import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const PAKISTAN_BOUNDS = L.latLngBounds(
  L.latLng(23.5, 60.5),  // SW corner
  L.latLng(37.5, 77.5)   // NE corner
)

interface LatLng {
  lat: number
  lng: number
}

interface MapPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  initialAddress?: string | null
  onLocationChange: (lat: number, lng: number, address: string) => void
}

function ClickHandler({
  onMapClick,
  onOutOfBounds,
}: {
  onMapClick: (latlng: LatLng) => void
  onOutOfBounds: () => void
}) {
  useMapEvents({
    click(e) {
      if (PAKISTAN_BOUNDS.contains(e.latlng)) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
      } else {
        onOutOfBounds()
      }
    },
  })
  return null
}

function MapFlyTo({ position }: { position: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([position.lat, position.lng], 14, { duration: 1 })
  }, [position, map])
  return null
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

async function searchAddress(query: string): Promise<{ lat: number; lng: number; display_name: string }[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=pk`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    return data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      display_name: item.display_name,
    }))
  } catch {
    return []
  }
}

export default function MapPicker({
  initialLat,
  initialLng,
  initialAddress,
  onLocationChange,
}: MapPickerProps) {
  const defaultCenter: LatLng = { lat: 30.3753, lng: 69.3451 } 

  const [position, setPosition] = useState<LatLng | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  )
  const [address, setAddress] = useState<string>(initialAddress ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<{ lat: number; lng: number; display_name: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [reverseLoading, setReverseLoading] = useState(false)
  const [flyTo, setFlyTo] = useState<LatLng | null>(null)
  const [outOfBoundsWarning, setOutOfBoundsWarning] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyPosition = async (latlng: LatLng) => {
    setOutOfBoundsWarning(false)
    setPosition(latlng)
    setFlyTo(latlng)
    setReverseLoading(true)
    const resolved = await reverseGeocode(latlng.lat, latlng.lng)
    setAddress(resolved)
    setReverseLoading(false)
    onLocationChange(latlng.lat, latlng.lng, resolved)
  }

  const handleOutOfBounds = () => {
    setOutOfBoundsWarning(true)
    setTimeout(() => setOutOfBoundsWarning(false), 3000)
  }

  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    setSuggestions([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 3) return
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const results = await searchAddress(value)
      setSuggestions(results)
      setSearching(false)
    }, 500)
  }

  const handleSuggestionClick = (s: { lat: number; lng: number; display_name: string }) => {
    setSuggestions([])
    setSearchQuery('')
    const latlng = { lat: s.lat, lng: s.lng }
    setPosition(latlng)
    setFlyTo(latlng)
    setAddress(s.display_name)
    onLocationChange(s.lat, s.lng, s.display_name)
  }

  const handleClear = () => {
    setPosition(null)
    setAddress('')
    setSearchQuery('')
    setSuggestions([])
    setOutOfBoundsWarning(false)
    onLocationChange(0, 0, '')
  }

  const mapCenter = position ?? defaultCenter

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search city or address in Pakistan..."
              className="w-full px-4 py-2.5 pr-10 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          {position && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-sm text-red-600 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && (
          <ul className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-700 transition-colors border-b border-gray-100 last:border-0"
                >
                  <span className="mr-2 text-pink-500">📍</span>
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* No results hint */}
        {!searching && searchQuery.trim().length >= 3 && suggestions.length === 0 && (
          <p className="mt-1 text-xs text-gray-400 pl-1">No Pakistani locations found for "{searchQuery}"</p>
        )}
      </div>

      {/* Out-of-bounds warning */}
      {outOfBoundsWarning && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg px-4 py-2.5 text-sm">
          <span>⚠️</span>
          <span>Please select a location within Pakistan.</span>
        </div>
      )}

      {/* Map — locked to Pakistan bounds */}
      <div className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-md" style={{ height: '350px' }}>
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={position ? 14 : 5}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          maxBounds={PAKISTAN_BOUNDS}
          maxBoundsViscosity={1.0}
          minZoom={5}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onMapClick={applyPosition} onOutOfBounds={handleOutOfBounds} />
          {flyTo && <MapFlyTo position={flyTo} />}
          {position && <Marker position={[position.lat, position.lng]} />}
        </MapContainer>
      </div>

      {}
      {position ? (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-green-600 mt-0.5">✅</span>
            <div>
              <p className="font-semibold text-green-800 mb-0.5">Location set</p>
              {reverseLoading ? (
                <p className="text-green-600 italic">Resolving address…</p>
              ) : (
                <p className="text-green-700 leading-snug">{address}</p>
              )}
              <p className="text-green-600 text-xs mt-1">
                {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-1">
          🇵🇰 Click anywhere on the map or search above to set your venue location
        </p>
      )}
    </div>
  )
}
