import { React, type AllWidgetProps, getAppStore } from 'jimu-core'
import { MyActionKeys } from '../extensions/my-store';

export default function Widget(props: AllWidgetProps<any>) {

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // TODO: validate origin in production
      const { type, payload } = event.data

      const sourceWindow = event.source as Window | null
      if (!sourceWindow) return

      // 🔹 CHILD → PARENT: Extent Inquiry
      if (type === "EXTENT_INQUIRY") {
  
        const firstStore = getAppStore();
        const storedExtentJson = firstStore.getState();
        const storedExtent = storedExtentJson.myState?.savedExtent;

        sourceWindow.postMessage(
          {
            type: "EXTENT_RESPONSE",
            payload: storedExtent
          },
          event.origin
        )
      }

      // 🔹 CHILD → PARENT: Extent Update
      if (type === "EXTENT_UPDATE") {
        props.dispatch({
          type: MyActionKeys.SetExtent,
          val: payload
        });
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [])

  return (
    <div style={{ padding: 5 }}>
      <p></p>
    </div>
  )
}