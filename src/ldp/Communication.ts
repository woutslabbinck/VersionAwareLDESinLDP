/***************************************
 * Title: Communication
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
export interface Communication {
    get: (resourceIdentifier: string, headers?: Headers) => Promise<Response>
    head: (resourceIdentifier: string) => Promise<Response>
    post: (resourceIdentifier: string, body?: string, headers?: Headers) => Promise<Response>
    put: (resourceIdentifier: string, body?: string, headers?: Headers) => Promise<Response>
    patch: (resourceIdentifier: string, body?: string, headers?: Headers) => Promise<Response>
    delete: (resourceIdentifier: string) => Promise<Response>
}
