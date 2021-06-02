import * as dotenv from 'dotenv';
import * as path from 'path';
import { IntegrationConfig } from '../src/config';

if (process.env.LOAD_ENV) {
  dotenv.config({
    path: path.join(__dirname, '../.env'),
  });
}
const DEFAULT_GITHUB_APP_ID = 999999;
const DEFAULT_GITHUB_APP_LOCAL_PRIVATE_KEY_PATH = '/fakey/mcfake.pem';
const DEFAULT_INSTALLATION_ID = 99999999;

export const integrationConfig: IntegrationConfig = {
  githubAppId: Number(process.env.GITHUB_APP_ID) || DEFAULT_GITHUB_APP_ID,
  githubAppLocalPrivateKeyPath:
    process.env.GITHUB_APP_LOCAL_PRIVATE_KEY_PATH ||
    DEFAULT_GITHUB_APP_LOCAL_PRIVATE_KEY_PATH,
  githubAppPrivateKey: '',
  installationId:
    Number(process.env.INSTALLATION_ID) || DEFAULT_INSTALLATION_ID,
  analyzeCommitApproval: true,
};
