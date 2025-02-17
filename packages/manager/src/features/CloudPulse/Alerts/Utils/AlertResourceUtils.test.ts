import { regionFactory } from 'src/factories';

import {
  getFilteredResources,
  getRegionOptions,
  getRegionsIdRegionMap,
  getSupportedRegionOptions,
} from './AlertResourceUtils';

import type { CloudPulseResources } from '../../shared/CloudPulseResourcesSelect';
import type { Region } from '@linode/api-v4';
import type { CloudPulseResourceTypeMapFlag } from 'src/featureFlags';

const mockResourceTypeMap: CloudPulseResourceTypeMapFlag[] = [
  {
    dimensionKey: 'LINODE_ID',
    serviceType: 'linode',
    supportedRegionIds: 'us-east, us-west',
  },
  {
    dimensionKey: 'cluster_id',
    serviceType: 'dbaas',
  },
];

describe('getRegionsIdLabelMap', () => {
  it('should return a proper map for given regions', () => {
    const regions = regionFactory.buildList(10);
    const result = getRegionsIdRegionMap(regions);
    // check for a key
    expect(result.has(regions[0].id)).toBe(true);
    // check for value to match the region object
    expect(result.get(regions[0].id)).toBe(regions[0]);
  });
  it('should return 0 if regions is passed as undefined', () => {
    const result = getRegionsIdRegionMap(undefined);
    // if regions passed undefined, it should return an empty map
    expect(result.size).toBe(0);
  });
});

describe('getRegionOptions', () => {
  const regions = regionFactory.buildList(10);
  const regionsIdToLabelMap = getRegionsIdRegionMap(regions);
  const data: CloudPulseResources[] = [
    { id: '1', label: 'Test', region: regions[0].id },
    { id: '2', label: 'Test2', region: regions[1].id },
    { id: '3', label: 'Test3', region: regions[2].id },
  ];
  it('should return correct region objects for given resourceIds', () => {
    const result = getRegionOptions({
      data,
      regionsIdToRegionMap: regionsIdToLabelMap,
      resourceIds: ['1', '2'],
    });
    // Valid case
    expect(result.length).toBe(2);
  });

  it('should return an empty region options if data is not passed', () => {
    // Case with no data
    const result = getRegionOptions({
      regionsIdToRegionMap: regionsIdToLabelMap,
      resourceIds: ['1', '2'],
    });
    expect(result.length).toBe(0);
  });

  it('should return an empty region options if there is no matching resource ids', () => {
    const result = getRegionOptions({
      data,
      regionsIdToRegionMap: regionsIdToLabelMap,
      resourceIds: ['101'],
    });
    expect(result.length).toBe(0);
  });

  it('should return unique regions even if resourceIds contains duplicates', () => {
    const result = getRegionOptions({
      data,
      regionsIdToRegionMap: regionsIdToLabelMap,
      resourceIds: ['1', '1', '2', '2'], // Duplicate IDs
    });
    expect(result.length).toBe(2); // Should still return unique regions
  });
  it('should return all region objects if resourceIds is empty and isAdditionOrDeletionNeeded is true', () => {
    const result = getRegionOptions({
      data,
      isAdditionOrDeletionNeeded: true,
      regionsIdToRegionMap: regionsIdToLabelMap,
      resourceIds: [],
    });
    // Valid case
    expect(result.length).toBe(3);
  });
});

