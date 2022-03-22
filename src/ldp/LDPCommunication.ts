/***************************************
 * Title: LDPCommunication
 * Description: Performs the HTTP request to a Linked Data Platform
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {Communication} from "./Communication";

export class LDPCommunication implements Communication {

    public constructor() {
    }

    public async get(resourceIdentifier: string, headers?: Headers): Promise<Response> {
        headers = headers ? headers : new Headers({'Content-type': 'text/turtle'})
        return await fetch(resourceIdentifier, {
            method: 'GET',
            headers
        });
    }

    public async head(resourceIdentifier: string): Promise<Response> {
        return await fetch(resourceIdentifier, {
            method: 'HEAD'
        });
    }

    public async post(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        headers = headers ? headers : new Headers({'Content-type': 'text/turtle'})
        return await fetch(resourceIdentifier, {
            method: 'POST',
            headers: headers,
            body: body
        });
    }

    public async put(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        headers = headers ? headers : new Headers({'Content-type': 'text/turtle'})
        return await fetch(resourceIdentifier, {
            method: 'PUT',
            headers: headers,
            body: body
        });
    }

    public async patch(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        headers = headers ? headers : new Headers({'Content-type': 'application/sparql-update'})
        return await fetch(resourceIdentifier, {
            method: 'PATCH',
            headers: headers,
            body: body
        });
    }

    public async delete(resourceIdentifier: string): Promise<Response> {
        return await fetch(resourceIdentifier, {
            method: 'DELETE'
        });
    }
}
