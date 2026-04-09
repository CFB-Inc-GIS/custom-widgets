import { React, type AllWidgetProps } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import type MapView from '@arcgis/core/views/MapView'
import Extent from '@arcgis/core/geometry/Extent'

export default function Widget(props: AllWidgetProps<any>) {

  const initializedRef = React.useRef(false)
  const viewRef = React.useRef<MapView | null>(null)

  // 🔹 Listen for parent response
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "EXTENT_RESPONSE") {

        if (!event.data.payload) {
          return
        }

        const view = viewRef.current
        if (!view) return

        const extent = Extent.fromJSON(event.data.payload)

        view.when().then(() => {
          view.goTo(extent)
        })
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  const handleActiveViewChange = (jimuMapView: JimuMapView) => {
    if (!jimuMapView || initializedRef.current) return
    initializedRef.current = true

    const view = jimuMapView.view as MapView
    viewRef.current = view

    // 🔹 Step 1: Ask parent for extent
    window.parent.postMessage(
      {
        type: "EXTENT_INQUIRY",
        payload: "Extent Inquiry"
      },
      "*"
    )

    // 🔹 Step 2: Watch for extent changes and send back
    view.watch('stationary', (isStationary) => {
      if (!isStationary) return

      const extentJSON = view.extent.toJSON()

      window.parent.postMessage(
        {
          type: "EXTENT_UPDATE",
          payload: extentJSON
        },
        "*"
      )
    })
  }

  const activeMapWidgetId = props.useMapWidgetIds?.[0]

  return (
    <div style={{ padding: 10 }}>
      <JimuMapViewComponent
        useMapWidgetId={activeMapWidgetId}
        onActiveViewChange={handleActiveViewChange}
      />
    </div>
  )
}