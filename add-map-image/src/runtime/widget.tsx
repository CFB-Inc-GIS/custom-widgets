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

  type OperationalLayerType =
  | 'MAP_SERVICE'

  type SupportedLayer =
  | __esri.MapImageLayer
  | __esri.GroupLayer
  | __esri.Sublayer


  type NestedSubLayerNode = {
    layer: SupportedLayer | null;
    label: string;
    itemId: Number;
    checked: boolean;
    expanded?: boolean;
  }

  type SubLayerNode = {
    layer: SupportedLayer | null;
    label: string;
    itemId: Number;
    checked: boolean;
    expanded?: boolean;
    nestedSubLayers?: NestedSubLayerNode[];
  };

  type LayerNode = {
    layer: SupportedLayer | null;
    label: string;
    itemId: string;
    checked: boolean;
    expanded?: boolean;
    subLayers?: SubLayerNode[];

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


  const createLayerFromItemId = (itemId: string, type: OperationalLayerType): SupportedLayer => {
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

    const dataSource = props.useDataSources?.[0];

    if (!dataSource) return;

    const manager = DataSourceManager.getInstance();
  

    const run = async (dataSourceId: string) => {

      setNodes([])
      const dsSource = manager.createDataSource(dataSourceId);

      (await dsSource).ready();
      (await dsSource).fetchSchema();
      const ds = manager.getDataSource(dataSourceId);
      const json = ds?.getDataSourceJson?.();
      const dsType = json?.type as OperationalLayerType;
      const itemId = json?.itemId;
      const label = json?.sourceLabel ?? 'No Label';
      const layer = createLayerFromItemId(itemId, dsType) as __esri.MapImageLayer;
      
      await layer.load();
      
      const sourceLayers = layer.sourceJSON?.layers ?? [];
      const layerLookup = new Map<number, any>();

      sourceLayers.forEach((layer: any) => {
        layerLookup.set(Number(layer.id), layer);
      });

      const firstLevelLayers = sourceLayers.filter(
        (layer: any) => Number(layer.parentLayerId) === -1
      );
 
      const subLayers: SubLayerNode[] = firstLevelLayers.map((sublayer: any) => {

      const id = Number(sublayer.id);

              const nestedSubLayers = sublayer.subLayerIds?.map((nestedId: number) => {
                const nestedSublayer = layerLookup.get(nestedId);

                return {
                  layer: nestedSublayer.type === 'Group Layer' ? layer.findSublayerById(nestedId) : layer.findSublayerById(nestedId) as __esri.Sublayer,
                  label: nestedSublayer.name,
                  itemId: String(nestedId),
                  checked: Boolean(nestedSublayer.defaultVisibility),
                  expanded: false
                };
              }) ?? [];

      return {
        layer: sublayer.type === 'Group Layer' ? layer.findSublayerById(id) : layer.findSublayerById(id) as __esri.Sublayer,
        label: sublayer.name,
        itemId: String(id),
        checked: Boolean(sublayer.defaultVisibility),
        expanded: false,
        nestedSubLayers
      };

    });

      const layerNode = {
        layer,
        label,
        itemId,
        checked: false,
        expanded: false,
        subLayers
      }

      setNodes([layerNode]);
  } 
    run(dataSource.dataSourceId)
      
  }, [props.useDataSources]);



