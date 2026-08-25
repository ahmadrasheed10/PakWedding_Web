import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

const PAKISTAN_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [60.5, 23.5],
  [77.5, 37.5],
]

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

interface Suggestion {
  mapboxId: string
  name: string
  placeFormatted: string
}

interface SearchResult {
  lat: number
  lng: number
  display_name: string
}

function generateSessionToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function MapPicker({
  initialLat,
  initialLng,
  initialAddress,
  onLocationChange,
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const defaultCenter: LatLng = { lat: 30.3753, lng: 69.3451 }

  const [position, setPosition] = useState<LatLng | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null
  )

  const [address, setAddress] = useState(initialAddress ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [reverseLoading, setReverseLoading] = useState(false)
  const [outOfBoundsWarning, setOutOfBoundsWarning] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sessionTokenRef = useRef<string>(generateSessionToken())

  const isInsidePakistan = (lng: number, lat: number) => {
    return lng >= 60.5 && lng <= 77.5 && lat >= 23.5 && lat <= 37.5
  }

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
      const response = await fetch(
        `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${token}`
      )
      if (!response.ok) throw new Error('Mapbox reverse geocoding failed')
      const data = await response.json()
      return data.features?.[0]?.properties?.full_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    } catch (error) {
      console.error('Mapbox reverse geocoding error:', error)
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
  }

  const fetchSuggestions = async (query: string): Promise<Suggestion[]> => {
    try {
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
      if (!token) {
        console.error('Mapbox access token is missing')
        return []
      }

      const center = mapRef.current?.getCenter()
      const proximity = center ? `${center.lng},${center.lat}` : `${defaultCenter.lng},${defaultCenter.lat}`

      const url =
        `https://api.mapbox.com/search/searchbox/v1/suggest` +
        `?q=${encodeURIComponent(query)}` +
        `&country=PK` +
        `&language=en` +
        `&limit=8` +
        `&proximity=${proximity}` +
        `&types=poi,address,place,locality,neighborhood,street,district,region` +
        `&session_token=${sessionTokenRef.current}` +
        `&access_token=${encodeURIComponent(token)}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        console.error('Mapbox suggest failed:', response.status, data)
        return []
      }

      return (data.suggestions ?? []).map((s: any) => ({
        mapboxId: s.mapbox_id,
        name: s.name,
        placeFormatted: s.place_formatted ?? s.full_address ?? s.name,
      }))
    } catch (error) {
      console.error('Mapbox suggest error:', error)
      return []
    }
  }

  const retrieveSuggestion = async (mapboxId: string): Promise<SearchResult | null> => {
    try {
      const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
      const url =
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}` +
        `?session_token=${sessionTokenRef.current}` +
        `&access_token=${encodeURIComponent(token)}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        console.error('Mapbox retrieve failed:', response.status, data)
        return null
      }

      const feature = data.features?.[0]
      const coordinates = feature?.geometry?.coordinates
      if (!coordinates || coordinates.length < 2) return null

      const [lng, lat] = coordinates
      return {
        lat,
        lng,
        display_name:
          feature.properties?.full_address ?? feature.properties?.name ?? 'Selected location',
      }
    } catch (error) {
      console.error('Mapbox retrieve error:', error)
      return null
    }
  }

  const updateMarker = (lat: number, lng: number) => {
    if (!mapRef.current) return
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = new mapboxgl.Marker({ color: '#e11d48' }).setLngLat([lng, lat]).addTo(mapRef.current)
  }

  const applyPosition = async ({ lat, lng }: LatLng) => {
    if (!isInsidePakistan(lng, lat)) {
      setOutOfBoundsWarning(true)
      setTimeout(() => setOutOfBoundsWarning(false), 3000)
      return
    }

    setOutOfBoundsWarning(false)
    setPosition({ lat, lng })
    updateMarker(lat, lng)

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 })
    }

    setReverseLoading(true)
    const resolvedAddress = await reverseGeocode(lat, lng)
    setAddress(resolvedAddress)
    setReverseLoading(false)

    onLocationChange(lat, lng, resolvedAddress)
  }

  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return

    const center = position ?? defaultCenter

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [center.lng, center.lat],
      zoom: position ? 14 : 5,
      maxBounds: PAKISTAN_BOUNDS,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      mapRef.current = map
      if (position) updateMarker(position.lat, position.lng)
      map.resize()
    })

    map.on('click', async (event) => {
      await applyPosition({ lat: event.lngLat.lat, lng: event.lngLat.lng })
    })

    return () => {
      if (markerRef.current) markerRef.current.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    setSuggestions([])

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) return

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const results = await fetchSuggestions(value)
      setSuggestions(results)
      setSearching(false)
    }, 400)
  }

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    setSuggestions([])
    setSearchQuery('')

    const result = await retrieveSuggestion(suggestion.mapboxId)

    sessionTokenRef.current = generateSessionToken()

    if (!result) return
    await applyPosition({ lat: result.lat, lng: result.lng })
  }

  const handleClear = () => {
    setPosition(null)
    setAddress('')
    setSearchQuery('')
    setSuggestions([])
    setOutOfBoundsWarning(false)
    sessionTokenRef.current = generateSessionToken()

    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [defaultCenter.lng, defaultCenter.lat], zoom: 5 })
    }

    onLocationChange(0, 0, '')
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search city, address, or venue name in Pakistan..."
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

        {suggestions.length > 0 && (
          <ul className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
            {suggestions.map((s) => (
              <li key={s.mapboxId}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-pink-50 hover:text-pink-700 transition-colors border-b border-gray-100 last:border-0"
                >
                  <span className="mr-2 text-pink-500">📍</span>
                  <span className="font-medium">{s.name}</span>
                  {s.placeFormatted && (
                    <span className="block text-xs text-gray-400 ml-6">{s.placeFormatted}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!searching && searchQuery.trim().length >= 2 && suggestions.length === 0 && (
          <p className="mt-1 text-xs text-gray-400 pl-1">No Pakistani locations found for "{searchQuery}"</p>
        )}
      </div>

      {outOfBoundsWarning && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg px-4 py-2.5 text-sm">
          <span>⚠️</span>
          <span>Please select a location within Pakistan.</span>
        </div>
      )}

      <div className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-md" style={{ height: '350px' }}>
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      </div>

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