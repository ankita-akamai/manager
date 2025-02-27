import { recycleClusterNodes } from '@linode/api-v4/lib/kubernetes';
import { Typography } from '@linode/ui';
import { useSnackbar } from 'notistack';
import * as React from 'react';

import { ActionsPanel } from 'src/components/ActionsPanel/ActionsPanel';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog/ConfirmationDialog';
import {
  getNextVersion,
  useLkeStandardOrEnterpriseVersions,
} from 'src/features/Kubernetes/kubeUtils';
import { useKubernetesClusterMutation } from 'src/queries/kubernetes';

import { localStorageWarning } from './constants';

import type { KubernetesTier } from '@linode/api-v4/lib/kubernetes';

interface Props {
  clusterID: number;
  clusterLabel: string;
  clusterTier: KubernetesTier;
  currentVersion: string;
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeDialog = (props: Props) => {
  const {
    clusterID,
    clusterLabel,
    clusterTier,
    currentVersion,
    isOpen,
    onClose,
  } = props;

  const { enqueueSnackbar } = useSnackbar();

  const { mutateAsync: updateKubernetesCluster } = useKubernetesClusterMutation(
    clusterID
  );

  const { versions } = useLkeStandardOrEnterpriseVersions(clusterTier);

  const nextVersion = getNextVersion(currentVersion, versions ?? []);

  const [hasUpdatedSuccessfully, setHasUpdatedSuccessfully] = React.useState(
    false
  );

  const [error, setError] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setError(undefined);
      setSubmitting(false);
      setHasUpdatedSuccessfully(false);
    }
  }, [isOpen]);

  const onSubmitUpgradeDialog = () => {
    if (!nextVersion) {
      setError('Your Kubernetes Cluster is already on the latest version.');
      return;
    }
    setSubmitting(true);
    setError(undefined);
    updateKubernetesCluster({
      k8s_version: nextVersion,
    })
      .then((_) => {
        setHasUpdatedSuccessfully(true);
        setSubmitting(false);
      })
      .catch((e) => {
        setSubmitting(false);
        setError(e[0].reason);
      });
  };

  const onSubmitRecycleDialog = () => {
    setSubmitting(true);
    setError(undefined);
    recycleClusterNodes(clusterID)
      .then((_) => {
        enqueueSnackbar('Recycle started successfully.', {
          variant: 'success',
        });
        onClose();
      })
      .catch((e) => {
        setSubmitting(false);
        setError(e[0].reason);
      });
  };

  const dialogTitle = hasUpdatedSuccessfully
    ? `Step 2: Recycle All Cluster Nodes`
    : `Step 1: Upgrade ${clusterLabel} to Kubernetes ${nextVersion}`;

  const actions = (
    <ActionsPanel
      primaryButtonProps={{
        'data-testid': 'confirm',
        label: hasUpdatedSuccessfully ? 'Recycle All Nodes' : 'Upgrade Version',
        loading: submitting,
        onClick: hasUpdatedSuccessfully
          ? onSubmitRecycleDialog
          : onSubmitUpgradeDialog,
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
      error={error}
      onClose={onClose}
      open={isOpen}
      title={dialogTitle}
    >
      <Typography>
        {hasUpdatedSuccessfully ? (
          <>
            Kubernetes version has been updated successfully. <br /> <br />
            For the changes to take full effect you must recycle the nodes in
            your cluster. {localStorageWarning}
          </>
        ) : (
          <>
            Upgrade {clusterLabel}&rsquo;s Kubernetes version from{' '}
            <strong>{currentVersion}</strong> to <strong>{nextVersion}</strong>?
            Once the upgrade is complete you will need to recycle all nodes in
            your cluster.
          </>
        )}
      </Typography>
    </ConfirmationDialog>
  );
};

export default React.memo(UpgradeDialog);
