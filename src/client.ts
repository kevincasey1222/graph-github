import {
  IntegrationLogger,
  IntegrationValidationError,
  IntegrationProviderAuthenticationError,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from './config';
import { AccountType, TokenPermissions } from './types';
import getInstallation from './util/getInstallation';
import createGitHubAppClient from './util/createGitHubAppClient';
import OrganizationAccountClient from './client/OrganizationAccountClient';
import { GitHubGraphQLClient } from './client/GraphQLClient';
import resourceMetadataMap from './client/GraphQLClient/resourceMetadataMap';
import {
  OrgMemberQueryResponse,
  OrgRepoQueryResponse,
  OrgTeamQueryResponse,
  OrgQueryResponse,
  OrgTeamMemberQueryResponse,
} from './client/GraphQLClient';
import { Token } from 'graphql';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;

// Providers often supply types with their API libraries.

type AcmeUser = {
  id: string;
  name: string;
};

type AcmeGroup = {
  id: string;
  name: string;
  users?: Pick<AcmeUser, 'id'>[];
};

// Those can be useful to a degree, but often they're just full of optional
// values. Understanding the response data may be more reliably accomplished by
// reviewing the API response recordings produced by testing the wrapper client
// (below). However, when there are no types provided, it is necessary to define
// opaque types for each resource, to communicate the records that are expected
// to come from an endpoint and are provided to iterating functions.

/*
import { Opaque } from 'type-fest';
export type AcmeUser = Opaque<any, 'AcmeUser'>;
export type AcmeGroup = Opaque<any, 'AcmeGroup'>;
*/

/**
 * An APIClient maintains authentication state and provides an interface to
 * third party data APIs.
 *
 * It is recommended that integrations wrap provider data APIs to provide a
 * place to handle error responses and implement common patterns for iterating
 * resources.
 */
export class APIClient {
  accountClient: OrganizationAccountClient;
  constructor(
    readonly config: IntegrationConfig,
    readonly logger: IntegrationLogger,
  ) {}

  public async verifyAuthentication(): Promise<void> {
    // the most light-weight request possible to validate
    // authentication works with the provided credentials, throw an err if
    // authentication fails
    await this.setupAccountClient();
  }

  public async getAccountDetails(): Promise<OrgQueryResponse> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    return await this.accountClient.getAccount();
  }

  /**
   * Iterates each user resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateMembers(
    iteratee: ResourceIteratee<OrgMemberQueryResponse>,
  ): Promise<void> {
    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const members: OrgMemberQueryResponse[] = await this.accountClient.getMembers();

    for (const member of members) {
      await iteratee(member);
    }
    console.log(await this.accountClient.getTeams());
  }

  /**
   * Iterates each group resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateGroups(
    iteratee: ResourceIteratee<AcmeGroup>,
  ): Promise<void> {
    // TODO paginate an endpoint, invoke the iteratee with each record in the
    // page
    //
    // The provider API will hopefully support pagination. Functions like this
    // should maintain pagination state, and for each page, for each record in
    // the page, invoke the `ResourceIteratee`. This will encourage a pattern
    // where each resource is processed and dropped from memory.

    if (!this.accountClient) {
      await this.setupAccountClient();
    }
    const teams: OrgTeamQueryResponse[] = await this.accountClient.getTeams();

    for (const team of teams) {
      console.log(team);
      console.log(`justin case`);
      //await iteratee(team);
    }
  }

  public async setupAccountClient(): Promise<void> {
    try {
      const installationId = Number(this.config.installationId);
      const appClient = await createGitHubAppClient(
        installationId,
        this.logger,
      );
      const { token, permissions } = (await appClient.auth({
        type: 'installation',
      })) as {
        token: string;
        permissions: TokenPermissions;
      };

      if (
        !(permissions.members === 'read' || permissions.members === 'write')
      ) {
        throw new IntegrationValidationError(
          'Integration requires read access to organization members. See GitHub App permissions.',
        );
      }

      if (
        !(permissions.metadata === 'read' || permissions.metadata === 'write')
      ) {
        //as of now, this property has no 'write' value, but just in case
        throw new IntegrationValidationError(
          'Integration requires read access to repository metadata. See GitHub App permissions.',
        );
      }

      const installation = await getInstallation(appClient, installationId);

      if (installation.target_type !== AccountType.Org) {
        throw new IntegrationValidationError(
          'Integration supports only GitHub Organization accounts.',
        );
      }

      this.accountClient = new OrganizationAccountClient({
        login: installation.account.login,
        restClient: appClient,
        graphqlClient: new GitHubGraphQLClient(
          token,
          resourceMetadataMap(),
          this.logger,
        ),
        logger: this.logger,
        analyzeCommitApproval: this.config.analyzeCommitApproval,
      });
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: `https://api.github.com/app/installations/${this.config.installation_id}/access_tokens`,
        status: err.status,
        statusText: err.statusText,
      });
    }
  }
}

export function createAPIClient(
  config: IntegrationConfig,
  logger: IntegrationLogger,
): APIClient {
  return new APIClient(config, logger);
}
