import { React, AllWidgetProps, DataSourceManager } from 'jimu-core';
import GroupLayer from "@arcgis/core/layers/GroupLayer.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import VectorTileLayer from "@arcgis/core/layers/VectorTileLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
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
  | 'GROUP_LAYER'
  | 'vector-tile'
  | 'tile'
  | 'feature';

  type SupportedLayer =
  | __esri.GroupLayer
  | __esri.VectorTileLayer
  | __esri.TileLayer
  | __esri.FeatureLayer;

  type NestedSubLayerNode = {
    layer: SupportedLayer | null;
    label: string;
    itemId: string | null;
    checked: boolean;
    expanded?: boolean;
  }

  type SubLayerNode = {
    layer: SupportedLayer | null;
    label: string;
    itemId: string | null;
    checked: boolean;
    expanded?: boolean;
    nestedSubLayers?: NestedSubLayerNode[];
  };  

  type LayerNode = {
    layer: SupportedLayer | null;
    label: string;
    itemId: string | null;
    checked: boolean;
    expanded?: boolean;
    subLayers?: SubLayerNode[];

  };

  type ParentGroup = {
    label: string;
    checked: true;
  }


  // =========================
  // STATE
  // =========================

  const [nodes, setNodes] = React.useState<LayerNode[]>([]);
  const [jimuMapView, setJimuMapView] = React.useState(null);
  const [parentGroup, setParentGroup] = React.useState<ParentGroup | null>(null);

  const activeMapWidgetId = props.useMapWidgetIds?.[0]
   // =========================
  // LAYER FACTORIES
  // =========================


  const createLayerFromItemId = (itemId: string, type: OperationalLayerType): SupportedLayer => {
    console.log(`Creating layer from itemId: ${itemId} with type: ${type}`);
    switch (type) {
      case 'GROUP_LAYER':
        return new GroupLayer({ portalItem: { id: itemId } });
      case 'vector-tile':
        return new VectorTileLayer({ portalItem: { id: itemId } });
      case 'tile':
        return new TileLayer({ portalItem: { id: itemId } });
      case 'feature':
        return new FeatureLayer({ portalItem: { id: itemId } });  
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
  
    const run = async () => {
      setNodes([])
      const dsSource = manager.createDataSource(dataSource.dataSourceId);
      (await dsSource).ready();
      (await dsSource).fetchSchema();
      const ds = manager.getDataSource(dataSource.dataSourceId);
      const json = ds?.getDataSourceJson?.();
      const dsType = json?.type as OperationalLayerType;
      const itemId = json?.itemId;
      const layer = createLayerFromItemId(itemId, dsType) as GroupLayer;
      setParentGroup({
        label: layer.title,
        checked: true
      });

      await layer.load();
      
      // =========================
      // LEVEL 1
      // =========================

      const layerNodes: LayerNode[] = layer.layers.toArray().map((child: any) => {
        const itemId = child.portalItem?.id || null;
        const resolvedLayer = itemId ? createLayerFromItemId(itemId, child.type as OperationalLayerType) : null;
          

        // =========================
        // LEVEL 2
        // =========================

        let subLayers: SubLayerNode[] | undefined = undefined;
        if (child.type === 'group') {

          const childGroup = child;

          childGroup.load?.();

          subLayers =
            childGroup.layers?.toArray?.().map((subchild: any) => {

              const subItemId = subchild.portalItem?.id || null;

              const subResolved =
                subItemId
                  ? createLayerFromItemId(
                      subItemId,
                      subchild.type as OperationalLayerType
                    )
                  : null;
                  // =========================
                  // LEVEL 3 (nestedSubLayers)
                  // =========================

                  let nestedSubLayers: SubLayerNode[] | undefined =
                    undefined;

                  if (subchild.type === 'group') {

                    const nestedGroup = subchild;

                    nestedGroup.load?.();

                    nestedSubLayers =
                      nestedGroup.layers?.toArray?.().map((nested: any) => {

                        const nestedItemId = nested.portalItem?.id || null;

                        const nestedResolvedLayer =
                          nestedItemId
                            ? createLayerFromItemId(
                                nestedItemId,
                                nested.type as OperationalLayerType
                              )
                            : null;

                        return {
                          layer: nestedResolvedLayer,
                          label: nested.title,
                          itemId: nestedItemId ?? '',
                          checked: Boolean(nested.visible),
                          expanded: false,
                        };
                      });
  
                  }

              return {
                layer: subResolved,
                label: subchild.title,
                itemId: subItemId ?? '',
                checked: Boolean(subchild.visible),
                expanded: false,
                nestedSubLayers: nestedSubLayers?.reverse()
              };
            });
        }

        return {
            layer: resolvedLayer,
            label: child.title,
            itemId: itemId ?? '',
            checked: Boolean(child.visible),
            expanded: false,
            subLayers: subLayers?.reverse()
          };
      });
      setNodes(layerNodes.reverse());
    
  };

  run();

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

 
  if (shouldBeVisible) {
    jimuMapView.view.map.add(nested.layer);
    return;
  } else if (!shouldBeVisible) {
    jimuMapView.view.map.remove(nested.layer);
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

  // =========================
  // OPERATIONAL LAYER TOGGLE IF LAYER IS TILE LAYER OR FEATURE LAYER
  // =========================
  if (shouldBeVisible && (child.layer instanceof VectorTileLayer || child.layer instanceof FeatureLayer)) {
     jimuMapView.view.map.add(child.layer);
     return;
  } else if (!shouldBeVisible && (child.layer instanceof VectorTileLayer || child.layer instanceof FeatureLayer)) {
     jimuMapView.view.map.remove(child.layer);
     return;
  }
  
  
  child.nestedSubLayers?.forEach((nested) => {
    const nestedVisible = shouldBeVisible && nested.checked;

    if (nestedVisible && (nested.layer instanceof VectorTileLayer || nested.layer instanceof FeatureLayer)) {
      jimuMapView.view.map.add(nested.layer);
      return;
    } else if (!nestedVisible && (nested.layer instanceof VectorTileLayer || nested.layer instanceof FeatureLayer)) {
      jimuMapView.view.map.remove(nested.layer);
      return;
    }
  });
};




// =========================
// LAYER NODE TOGGLE
// =========================

const toggleLayerNode = (currentNodes: LayerNode[], parentIndex: number) => {

  if (!jimuMapView) return;

  const parent = currentNodes[parentIndex];
  if (!parent) return;

  // =========================
  // LEVEL 1 OPERATRIONAL LAYER
  // =========================
  if (parent.checked && (parent.layer instanceof VectorTileLayer || parent.layer instanceof FeatureLayer)) {
      jimuMapView.view.map.add(parent.layer);
      return;
  } else if (!parent.checked && (parent.layer instanceof VectorTileLayer || parent.layer instanceof FeatureLayer)) {
      jimuMapView.view.map.remove(parent.layer);
      return;
  }

  // =========================
  // LEVEL 2 - STRUCTURAL GROUP LAYER - MOUNT CHILDREN TOGGLED ON
  // =========================
  parent.subLayers?.forEach((child) => {

    const childVisible = parent.checked && child.checked;

    if (childVisible && (child.layer instanceof VectorTileLayer || child.layer instanceof FeatureLayer)) {
        jimuMapView.view.map.add(child.layer);
        return;
    } else if (!childVisible && (child.layer instanceof VectorTileLayer || child.layer instanceof FeatureLayer)) {
        jimuMapView.view.map.remove(child.layer);
        return;
    }

    // =========================
    // LEVEL 3 (NESTED)
    // =========================

        child.nestedSubLayers?.forEach((nested) => {

              const nestedVisible = childVisible && nested.checked;

              if (nestedVisible && (nested.layer instanceof VectorTileLayer || nested.layer instanceof FeatureLayer)) {
                jimuMapView.view.map.add(nested.layer);
                return;
              } else if (!nestedVisible && (nested.layer instanceof VectorTileLayer || nested.layer instanceof FeatureLayer)) {
                jimuMapView.view.map.remove(nested.layer);
                return;
              }
        });

  });

};


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
