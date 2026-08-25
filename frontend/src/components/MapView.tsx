import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

interface MapViewProps {
  lat: number
  lng: number
  address?: string | null
  vendorName?: string
}

export default function MapView({
  lat,
  lng,
  address,
  vendorName,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  const googleMapsUrl =
    `https://www.google.com/maps?q=${lat},${lng}`

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 15,
      scrollZoom: false,
    })

    map.addControl(
      new mapboxgl.NavigationControl(),
      'top-right'
    )

    map.on('load', () => {
      const popupContent = `
        <div style="font-size: 14px;">
          <div style="font-weight: 600;">
            ${vendorName ?? 'Venue'}
          </div>

          ${
            address
              ? `
                <div style="
                  font-size: 12px;
                  color: #4b5563;
                  margin-top: 4px;
                  max-width: 180px;
                ">
                  ${address}
                </div>
              `
              : ''
          }
        </div>
      `

      markerRef.current = new mapboxgl.Marker({
        color: '#e11d48',
      })
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({
            offset: 25,
          }).setHTML(popupContent)
        )
        .addTo(map)

      map.resize()
    })

    mapRef.current = map

    return () => {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }

      map.remove()
      mapRef.current = null
    }
  }, [lat, lng, address, vendorName])

  return (
    <div className="space-y-3">

      {/* Map */}
      <div
        className="rounded-xl overflow-hidden border-2 border-rose-100 shadow-md"
        style={{ height: '320px' }}
      >
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* Address */}
      {address && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3 text-sm text-gray-700">
          <span className="text-rose-500 mt-0.5 flex-shrink-0">
            📍
          </span>

          <span className="leading-snug">
            {address}
          </span>
        </div>
      )}

      {/* Direction button */}
      <div className="flex gap-3">

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-gray-700 hover:text-primary-700 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
          </svg>

          Open in Google Maps
        </a>

      </div>

    </div>
  )
}