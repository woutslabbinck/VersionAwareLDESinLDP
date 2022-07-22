/***************************************
 * Title: LDPCommunication
 * Description: Performs the HTTP request to a Linked Data Platform
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be) & Lars Van Cauter
 * Created on 21/03/2022
 *****************************************/
import {Communication} from "../ldp/Communication";
import {Session} from "@inrupt/solid-client-authn-node";

export class SolidCommunication implements Communication {

    // bit ugly, but don't know how to fix yet
    private authFetch: any;
    private session: Session;

    public constructor(session: Session) {
        this.session = session;
        this.authFetch = session.fetch;
    }

    public async get(resourceIdentifier: string, headers?: Headers): Promise<Response> {
        headers = headers ? headers : new Headers({'Accept': 'text/turtle'})
        return await this.authFetch(resourceIdentifier, {
            method: 'GET',
            headers: headers
        });
    }

    public async head(resourceIdentifier: string): Promise<Response> {
        return await this.authFetch(resourceIdentifier, {
            method: 'HEAD'
        });
    }

    public async post(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        headers = headers ? headers : new Headers({'Content-type': 'text/turtle'})
        return await this.authFetch(resourceIdentifier, {
            method: 'POST',
            headers: headers,
            body: body
        });
    }

    public async put(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        headers = headers ? headers : new Headers({'Content-type': 'text/turtle'})
        return await this.authFetch(resourceIdentifier, {
            method: 'PUT',
            headers: headers,
            body: body
        });
    }

    public async patch(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        headers = headers ? headers : new Headers({'Content-type': 'application/sparql-update'})
        return await this.authFetch(resourceIdentifier, {
            method: 'PATCH',
            headers: headers,
            body: body
        });
    }

    public async delete(resourceIdentifier: string): Promise<Response> {
        return await this.authFetch(resourceIdentifier, {
            method: 'DELETE'
        });
    }
}
