import {
  Autocomplete,
  CircleProgress,
  Dialog,
  Divider,
  Notice,
  Typography,
} from '@linode/ui';
import { styled, useTheme } from '@mui/material/styles';
import Grid from '@mui/material/Grid2';
import {
  both,
  compose,
  equals,
  isNil,
  lensPath,
  over,
  set,
  uniq,
  view,
  when,
} from 'ramda';
import * as React from 'react';

import { ActionsPanel } from 'src/components/ActionsPanel/ActionsPanel';
import { usePrevious } from 'src/hooks/usePrevious';
import {
  useAllLinodesQuery,
  useLinodeQuery,
} from 'src/queries/linodes/linodes';
import {
  useAssignAdressesMutation,
  useLinodeIPsQuery,
} from 'src/queries/linodes/networking';
import { useAllIPv6RangesQuery } from 'src/queries/networking/networking';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';

import type { APIError, IPRange } from '@linode/api-v4';

interface Props {
  linodeId: number;
  onClose: () => void;
  open: boolean;
  readOnly?: boolean;
}

type IPStates = Move | NoAction | Swap;

interface IPRowState {
  [x: string]: IPStates;
}

type Mode = 'move' | 'none' | 'swap';

interface NoAction {
  mode: Mode;
  sourceIP: string;
  sourceIPsLinodeID: number;
}

interface Move extends NoAction {
  selectedLinodeID: number;
}

interface Swap extends Move {
  selectedIP: string;
  selectedLinodesIPs: string[];
}

const defaultState = (
  sourceIP: string,
  sourceIPsLinodeID: number
): NoAction => ({
  mode: 'none',
  sourceIP,
  sourceIPsLinodeID,
});

export const getLinodeIPv6Ranges = (
  ipv6RangesData: IPRange[] | undefined,
  ipv6: null | string
) => {
  return (
    ipv6RangesData
      ?.filter(
        (ipv6RangeData) =>
          ipv6RangeData.route_target === ipv6?.substring(0, ipv6.indexOf('/'))
      )
      .map(
        (ipv6RangeData) => `${ipv6RangeData.range}/${ipv6RangeData.prefix}`
      ) ?? []
  );
};

