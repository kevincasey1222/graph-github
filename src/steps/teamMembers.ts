import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { createAPIClient } from '../client';
import { IntegrationConfig } from '../config';
import { toOrganizationMemberEntityFromTeamMember } from '../sync/converters';
import { TeamMemberRole } from '../client/GraphQLClient';
import {
  GithubEntities,
  GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
  GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
} from '../constants';
import { TeamEntity } from '../types';

export async function fetchTeamMembers({
  instance,
  logger,
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const config = instance.config;
  const apiClient = createAPIClient(config, logger);

  await jobState.iterateEntities(
    { _type: GithubEntities.GITHUB_TEAM._type },
    async (teamEntity: TeamEntity) => {
      await apiClient.iterateTeamMembers(teamEntity, async (user) => {
        if (!(await jobState.hasKey(user.id))) {
          //somehow this team has a user we didn't know about
          //shouldn't happen, except through weird timing, but we'll make an entry
          await jobState.addEntity(
            toOrganizationMemberEntityFromTeamMember(user),
          );
        }

        const teamMemberRelationship = createDirectRelationship({
          _class: RelationshipClass.HAS,
          fromType: GithubEntities.GITHUB_TEAM._type,
          toType: GithubEntities.GITHUB_MEMBER._type,
          fromKey: user.teams, //a single team key
          toKey: user.id,
        });

        if (jobState.hasKey(teamMemberRelationship._key)) {
          logger.warn(
            {
              teamId: teamEntity.id,
              teamKey: teamEntity._key,
              teamName: teamEntity.name,
              teamRepoTeamKey: user.teams,
              teamRepoId: user.id,
              relationshipKey: teamMemberRelationship._key,
            },
            'Member-team relationship was already ingested: Skipping.',
          );
        } else {
          await jobState.addRelationship(teamMemberRelationship);
        }

        if (user.role === TeamMemberRole.Maintainer) {
          const maintainerTeamRelationship = createDirectRelationship({
            _class: RelationshipClass.MANAGES,
            fromType: GithubEntities.GITHUB_MEMBER._type,
            toType: GithubEntities.GITHUB_TEAM._type,
            fromKey: user.id,
            toKey: user.teams,
          });

          if (jobState.hasKey(maintainerTeamRelationship._key)) {
            logger.warn(
              {
                teamId: teamEntity.id,
                teamKey: teamEntity._key,
                teamName: teamEntity.name,
                teamRepoTeamKey: user.teams,
                teamRepoId: user.id,
                relationshipKey: maintainerTeamRelationship._key,
              },
              'Maintainer-team relationship was already ingested: Skipping.',
            );
          } else {
            await jobState.addRelationship(maintainerTeamRelationship);
          }
        }
      });
    },
  );
}

export const teamMemberSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: 'fetch-team-members',
    name: 'Fetch Team Members',
    entities: [],
    relationships: [
      {
        _type: GITHUB_TEAM_MEMBER_RELATIONSHIP_TYPE,
        _class: RelationshipClass.HAS,
        sourceType: GithubEntities.GITHUB_TEAM._type,
        targetType: GithubEntities.GITHUB_MEMBER._type,
      },
      {
        _type: GITHUB_MEMBER_TEAM_RELATIONSHIP_TYPE,
        _class: RelationshipClass.MANAGES,
        sourceType: GithubEntities.GITHUB_MEMBER._type,
        targetType: GithubEntities.GITHUB_TEAM._type,
      },
    ],
    dependsOn: ['fetch-teams', 'fetch-users'],
    executionHandler: fetchTeamMembers,
  },
];
