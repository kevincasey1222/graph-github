import {
  createMockStepExecutionContext,
  Recording,
} from '@jupiterone/integration-sdk-testing';
import { IntegrationConfig, sanitizeConfig } from '../config';
import { DATA_ACCOUNT_ENTITY, fetchAccountDetails } from './account';
import { integrationConfig } from '../../test/config';
import { setupGithubRecording } from '../../test/recording';

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

describe('fetchAccountDetails exec handler', () => {
  let accounts;
  let context;

  test('execution and snapshot', async () => {
    recording = setupGithubRecording({
      directory: __dirname,
      name: 'account', //redaction of headers is in setupGithubRecording
    });
    sanitizeConfig(integrationConfig);
    integrationConfig.installationId = 17214088; //this is the id the recordings are under
    context = createMockStepExecutionContext<IntegrationConfig>({
      instanceConfig: integrationConfig,
    });

    // Simulates dependency graph execution.
    // See https://github.com/JupiterOne/sdk/issues/262.
    await fetchAccountDetails(context);

    // Review snapshot, failure is a regression
    expect({
      numCollectedEntities: context.jobState.collectedEntities.length,
      numCollectedRelationships: context.jobState.collectedRelationships.length,
      collectedEntities: context.jobState.collectedEntities,
      collectedRelationships: context.jobState.collectedRelationships,
      encounteredTypes: context.jobState.encounteredTypes,
    }).toMatchSnapshot();

    accounts = context.jobState.collectedEntities.filter((e) =>
      e._class.includes('Account'),
    );
  });

  test('schema match', () => {
    expect(accounts.length).toEqual(1);
    expect(accounts).toMatchGraphObjectSchema({
      _class: ['Account'],
      schema: {
        additionalProperties: true,
        properties: {
          _type: { const: 'github_account' },
          accountType: { type: 'string' },
          accountId: { type: 'string' },
          login: { type: 'string' },
          _rawData: {
            type: 'array',
            items: { type: 'object' },
          },
        },
        required: ['accountId'],
      },
    });
  });

  test('jobState includes DATA_ACCOUNT_ENTITY', async () => {
    const entityFromConstant = await context.jobState.getData(
      DATA_ACCOUNT_ENTITY,
    );
    expect(entityFromConstant).toEqual(accounts[0]);
  });
});
