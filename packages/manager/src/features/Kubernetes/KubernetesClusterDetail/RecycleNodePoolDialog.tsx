import { Typography } from '@linode/ui';
import { useSnackbar } from 'notistack';
import * as React from 'react';

import { ActionsPanel } from 'src/components/ActionsPanel/ActionsPanel';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog/ConfirmationDialog';
import { localStorageWarning } from 'src/features/Kubernetes/constants';
import { useRecycleNodePoolMutation } from 'src/queries/kubernetes';

interface Props {
  clusterId: number;
  nodePoolId: number;
  onClose: () => void;
  open: boolean;
}

export const RecycleNodePoolDialog = (props: Props) => {
  const { clusterId, nodePoolId, onClose, open } = props;

  const { enqueueSnackbar } = useSnackbar();

  const { error, isPending, mutateAsync } = useRecycleNodePoolMutation(
    clusterId,
    nodePoolId
  );

  const onRecycle = () => {
    mutateAsync().then(() => {
      enqueueSnackbar(`Recycled all nodes in node pool ${nodePoolId}`, {
        variant: 'success',
      });
      onClose();
    });
  };

  const actions = (
    <ActionsPanel
      primaryButtonProps={{
        'data-testid': 'confirm',
        label: 'Recycle Pool Nodes',
        loading: isPending,
        onClick: onRecycle,
      }}
      secondaryButtonProps={{
        'data-testid': 'cancel',
        label: 'Cancel',
        onClick: onClose,
      }}
      style={{ padding: 0 }}
    />
  );

  return (
    <ConfirmationDialog
      actions={actions}
      error={error?.[0].reason}
      onClose={onClose}
      open={open}
      title="Recycle node pool?"
    >
      <Typography>
        Redeploy all nodes in the node pool. {localStorageWarning} This may take
        several minutes, as nodes will be replaced on a rolling basis.
      </Typography>
    </ConfirmationDialog>
  );
};