// =========================
// NESTED SUBLAYER TOGGLE
// =========================

  const toggleNestedSubLayer = (
  currentNodes: LayerNode[],
  parentIndex: number,
  childIndex: number,
  nestedIndex: number
) => {
  if (!jimuMapView) return;
  const parent = currentNodes[parentIndex];
  const child = parent?.subLayers?.[childIndex];
  const nested = child?.nestedSubLayers?.[nestedIndex];
  
  const parentVisible = parent.checked;
  const childVisible = child.checked; 
  const shouldBeVisible = parentVisible && childVisible && nested.checked;

  const nestedLayer = nested?.layer;
 
  if (shouldBeVisible) {
    nestedLayer.visible = true;
    return;
  } else if (!shouldBeVisible) {
    nestedLayer.visible = false;
    return;
  }
};
// =========================
// SUBLAYER TOGGLE
// =========================

  const toggleSubLayer = (
  currentNodes: LayerNode[],
  parentIndex: number,
  childIndex: number
) => {
  if (!jimuMapView) return;
  const parent = currentNodes[parentIndex];
  const child = parent?.subLayers?.[childIndex];
  const parentVisible = parent.checked; 
  const shouldBeVisible = parentVisible && child.checked;
  
  if (child.layer.type === "group" && shouldBeVisible) {
    
    child.layer.visible = shouldBeVisible;
    
    const nestedSubLayers = [...child.nestedSubLayers];
    nestedSubLayers.forEach(nested => {
      const nestedVisible = shouldBeVisible && nested.checked;
      const nestedLayer = nested.layer as __esri.Sublayer;
      if (nestedVisible) {
        nestedLayer.visible = true;
      } else {
        nestedLayer.visible = false;
      }
      return;
  })
  return;
 };
  if (shouldBeVisible && child.layer.type == "sublayer") {
     child.layer.visible = true;
     return;
  } else if (!shouldBeVisible && child.layer.type == "sublayer") {
    child.layer.visible = false;
    return;
  }
  
};

// =========================
// LAYER NODE TOGGLE
// =========================

const toggleLayerNode = (currentNodes: LayerNode[], parentIndex: number) => {
  if (!jimuMapView) return;
  
  const parent = currentNodes[parentIndex];

  if (!parent.layer) return;

  if (!parent.checked) {
    jimuMapView.view.map.remove(parent.layer);
  }

  if (parent.checked) {
    jimuMapView.view.map.add(parent.layer);
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
  ],
        itemChildren: (sub.nestedSubLayers ?? []).map((nested, nestedIndex) => ({
          itemKey: `nested-${parentIndex}-${childIndex}-${nestedIndex}`,
          itemStateTitle: nested.label,
          itemStateChecked: nested.checked?? false,
          itemStateExpanded: nested.expanded ?? false,
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
                const nestedChild = child?.nestedSubLayers?.[nestedIndex];
                setTargetLayer(nestedChild)
                handleEllipsisClick()
              }
            }
          ]
        }))
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
  let interactionType: 'parent' | 'child' | 'nested' | null = null;
  let parentIndex: number | null = null;
  let childIndex: number | null = null;
  let nestedIndex: number | null = null;

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

    if (parts[0] === 'nested') {
      interactionType = 'nested';
      parentIndex = Number(parts[1]);
      childIndex = Number(parts[2]);
      nestedIndex = Number(parts[3]);
    }
  }

  const currentTreeStateRaw = actionData.itemJsons[actionData.itemJsons.length - 1];

  // FIRST LEVEL: PARENT NODES
  const updatedLayerNodes = currentTreeStateRaw.itemChildren.map((parent: any, pIndex: number) => {
    const layerNode = nodes[pIndex];
    
        // SECOND LEVEL: CHILD NODES
        const updatedSubLayers = parent.itemChildren.map((child: any, cIndex: number) => {
          const subLayer = layerNode.subLayers[cIndex];

                // THIRD LEVEL: NESTED NODES
                const updatedNestedSubLayers = child.itemChildren.map((nested: any, nIndex: number) => {
                  const nestedSubLayer = subLayer.nestedSubLayers[nIndex];
                  return {
                    ...nestedSubLayer,
                    checked: nested.itemStateChecked,
                    expanded: nested.itemStateExpanded
                  };
                });
                
          return {
            ...subLayer, // 👈 ALWAYS preserve prior state
            checked: child.itemStateChecked,
            expanded: child.itemStateExpanded,
            nestedSubLayers: updatedNestedSubLayers
          };
        });

    return {
      ...layerNode, // 👈 preserve full history
      checked: parent.itemStateChecked,
      expanded: parent.itemStateExpanded,
      subLayers: updatedSubLayers
    };
  });
 
  setNodes(updatedLayerNodes); 
  console.log('Updated Layer Nodes:', updatedLayerNodes);
  if (interactionType == 'nested') {
  toggleNestedSubLayer(updatedLayerNodes, parentIndex, childIndex, nestedIndex)
  }
  else if (interactionType == 'child') {
  toggleSubLayer(updatedLayerNodes,parentIndex, childIndex) 
  }
  else if (interactionType == 'parent') {
  toggleLayerNode(updatedLayerNodes, parentIndex)
  }
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