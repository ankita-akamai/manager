import type { AlertsEngineOptionProps } from './AlertsEngineTypeFilter';
import type { AlertsRegionProps } from './AlertsRegionFilter';
import type { AlertsTagFilterProps } from './AlertsTagsFilter';
import type { AlertServiceType } from '@linode/api-v4';
import type { MemoExoticComponent } from 'react';

export interface ColumnConfig<T> {
  /**
   * Function to extract the value from a data object for display in the column.
   * @param data - The data object of type T.
   * @returns The string representation of the column value.
   */
  accessor: (data: T) => string | string[];

  /**
   * The label or title of the column to be displayed in the table header.
   */
  label: string;

  /**
   * Optional key used for sorting the column.
   * It should be a valid key from the data object of type T.
   */
  sortingKey?: keyof T;
}

export interface EngineType {
  id: string;
  label: string;
}

/**
 * Represents the column configurations for different service types.
 * Each key in the record corresponds to an AlertServiceType or an empty string (default).
 * The value is an array of ColumnConfig objects defining the table structure for that service type.
 * @template T - The type of data displayed in the table columns.
 */
export type ServiceColumns<T> = Record<
  '' | AlertServiceType,
  ColumnConfig<T>[]
>;

/**
 * Represents the possible types for alert filter values.
 * The filter value can be a boolean, number, string, or undefined.
 */
export type AlertFilterType = boolean | number | string | string[] | undefined;

/**
 * Defines the available filter keys that can be used to filter alerts.
 * This type will be extended in the future to include other attributes like tags, plan, etc.
 */
export type AlertFilterKey = 'engineType' | 'region' | 'tags';

export type AlertAdditionalFilterKey = 'engineType' | 'tags'; // will be extended to have tags, plan etc.,

export interface ServiceFilterConfig {
  component: MemoExoticComponent<
    React.ComponentType<
      AlertsEngineOptionProps | AlertsRegionProps | AlertsTagFilterProps
    >
  >;
  filterKey: AlertFilterKey;
}
