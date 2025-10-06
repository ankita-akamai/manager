import { useRegionsQuery } from '@linode/queries';
import { useIsGeckoEnabled } from '@linode/shared';
import * as React from 'react';

import { RegionSelect } from 'src/components/RegionSelect/RegionSelect';
import { useFlags } from 'src/hooks/useFlags';

import { useFetchOptions } from '../Alerts/CreateAlert/Criteria/DimensionFilterValue/useFetchOptions';
import { NO_REGION_MESSAGE } from '../Utils/constants';
import { deepEqual } from '../Utils/FilterBuilder';
import { FILTER_CONFIG } from '../Utils/FilterConfig';

import type { Item } from '../Alerts/constants';
import type { CloudPulseMetricsFilter } from '../Dashboard/CloudPulseDashboardLanding';
import type { Dashboard, FilterValue } from '@linode/api-v4';

export interface CloudPulseLinodeRegionSelectProps {
  /*
   * The default value to be selected when the component is mounted.
   */
  defaultValue?: FilterValue;
  /**
   * Whether the component is disabled.
   */
  disabled?: boolean;
  /**
   * The key of the filter.
   */
  filterKey: string;
  /**
   * The callback to be called when the linode region is changed.
   */
  handleLinodeRegionChange: (
    filterKey: string,
    region: string | undefined,
    labels: string[],
    savePref?: boolean
  ) => void;
  /**
   * The label of the component.
   */
  label: string;
  /**
   * The placeholder of the component.
   */
  placeholder?: string;
  /**
   * Whether to save the preferences.
   */
  savePreferences?: boolean;
  /**
   * The selected dashboard.
   */
  selectedDashboard: Dashboard | undefined;
  /**
   * The selected entities.
   */
  selectedEntities: string[];
  /**
   * The xfilter based on the config.
   */
  xFilter?: CloudPulseMetricsFilter;
}

export const CloudPulseLinodeRegionSelect = React.memo(
  (props: CloudPulseLinodeRegionSelectProps) => {
    const {
      defaultValue,
      filterKey,
      handleLinodeRegionChange,
      label,
      placeholder,
      savePreferences,
      selectedDashboard,
      selectedEntities,
      disabled = false,
      xFilter,
    } = props;

    const { data: regions, isError, isLoading } = useRegionsQuery();

    const flags = useFlags();
    const { isGeckoLAEnabled } = useIsGeckoEnabled(
      flags.gecko2?.enabled,
      flags.gecko2?.la
    );

    const dashboardId = selectedDashboard?.id;
    const serviceType = selectedDashboard?.service_type;
    const capability = dashboardId
      ? FILTER_CONFIG.get(dashboardId)?.capability
      : undefined;

    const [selectedRegion, setSelectedRegion] = React.useState<string>();

    // Fetch the linode regions associated with the selected entities
    const {
      values: linodeRegions,
      isLoading: isLinodeRegionIdLoading,
      isError: isLinodeRegionIdError,
    } = useFetchOptions({
      dimensionLabel: filterKey,
      entities: selectedEntities,
      regions,
      serviceType,
      type: 'metrics',
    });

    const linodeRegionIds = linodeRegions.map(
      (option: Item<string, string>) => option.value
    );

    const supportedLinodeRegions = React.useMemo(() => {
      return (
        regions?.filter((region) => linodeRegionIds?.includes(region.id)) ?? []
      );
    }, [regions, linodeRegionIds]);

    const dependencyKey = supportedLinodeRegions
      .map((region) => region.id)
      .sort()
      .join(',');

    React.useEffect(() => {
      if (disabled && !selectedRegion) {
        return; // no need to do anything
      }

      // If savePreferences is false, select the first region from the supported regions
      if (
        !savePreferences &&
        supportedLinodeRegions?.length &&
        selectedRegion === undefined
      ) {
        const defaultRegion = supportedLinodeRegions[0];
        handleLinodeRegionChange(filterKey, defaultRegion.id, [
          defaultRegion.label,
        ]);
        setSelectedRegion(defaultRegion.id);
        return;
      }

      // If component is not disabled, supported linode regions have loaded, savePreferences is true,
      // and there's no selected region — attempt to preselect from defaultValue.
      if (
        !disabled &&
        supportedLinodeRegions &&
        savePreferences &&
        selectedRegion === undefined
      ) {
        // Try to find the region corresponding to the saved default value
        const region = defaultValue
          ? supportedLinodeRegions.find(
              (regionObj) => regionObj.id === defaultValue
            )
          : undefined;
        // Notify parent and set internal state
        handleLinodeRegionChange(
          filterKey,
          region?.id,
          region ? [region.label] : []
        );
        setSelectedRegion(region?.id);
      } else {
        if (disabled && selectedRegion !== undefined) {
          setSelectedRegion('');
          handleLinodeRegionChange(filterKey, undefined, []);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      xFilter, // Reacts to filter changes (to reset region)
      dependencyKey, // Reacts to linode region changes
    ]);

    return (
      <RegionSelect
        currentCapability={capability}
        data-testid="region-select"
        disableClearable={false}
        disabled={!selectedDashboard || !regions || disabled || !linodeRegions}
        errorText={
          isError || isLinodeRegionIdError
            ? `Failed to fetch ${label || 'Linode Region'}.`
            : ''
        }
        fullWidth
        isGeckoLAEnabled={isGeckoLAEnabled}
        label={label || 'Linode Region'}
        loading={!disabled && (isLoading || isLinodeRegionIdLoading)}
        noMarginTop
        noOptionsText={
          NO_REGION_MESSAGE[selectedDashboard?.service_type ?? ''] ??
          'No firewalls configured in any Linode regions.'
        }
        onChange={(_, region) => {
          setSelectedRegion(region?.id ?? '');
          handleLinodeRegionChange(
            filterKey,
            region?.id,
            region ? [region.label] : [],
            savePreferences
          );
        }}
        placeholder={placeholder ?? 'Select a Linode Region'}
        regions={supportedLinodeRegions}
        value={supportedLinodeRegions?.length ? (selectedRegion ?? null) : null}
      />
    );
  },
  (prevProps, nextProps) =>
    prevProps.selectedDashboard?.id === nextProps.selectedDashboard?.id &&
    deepEqual(prevProps.xFilter, nextProps.xFilter)
);
