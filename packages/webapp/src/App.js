// @flow
import BuildInfo from './BuildInfo';
import Comparisons from './Comparisons';
import deepEqual from 'deep-equal';
import Chart from './charts/Chart';
import { getBuilds } from './api';
import React, { Component } from 'react';
import { StyleSheet, View } from 'react-native';
import theme from './theme';
import Toggles from './Toggles';
import { interpolateRainbow, scaleSequential } from 'd3-scale';
import { ChartType, ValueType, valueTypeAccessor, XScaleType, YScaleType } from './values';

import type { Match, RouterHistory } from 'react-router-dom';
import type { Build, Bundle } from './types';

const _getActiveBundles = (props: Object, bundles): Array<string> => {
  const { match: { params } } = props;
  const { bundleNames } = params;
  if (!bundleNames) {
    return bundles;
  } else {
    const bundles = bundleNames.split('+');
    return bundles.filter(b => bundles.indexOf(b) !== -1);
  }
};

class App extends Component {
  state: {
    activeBundles: Array<string>,
    builds: Array<Build>,
    bundles: Array<string>,
    chart: $Values<typeof ChartType>,
    hoveredBundle?: string,
    selectedBuild?: Build,
    compareBuilds: Array<Build>,
    values: $Values<typeof ValueType>,
    xscale: $Values<typeof XScaleType>,
    yscale: $Values<typeof YScaleType>
  };

  props: {
    history: RouterHistory,
    match: Match
  };

  constructor(props: Object, context: Object) {
    super(props, context);
    this.state = {
      activeBundles: [],
      builds: [],
      bundles: [],
      chart: ChartType.AREA,
      values: ValueType.GZIP,
      compareBuilds: [],
      xscale: XScaleType.COMMIT,
      yscale: YScaleType.LINEAR
    };
  }

  componentDidMount() {
    this._fetchData();
  }

  componentWillReceiveProps(nextProps: Object) {
    if (!deepEqual(this.props.match.params, nextProps.match.params)) {
      this.setState(() => ({ activeBundles: _getActiveBundles(nextProps, this.state.bundles) }));
    }
  }

  render() {
    const {
      activeBundles,
      builds,
      bundles,
      chart,
      hoveredBundle,
      selectedBuild,
      compareBuilds,
      values,
      xscale,
      yscale
    } = this.state;

    return (
      <View style={styles.root}>
        <View style={styles.main}>
          <View style={styles.scaleTypeButtons}>
            <Toggles
              chartType={chart}
              onToggle={this._handleToggleValueTypes}
              valueType={values}
              xScaleType={xscale}
              yScaleType={yscale}
            />
          </View>
          <View style={styles.innerMain}>
            <View style={styles.chartRoot}>
              <View style={styles.chart}>
                <Chart
                  activeBundles={activeBundles}
                  bundles={bundles}
                  chartType={chart}
                  colorScale={this._colorScale}
                  onHover={this._handleHover}
                  onSelectBuild={this._handleSelectBuild}
                  selectedBuilds={compareBuilds.map(b => b.meta.revision)}
                  valueAccessor={valueTypeAccessor[values]}
                  xScaleType={xscale}
                  yScaleType={yscale}
                  stats={builds}
                />
              </View>
            </View>
          </View>
        </View>
        <View style={styles.data}>
          <View style={styles.table}>
            <Comparisons
              activeBundles={activeBundles}
              builds={compareBuilds}
              bundles={bundles}
              colorScale={this._colorScale}
              hoveredBundle={hoveredBundle}
              onBundlesChange={this._handleBundlesChange}
              onRemoveBuild={this._handleRemoveRevision}
              onShowBuildInfo={this._handleShowBuildInfo}
              valueAccessor={valueTypeAccessor[values]}
            />
          </View>
          <View style={styles.info}>
            {selectedBuild ? <BuildInfo build={selectedBuild} /> : null}
          </View>
        </View>
      </View>
    );
  }

  _fetchData() {
    getBuilds({}).then(({ builds, bundles }) => {
      this._colorScale = scaleSequential(interpolateRainbow).domain([0, bundles.length]);
      this.setState(() => ({
        activeBundles: _getActiveBundles(this.props, bundles),
        builds,
        bundles
      }));
    });
  }

  _handleToggleValueTypes = (toggleType: string, value: string) => {
    this.setState({ [toggleType]: value });
  };

  _handleHover = (bundle?: Bundle) => {
    if (bundle) {
      this.setState({ hoveredBundle: bundle.key });
    }
  };

  _handleBundlesChange = (newBundles: Array<string>) => {
    const { bundles } = this.state;
    this.props.history.push(
      newBundles.length && newBundles.length !== bundles.length
        ? `/${newBundles.filter(b => b !== 'All').join('+')}`
        : '/'
    );
  };

  _handleSelectBuild = (build: Build, bundleName: string) => {
    this.setState({
      compareBuilds: [...this.state.compareBuilds, build],
      selectedBuild: build
    });
  };

  _handleRemoveRevision = (revision: string) => {
    this.setState(() => ({
      compareBuilds: this.state.compareBuilds.filter(build => build.meta.revision !== revision),
      selectedBuild: this.state.compareBuilds.length && this.state.compareBuilds[0]
    }));
  };

  _handleShowBuildInfo = (revision: string) => {
    this.setState(() => ({
      selectedBuild: this.state.compareBuilds.find(build => build.meta.revision === revision)
    }));
  };
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    height: '100vh',
    position: 'absolute',
    width: '100vw',
    top: 0,
    left: 0
  },
  data: {
    flexGrow: 0,
    minWidth: `${2 * (100 / theme.columns)}%`,
    maxWidth: `${6 * (100 / theme.columns)}%`,
    borderLeftStyle: 'solid',
    borderLeftWidth: '1px',
    borderLeftColor: theme.colorGray
  },
  table: {
    overflowY: 'scroll',
    minHeight: '50vh',
    maxHeight: '80vh',
    borderBottomStyle: 'solid',
    borderBottomWidth: '1px',
    borderBottomColor: theme.colorGray
  },
  info: {
    flexGrow: 1,
    minHeight: '20vh',
    maxHeight: '50vh',
    margin: theme.spaceSmall
  },
  main: {
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    flexGrow: 1
  },
  innerMain: {
    flexGrow: 1
  },
  chartRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    minHeight: '100%',
    width: '100%'
  },
  chart: {
    flexGrow: 1
  },
  scaleTypeButtons: {
    flex: 0,
    marginTop: theme.spaceSmall,
    marginRight: theme.spaceSmall,
    marginBottom: theme.spaceSmall
  }
});

export default App;
