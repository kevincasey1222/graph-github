import {
  IntegrationExecutionContext,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import { validateInvocation, IntegrationConfig } from './config';

export default async function getStepStartStates(
  context: IntegrationExecutionContext<IntegrationConfig>,
): Promise<StepStartStates> {
  const scopes = await validateInvocation(context);

  return {
    ['fetch-account']: { disabled: false },
    ['fetch-users']: { disabled: false },
    ['fetch-repos']: { disabled: false },
    ['fetch-teams']: { disabled: false },
    ['fetch-team-members']: { disabled: false },
    ['fetch-team-repos']: { disabled: false },
    ['fetch-collaborators']: { disabled: false },
    ['fetch-prs']: { disabled: false },
    ['fetch-issues']: { disabled: !scopes.repoIssues },
    ['fetch-apps']: { disabled: !scopes.orgAdmin },
    ['fetch-environments']: { disabled: !scopes.repoEnvironments },
    ['fetch-org-secrets']: { disabled: !scopes.orgSecrets },
    ['fetch-repo-secrets']: { disabled: !scopes.repoSecrets },
    ['fetch-env-secrets']: {
      disabled: !scopes.repoSecrets || !scopes.repoEnvironments,
    },
  };
}
