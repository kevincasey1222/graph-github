import * as dotenv from 'dotenv';
import * as path from 'path';
import { IntegrationConfig } from '../src/config';

if (process.env.LOAD_ENV) {
  dotenv.config({
    path: path.join(__dirname, '../.env'),
  });
}
const DEFAULT_GITHUB_APP_ID = 999999;
const DEFAULT_INSTALLATION_ID = 99999999;
const DEFAULT_APP_PRIVATE_KEY = 'donotauthenticate';

export const integrationConfig: IntegrationConfig = {
  githubAppId: Number(process.env.GITHUB_APP_ID) || DEFAULT_GITHUB_APP_ID,
  githubAppPrivateKey: DEFAULT_APP_PRIVATE_KEY,
  installationId:
    Number(process.env.INSTALLATION_ID) || DEFAULT_INSTALLATION_ID,
  analyzeCommitApproval: true,
  githubAppDefaultLogin: 'something', //can be set manually in tests
};
