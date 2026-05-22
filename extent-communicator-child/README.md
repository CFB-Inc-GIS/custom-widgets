# Map Extent Connector (Experience Builder Widget)

## Overview
The Map Extent Connector is a custom ArcGIS Experience Builder widget that
synchronizes map extents across multiple Map Widgets inside an Experience.

When a user changes views or navigates between sections, the widget restores
the last known map extent to maintain spatial continuity.

## Key Features
- Listens to active `JimuMapView` changes
- Stores map extents in Redux
- Restores extent when switching views/maps
- Compatible with Experience Builder Developer Edition
- Production-safe build (`npm run build:prod`)

## Requirements
- ArcGIS Experience Builder Developer Edition
- ArcGIS Enterprise (tested in Enterprise environment)
- Node.js (version matching ExB Dev requirements)

## Build Instructions
```bash
npm install
npm run build:prod