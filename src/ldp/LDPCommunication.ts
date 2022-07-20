/***************************************
 * Title: LDPCommunication
 * Description: Performs the HTTP request to a Linked Data Platform
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {Communication} from "./Communication";

import {buildAuthenticatedFetch, createDpopHeader, generateDpopKeyPair} from '@inrupt/solid-client-authn-core';

// VersionAwareLdesInLdp option
export interface VALILOptions {
    podurl: string;
    user_mail: string;
    user_password: string;
}
export class LDPCommunication implements Communication {

    private readonly options: VALILOptions | undefined;
    // bit ugly, but don't know how to fix yet
    private authFetch: any = undefined;
    private accessTokenTtl = new Date();

    public constructor(options?: VALILOptions) {
        this.options = options;
    }

    private async authenticate() {
        if (this.options == undefined) {
            this.authFetch = fetch;
            return;
        }

        if (this.accessTokenTtl <= new Date()) {
            // This URL can also be found by checking the controls in JSON responses when interacting with the IDP API,
            // as described in the Identity Provider section.
            //https://solidproject.org/self-hosting/css
            const creds = await fetch(`${this.options.podurl}idp/credentials/`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                // The email/password fields are those of your account.
                // The name field will be used when generating the ID of your token.
                body: JSON.stringify({email: this.options.user_mail, password: this.options.user_password, name: 'my-token'}),
            });

            console.log(creds);

            // These are the identifier and secret of your token.
            // Store the secret somewhere safe as there is no way to request it again from the server!
            const {id, secret} = await creds.json();

            // A key pair is needed for encryption.
            // This function from `solid-client-authn` generates such a pair for you.
            const dpopKey = await generateDpopKeyPair();

            // These are the ID and secret generated in the previous step.
            // Both the ID and the secret need to be form-encoded.
            const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
            // This URL can be found by looking at the "token_endpoint" field at
            // {serverurl}/.well-known/openid-configuration
            const tokenUrl = `${this.options.podurl}.oidc/token`;
            const post_respons = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    // The header needs to be in base64 encoding.
                    authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
                    'content-type': 'application/x-www-form-urlencoded',
                    dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
                },
                body: 'grant_type=client_credentials&scope=webid',
            });

            const postjson = await post_respons.json();
            console.log(postjson);
            // updated accessTokenTtl
            const ttl = postjson["expires_in"];
            this.accessTokenTtl = new Date();
            this.accessTokenTtl.setSeconds(this.accessTokenTtl.getSeconds() + ttl);
            // This is the Access token that will be used to do an authenticated request to the server.
            const {access_token: accessToken} = postjson;

            // The DPoP key needs to be the same key as the one used in the previous step.
            // The Access token is the one generated in the previous step.
            const authFetch = await buildAuthenticatedFetch(fetch, accessToken, {dpopKey});
            // authFetch can now be used as a standard fetch function that will authenticate as your WebID.
            this.authFetch = authFetch;
            return;
        }
    }

    public async get(resourceIdentifier: string, headers?: Headers): Promise<Response> {
        await this.authenticate()
        headers = headers ? headers : new Headers({'Accept': 'text/turtle'})
        return await this.authFetch(resourceIdentifier, {
            method: 'GET',
            headers: headers
        });
    }

    public async head(resourceIdentifier: string): Promise<Response> {
        await this.authenticate()
        return await this.authFetch(resourceIdentifier, {
            method: 'HEAD'
        });
    }

    public async post(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        await this.authenticate()
        headers = headers ? headers : new Headers({'Content-type': 'text/turtle'})
        return await this.authFetch(resourceIdentifier, {
            method: 'POST',
            headers: headers,
            body: body
        });
    }

    public async put(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        await this.authenticate()
        headers = headers ? headers : new Headers({'Content-type': 'text/turtle'})
        return await this.authFetch(resourceIdentifier, {
            method: 'PUT',
            headers: headers,
            body: body
        });
    }

    public async patch(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        await this.authenticate()
        headers = headers ? headers : new Headers({'Content-type': 'application/sparql-update'})
        return await this.authFetch(resourceIdentifier, {
            method: 'PATCH',
            headers: headers,
            body: body
        });
    }

    public async delete(resourceIdentifier: string): Promise<Response> {
        await this.authenticate()
        return await this.authFetch(resourceIdentifier, {
            method: 'DELETE'
        });
    }
}
