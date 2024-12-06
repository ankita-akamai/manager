import { Box, Chip, Typography } from '@linode/ui';
import React from 'react';

interface CloudPulseAppliedFilterProps {
  filters: {
    [label: string]: string[];
  };
}
export const CloudPulseAppliedFilter = (
  props: CloudPulseAppliedFilterProps
) => {
  const { filters } = props;

  return (
    <Box
      data-qa-applied-filter-id="applied-filter"
      data-testid="applied-filter"
      display="flex"
      flexDirection={{ sm: 'row', xs: 'column' }}
      flexWrap={{ sm: 'wrap', xs: 'nowrap' }}
      maxHeight="70px"
      mb={2}
      mx={3}
      overflow="auto"
      pb={2}
      rowGap={1.5}
    >
      {Object.entries(filters).map((data, index) => {
        const label = data[0];
        const filterValue = data[1];
        return (
          <React.Fragment key={index}>
            <Typography
              fontSize="14px"
              key={label}
              mr={1}
              variant="h3"
            >{`${label}:`}</Typography>
            {filterValue.map((value, index) => {
              return (
                <Chip
                  sx={{
                    backgroundColor: '#f0f7ff',
                    fontSize: '14px',
                    mr: index === filterValue.length - 1 ? 4 : 1,
                    px: 1,
                    py: 0.5,
                  }}
                  data-qa-value={`${label} ${value}`}
                  key={`${label} ${value}`}
                  label={value}
                />
              );
            })}
          </React.Fragment>
        );
      })}
    </Box>
  );
};
