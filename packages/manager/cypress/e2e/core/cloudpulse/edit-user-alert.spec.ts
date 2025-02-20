/**
 * @file Integration Tests for the CloudPulse Edit Alert Page.
 *
 * This file contains Cypress tests for the Edit Alert page of the CloudPulse application.
 * It verifies that alert details are correctly displayed, interactive, and editable.
 */

import { mockAppendFeatureFlags } from 'support/intercepts/feature-flags';
import {
  accountFactory,
  alertDefinitionFactory,
  alertFactory,
  cpuRulesFactory,
  dashboardMetricFactory,
  databaseFactory,
  memoryRulesFactory,
  notificationChannelFactory,
  regionFactory,
  triggerConditionFactory,
} from 'src/factories';
import { mockGetAccount } from 'support/intercepts/account';
import type { Flags } from 'src/featureFlags';
import {
  mockCreateAlertDefinition,
  mockGetAlertChannels,
  mockGetAlertDefinitions,
  mockGetAllAlertDefinitions,
  mockGetCloudPulseMetricDefinitions,
  mockGetCloudPulseServices,
  mockUpdateAlertDefinitions,
} from 'support/intercepts/cloudpulse';
import { mockGetRegions } from 'support/intercepts/regions';
import { Database } from '@linode/api-v4';
import { mockGetDatabases } from 'support/intercepts/databases';
import { widgetDetails } from 'support/constants/widgets';
import { ui } from 'support/ui';

// Feature flag setup
const flags: Partial<Flags> = { aclp: { enabled: true, beta: true } };
const mockAccount = accountFactory.build();

// Mock alert definition
const customAlertDefinition = alertDefinitionFactory.build({
  channel_ids: [1],
  label: 'Alert-1',
  severity: 0,
  description: 'My Custom Description',
  entity_ids: ['2'],
  tags: [''],
  rule_criteria: {
    rules: [cpuRulesFactory.build(), memoryRulesFactory.build()],
  },
  trigger_conditions: triggerConditionFactory.build(),
});

// Mock alert details
const alertDetails = alertFactory.build({
  service_type: 'dbaas',
  alert_channels: [{ id: 1 }],
  label: 'Alert-1',
  type: 'user',
  severity: 0,
  description: 'My Custom Description',
  entity_ids: ['2'],
  updated: new Date().toISOString(),
  created_by: 'user1',
  tags: [''],
  rule_criteria: {
    rules: [cpuRulesFactory.build(), memoryRulesFactory.build()],
  },
  trigger_conditions: triggerConditionFactory.build(),
});

const { service_type, id, label, description } = alertDetails;

// Mock regions
const regions = [
  regionFactory.build({
    capabilities: ['Managed Databases'],
    id: 'us-ord',
    label: 'Chicago, IL',
  }),
  regionFactory.build({
    capabilities: ['Managed Databases'],
    id: 'us-east',
    label: 'Newark',
  }),
];

// Mock databases
const databases: Database[] = databaseFactory.buildList(5).map((db, index) => ({
  ...db,
  type: 'MySQL',
  region: regions[index % regions.length].id,
  status: 'active',
  engine: 'mysql',
  id: index,
}));

// Mock metric definitions
const { metrics } = widgetDetails.dbaas;
const metricDefinitions = metrics.map(({ title, name, unit }) =>
  dashboardMetricFactory.build({ label: title, metric: name, unit })
);

// Mock notification channels
const notificationChannels = notificationChannelFactory.build({
  channel_type: 'email',
  type: 'custom',
  label: 'Channel-1',
  id: 1,
});

const METRIC_DESCRIPTION_DATA_FIELD =
  'Represents the metric you want to receive alerts for. Choose the one that helps you evaluate performance of your service in the most efficient way. For multiple metrics we use the AND method by default.';
const SEVERITY_LEVEL_DESCRIPTION =
  'Define a severity level associated with the alert to help you prioritize and manage alerts in the Recent activity tab.';
const EVALUATION_PERIOD_DESCRIPTION =
  'Defines the timeframe for collecting data in polling intervals to understand the service performance. Choose the data lookback period where the thresholds are applied to gather the information impactful for your business.';
const POLLING_INTERVAL_DESCRIPTION =
  'Choose how often you intend to evaluate the alert condition.';

