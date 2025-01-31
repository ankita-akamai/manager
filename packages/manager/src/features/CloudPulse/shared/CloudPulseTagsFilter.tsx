import { Autocomplete } from '@linode/ui';
import React from 'react';

import { useAllLinodesQuery } from 'src/queries/linodes/linodes';
import { themes } from 'src/utilities/theme';

import { deepEqual } from '../Utils/FilterBuilder';

import type { FilterValueType } from '../Dashboard/CloudPulseDashboardLanding';
import type { Filter, FilterValue, Linode } from '@linode/api-v4';

export interface CloudPulseTags {
  label: string;
}

export interface CloudPulseTagsSelectProps {
  defaultValue?: Partial<FilterValue>;
  disabled?: boolean;
  handleTagsChange: (tags: CloudPulseTags[], savePref?: boolean) => void;
  label: string;
  optional?: boolean;
  placeholder?: string;
  region: FilterValueType;
  resourceType: string | undefined;
  savePreferences?: boolean;
  xFilter?: Filter;
}

export const CloudPulseTagsSelect = React.memo(
  (props: CloudPulseTagsSelectProps) => {
    const {
      defaultValue,
      disabled,
      handleTagsChange,
      label,
      optional,
      placeholder,
      region,
      resourceType,
      savePreferences,
      xFilter,
    } = props;

    const { data: linodesByRegion, isError, isLoading } = useAllLinodesQuery(
      {},
      xFilter ? xFilter : { region: region as string },
      !disabled && Boolean(region && resourceType)
    );

    // fetch all linode instances, consume the associated tags
    const tags = React.useMemo(() => {
      if (!linodesByRegion) {
        return undefined;
      }

      return Array.from(
        new Set(linodesByRegion.flatMap((linode: Linode) => linode.tags))
      )
        .sort()
        .map((tag) => ({ label: tag })) as CloudPulseTags[];
    }, [linodesByRegion]);

    const [selectedTags, setSelectedTags] = React.useState<CloudPulseTags[]>();

    const isAutocompleteOpen = React.useRef(false); // Ref to track the open state of Autocomplete

    React.useEffect(() => {
      if (!tags || !savePreferences || selectedTags) {
        if (selectedTags) {
          setSelectedTags([]);
          handleTagsChange([]);
        }
      } else {
        const defaultTags =
          defaultValue && Array.isArray(defaultValue)
            ? defaultValue.map((tag) => String(tag))
            : [];
        const filteredTags = tags.filter((tag) =>
          defaultTags.includes(String(tag.label))
        );
        handleTagsChange(filteredTags);
        setSelectedTags(filteredTags);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tags, resourceType, region, xFilter]);

    return (
      <Autocomplete
        onChange={(e, tagSelections) => {
          setSelectedTags(tagSelections);

          if (!isAutocompleteOpen.current) {
            handleTagsChange(tagSelections, savePreferences);
          }
        }}
        onClose={() => {
          isAutocompleteOpen.current = false;
          handleTagsChange(selectedTags ?? [], savePreferences);
        }}
        onOpen={() => {
          isAutocompleteOpen.current = true;
        }}
        textFieldProps={{
          InputProps: {
            sx: {
              '::-webkit-scrollbar': {
                display: 'none',
              },
              maxHeight: '55px',
              msOverflowStyle: 'none',
              overflow: 'auto',
              scrollbarWidth: 'none',
              svg: {
                color: themes.light.color.grey3,
              },
            },
          },
          optional,
        }}
        autoHighlight
        clearOnBlur
        data-testid="tags-select"
        disabled={disabled}
        errorText={isError ? `Failed to fetch ${label || 'Tags'}.` : ''}
        label={label || 'Tags'}
        limitTags={1}
        loading={isLoading}
        multiple
        noMarginTop
        options={tags ?? []}
        placeholder={selectedTags?.length ? '' : placeholder || 'Select Tags'}
        value={selectedTags ?? []}
      />
    );
  },
  compareProps
);

function compareProps(
  prevProps: CloudPulseTagsSelectProps,
  nextProps: CloudPulseTagsSelectProps
): boolean {
  // these properties can be extended going forward
  const keysToCompare: (keyof CloudPulseTagsSelectProps)[] = [
    'region',
    'resourceType',
  ];

  for (const key of keysToCompare) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  if (!deepEqual(prevProps.xFilter, nextProps.xFilter)) {
    return false;
  }

  // Ignore function props in comparison
  return true;
}
