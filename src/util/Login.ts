/***************************************
 * Title: Login.ts
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be) & Lars Van Cauter
 * Created on 26/11/2021
 *****************************************/

// import {readdirSync, readFileSync, unlinkSync, writeFileSync} from "fs";
// import Path from "path";
import {Session, ILoginInputOptions, InMemoryStorage} from "@rubensworks/solid-client-authn-isomorphic";

import express from "express";


type InputOptions = {
    solidIdentityProvider: string;
    applicationName?: string;
    registrationType: "static" | "dynamic";
};

// TODO Function type syntax
export async function getSession(validatedOptions: InputOptions, callback: any): Promise<Session> {
    const app = express();
    const port = 3011;
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
            "The tokens been received. You can now close this window."
        );
        server.close();

        callback(session);
    });
    return session;
}

// // import {handleIncomingRedirect, login, fetch, getDefaultSession} from '@inrupt/solid-client-authn-browser'

// // export async function loginAndFetch() {
// //     // 1. Call `handleIncomingRedirect()` to complete the authentication process.
// //     //    If called after the user has logged in with the Solid Identity Provider, 
// //     //      the user's credentials are stored in-memory, and
// //     //      the login process is complete. 
// //     //   Otherwise, no-op.  
// //     console.log(window ?? "nullllll");
// //     await handleIncomingRedirect({url: "http://localhost:3000"});

// //     // 2. Start the Login Process if not already logged in.
// //     if (!getDefaultSession().info.isLoggedIn) {

// //         await login({
// //             // Specify the URL of the user's Solid Identity Provider;
// //             // e.g., "https://login.inrupt.com".
// //             oidcIssuer: "https://solidcommunity.net",
// //             // Specify the URL the Solid Identity Provider should redirect the user once logged in,
// //             // e.g., the current page for a single-page app.
// //             // redirectUrl: window.location.href,
// //             redirectUrl: "http://localhost:3000",
// //             // Provide a name for the application when sending to the Solid Identity Provider
// //             clientName: "My application"
// //         });
// //     }
// // }
// import fetch from 'node-fetch';
// import {buildAuthenticatedFetch, createDpopHeader, generateDpopKeyPair} from '@inrupt/solid-client-authn-core';
// export async function logincss() {

//     // This assumes your server is started under http://localhost:3000/.
//     // This URL can also be found by checking the controls in JSON responses when interacting with the IDP API,
//     // as described in the Identity Provider section.
//     const respons = await fetch('http://localhost:3000/idp/credentials/', {
//         method: 'POST',
//         headers: {'content-type': 'application/json'},
//         // The email/password fields are those of your account.
//         // The name field will be used when generating the ID of your token.
//         body: JSON.stringify({email: 'my-email@example.com', password: 'my-account-password', name: 'my-token'}),
//     });

//     // These are the identifier and secret of your token.
//     // Store the secret somewhere safe as there is no way to request it again from the server!
//     const {id, secret}: any = await respons.json();

//     // A key pair is needed for encryption.
//     // This function from `solid-client-authn` generates such a pair for you.
//     const dpopKey = await generateDpopKeyPair();

//     // These are the ID and secret generated in the previous step.
//     // Both the ID and the secret need to be form-encoded.
//     const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
//     // This URL can be found by looking at the "token_endpoint" field at
//     // http://localhost:3000/.well-known/openid-configuration
//     // if your server is hosted at http://localhost:3000/.
//     const tokenUrl = 'http://localhost:3000/.oidc/token';
//     const respon = await fetch(tokenUrl, {
//         method: 'POST',
//         headers: {
//             // The header needs to be in base64 encoding.
//             authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
//             'content-type': 'application/x-www-form-urlencoded',
//             dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
//         },
//         body: 'grant_type=client_credentials&scope=webid',
//     });

//     // This is the Access token that will be used to do an authenticated request to the server.
//     // The JSON also contains an "expires_in" field in seconds, 
//     // which you can use to know when you need request a new Access token.
//     const {access_token: accessToken}: any = await respon.json();

//     // The DPoP key needs to be the same key as the one used in the previous step.
//     // The Access token is the one generated in the previous step.
//     // const authFetch = await buildAuthenticatedFetch(fetch, accessToken, {dpopKey});
//     // authFetch can now be used as a standard fetch function that will authenticate as your WebID.
//     // This request will do a simple GET for example.
//     // const response = await authFetch('http://localhost:3000/private');
// }
// logincss();
