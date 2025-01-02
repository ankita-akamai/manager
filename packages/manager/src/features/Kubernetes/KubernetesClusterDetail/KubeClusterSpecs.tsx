import { CircleProgress, TooltipIcon, Typography } from '@linode/ui';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Grid from '@mui/material/Unstable_Grid2';
import * as React from 'react';
import { makeStyles } from 'tss-react/mui';

import {
  useAllKubernetesNodePoolQuery,
  useKubernetesTypesQuery,
} from 'src/queries/kubernetes';
import { useRegionsQuery } from 'src/queries/regions/regions';
import { useSpecificTypes } from 'src/queries/types';
import { extendTypesQueryResult } from 'src/utilities/extendType';
import { pluralize } from 'src/utilities/pluralize';
import {
  HA_PRICE_ERROR_MESSAGE,
  UNKNOWN_PRICE,
} from 'src/utilities/pricing/constants';
import { getDCSpecificPriceByType } from 'src/utilities/pricing/dynamicPricing';
import { getTotalClusterPrice } from 'src/utilities/pricing/kubernetes';

import { getTotalClusterMemoryCPUAndStorage } from '../kubeUtils';

import type { KubernetesCluster } from '@linode/api-v4';
import type { Theme } from '@mui/material/styles';

interface Props {
  cluster: KubernetesCluster;
}

const useStyles = makeStyles()((theme: Theme) => ({
  iconTextOuter: {
    minWidth: 115,
  },
  item: {
    '&:first-of-type': {
      paddingTop: 0,
    },
    '&:last-of-type': {
      paddingBottom: 0,
    },
    paddingBottom: theme.spacing(1),
    paddingTop: theme.spacing(1),
  },
  tooltip: {
    '& .MuiTooltip-tooltip': {
      minWidth: 320,
    },
  },
}));

export const KubeClusterSpecs = React.memo((props: Props) => {
  const { cluster } = props;
  const { classes } = useStyles();
  const { data: regions } = useRegionsQuery();
  const theme = useTheme();
  const { data: pools } = useAllKubernetesNodePoolQuery(cluster.id);
  const typesQuery = useSpecificTypes(pools?.map((pool) => pool.type) ?? []);
  const types = extendTypesQueryResult(typesQuery);

  const { CPU, RAM, Storage } = getTotalClusterMemoryCPUAndStorage(
    pools ?? [],
    types ?? []
  );

  const {
    data: kubernetesHighAvailabilityTypesData,
    isError: isErrorKubernetesTypes,
    isLoading: isLoadingKubernetesTypes,
  } = useKubernetesTypesQuery();

  const matchesColGapBreakpointDown = useMediaQuery(
    theme.breakpoints.down(theme.breakpoints.values.lg)
  );

  const lkeHAType = kubernetesHighAvailabilityTypesData?.find(
    (type) => type.id === 'lke-ha'
  );

  const region = regions?.find((r) => r.id === cluster.region);
  const displayRegion = region?.label ?? cluster.region;

  const highAvailabilityPrice = cluster.control_plane.high_availability
    ? getDCSpecificPriceByType({ regionId: region?.id, type: lkeHAType })
    : undefined;

  const kubeSpecsLeft = [
    `Version ${cluster.k8s_version}`,
    displayRegion,
    isLoadingKubernetesTypes ? (
      <CircleProgress size="sm" sx={{ marginTop: 2 }} />
    ) : cluster.control_plane.high_availability && isErrorKubernetesTypes ? (
      <>
        ${UNKNOWN_PRICE}/month
        <TooltipIcon
          sxTooltipIcon={{
            marginBottom: theme.spacing(0.5),
            marginLeft: theme.spacing(1),
            padding: 0,
          }}
          classes={{ popper: classes.tooltip }}
          status="help"
          text={HA_PRICE_ERROR_MESSAGE}
          tooltipPosition="bottom"
        />
      </>
    ) : (
      `$${getTotalClusterPrice({
        highAvailabilityPrice: highAvailabilityPrice
          ? Number(highAvailabilityPrice)
          : undefined,
        pools: pools ?? [],
        region: region?.id,
        types: types ?? [],
      }).toFixed(2)}/month`
    ),
  ];

  const kubeSpecsRight = [
    pluralize('CPU Core', 'CPU Cores', CPU),
    `${RAM / 1024} GB RAM`,
    `${Math.floor(Storage / 1024)} GB Storage`,
  ];

  const kubeSpecItem = (spec: string, idx: number) => {
    return (
      <Grid
        alignItems="center"
        className={classes.item}
        key={`spec-${idx}`}
        wrap="nowrap"
      >
        <Grid className={classes.iconTextOuter}>
          <Typography>{spec}</Typography>
        </Grid>
      </Grid>
    );
  };

  return (
    <Grid
      columnGap={matchesColGapBreakpointDown ? 2 : 0}
      container
      direction="row"
      lg={3}
      xs={12}
    >
      <Grid lg={6}>{kubeSpecsLeft.map(kubeSpecItem)}</Grid>
      <Grid lg={6}>{kubeSpecsRight.map(kubeSpecItem)}</Grid>
    </Grid>
  );
});