export const IPTransfer = (props: Props) => {
  const { linodeId, onClose, open, readOnly } = props;
  const theme = useTheme();
  const { mutateAsync: assignAddresses } = useAssignAdressesMutation({
    currentLinodeId: linodeId,
  });

  const { data: linode } = useLinodeQuery(linodeId, open);

  const { data: _ips } = useLinodeIPsQuery(linodeId);

  const publicIPv4Addresses = _ips?.ipv4.public.map((i) => i.address) ?? [];
  const privateIPv4Addresses = _ips?.ipv4.private.map((i) => i.address) ?? [];
  const ipv6Addresses =
    _ips?.ipv6?.global.map((i) => `${i.range}/${i.prefix}`) ?? [];

  const ipAddresses = [
    ...publicIPv4Addresses,
    ...privateIPv4Addresses,
    ...ipv6Addresses,
  ];

  const [ips, setIPs] = React.useState<IPRowState>(
    ipAddresses.reduce(
      (acc, ip) => ({
        ...acc,
        [ip]: defaultState(ip, linodeId),
      }),
      {}
    )
  );
  const [error, setError] = React.useState<APIError[] | undefined>(undefined);
  const [successMessage, setSuccessMessage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    // Not using onReset here because we don't want to reset the IPs.
    // User may want to keep their selection after closing the modal to check their IP addresses table.
    setError(undefined);
    setSuccessMessage('');
  }, [open]);

  const {
    data: allLinodes,
    error: linodesError,
    isLoading,
  } = useAllLinodesQuery(
    {},
    {
      region: linode?.region,
    },
    open // only run the query if the modal is open
  );

  const {
    data: ipv6RangesData,
    error: ipv6RangesError,
    isLoading: ipv6RangesLoading,
  } = useAllIPv6RangesQuery();

  const linodes = (allLinodes ?? []).filter((l) => l.id !== linodeId);

  const onModeChange = (ip: string) => (
    event: React.SyntheticEvent<Element, Event>,
    selected: { label: string; value: string }
  ) => {
    const mode = (selected?.value as Mode) || 'none';
    const firstLinode = linodes[0];

    const newState = compose<any, any, any, any, any>(
      /** Always update the mode. */
      setMode(ip, mode),

      /** When switching back to none, reset the ipState. */
      when(
        () => isNone(mode),
        updateIPState(ip, (ipState) =>
          defaultState(ipState.sourceIP, ipState.sourceIPsLinodeID)
        )
      ),

      /** When we're swapping/moving we default to the head of the list if it's not set already. */
      when(
        both(
          () => isSwapping(mode) || isMoving(mode),
          compose(isNil, view(L.selectedLinodeID(ip)))
        ),
        setSelectedLinodeID(ip, firstLinode.id)
      ),

      /** When we're swapping we defaulting the selectedIP to the first in the list and setting
       * the selectedLinodesIPs so the same Linode's IPs (which are used in the select IP menu).
       */
      when(
        () => isSwapping(mode),
        compose(
          setSelectedIP(ip, firstLinode.ipv4[0]),
          updateSelectedLinodesIPs(ip, () => {
            const linodeIPv6Ranges = getLinodeIPv6Ranges(
              ipv6RangesData,
              firstLinode.ipv6
            );
            return [...firstLinode.ipv4, ...linodeIPv6Ranges];
          })
        )
      )
    );
    setIPs((currentState) => newState(currentState));
  };

  const onSelectedLinodeChange = (ip: string) => (
    event: React.SyntheticEvent,
    selected: { label: string; value: number }
  ) => {
    const newState = compose<any, any, any>(
      setSelectedLinodeID(ip, selected.value),
      /**
       * When mode is swapping;
       *  Update the selectedLinodesIPs (since the Linode has changed, the available IPs certainly have)
       *  Update the selectedIP (to provide a sensible default).
       */
      when(
        compose(equals('swap'), view(L.mode(ip))),

        compose(
          /** We need to find and return the newly selected Linode's IPs. */
          updateSelectedLinodesIPs(ip, () => {
            const linode = linodes.find((l) => l.id === Number(selected.value));
            if (linode) {
              const linodeIPv6Ranges = getLinodeIPv6Ranges(
                ipv6RangesData,
                linode?.ipv6
              );
              return [...linode.ipv4, ...linodeIPv6Ranges];
            }
            return [];
          }),

          /** We need to find the selected Linode's IPs and return the first. */
          updateSelectedIP(ip, () => {
            const linode = linodes.find((l) => l.id === Number(selected.value));
            if (linode) {
              return linode.ipv4[0];
            }
            return undefined;
          })
        )
      )
    );
    setIPs((currentState) => newState(currentState));
  };

  const onSelectedIPChange = (ip: string) => (
    event: React.SyntheticEvent,
    selected: { label: string; value: string }
  ) => {
    setIPs(setSelectedIP(ip, selected.value));
  };

  const renderRow = (
    state: IPStates,
    renderLinodeSelect?: (s: Move) => JSX.Element,
    renderIPSelect?: (s: Swap) => JSX.Element
  ) => {
    const actionsList = [
      { label: 'Move To', value: 'move' },
      { label: 'Swap With', value: 'swap' },
    ];

    return (
      <Grid
        sx={{
          [theme.breakpoints.down('md')]: {
            backgroundColor: theme.color.grey5,
            mb: 3,
          },
        }}
        container
        key={state.sourceIP}
        spacing={2}
        size={12}
      >
        <Grid
          sx={{
            alignItems: 'center',
            display: 'flex',
          }}
          size={{
            md: 3,
            xs: 12,
          }}
        >
          <Typography>
            <Typography
              sx={(theme) => ({
                font: theme.font.bold,
                [theme.breakpoints.up('md')]: {
                  display: 'none',
                },
              })}
              component="span"
            >
              IP address:{' '}
            </Typography>
            {state.sourceIP}
          </Typography>
        </Grid>
        <StyledAutoGrid size={{ md: 3, xs: 12 }}>
          <Autocomplete
            isOptionEqualToValue={(option, value) =>
              option.value === value.value
            }
            textFieldProps={{
              dataAttrs: {
                'data-qa-ip-transfer-action-menu': state.mode,
              },
              disabled: readOnly,
              hideLabel: true,
            }}
            value={
              state.mode === 'none'
                ? null
                : actionsList.find(
                    (eachAction) => eachAction.value === state.mode
                  )
            }
            autoHighlight
            clearIcon={null}
            disablePortal={false}
            label="Select Action"
            noMarginTop
            onChange={onModeChange(state.sourceIP)}
            options={actionsList}
            placeholder="Select Action"
          />
        </StyledAutoGrid>
        {renderLinodeSelect && renderLinodeSelect(state as Move)}
        {renderIPSelect && renderIPSelect(state as Swap)}
      </Grid>
    );
  };

  const linodeSelect = ({ selectedLinodeID, sourceIP }: Move) => {
    const linodeList = linodes.map((l) => {
      return { label: l.label, value: l.id };
    });

    const defaultLinode = linodeList.find((eachLinode) => {
      return eachLinode.value === selectedLinodeID;
    });

    return (
      <StyledAutoGrid size={{ md: 3, xs: 12 }}>
        <Autocomplete
          textFieldProps={{
            dataAttrs: {
              'data-qa-linode-select': true,
            },
            hideLabel: true,
          }}
          autoHighlight
          disableClearable
          disabled={readOnly || linodes.length === 1}
          errorText={linodesError?.[0].reason}
          label="Select Linode"
          loading={isLoading || ipv6RangesLoading}
          noMarginTop
          onChange={onSelectedLinodeChange(sourceIP)}
          options={linodeList}
          placeholder="Select Linode"
          value={defaultLinode}
        />
      </StyledAutoGrid>
    );
  };

  const ipSelect = ({ selectedIP, selectedLinodesIPs, sourceIP }: Swap) => {
    const IPList = selectedLinodesIPs.map((ip) => {
      return { label: ip, value: ip };
    });

    const defaultIP = IPList.find((eachIP) => {
      return eachIP.value === selectedIP;
    });

    return (
      <StyledAutoGrid size={{ md: 3, xs: 12 }}>
        <Autocomplete
          textFieldProps={{
            dataAttrs: {
              'data-qa-swap-ip-action-menu': true,
            },
            hideLabel: true,
          }}
          autoHighlight
          disableClearable
          disablePortal={false}
          disabled={readOnly}
          label="Select IP Address"
          noMarginTop
          onChange={onSelectedIPChange(sourceIP)}
          options={IPList}
          value={defaultIP}
        />
      </StyledAutoGrid>
    );
  };

  const previousIPAddresses = usePrevious(ipAddresses);

  React.useEffect(() => {
    /**
     * if new ip addresses were provided as props, massage the data so it matches
     * the default shape we need to append to state
     */
    if (!equals(previousIPAddresses, ipAddresses)) {
      setIPs(
        ipAddresses.reduce<IPRowState>((acc, ip) => {
          acc[ip] = defaultState(ip, linodeId);
          return acc;
        }, {})
      );
    }
  }, [ipAddresses, linodeId, previousIPAddresses]);

  const ipRow = (ipState: IPStates) => {
    if (isNoneState(ipState)) {
      return renderRow(ipState);
    }

    if (isMoveState(ipState)) {
      return renderRow(ipState, linodeSelect);
    }

    if (isSwapState(ipState)) {
      return renderRow(ipState, linodeSelect, ipSelect);
    }

    return null;
  };

  const onSubmit = () => {
    setSubmitting(true);
    setError(undefined);
    setSuccessMessage('');

    const noActionSelected = !Object.values(ips).find(
      (ip) => ip.mode !== 'none'
    );
    if (noActionSelected) {
      setError([{ reason: 'Please select an action.' }]);
      setSubmitting(false);

      return;
    }

    assignAddresses(createRequestData(ips, linode?.region ?? ''))
      .then(() => {
        // Refresh Linodes in the region in which the changes were made.
        setSubmitting(false);
        setError(undefined);
        setSuccessMessage('IP transferred successfully.');
      })
      .catch((err) => {
        const apiErrors = getAPIErrorOrDefault(
          err,
          'Unable to transfer IP addresses at this time. Please try again later.'
        );

        setError(uniq(apiErrors));
        setSubmitting(false);
      });
  };

  const onReset = () => {
    setError(undefined);
    setSuccessMessage('');
    setIPs(
      ipAddresses.reduce(
        (state, ip) => ({
          ...state,
          [ip]: defaultState(ip, linodeId),
        }),
        {}
      )
    );
  };

  return (
    <Dialog fullWidth onClose={onClose} open={open} title="IP Transfer">
      {error && (
        <Grid size={12}>
          {error.map(({ reason }, idx) => (
            <Notice key={idx} text={reason} variant="error" />
          ))}
        </Grid>
      )}
      {successMessage && (
        <Grid size={12}>
          <Notice text={successMessage} variant="success" />
        </Grid>
      )}
      <Grid
        size={{
          lg: 8,
          sm: 12,
          xl: 6,
        }}
      >
        <Typography sx={{ marginBottom: theme.spacing(2) }}>
          If you have two Linodes in the same data center, you can use the IP
          transfer feature to switch their IP addresses. This could be useful in
          several situations. For example, if you&rsquo;ve built a new server to
          replace an old one, you could swap IP addresses instead of updating
          the DNS records.
        </Typography>
      </Grid>
      <Grid container size={12}>
        {!isLoading && !ipv6RangesLoading && ipv6RangesError ? (
          <Notice
            text={'There was an error loading IPv6 Ranges'}
            variant="error"
          />
        ) : null}
        {isLoading || ipv6RangesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CircleProgress size="sm" />
          </div>
        ) : (
          <>
            <Grid container size={12}>
              <Grid
                sx={{
                  [theme.breakpoints.down('md')]: {
                    display: 'none',
                  },
                }}
                data-qa-transfer-ip-label
                size={{
                  sm: 3,
                  xs: 12,
                }}
              >
                <Typography>IP Address</Typography>
              </Grid>
              <Grid
                sx={{
                  pl: 0.5,
                  [theme.breakpoints.down('md')]: {
                    display: 'none',
                  },
                }}
              >
                <Typography>Actions</Typography>
              </Grid>
            </Grid>
            <Grid
              sx={{
                [theme.breakpoints.down('md')]: {
                  visibility: 'hidden',
                },
              }}
              size={12}
            >
              <Divider />
            </Grid>
            {linodes.length === 0 ? (
              <Typography
                sx={{
                  color: theme.color.grey1,
                  marginTop: theme.spacing(2),
                }}
              >
                You have no other linodes in this Linode&rsquo;s data center
                with which to transfer IPs.
              </Typography>
            ) : (
              <Grid spacing={2} size={12}>
                {Object.values(ips).map(ipRow)}
              </Grid>
            )}
          </>
        )}
      </Grid>
      <Grid
        container
        size={12}
        sx={{
          justifyContent: 'flex-end',
        }}
      >
        <ActionsPanel
          primaryButtonProps={{
            'data-testid': 'ip-transfer-save',
            disabled: readOnly || linodes.length === 0,
            label: 'Save',
            loading: submitting,
            onClick: onSubmit,
          }}
          secondaryButtonProps={{
            'data-testid': 'ip-transfer-reset',
            disabled: submitting || linodes.length === 0,
            label: 'Reset Form',
            onClick: onReset,
          }}
        />
      </Grid>
    </Dialog>
  );
};