describe('getFilteredResources', () => {
  const regions = [
    ...regionFactory.buildList(10),
    regionFactory.build({ id: 'us-east' }),
    regionFactory.build({ id: 'us-west' }),
  ];
  const regionsIdToRegionMap = getRegionsIdRegionMap(regions);
  const data: CloudPulseResources[] = [
    { engineType: 'mysql', id: '1', label: 'Test', region: regions[0].id },
    { engineType: 'mysql', id: '2', label: 'Test2', region: regions[1].id },
    { engineType: undefined, id: '4', label: 'Test4', region: 'us-east' },
    { engineType: undefined, id: '5', label: 'Test5', region: 'us-west' },
    {
      engineType: 'postgresql',
      id: '3',
      label: 'Test3',
      region: regions[2].id,
    },
  ];
  it('should return correct filtered instances on only filtered regions', () => {
    const result = getFilteredResources({
      data,
      filteredRegions: getRegionOptions({
        data,
        regionsIdToRegionMap,
        resourceIds: ['1', '2'],
      }).map(({ id, label }) => `${label} (${id})`),
      regionsIdToRegionMap,
      resourceIds: ['1', '2'],
      supportedRegions: undefined,
    });
    expect(result.length).toBe(2);
    expect(result[0].label).toBe(data[0].label);
    expect(result[1].label).toBe(data[1].label);
  });
  it('should return correct filtered instances on filtered regions and search text', () => {
    const // Case with searchText
      result = getFilteredResources({
        data,
        filteredRegions: getRegionOptions({
          data,
          regionsIdToRegionMap,
          resourceIds: ['1', '2'],
        }).map(({ id, label }) => `${label} (${id})`),
        regionsIdToRegionMap,
        resourceIds: ['1', '2'],
        searchText: data[1].label,
        supportedRegions: undefined,
      });
    expect(result.length).toBe(1);
    expect(result[0].label).toBe(data[1].label);
  });
  it('should return empty result on mismatched filters', () => {
    const result = getFilteredResources({
      data,
      filteredRegions: getRegionOptions({
        data,
        regionsIdToRegionMap,
        resourceIds: ['1'], // region not associated with the resources
      }).map(({ id, label }) => `${label} (${id})`),
      regionsIdToRegionMap,
      resourceIds: ['1', '2'],
      searchText: data[1].label,
      supportedRegions: undefined,
    });
    expect(result.length).toBe(0);
  });
  it('should return empty result on empty data', () => {
    const result = getFilteredResources({
      data: [],
      filteredRegions: [],
      regionsIdToRegionMap,
      resourceIds: ['1', '2'],
      supportedRegions: undefined,
    });
    expect(result.length).toBe(0);
  });
  it('should return empty result if data is undefined', () => {
    const result = getFilteredResources({
      data: undefined,
      filteredRegions: [],
      regionsIdToRegionMap,
      resourceIds: ['1', '2'],
      supportedRegions: undefined,
    });
    expect(result.length).toBe(0);
  });
  it('should return checked true for already selected instances', () => {
    const // Case with searchText
      result = getFilteredResources({
        data,
        filteredRegions: [],
        regionsIdToRegionMap,
        resourceIds: ['1', '2'],
        searchText: '',
        selectedResources: ['1'],
        supportedRegions: undefined,
      });
    expect(result.length).toBe(2);
    expect(result[0].checked).toBe(true);
  });
  it('should return all resources in case of edit flow', () => {
    const // Case with searchText
      result = getFilteredResources({
        data,
        filteredRegions: [],
        isAdditionOrDeletionNeeded: true,
        regionsIdToRegionMap,
        resourceIds: [],
        searchText: undefined,
        selectedResources: ['1'],
        supportedRegions: undefined,
      });
    expect(result.length).toBe(data.length);
  });
  it('should return correct results on additional filters', () => {
    const result = getFilteredResources({
      additionalFilters: {
        engineType: 'postgresql',
      },
      data,
      filteredRegions: [],
      regionsIdToRegionMap,
      resourceIds: ['1', '2', '3'],
      supportedRegions: undefined,
    });
    expect(result.length).toBe(1);
  });
  it('should return correct results if additional filters key value is undefined', () => {
    const result = getFilteredResources({
      additionalFilters: {
        engineType: undefined,
      },
      data,
      filteredRegions: [],
      regionsIdToRegionMap,
      resourceIds: ['1', '2', '3'],
      supportedRegions: undefined,
    });
    expect(result.length).toBe(3);
  });
  it('should return correct results if supported regions are defined and one or more regions are selected', () => {
    const result = getFilteredResources({
      additionalFilters: {
        engineType: undefined,
      },
      data,
      filteredRegions: [],
      regionsIdToRegionMap,
      resourceIds: ['1', '2', '3', '4', '5'],
      supportedRegions: getSupportedRegionOptions(
        mockResourceTypeMap,
        'linode',
        regions
      ) as Region[],
    });
    expect(result.length).toBe(2);
  });
  it('should return correct results if supported regions are defined and no region is selected', () => {
    const result = getFilteredResources({
      additionalFilters: {
        engineType: undefined,
      },
      data,
      filteredRegions: [],
      regionsIdToRegionMap,
      resourceIds: ['2', '3', '4', '5'],
      supportedRegions: getSupportedRegionOptions(
        mockResourceTypeMap,
        'linode',
        regions
      ),
    });
    expect(result.length).toBe(2);
  });
});

describe('getSupportedRegionOptions', () => {
  const regions = [
    regionFactory.build({ country: 'us', id: 'us-east', label: 'Newark, NJ' }),
    regionFactory.build({ country: 'us', id: 'us-west', label: 'Fremont, CA' }),
    regionFactory.build({ country: 'uk', id: 'eu-west', label: 'London, UK' }),
  ];

  it('returns filtered regions based on supported region ids', () => {
    const result = getSupportedRegionOptions(
      mockResourceTypeMap,
      'linode',
      regions
    ) as Region[];

    expect(result[0].id).toEqual('us-east');
    expect(result[1].id).toEqual('us-west');
  });

  it('returns undefined when supported region ids are undefined', () => {
    const result = getSupportedRegionOptions(
      mockResourceTypeMap,
      'dbaas',
      regions
    );
    expect(result).toBeUndefined();
  });
});
