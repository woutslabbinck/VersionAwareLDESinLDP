/***************************************
 * Title: Login.ts
 * Description: Logs the user in
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 26/11/2021
 *****************************************/

import {readdirSync, readFileSync, unlinkSync, writeFileSync} from "fs";
import Path from "path";
import {ILoginInputOptions, InMemoryStorage, Session} from "@rubensworks/solid-client-authn-isomorphic";

import {config} from 'dotenv';
import express from "express";
import {buildAuthenticatedFetch, createDpopHeader, generateDpopKeyPair} from "@inrupt/solid-client-authn-core";
import {LDPCommunication} from "../ldp/LDPCommunication";
import {turtleStringToStore} from "@treecg/ldes-snapshot";
import {SOLID} from "@solid/community-server";

config();

export enum RegistrationType {
    Static = "static",
    Dynamic = "dynamic"
};

type InputOptions = {
    solidIdentityProvider: string;
    applicationName?: string;
    registrationType: RegistrationType; // not used?
};

export async function login(validatedOptions: InputOptions): Promise<void> {
    const app = express();
    const port = 3123;
    const iriBase = `http://localhost:${port}`;
    const storage = new InMemoryStorage();

    const session: Session = new Session({
        insecureStorage: storage,
        secureStorage: storage,
    });

    const server = app.listen(port, async () => {
        console.log(`Listening at: [${iriBase}].`);
        const loginOptions: ILoginInputOptions = {
            clientName: validatedOptions.applicationName,
            oidcIssuer: validatedOptions.solidIdentityProvider,
            redirectUrl: iriBase,
            tokenType: "DPoP",
            handleRedirect: (url: string) => {
                console.log(`\nPlease visit ${url} in a web browser.\n`);
            },
        };
        console.log(
            `Logging in to Solid Identity Provider  ${validatedOptions.solidIdentityProvider} to get a refresh token.`
        );

        session.login(loginOptions).catch((e) => {
            throw new Error(
                `Logging in to Solid Identity Provider [${validatedOptions.solidIdentityProvider
                }] failed: ${e.toString()}`
            );
        });
    });

    app.get("/", async (_req: {url: string | URL;}, res: {send: (arg0: string) => void;}) => {
        const redirectIri = new URL(_req.url, iriBase).href;
        console.log(
            `Login into the Identity Provider successful, receiving request to redirect IRI [${redirectIri}].`
        );
        await session.handleIncomingRedirect(redirectIri);
        // NB: This is a temporary approach, and we have work planned to properly
        // collect the token. Please note that the next line is not part of the public
        // API, and is therefore likely to break on non-major changes.
        const rawStoredSession = await storage.get(
            `solidClientAuthenticationUser:${session.info.sessionId}`
        );
        if (rawStoredSession === undefined) {
            throw new Error(
                `Cannot find session with ID [${session.info.sessionId}] in storage.`
            );
        }
        const storedSession = JSON.parse(rawStoredSession);
        console.log(`
These are your login credentials:
{
  "refreshToken" : "${storedSession.refreshToken}",
  "clientId"     : "${storedSession.clientId}",
  "clientSecret" : "${storedSession.clientSecret}",
  "issuer"       : "${storedSession.issuer}",
}
`);
        res.send(
            "The tokens have been sent to @inrupt/generate-oidc-token. You can close this window."
        );

        // write session away
        writeFileSync(Path.join(__dirname, 'config.json'), JSON.stringify(storedSession));

        server.close();
    });
}

/**
 * Function only stops when a config file is created -> indicating that a user is logged in
 */
export async function isLoggedin(): Promise<void> {
    const rootPath = __dirname;
    let loggedIn = false;
    while (!loggedIn) {
        const files = readdirSync(rootPath);
        if (files.includes('config.json')) {
            loggedIn = true;
            break;
        }
        await sleep(1000);
    }
}

export async function getSession(): Promise<Session> {
    const configPath = Path.join(__dirname, 'config.json');
    const credentials = JSON.parse(readFileSync(configPath, 'utf-8'));

    const session = new Session();
    session.onNewRefreshToken((newToken: string): void => {
        console.log("New refresh token: ", newToken);
    });
    await session.login({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        refreshToken: credentials.refreshToken,
        oidcIssuer: credentials.issuer,
    });
    unlinkSync(configPath);
    return session;
}

export function sleep(ms: number): Promise<any> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates an authenticated fetch using the mail, password and the IDP URL of the given pod.
 * TODO: create one that uses the webid and https://github.com/SolidLabResearch/SolidLabLib.js getIdentityProvider method
 *
 * This method has only been tested for CSS v5.0.0
 * e.g. of an IDP URL: http://localhost:3000/idp/
 * @param config
 */
async function authenticatedFetch(config: { email: string, password: string, idp: string, tokenEndpoint?: string }): Promise<(input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>> {
    // fetch id and secret from the client credentials.
    const {email, password, idp} = config
    const tokenUrl = config.tokenEndpoint ?? new URL(idp).origin + "/.oidc/token" // note: can retrieve it from {server}/.well-known/openid-configuration (e.g. http://localhost:3000/.well-known/openid-configuration)
    const idpResponse = await fetch(idp)

    // only if 200
    const idpjson = await idpResponse.json()

    const credentialURL = idpjson.controls.credentials
    // throw error if undefined (credentialURL)
    const credentialsResponse = await fetch(credentialURL, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email: email, password: password, name: 'my-token'}),
    });

    // only if 200
    const {id, secret} = await credentialsResponse.json();


    // Requesting an access token.
    const dpopKey = await generateDpopKeyPair();
    const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            // The header needs to be in base64 encoding.
            authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
            dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
        },
        body: 'grant_type=client_credentials&scope=webid',
    });
    const {access_token: accessToken, expires_in: expires} = await response.json();
    // https://communitysolidserver.github.io/CommunitySolidServer/5.x/usage/client-credentials/#requesting-an-access-token
    // 'The JSON also contains an "expires_in" field in seconds'

    if (accessToken === undefined) {
        throw Error("Authentication failed: password or email are wrong for idp: "+idp)
    }
    console.log("token expires in:", expires, "seconds.")
    // it says types don't match, but they should
    // @ts-ignore
    return await buildAuthenticatedFetch(fetch, accessToken, {dpopKey});
}


async function getIdp(webID: string): Promise<string> {
    const response = await new LDPCommunication().get(webID)
    const store = await turtleStringToStore(await response.text())
    const idp = store.getQuads(webID, SOLID.oidcIssuer,null,null)[0].object.value
    return idp + 'idp/' // Note: don't know if that should or should not be added.
}

/**
 * Retrieve a {@link Session} containing only an authenticated fetch method.
 * Only applicable for CSS v5.1.0 and up.
 *
 * @param config
 */
export async function getAuthenticatedSession(config: { webId: string, email: string, password: string }): Promise<Session> {
    const {email, password} = config
    const idp = await getIdp(config.webId);     // TODO: use getIdentityProvider from https://github.com/SolidLabResearch/SolidLabLib.js
    const session = new Session()
    try {
        session.fetch = await authenticatedFetch({email, password, idp});
        session.info.isLoggedIn = true
        session.info.webId = config.webId
    } catch (e:unknown) {
        const error = e as Error
        console.log("Log in not successful for webID: "+config.webId)
        console.log(error.message)
        // fetch is part of session and will have a non-authenticated fetch method
    }

    return session;
}