const StyledAutoGrid = styled(Grid, { label: 'StyledAutoGrid' })(
  ({ theme }) => ({
    minWidth: 175,
    [theme.breakpoints.up('sm')]: {
      flexBasis: 'auto',
      maxWidth: 'auto',
    },
  })
);

const L = {
  ip: (ip: string) => lensPath([ip]),
  mode: (ip: string) => lensPath([ip, 'mode']),
  selectedIP: (ip: string) => lensPath([ip, 'selectedIP']),
  selectedLinodeID: (ip: string) => lensPath([ip, 'selectedLinodeID']),
  selectedLinodesIPs: (ip: string) => lensPath([ip, 'selectedLinodesIPs']),
  sourceIP: (ip: string) => lensPath([ip, 'sourceIP']),
  sourceIPsLinodeID: (ip: string) => lensPath([ip, 'sourceIPsLinodeID']),
};

const setMode = (ip: string, mode: Mode) => set(L.mode(ip), mode);

const setSelectedIP = (ip: string, selectedIP: string) =>
  set(L.selectedIP(ip), selectedIP);

const setSelectedLinodeID = (ip: string, selectedLinodeID: number | string) =>
  set(L.selectedLinodeID(ip), selectedLinodeID);

const updateSelectedLinodesIPs = (ip: string, fn: (s: string[]) => string[]) =>
  over(L.selectedLinodesIPs(ip), fn);

