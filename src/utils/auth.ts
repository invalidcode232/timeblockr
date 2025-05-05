import path from 'path';
import process from 'process';
import { authenticate } from '@google-cloud/local-auth';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

import type { JSONClient } from 'google-auth-library/build/src/auth/googleauth';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'credentials', 'token.json');
const CREDENTIALS_PATH = path.join(
    process.cwd(),
    'credentials',
    'credentials.json'
);

/**
 * Reads previously authorized credentials from the save file.
 *
 */
const loadSavedCredentialsIfExist = async (): Promise<JSONClient | null> => {
    const tokenFile = Bun.file(TOKEN_PATH);

    if (!(await tokenFile.exists())) {
        return null;
    }

    const credentials = await tokenFile.json();

    return google.auth.fromJSON(credentials);
};

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 */
const saveCredentials = async (client: OAuth2Client): Promise<void> => {
    const credentialFile = Bun.file(CREDENTIALS_PATH);

    if (!credentialFile.exists()) {
        throw new Error(
            'credentials file not found. please provide a valid credentials.json from Google Developer Console.'
        );
    }

    const keys = await credentialFile.json();

    const key = keys.installed || keys.web;

    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });

    await Bun.write(TOKEN_PATH, payload);
};

/**
 * Load or request or authorization to call APIs.
 *
 */
const authorize = async (): Promise<OAuth2Client | JSONClient> => {
    let client: JSONClient | OAuth2Client | null =
        await loadSavedCredentialsIfExist();

    if (client) {
        return client;
    }

    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });

    if (client?.credentials) {
        await saveCredentials(client);
    }

    return client;
};

export { authorize };
