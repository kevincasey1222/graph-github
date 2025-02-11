import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { createRepoAllowsTeamRelationship } from '../sync/converters';
import {
  GithubEntities,
  GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
} from '../constants';
import { TeamEntity } from '../types';

export async function fetchTeamRepos({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  await jobState.iterateEntities(
    { _type: GithubEntities.GITHUB_TEAM._type },
    async (teamEntity: TeamEntity) => {
      await apiClient.iterateTeamRepos(teamEntity, async (teamRepo) => {
        //teamRepo.id is the repo id
        //teamRepo.teams is the team id
        if (
          (await jobState.hasKey(teamRepo.id)) &&
          (await jobState.hasKey(teamRepo.teams))
        ) {
          const repoTeamRelationship = createRepoAllowsTeamRelationship(
            teamRepo.id,
            teamEntity._key,
            teamRepo.permission,
          );
          if (jobState.hasKey(repoTeamRelationship._key)) {
            logger.warn(
              {
                teamId: teamEntity.id,
                teamKey: teamEntity._key,
                teamName: teamEntity.name,
                teamRepoTeamKey: teamRepo.teams,
                teamRepoId: teamRepo.id,
                relationshipKey: repoTeamRelationship._key,
              },
              'Repo-team relationship was already ingested: Skipping.',
            );
          } else {
            await jobState.addRelationship(repoTeamRelationship);
          }
        } else {
          logger.warn(
            { repoId: teamRepo.id, teamId: teamRepo.teams },
            `Could not build relationship between team and repo.`,
          );
        }
      });
    },
  );
}

export const teamRepoSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-team-repos',
    name: 'Fetch Team Repos',
    entities: [],
    relationships: [
      {
        _type: GITHUB_REPO_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.ALLOWS,
        sourceType: GithubEntities.GITHUB_REPO._type,
        targetType: GithubEntities.GITHUB_TEAM._type,
      },
    ],
    dependsOn: ['fetch-repos', 'fetch-teams'],
    executionHandler: fetchTeamRepos,
  },
];
