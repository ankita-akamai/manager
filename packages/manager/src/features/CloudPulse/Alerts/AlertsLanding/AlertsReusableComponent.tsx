import {
  Autocomplete,
  Box,
  Button,
  CircleProgress,
  Paper,
  Stack,
  Typography,
} from '@linode/ui';
import React from 'react';
import { useHistory } from 'react-router-dom';

import { DebouncedSearchTextField } from 'src/components/DebouncedSearchTextField';
import { useAlertDefinitionByServiceTypeQuery } from 'src/queries/cloudpulse/alerts';

import { AlertListReusableTable } from '../AlertsListing/AlertListReusableTable';
import {
  convertAlertsToTypeSet,
  filterAlertsByStatusAndType,
} from '../Utils/utils';

import type { AlertDefinitionType } from '@linode/api-v4';

interface AlertReusableComponentProps {
  /**
   * id for the selected entity
   */
  entityId: string;

  /**
   * name of the selected entity
   */
  entityName: string;

  /**
   * service type of selected entity
   */
  serviceType: string;
}

export const AlertReusableComponent = (props: AlertReusableComponentProps) => {
  const { entityId, entityName, serviceType } = props;
  const { data: alerts, isLoading } = useAlertDefinitionByServiceTypeQuery(
    serviceType
  );

  const [searchText, setSearchText] = React.useState<string>('');
  const [selectedType, setSelectedType] = React.useState<
    AlertDefinitionType | undefined
  >();

  const filteredAlerts = React.useMemo(() => {
    return filterAlertsByStatusAndType(alerts, searchText, selectedType);
  }, [alerts, searchText, selectedType]);
  const history = useHistory();

  const types = React.useMemo<{ label: AlertDefinitionType }[]>(() => {
    return convertAlertsToTypeSet(alerts);
  }, [alerts]);
  if (isLoading) {
    return <CircleProgress />;
  }
  return (
    <Paper>
      <Stack gap={3}>
        <Box display="flex" justifyContent="space-between">
          <Typography variant="h2">Alerts</Typography>
          <Button
            data-testid="manage-alerts"
            onClick={() => history.push('/monitor/alerts/definitions')}
            sx={{ border: '1px solid' }}
          >
            Manage Alerts
          </Button>
        </Box>
        <Stack gap={2}>
          <Box display="flex" gap={2}>
            <DebouncedSearchTextField
              data-testid="search-alert"
              label=""
              noMarginTop
              onSearch={setSearchText}
              placeholder="Search for Alerts"
              sx={{ width: '250px' }}
              value={searchText}
            />
            <Autocomplete
              onChange={(_, selectedValue) => {
                setSelectedType(selectedValue?.label);
              }}
              autoHighlight
              data-testid="alert-type-select"
              label=""
              noMarginTop
              options={types}
              placeholder="Select Alert Type"
              sx={{ width: '250px' }}
            />
          </Box>
          <AlertListReusableTable
            columns={[
              { columnName: 'Alert Name', label: 'label' },
              { columnName: 'Metric Threshold', label: 'id' },
              { columnName: 'Alert Type', label: 'type' },
            ]}
            alerts={filteredAlerts}
            entityId={entityId}
            entityName={entityName}
            ordeByColumn="Alert Name"
          />
        </Stack>
      </Stack>
    </Paper>
  );
};
