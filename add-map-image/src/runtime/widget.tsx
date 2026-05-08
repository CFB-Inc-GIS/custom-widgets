import { React, AllWidgetProps, DataSourceManager } from 'jimu-core';
import MapImageLayer from "@arcgis/core/layers/MapImageLayer.js"
import { JimuMapViewComponent } from 'jimu-arcgis';
import { Tree, TreeAlignmentType, TreeCollapseStyle, TreeStyle } from 'jimu-ui/basic/list-tree'
import '../extensions/widget.css';
import { createPortal } from "react-dom";
import { Button } from 'jimu-ui';
import { FloatingPanel } from 'jimu-ui'
import { Slider } from 'jimu-ui'


export default function Widget(this: any, props: AllWidgetProps<any>) {

  // =========================
  // SPECIAL OPTIONS MENU SETTINGS
  // =========================

  const [options, setOptions] = React.useState(false);
  const [optionsTop, setOptionsTop] = React.useState(0);
  const [optionsLeft, setOptionsLeft] = React.useState(0);
  const optionsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [transparencyPanel, setTransparencyPanel] = React.useState(false);
  const [targetLayer, setTargetLayer] = React.useState<SubLayerNode | null>(null);

  const [, forceRender] = React.useState(0);

  const handleEllipsisClick = () => {
    forceRender(v => v + 1);
  };

  React.useEffect(() => {
  const handleOutsideClick = (event: MouseEvent) => {
    if (
      optionsMenuRef.current &&
      !optionsMenuRef.current.contains(event.target as Node)
    ) {
      setOptions(false);
    }
  };

  document.addEventListener('mousedown', handleOutsideClick);

  return () => {
    document.removeEventListener('mousedown', handleOutsideClick);
  };
}, []);


  // =========================
  // TYPES
  // =========================

  type SupportedLayerType =
  | 'MAP_SERVICE'

  type SupportedLayer =
  | __esri.MapImageLayer
  | __esri.Sublayer


  type SubLayerNode = {
    layer: SupportedLayer | null;
    label: string;
    itemId: Number;
    checked: boolean;
    expanded?: boolean;
  };  


  type LayerNode = {
    layer: SupportedLayer | null;
    label: string;
    itemId: string;
    checked: boolean;
    expanded?: boolean;
    subLayers: SubLayerNode[];

  };



  // =========================
  // STATE
  // =========================


  const [nodes, setNodes] = React.useState<LayerNode[]>([]);
  const [jimuMapView, setJimuMapView] = React.useState(null);

  const activeMapWidgetId = props.useMapWidgetIds?.[0]
   // =========================
  // LAYER FACTORIES
  // =========================


  const createLayerFromItem = (itemId: string, type: SupportedLayerType): SupportedLayer => {
    switch (type) {
      case 'MAP_SERVICE':
        return new MapImageLayer({ portalItem: { id: itemId } });
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  };

  // =========================
  // DATA LOADING
  // =========================

  React.useEffect(() => {
    // These may be necessary to reset to zero so that there are no duplicate if props.useDataSources changes

    const useDs = props.useDataSources;

    if (!useDs || useDs.length === 0) return;

    const manager = DataSourceManager.getInstance();
  

    const run = async (dataSourceId: string) => {
      setNodes([])
      const dsSource = manager.createDataSource(dataSourceId);

      (await dsSource).ready();
      (await dsSource).fetchSchema();
      const ds = manager.getDataSource(dataSourceId);
      const json = ds?.getDataSourceJson?.();
      const dsType = json?.type as SupportedLayerType;
      const label = json?.sourceLabel ?? 'No Label';
      const itemId = json?.itemId;
      const thisUrl = json?.url
      const layer = createLayerFromItem(itemId, dsType);
    
      if (layer instanceof MapImageLayer) {
            await layer.load();
            let count = 1;
            const subLayers = layer.sourceJSON?.layers.map((sublayer: any) => {
              const suffixId = Number(sublayer.id)
              const subLayerUrl = `${thisUrl}/${suffixId}`;
              const checkedValue = count === 1;
              count = count + 1;
              return {
                layer: layer.findSublayerById(suffixId),
                label: sublayer.name,
                itemId: suffixId,
                checked: checkedValue
              };
          });

      setNodes(prev => [
        ...prev,
        {
          layer,
          label,
          itemId,
          checked: false,
          subLayers
        }
      ]);
    };
  }
    useDs.forEach((dataSource) => {
        run(dataSource.dataSourceId)
      });

  }, [props.useDataSources]);


// =========================
// SUBLAYER TOGGLE
// =========================

  const toggleSubLayer = (
  parentIndex: number,
  childIndex: number,
  isChecked: boolean
) => {
  if (!jimuMapView) return;
  const parent = nodes[parentIndex];
  const child = parent?.subLayers?.[childIndex];
  
  const layer = child.layer
  layer.visible = isChecked;
};

// =========================
// GROUP NODE TOGGLE
// =========================

const toggleGroupNode = (parentIndex: number, isChecked:boolean) => {
  if (!jimuMapView) return;
  
  const mapImage = nodes[parentIndex].layer;

  if (!mapImage) return;

  if (!isChecked) {
    jimuMapView.view.map.remove(mapImage);
  }

  if (isChecked) {
    jimuMapView.view.map.add(mapImage);
  }
}

// =========================
// DEFINES THE TREE CONTENT AND ACTION ON THE OPTIONS MENU
// =========================

const rootItemJson = React.useMemo(() => {
  return {
    itemKey: 'root',
    itemStateTitle: 'root',
    itemChildren: nodes.map((node, parentIndex) => ({
      itemKey: `parent-${parentIndex}`,
      itemStateTitle: node.label,
      itemStateChecked: node.checked ?? false,
      itemStateExpanded: node.expanded ?? false,
      isItemSelectable: true,

      // 👇 ensure this is ALWAYS a valid array
      itemChildren: (node.subLayers ?? []).map((sub, childIndex) => ({
        itemKey: `child-${parentIndex}-${childIndex}`,
        itemStateTitle: sub.label,
        itemStateChecked: sub.checked ?? false,
        itemStateExpanded: sub.expanded ?? false,
        isItemSelectable: true,
        itemStateCommands: [
      {
        name: 'ellipsis',
        label: "Options",
        visible: true,
        state: ['default'],
        action: () => {
          const el = document.activeElement as HTMLElement;
          const rect = el.getBoundingClientRect();
          setOptions(true)
          setOptionsTop(rect.bottom)
          setOptionsLeft(rect.left)
          const parent = nodes[parentIndex];
          const child = parent?.subLayers?.[childIndex];
        
          setTargetLayer(child)
          handleEllipsisClick()
      }}
  ]
      })),
    
    }))
  };
}, [nodes]);


// =========================
// HANDLES INTERACTION ON THE TREE
// =========================


const handleTreeUpdate = (actionData: any) => {
  // QUESTION ASYNCHRONOUS NATURE OF ACTION DATA CALLBACK
  // The Tree State consists of Parent Group Nodes and their sub layers

  // GUARD
  if (!actionData?.itemJsons?.length) return;
  
  // Create a tuple that contains whether it is first level group node, sub layer, the index of the layer, and the index of the parent if any
  // Default tuple values
  const currentItem = actionData?.currentItemJson;
  let interactionType: 'parent' | 'child' | null = null;
  let parentIndex: number | null = null;
  let childIndex: number | null = null;
  let isChecked: boolean | null = null;

  if (currentItem) {
    const key = currentItem.itemKey; // e.g. "parent-0" or "child-0-2"
    const parts = key.split('-');

    if (parts[0] === 'parent') {
      interactionType = 'parent';
      parentIndex = Number(parts[1]);
    }

    if (parts[0] === 'child') {
      interactionType = 'child';
      parentIndex = Number(parts[1]);
      childIndex = Number(parts[2]);
    }
  }

  console.log("Action Data", actionData)
  

  const currentTreeStateRaw = actionData.itemJsons[actionData.itemJsons.length - 1];

  const updatedGroupNodes = currentTreeStateRaw.itemChildren.map((parent: any, pIndex: number) => {
    const groupNode = nodes[pIndex];

    if (interactionType == 'parent' && parentIndex == pIndex) {
        isChecked = parent.itemStateChecked;
      }

    const currentStateSubLayers = parent.itemChildren.map((child: any, cIndex: number) => {
      const subLayer = groupNode.subLayers[cIndex];
      if (interactionType == 'child' && childIndex == cIndex) {
        isChecked = child.itemStateChecked;
      }

      return {
        ...subLayer, // 👈 ALWAYS preserve prior state
        checked: child.itemStateChecked,
        expanded: child.itemStateExpanded
      };
    });

    return {
      ...groupNode, // 👈 preserve full history
      checked: parent.itemStateChecked,
      expanded: parent.itemStateExpanded,
      subLayers: currentStateSubLayers
    };
  });
  setNodes(updatedGroupNodes); 

  if (interactionType == 'child')
  { toggleSubLayer(parentIndex, childIndex, isChecked) } 
  else if (interactionType == 'parent') 
  { toggleGroupNode(parentIndex, isChecked)}
};

// =========================
// RENDER
// =========================

 return (
  <div>
  <div style={{ width: '100%', height: '100%', padding: '2px', boxSizing: 'border-box' }}>
    <JimuMapViewComponent
      useMapWidgetId={activeMapWidgetId}
      onActiveViewChange={(view) => {
        setJimuMapView(view);
      }}
    />
    {transparencyPanel && (
      <FloatingPanel
      open={transparencyPanel}
      onHeaderClose={() => setTransparencyPanel(false)}
      headerTitle="Transparency"
      showHeaderClose
      defaultPosition={{
        x: optionsLeft,
        y: optionsTop
      }}
      size={{
        height: 200,
        width: 300
      }}
      dragBounds="body"
      autoFocus
      trapFocus
      >
      <div>
      <div style={{ padding: 10, fontSize: 13 }}>
       {targetLayer ? targetLayer.label : ''}
      </div>
      <br></br>
      <div style={{ padding: 15 }}>
      <Slider
        aria-label="Slider"
        defaultValue={0}
        max={100}
        min={0}
        onChange={(event) => {
          const value = Number((event.target as HTMLInputElement).value);
          if (!targetLayer?.layer) return;
          const opacity = value / 100;
          targetLayer.layer.opacity = opacity;
        }}
        size="default"
        step={1}
      /> 
      </div>
      <div style={{ padding: 15, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span>0%</span>
      <span>50%</span>
      <span>100%</span>
      </div>
      </div>
  </FloatingPanel>
      
    )}
      <Tree 
        size="default"
        collapseStyle={TreeCollapseStyle.Arrow}
        dndEnabled={false}
        treeAlignmentType={TreeAlignmentType.Intact}
        treeStyle={TreeStyle.Basic}
        checkboxLinkage={false}
        isMultiSelection={true}
        rootItemJson={rootItemJson}
        onUpdateItem={handleTreeUpdate}
      />

      {options && optionsLeft && optionsTop && createPortal(
      <div ref={optionsMenuRef} className='optionsMenu'
        style={{
          position: 'fixed',
          top: optionsTop,
          left: optionsLeft,
          width: 190,
          background: 'white',
          zIndex: 9999999
        }}
      >
      <Button
        className="transparency-button"
        type="tertiary"
        onClick={() => {
        setTransparencyPanel(true);
        setOptions(false);
      }}
      >
        <div className="transparency-icon" />

        <div className="transparency-label">
          Transparency
        </div>
      </Button>
      </div>,
      document.body
    )}
  </div>
  </div>
)
};