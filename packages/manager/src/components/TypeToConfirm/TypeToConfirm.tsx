import { Checkbox, FormControlLabel, TextField, Typography } from '@linode/ui';
import * as React from 'react';

import { FormGroup } from 'src/components/FormGroup';
import { Link } from 'src/components/Link';

import type { TextFieldProps } from '@linode/ui';
import type { Theme } from '@mui/material';
import type { SxProps } from '@mui/material';

export interface TypeToConfirmProps extends Omit<TextFieldProps, 'onChange'> {
  confirmationText?: JSX.Element | string;
  expand?: boolean;
  handleDeleteAccountServices?: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  hideInstructions?: boolean;
  isCloseAccount?: boolean;
  onChange: (value: string) => void;
  textFieldStyle?: React.CSSProperties;
  title?: string;
  typographyStyle?: React.CSSProperties;
  typographyStyleSx?: SxProps<Theme>;
  visible?: boolean | undefined;
}

export const TypeToConfirm = (props: TypeToConfirmProps) => {
  const {
    confirmationText,
    expand,
    handleDeleteAccountServices,
    hideInstructions,
    isCloseAccount,
    onChange,
    textFieldStyle,
    title,
    typographyStyle,
    typographyStyleSx,
    visible,
    ...rest
  } = props;

  /*
    There was an edge case bug where, when preferences?.type_to_confirm was undefined,
    the type-to-confirm input did not appear and the language in the instruction text
    did not match. If 'visible' is not explicitly false, we treat it as true.
  */

  const showTypeToConfirmInput = visible !== false;
  const disableOrEnable = showTypeToConfirmInput ? 'disable' : 'enable';

  return (
    <>
      {showTypeToConfirmInput ? (
        <>
          <Typography variant="h2">{title}</Typography>
          <Typography style={typographyStyle} sx={typographyStyleSx}>
            {confirmationText}
          </Typography>
          {isCloseAccount && (
            <FormGroup
              sx={(theme) => ({
                marginTop: theme.tokens.spacing[20],
                paddingLeft: theme.tokens.spacing[10],
              })}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    name="services"
                    onChange={handleDeleteAccountServices}
                  />
                }
                data-qa-checkbox="deleteAccountServices"
                label="Delete all account services and entities (Linodes, volumes, DNS records, etc.)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    name="users"
                    onChange={handleDeleteAccountServices}
                  />
                }
                data-qa-checkbox="deleteAccountUsers"
                label="Delete all user accounts, including your own."
              />
            </FormGroup>
          )}
          <TextField
            onChange={(e) => onChange(e.target.value)}
            style={textFieldStyle}
            {...rest}
            expand={expand}
          />
        </>
      ) : null}
      {!hideInstructions ? (
        <Typography
          data-testid="instructions-to-enable-or-disable"
          sx={{ marginTop: 1 }}
        >
          To {disableOrEnable} type-to-confirm, go to the Type-to-Confirm
          section of <Link to="/profile/settings">My Settings</Link>.
        </Typography>
      ) : null}
    </>
  );
};
