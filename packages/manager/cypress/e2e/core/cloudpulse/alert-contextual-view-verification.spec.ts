/**
 * @file Integration Tests for contextual view of Entity Listing.
 */
import { mockAppendFeatureFlags } from 'support/intercepts/feature-flags';
import {
  mockAddEntityToAlert,
  mockDeleteEntityFromAlert,
  mockGetAlertDefinition,
} from 'support/intercepts/cloudpulse';
import { widgetDetails } from 'support/constants/widgets';
import { accountFactory, alertFactory, databaseFactory } from 'src/factories';
import { mockGetAccount } from 'support/intercepts/account';
import {
  AlertDefinitionType,
  Database,
  MetricAggregationType,
} from '@linode/api-v4';
import {
  mockGetDatabase,
  mockGetDatabaseTypes,
} from 'support/intercepts/databases';
import { mockDatabaseNodeTypes } from 'support/constants/databases';
import { RecPartial } from 'factory.ts';
import { ui } from 'support/ui';

const DBaaS = 'dbaas';
const ALERT_TYPE = 'alert-definition-id';

// Mock data
const { region, engine, clusterName } = widgetDetails.dbaas;
const mockAccount = accountFactory.build();
const databaseMock: Database = databaseFactory.build({
  label: clusterName,
  id: 100,
  type: engine,
  region: region,
  status: 'active',
  cluster_size: 3,
  engine: 'mysql',
});

const alertConfigs = [
  {
    type: 'system',
    created_by: 'user1',
    metric: 'CPU Usage',
    aggregate_function: 'avg' as RecPartial<MetricAggregationType>,
    threshold: 55,
  },
  {
    type: 'user',
    created_by: 'user2',
    metric: 'Memory Usage',
    aggregate_function: 'min' as RecPartial<MetricAggregationType>,
    threshold: 100,
  },
  {
    type: 'system',
    created_by: 'user3',
    metric: 'Disk Usage',
    aggregate_function: 'sum' as RecPartial<MetricAggregationType>,
    threshold: 75,
  },
  {
    type: 'user',
    created_by: 'user4',
    metric: 'Network Usage',
    aggregate_function: 'max' as RecPartial<MetricAggregationType>,
    threshold: 90,
  },
];
const alerts = alertConfigs.flatMap((config) =>
  alertFactory.build({
    service_type: DBaaS,
    severity: 1,
    status: 'enabled',
    type: config.type as AlertDefinitionType,
    created_by: config.created_by,
    rule_criteria: {
      rules: [
        {
          aggregate_function: config.aggregate_function,
          metric: config.metric,
          label: config.metric,
          operator: 'gt',
          threshold: config.threshold,
          unit: 'Bytes',
        },
      ],
    },
  })
);

// Verify Sorting Function
const verifyTableSorting = (
  header: string,
  sortOrder: 'ascending' | 'descending',
  expectedValues: number[]
) => {
  ui.heading
    .findByText(header)
    .click()
    .should('have.attr', 'aria-sort', sortOrder);
  cy.get('[data-qa="alert-table"]').within(() => {
    cy.get('[data-qa-alert-cell]').should(($cells) => {
      const actualOrder = $cells
        .map((_, cell) => parseInt(cell.getAttribute('data-qa-alert-cell')!, 5))
        .get();
      expectedValues.forEach((value, index) =>
        expect(actualOrder[index]).to.equal(value)
      );
    });
  });
};

// Sorting cloums and expected values
const sortCases = [
  { column: 'label', descending: [4, 3, 2, 1], ascending: [1, 2, 3, 4] },
  { column: 'id', descending: [4, 3, 2, 1], ascending: [1, 2, 3, 4] },
  { column: 'type', descending: [2, 4, 1, 3], ascending: [1, 3, 2, 4] },
];

/*
 * - Mocks feature flags, account data, and necessary API calls for database alerts.
 * - Visits the database alerts page after login.
 * - Verifies that the correct tooltip message appears on the page.
 * - Verifies that the 'Manage Alerts' button is visible and accessible.
 * - Confirms that each alert in the table has a valid hyperlink with the correct ID and text.
 * - Simulates searching for alerts using the label and verifies that the corresponding alert is visible.
 * - Clears the search and confirms that all alerts are visible again.
 * - Filters alerts by type and confirms that only the relevant alerts are visible.
 * - Enables the first alert by checking the checkbox and clicking the "Enable" button.
 * - Asserts that the correct API response is received for enabling the alert and confirms success message.
 * - Disables the first alert by unchecking the checkbox and clicking the "Disable" button.
 * - Asserts that the correct API response is received for disabling the alert and confirms success message.
 * - Verifies that sorting by different columns (ID, label, type) works as expected with ascending and descending orders.
 */

