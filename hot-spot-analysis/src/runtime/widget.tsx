
import { React, type AllWidgetProps } from 'jimu-core'
import { JimuMapViewComponent } from 'jimu-arcgis'

export default function Widget(props: AllWidgetProps<any>) {
  const [amenityId, setAmenityId] = React.useState('')
  const [status, setStatus] = React.useState('Ready')
  const [loading, setLoading] = React.useState(false)

  const activeMapWidgetId = props.useMapWidgetIds?.[0]

  const handleSubmit = async () => {
    const amenity = amenityId.trim()

    if (!amenity) {
      setStatus('Please enter an amenity ID.')
      return
    }

    setLoading(true)
    setStatus('Sending request...')

    try {
      const response = await fetch(
        `http://192.168.1.121:5000/rec_scan/hotspot/${encodeURIComponent(amenity)}/`
      )

      console.log('HTTP status:', response.status)

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const data = await response.json()

      console.log('Response data:', data)
      setStatus(data.message || 'Request completed.')
    } catch (error) {
      console.error('Flask request failed:', error)

      setStatus(
        error instanceof Error
          ? error.message
          : 'Unknown request error'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 10 }}>
      <JimuMapViewComponent
        useMapWidgetId={activeMapWidgetId}
        onActiveViewChange={() => {}}
      />

      <input
        type="text"
        value={amenityId}
        onChange={(event) => setAmenityId(event.target.value)}
        placeholder="Enter amenity ID"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: 8
        }}
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Sending...' : 'Submit'}
      </button>

      <div style={{ marginTop: 8 }}>
        {status}
      </div>
    </div>
  )
}
