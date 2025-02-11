import { Box, FormControlLabel, Toggle, Tooltip, Typography } from '@linode/ui';
import React from 'react';

import { Link } from 'src/components/Link';
import NullComponent from 'src/components/NullComponent';
import { TableCell } from 'src/components/TableCell';
import { TableRow } from 'src/components/TableRow';

import { processMetricCriteria } from '../Utils/utils';

import type { ProcessedCriteria } from '../Utils/utils';
import type { Alert } from '@linode/api-v4';

interface AlertListReusableTableRowProps {
  /**
   * alert object which should be dispalyed in the row
   */
  alert: Alert;

  /**
   * handler function for the click of toggle button
   * @param alert alert object for which toggle button is click
   */
  handleToggle: (alert: Alert) => void;

  /**
   * status for the alert whether it is enabled or disabled
   */
  status?: boolean;
}

export const AlertListReusableTableRow = (
  props: AlertListReusableTableRowProps
) => {
  const { alert, handleToggle, status = false } = props;
  const { id, label, rule_criteria, service_type, type } = alert;
  const metricThreshold = processMetricCriteria(rule_criteria.rules);

  return (
    <TableRow data-qa-alert-cell={id} data-testid={id} key={`alert-row-${id}`}>
      <TableCell>
        <FormControlLabel
          control={
            <Toggle checked={status} onChange={() => handleToggle(alert)} />
          }
          label={''}
        />
      </TableCell>
      <TableCell>
        <Link to={`/monitor/alerts/definitions/detail/${service_type}/${id}`}>
          {label}
        </Link>
      </TableCell>
      <TableCell>
        <MetricThreshold metricThreshold={metricThreshold} />
      </TableCell>
      <TableCell>{type}</TableCell>
    </TableRow>
  );
};

export interface MetricThresholdProps {
  metricThreshold: ProcessedCriteria[];
}

const MetricThreshold = (props: MetricThresholdProps) => {
  const { metricThreshold } = props;
  if (metricThreshold.length === 0) {
    return <NullComponent />;
  }

  const thresholdObject = metricThreshold[0];
  const metric = `${thresholdObject.label} ${thresholdObject.operator}  ${thresholdObject.threshold} ${thresholdObject.unit}`;
  const total = metricThreshold.length - 1;
  if (metricThreshold.length === 1) {
    return <Typography variant="subtitle1">{metric}</Typography>;
  }
  const rest = metricThreshold
    .slice(1)
    .map((criteria) => {
      return `${criteria.label} ${criteria.operator} ${criteria.threshold} ${criteria.unit}`;
    })
    .join('\n');
  return (
    <Box alignItems="center" display="flex" gap={1.75}>
      <Typography variant="subtitle1">{metric}</Typography>
      <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{rest}</Box>}>
        <Typography
          sx={(theme) => {
            return {
              backgroundColor: theme.bg.offWhite,
              border: '1px solid',
              borderColors: theme.borderColors.borderFocus,
              borderRadius: '4px',
              px: 1,
              py: 0.5,
            };
          }}
          variant="subtitle1"
        >
          +{total}
        </Typography>
      </Tooltip>
    </Box>
  );
};