describe('Integration Tests for Edit Alert', () => {
  beforeEach(() => {
    mockAppendFeatureFlags(flags);
    mockGetAccount(mockAccount);
    mockGetRegions(regions);
    mockGetCloudPulseServices([alertDetails.service_type]);
    mockGetAllAlertDefinitions([alertDetails]).as('getAlertDefinitionsList');
    mockGetAlertDefinitions(service_type, id, alertDetails).as(
      'getAlertDefinitions'
    );
    mockGetDatabases(databases).as('getDatabases');
    mockUpdateAlertDefinitions(service_type, id, alertDetails).as(
      'updateDefinitions'
    );
    mockCreateAlertDefinition(service_type, customAlertDefinition);
    mockGetCloudPulseMetricDefinitions(service_type, metricDefinitions);
    mockGetAlertChannels([notificationChannels]);
  });

  // Define an interface for rule values
  interface RuleCriteria {
    dataField: string;
    aggregationType: string;
    operator: string;
    threshold: string;
  }

  // Mapping of interface keys to data attributes
  const fieldSelectors: Record<keyof RuleCriteria, string> = {
    dataField: 'data-field',
    aggregationType: 'aggregation-type',
    operator: 'operator',
    threshold: 'threshold',
  };

  // Function to assert rule values
  const assertRuleValues = (ruleIndex: number, rule: RuleCriteria) => {
    cy.get(`[data-testid="rule_criteria.rules.${ruleIndex}-id"]`).within(() => {
      (Object.keys(rule) as (keyof RuleCriteria)[]).forEach((key) => {
        cy.get(
          `[data-qa-metric-threshold="rule_criteria.rules.${ruleIndex}-${fieldSelectors[key]}"]`
        )
          .should('be.visible')
          .find('input')
          .should('have.value', rule[key]);
      });
    });
  };

  it('should correctly display the details of the alert in the Edit Alert page', () => {
    cy.visitWithLogin(`/monitor/alerts/definitions/edit/${service_type}/${id}`);
    cy.wait('@getAlertDefinitions');

    // Verify form fields
    cy.findByLabelText('Name').should('have.value', label);
    cy.findByLabelText('Description (optional)').should(
      'have.value',
      description
    );
    cy.findByLabelText('Service')
      .should('be.disabled')
      .should('have.value', 'Databases');
    cy.findByLabelText('Severity').should('have.value', 'Severe');

    // Verify alert resource selection
    cy.get('[data-qa-alert-table="true"]')
      .contains('[data-qa-alert-cell*="resource"]', 'database-3')
      .parents('tr')
      .find('[type="checkbox"]')
      .should('be.checked');

    // Verify alert resource selection count message
    cy.get('[data-qa-notice="true"]')
      .find('p')
      .should('have.text', '1 of 5 resources are selected.');

    // Assert rule values 1

    assertRuleValues(0, {
      dataField: 'CPU Utilization',
      aggregationType: 'Average',
      operator: '==',
      threshold: '1000',
    });

    // Assert rule values 2

    assertRuleValues(1, {
      dataField: 'Memory Usage',
      aggregationType: 'Average',
      operator: '==',
      threshold: '1000',
    });

    // Verify that tooltip messages are displayed correctly with accurate content.
    ui.tooltip.findByText(METRIC_DESCRIPTION_DATA_FIELD).should('be.visible');

    ui.tooltip.findByText(SEVERITY_LEVEL_DESCRIPTION).should('be.visible');

    ui.tooltip.findByText(EVALUATION_PERIOD_DESCRIPTION).should('be.visible');

    ui.tooltip.findByText(POLLING_INTERVAL_DESCRIPTION).should('be.visible');

    // Assert dimension filters
    const dimensionFilters = [
      { field: 'State of CPU', operator: 'Equal', value: 'User' },
    ];

    dimensionFilters.forEach((filter, index) => {
      cy.get(
        `[data-qa-dimension-filter="rule_criteria.rules.0.dimension_filters.${index}-data-field"]`
      )
        .should('be.visible')
        .find('input')
        .should('have.value', filter.field);

      cy.get(
        `[data-qa-dimension-filter="rule_criteria.rules.0.dimension_filters.${index}-operator"]`
      )
        .should('be.visible')
        .find('input')
        .should('have.value', filter.operator);

      cy.get(
        `[data-qa-dimension-filter="rule_criteria.rules.0.dimension_filters.${index}-value"]`
      )
        .should('be.visible')
        .find('input')
        .should('have.value', filter.value);
    });

    // Verify notification details
    cy.get('[data-qa-notification="notification-channel-0"]').within(() => {
      cy.get('[data-qa-channel="true"]').should('have.text', 'Channel-1');
      cy.get('[data-qa-type="true"]').next().should('have.text', 'Email');
      cy.get('[data-qa-channel-details="true"]').should(
        'have.text',
        'test@test.comtest2@test.com'
      );
    });
  });

  it.only('successfully updated alert details and verified that the API request matches the expected test data.', () => {
    cy.visitWithLogin(`/monitor/alerts/definitions/edit/${service_type}/${id}`);
    cy.wait('@getAlertDefinitions');

    cy.findByLabelText('Name').clear().type('Alert-2');

    cy.findByLabelText('Description (optional)')
      .clear()
      .type('update-description');
    cy.findByLabelText('Service').should('be.disabled');

    ui.autocomplete.findByLabel('Severity').clear().type('Info');
    ui.autocompletePopper.findByTitle('Info').should('be.visible').click();

    cy.get('[data-qa-notice="true"]').within(() => {
      ui.button.findByTitle('Select All').should('be.visible').click();
    });

    cy.get(
      '[data-qa-metric-threshold="rule_criteria.rules.0-data-field"]'
    ).within(() => {
      ui.button.findByAttribute('aria-label', 'Clear').click();
    });

    cy.get('[data-testid="rule_criteria.rules.0-id"]').within(() => {
      ui.autocomplete.findByLabel('Data Field').type('Disk I/O');
      ui.autocompletePopper.findByTitle('Disk I/O').click();
      ui.autocomplete.findByLabel('Aggregation Type').type('Minimum');
      ui.autocompletePopper.findByTitle('Minimum').click();
      ui.autocomplete.findByLabel('Operator').type('>');
      ui.autocompletePopper.findByTitle('>').click();
      cy.get('[data-qa-threshold]').should('be.visible').clear().type('2000');
    });

    // click on the submit button
    ui.buttonGroup
      .find()
      .find('button')
      .filter('[type="submit"]')
      .should('be.visible')
      .should('be.enabled')
      .click();

    cy.wait('@getAlertDefinitions').then(({ request }) => {
      // Validate top-level properties
      expect(request.body.label).to.equal('Alert-2');
      expect(request.body.description).to.equal('update-description');
      expect(request.body.severity).to.equal('Info');
    });
  });
});