it('should verify sorting, alert management, and search functionality for contextual view of entity listing.', () => {
  mockAppendFeatureFlags({ aclp: { beta: true, enabled: true } });
  mockGetAccount(mockAccount);
  mockGetDatabase(databaseMock).as('getDatabase');
  mockGetDatabaseTypes(mockDatabaseNodeTypes).as('getDatabaseTypes');
  mockGetAlertDefinition(DBaaS, alerts).as('getDBaaSAlertDefinitions');
  mockAddEntityToAlert(DBaaS, '100', { [ALERT_TYPE]: 100 }).as(
    'addEntityToAlert'
  );
  mockDeleteEntityFromAlert(DBaaS, '100', 1).as('deleteEntityToAlert');

  // Visit the database alerts page
  cy.visitWithLogin(
    `/databases/${databaseMock.engine}/${databaseMock.id}/alerts`
  );
  cy.wait('@getDBaaSAlertDefinitions');

  // Test sorting
  sortCases.forEach(({ column, descending, ascending }) => {
    verifyTableSorting(column, 'descending', descending);
    verifyTableSorting(column, 'ascending', ascending);
  });

  // Tooltip and UI Element Verifications
  ui.tooltip
    .findByText(
      'The list contains only the alerts enabled in the Monitor centralized view.'
    )
    .should('be.visible');
  ui.buttonGroup.findButtonByTitle('Manage Alerts').should('be.visible');

  // Alert Links Verification
  [1, 2, 3, 4].forEach((id) => {
    cy.get(`[data-qa-alert-cell="${id}"]`).within(() => {
      cy.get('a')
        .should(
          'have.attr',
          'href',
          `/monitor/alerts/definitions/detail/${DBaaS}/${id}`
        )
        .and('have.text', `Alert-${id}`);
    });
  });

  // Search Functionality Test
  cy.findByPlaceholderText('Search for Alerts')
    .should('be.visible')
    .type(alerts[0].label);
  cy.get(`[data-qa-alert-cell="${alerts[0].id}"]`).should('be.visible');
  [1, 2, 3].forEach((index) =>
    cy.get(`[data-qa-alert-cell="${alerts[index].id}"]`).should('not.exist')
  );

  // Clear Search
  cy.findByPlaceholderText('Search for Alerts').should('be.visible').clear();

  // Select Alert Type Test
  cy.findByPlaceholderText('Select Alert Type')
    .should('be.visible')
    .type(`${alerts[0].type}{enter}`);
  cy.get(`[data-qa-alert-cell="${alerts[0].id}"]`).should('be.visible');
  [1, 3].forEach((index) =>
    cy.get(`[data-qa-alert-cell="${alerts[index].id}"]`).should('not.exist')
  );

  // Enable Alert
  cy.get('[data-qa-alert-cell="1"]')
    .find('[data-qa-toggle="false"]')
    .find('[type="checkbox"]')
    .check();
  cy.get('[data-testid="button"]')
    .should('be.enabled')
    .contains('Enable')
    .click();

  // Assert successful API call for disabling the alert
  cy.wait('@addEntityToAlert').then(({ response }) => {
    expect(response).to.have.property('statusCode', 200);
    ui.toast.assertMessage(
      'The alert settings for mysql-cluster saved successfully.'
    );
  });

  // Disable Alert
  cy.get('[data-qa-alert-cell="1"]')
    .find('[data-qa-toggle="true"]')
    .find('[type="checkbox"]')
    .uncheck();
  cy.get('[data-testid="button"]')
    .should('be.enabled')
    .contains('Disable')
    .click();

  // Assert successful API call for disabling the alert
  cy.wait('@deleteEntityToAlert').then(({ response }) => {
    expect(response).to.have.property('statusCode', 200);
    ui.toast.assertMessage(
      'The alert settings for mysql-cluster saved successfully.'
    );
  });
});
