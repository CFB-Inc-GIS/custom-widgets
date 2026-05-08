/** @jsx jsx */
import { React, jsx, Immutable, AllDataSourceTypes, type UseDataSource, DataSourceManager } from 'jimu-core';
import { AllWidgetSettingProps } from 'jimu-for-builder';
import { DataSourceSelector } from 'jimu-ui/advanced/data-source-selector';
import { MapWidgetSelector } from 'jimu-ui/advanced/setting-components';

/**
 * Widget settings component with a basic DataSourceSelector
 */
export default class Setting extends React.PureComponent<AllWidgetSettingProps<any>, any> {
  constructor(props: AllWidgetSettingProps<any>) {
    super(props);
    this.onDataSourceChange = this.onDataSourceChange.bind(this);
  }

    dataSourceManager = DataSourceManager.getInstance()

    supportedDsTypes = Immutable([
        AllDataSourceTypes.GroupLayer,
        AllDataSourceTypes.FeatureLayer,
        AllDataSourceTypes.ImageryLayer,
        AllDataSourceTypes.ImageryTileLayer,
        AllDataSourceTypes.MapService
    ])

  /**
   * Called when the user selects or changes the data source
   */
  onDataSourceChange(useDataSources: UseDataSource[]) {
    // Save the selected data source(s) to widget config
    this.props.onSettingChange({
      id: this.props.id,
      useDataSources: useDataSources
    });
  }
  onMapWidgetSelected = (useMapWidgetIds: string[]) => {
        this.props.onSettingChange({
            id: this.props.id,
            useMapWidgetIds: useMapWidgetIds
        })
    }
  
  render() {
    return (
      <div>
      <div className="widget-setting p-3">
        <h4> 1. Select a Data Source </h4>
        <br></br>
        <h5> ATTENTION </h5>
        <h6> This widget only accepts Map Images </h6>
        <br></br>
        <DataSourceSelector
          types={this.supportedDsTypes} // Allow all data source types
          useDataSources={this.props.useDataSources} // Current selection
          useDataSourcesEnabled={true}
          onChange={this.onDataSourceChange} // Handle selection change
          widgetId={this.props.id} // Required for linking to widget
          isMultiple={true}
        />
      </div>
      <div className ="widget-setting p-3">
          <h4> 2. Select a Map Widget</h4>
              <MapWidgetSelector useMapWidgetIds = {this.props.useMapWidgetIds} onSelect =
              {this.onMapWidgetSelected}/>
      </div>
      </div>
    );
  }
}