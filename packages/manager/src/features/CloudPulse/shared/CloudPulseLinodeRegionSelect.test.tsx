import { capabilityServiceTypeMapping } from '@linode/api-v4';
import { linodeFactory, regionFactory } from '@linode/utilities';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { dashboardFactory, firewallFactory } from 'src/factories';
import { renderWithTheme } from 'src/utilities/testHelpers';

import { NO_REGION_MESSAGE } from '../Utils/constants';
import { CloudPulseLinodeRegionSelect } from './CloudPulseLinodeRegionSelect';

import type { CloudPulseLinodeRegionSelectProps } from './CloudPulseLinodeRegionSelect';
import type { Region } from '@linode/api-v4';
import type { useRegionsQuery } from '@linode/queries';

const firewallDashboard = dashboardFactory.build({
  service_type: 'firewall',
  id: 4,
});

const props: CloudPulseLinodeRegionSelectProps = {
  filterKey: 'associated_entity_region',
  selectedEntities: [],
  handleLinodeRegionChange: vi.fn(),
  label: 'Linode Region',
  selectedDashboard: firewallDashboard,
  savePreferences: true,
  disabled: false,
  xFilter: {},
};

const queryMocks = vi.hoisted(() => ({
  useRegionsQuery: vi.fn().mockReturnValue({}),
  useResourcesQuery: vi.fn().mockReturnValue({}),
  useAllLinodesQuery: vi.fn().mockReturnValue({}),
}));

const allRegions: Region[] = [
  regionFactory.build({
    capabilities: [capabilityServiceTypeMapping['firewall']],
    id: 'us-lax',
    label: 'US, Los Angeles, CA',
    monitors: {
      metrics: ['Cloud Firewall'],
      alerts: [],
    },
  }),
  regionFactory.build({
    capabilities: [capabilityServiceTypeMapping['firewall']],
    id: 'us-west',
    label: 'US, Fremont, CA',
    monitors: {
      metrics: ['Cloud Firewall'],
      alerts: [],
    },
  }),
  regionFactory.build({
    capabilities: [capabilityServiceTypeMapping['linode']],
    id: 'us-east',
    label: 'US, Newark, NJ',
    monitors: {
      metrics: ['Linodes'],
      alerts: [],
    },
  }),
];

const errorMsg = 'Failed to fetch Linode Region.';

vi.mock('@linode/queries', async (importOriginal) => ({
  ...(await importOriginal()),
  useRegionsQuery: queryMocks.useRegionsQuery,
  useAllLinodesQuery: queryMocks.useAllLinodesQuery,
}));

vi.mock('src/queries/cloudpulse/resources', async () => {
  const actual = await vi.importActual('src/queries/cloudpulse/resources');
  return {
    ...actual,
    useResourcesQuery: queryMocks.useResourcesQuery,
  };
});

beforeEach(() => {
  queryMocks.useRegionsQuery.mockReturnValue({
    data: allRegions,
    isError: false,
    isLoading: false,
  });

  queryMocks.useResourcesQuery.mockReturnValue({
    data: firewallFactory.buildList(3, {
      entities: [{ id: 1, type: 'linode' }],
    }),
    isError: false,
    isLoading: false,
  });

  queryMocks.useAllLinodesQuery.mockReturnValue({
    data: linodeFactory.buildList(2, {
      region: 'us-west',
    }),
    isError: false,
    isLoading: false,
  });
});

describe('CloudPulseRegionSelect', () => {
  it('should render a Linode Region Select component', () => {
    const { getByLabelText, getByTestId } = renderWithTheme(
      <CloudPulseLinodeRegionSelect {...props} />
    );
    const { label } = props;
    expect(getByLabelText(label)).toBeVisible();
    expect(getByTestId('region-select')).toBeVisible();
  });

  it('should render a Linode Region Select component with proper error message on api call failure', () => {
    queryMocks.useRegionsQuery.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
    } as ReturnType<typeof useRegionsQuery>);
    const { getByText } = renderWithTheme(
      <CloudPulseLinodeRegionSelect {...props} />
    );

    expect(getByText(errorMsg)).toBeVisible();
  });

  it('should render a Linode Region Select component with proper error message on resources api call failure', () => {
    queryMocks.useResourcesQuery.mockReturnValue({
      data: null,
      isError: true,
      isLoading: false,
    });
    const updatedProps = {
      ...props,
      selectedDashboard: firewallDashboard,
    };
    renderWithTheme(<CloudPulseLinodeRegionSelect {...updatedProps} />);

    expect(screen.getByText(errorMsg)).toBeVisible();
  });

  it('should render a Linode Region Select component with given capability', async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <CloudPulseLinodeRegionSelect
        {...props}
        selectedDashboard={firewallDashboard}
      />
    );

    // resources are present only in us-west, no other regions like us-east here should be listed
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(
      screen.getByRole('option', {
        name: 'US, Fremont, CA (us-west)',
      })
    ).toBeVisible();
    expect(
      screen.queryByRole('option', {
        name: 'US, Newark, NJ (us-east)',
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', {
        name: 'US, Los Angeles, CA (us-lax)',
      })
    ).not.toBeInTheDocument();
  });

  it('should render a Linode Region Select component with correct info message when no regions are available for firewall service type', async () => {
    const user = userEvent.setup();
    queryMocks.useRegionsQuery.mockReturnValue({
      data: [],
      isError: false,
      isLoading: false,
    });
    // There are no aclp supported regions for firewall service type as returned by useRegionsQuery above
    renderWithTheme(
      <CloudPulseLinodeRegionSelect
        {...props}
        selectedDashboard={firewallDashboard}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText(NO_REGION_MESSAGE['firewall'])).toBeVisible();
  });

  it('Should show the correct linode region in the dropdown for firewall service type when savePreferences is true', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <CloudPulseLinodeRegionSelect {...props} selectedEntities={['1']} />
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(
      screen.getByRole('option', { name: 'US, Fremont, CA (us-west)' })
    ).toBeVisible();
  });

  it('Should select the first region automatically from the linode regions if savePreferences is false', async () => {
    renderWithTheme(
      <CloudPulseLinodeRegionSelect
        {...props}
        savePreferences={false}
        selectedEntities={['1']}
      />
    );
    expect(screen.getByDisplayValue('US, Fremont, CA (us-west)')).toBeVisible();
  });
});
