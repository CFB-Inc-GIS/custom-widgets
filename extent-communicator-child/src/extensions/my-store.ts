import { extensionSpec, ImmutableObject, IMState } from 'jimu-core';

export enum MyActionKeys {
    SetExtent = 'SET_EXTENT',
    SetId = 'SET_ID'
}

export interface SetExtentAction {
    type: MyActionKeys.SetExtent
    val: PlainExtent
}

export interface SetIdAction {
    type: MyActionKeys.SetId
    val: string
}

export type ActionTypes = SetExtentAction | SetIdAction

export interface PlainExtent {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
  spatialReference: {
    wkid?: number
    wkt?: string
  }
}

export interface MyState {
    savedExtent: PlainExtent | null;
    savedWidgetId: string | null;
}

export type IMMyState = ImmutableObject<MyState>

declare module 'jimu-core/lib/types/state' {
    interface State {
        myState?: IMMyState
    }
}

export default class MyReduxStoreExtension implements extensionSpec.ReduxStoreExtension {
    id = 'map-extent-connector-store-extension';

    // Returns your redux actions
    getActions() {
        return Object.values(MyActionKeys)
    }

    // This returns the local state
    getInitLocalState() {
        return {
            savedExtent: null,
            savedWidgetId: null
        }
    }

    // This is the reducer and specifies how the application state changes in response to the actions

    getReducer() {
        return (localState: IMMyState, action: ActionTypes, appState: IMState): IMMyState => {
            switch (action.type) {
                case MyActionKeys.SetExtent:
                    return localState.set('savedExtent', action.val);
                case MyActionKeys.SetId:
                    return localState.set('savedWidgetId', action.val);
                default:
                    return localState;
            }
        } 
    }

    // Return the local key for myState
    getStoreKey() {
        return 'myState';
    }
}