import OrganizationAccountClient from '../client/OrganizationAccountClient';
import {
  UserEntity,
  AccountEntity,
  PullsListResponseItem,
  PullsListCommitsResponseItem,
  PullsListReviewsResponseItem,
} from '../types';
import getCommitsToDestination from './getCommitsToDestination';

export interface Approval {
  commit: string;
  approverUsernames: string[];
}

export interface PRApprovalData {
  allCommits: PullsListCommitsResponseItem[];
  commitsByUnknownAuthor: PullsListCommitsResponseItem[];
  approvedCommits: PullsListCommitsResponseItem[];
  approvals: Approval[];
}

export default async function collectCommitsForPR(
  github: OrganizationAccountClient,
  account: AccountEntity,
  pr: PullsListResponseItem,
  /**
   * The members of the organization that the PR belongs to.
   *
   * This property is optional because we may be syncing in an organization or
   * in an individual's account. If we are syncing in an organization context,
   * we should provide the approval calculation code with the members of the
   * organization team so that it can discard commits and approvals from users
   * outside of the team. If we are in an account context, there are no team
   * members, so anything goes (but in the future, we may want to limit valid
   * commit authors and approvers to repo contributors).
   */
  teamMembers?: UserEntity[]
): Promise<PRApprovalData> {
  const teamMemberLogins = toLogins(teamMembers);

  const commits = await github.getPullRequestCommits(account, pr);
  const reviews = await github.getPullRequestReviews(account, pr);
  const approvals = reviews
    .filter(isApprovalReview)
    .reduce(addReviewToApprovals, [])
    .filter(
      approval =>
        hasTeamApprovals(approval, teamMemberLogins) &&
        hasPeerApprovals(approval, commits)
    );

  let approvedCommits: PullsListCommitsResponseItem[] = [];
  if (approvals.length > 0) {
    approvedCommits = getCommitsToDestination(
      commits,
      approvals[approvals.length - 1].commit
    );
  }

  const commitsByUnknownAuthor = commits.filter(commit =>
    fromUnknownAuthor(commit, teamMemberLogins)
  );

  return {
    allCommits: commits,
    approvedCommits,
    commitsByUnknownAuthor,
    approvals,
  };
}

function toLogins(teamMembers?: UserEntity[]) {
  let teamMemberLogins: string[] | undefined;
  if (teamMembers) {
    teamMemberLogins = teamMembers.reduce(
      (logins: string[], member) => [...logins, member.login],
      []
    );
  }
  return teamMemberLogins;
}

function isApprovalReview(review: PullsListReviewsResponseItem) {
  return review.state === 'APPROVED' || review.state === 'DISMISSED';
}

function hasPeerApprovals(
  approval: Approval,
  commits: PullsListCommitsResponseItem[]
) {
  const associatedCommits = getCommitsToDestination(commits, approval.commit);
  const commitAuthors = associatedCommits.reduce(
    (authors: string[], commit) => [
      ...authors,
      commit.author ? commit.author.login : '',
    ],
    []
  );
  const validApprovers = approval.approverUsernames.filter(
    approver => !commitAuthors.includes(approver)
  );
  return validApprovers.length > 0;
}

function userOutsideOfTeam(login: string, teamMembers: string[]) {
  return !teamMembers.includes(login);
}

function hasTeamApprovals(approval: Approval, teamMembers?: string[]) {
  if (!teamMembers) {
    return true;
  }

  const teamApprovers = approval.approverUsernames.filter(approver =>
    teamMembers.includes(approver)
  );
  return teamApprovers.length > 0;
}

function fromUnknownAuthor(
  commit: PullsListCommitsResponseItem,
  teamMembers?: string[]
) {
  if (!commit.author) {
    return true;
  }

  if (teamMembers) {
    return userOutsideOfTeam(commit.author.login, teamMembers);
  }

  return false;
}

function addReviewToApprovals(
  approvals: Approval[],
  approvalReview: PullsListReviewsResponseItem
) {
  if (!approvalReview.user) {
    // If an approval has no user, don't count it as valid
    return approvals;
  }

  const existingApproval = approvals.find(
    approval => approval.commit === approvalReview.commit_id
  );

  if (existingApproval) {
    existingApproval.approverUsernames.push(approvalReview.user.login);
    return approvals;
  } else {
    const approval: Approval = {
      commit: approvalReview.commit_id,
      approverUsernames: [approvalReview.user.login],
    };
    return [...approvals, approval];
  }
}
