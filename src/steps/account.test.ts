import { Recording } from '@jupiterone/integration-sdk-testing';
import { sanitizeConfig } from '../config';
import { DATA_ACCOUNT_ENTITY, accountSteps } from './account';
import { integrationConfig } from '../../test/config';
import { invocationConfig } from '..';
import { setupGithubRecording } from '../../test/recording';
import { executeStepWithDependencies } from '../../test/executeStepWithDependencies';
import { GithubEntities } from '../constants';

let recording: Recording;
afterEach(async () => {
  await recording.stop();
});

test('fetchAccountDetails exec handler', async () => {
  recording = setupGithubRecording({
    directory: __dirname,
    name: 'account', //redaction of headers is in setupGithubRecording
  });
  sanitizeConfig(integrationConfig);
  integrationConfig.installationId = 17214088; //this is the id the recordings are under

  const {
    collectedEntities,
    collectedRelationships,
    encounteredTypes,
    jobState,
  } = await executeStepWithDependencies({
    stepId: accountSteps[0].id,
    invocationConfig: invocationConfig as any,
    instanceConfig: integrationConfig,
  });

  expect({
    numCollectedEntities: collectedEntities.length,
    numCollectedRelationships: collectedRelationships.length,
    collectedEntities: collectedEntities,
    collectedRelationships: collectedRelationships,
    encounteredTypes: encounteredTypes,
  }).toMatchSnapshot();

  const accounts = collectedEntities.filter((e) =>
    e._type.includes('github_account'),
  );

  expect(accounts.length).toEqual(1);
  expect(accounts).toMatchGraphObjectSchema(GithubEntities.GITHUB_ACCOUNT);

  const entityFromConstant = await jobState.getData(DATA_ACCOUNT_ENTITY);
  expect(entityFromConstant).toEqual(accounts[0]);
});