const updateSelectedIP = (ip: string, fn: (a: string) => string | undefined) =>
  over(L.selectedIP(ip), fn);

const updateIPState = (ip: string, fn: (v: IPStates) => IPStates) =>
  over(L.ip(ip), fn);

const isMoving = (mode: Mode) => mode === 'move';

const isSwapping = (mode: Mode) => mode === 'swap';

const isNone = (mode: Mode) => mode === 'none';

const isNoneState = (state: Move | NoAction | Swap): state is NoAction =>
  state.mode === 'none';

const isMoveState = (state: Move | NoAction | Swap): state is Move =>
  state.mode === 'move';

const isSwapState = (state: Move | NoAction | Swap): state is Swap =>
  state.mode === 'swap';

const stateToAssignmentsReducer = (
  assignments: { address: string; linode_id: number }[],
  current: IPStates
) => {
  if (isMoveState(current)) {
    return [
      ...assignments,
      {
        address: current.sourceIP,
        linode_id: current.selectedLinodeID,
      },
    ];
  }

  if (isSwapState(current)) {
    return [
      ...assignments,
      {
        address: current.sourceIP,
        linode_id: current.selectedLinodeID,
      },
      {
        address: current.selectedIP,
        linode_id: current.sourceIPsLinodeID,
      },
    ];
  }

  return assignments;
};

const createRequestData = (state: IPRowState, region: string) => ({
  assignments: Object.values(state).reduce(stateToAssignmentsReducer, []),
  region,
});
