import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
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

interface MapViewProps {
  lat: number
  lng: number
  address?: string | null
  vendorName?: string
}

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  }, [map])
  return null
}

export default function MapView({ lat, lng, address, vendorName }: MapViewProps) {
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`

  return (
    <div className="space-y-3">
      {}
      <div
        className="rounded-xl overflow-hidden border-2 border-rose-100 shadow-md"
        style={{ height: '320px' }}
      >
        <MapContainer
          center={[lat, lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
          dragging={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapResizer />
          <Marker position={[lat, lng]}>
            <Popup>
              <div className="text-sm font-semibold">{vendorName ?? 'Venue'}</div>
              {address && <div className="text-xs text-gray-600 mt-1 max-w-[180px]">{address}</div>}
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Address label */}
      {address && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3 text-sm text-gray-700">
          <span className="text-rose-500 mt-0.5 flex-shrink-0">📍</span>
          <span className="leading-snug">{address}</span>
        </div>
      )}

      {/* Direction buttons */}
      <div className="flex gap-3">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-gray-700 hover:text-primary-700 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
          </svg>
          Open in Google Maps
        </a>
        
      </div>
    </div>
  )
}
