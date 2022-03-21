/***************************************
 * Title: LDPCommunication
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {Communication} from "./Communication";

export class LDPCommunication implements Communication {

    // todo: defaults
    public constructor() {
    }

    public async get(resourceIdentifier: string, headers?: Headers): Promise<Response> {
        return await fetch(resourceIdentifier, {
            method: 'GET'
        });
    }

    public async head(resourceIdentifier: string): Promise<Response> {
        return await fetch(resourceIdentifier, {
            method: 'HEAD'
        });
    }

    public async post(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        return await fetch(resourceIdentifier, {
            method: 'POST',
            headers: headers,
            body: body
        });
    }

    public async put(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
        return await fetch(resourceIdentifier, {
            method: 'PUT',
            headers: headers,
            body: body
        });
    }

    public async patch(resourceIdentifier: string, body?: string, headers?: Headers): Promise<Response> {
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
