/***************************************
 * Title: Communication
 * Description: Interface for HTTP communication
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
export interface Communication {
    /**
     * Performs an HTTP GET request on the resourceIdentifier.
     * default header: content-type=text/turtle
     * @param resourceIdentifier
     * @param headers
     */
    get: (resourceIdentifier: string, headers?: Headers) => Promise<Response>

    /**
     * Performs an HTTP HEAD request on the resourceIdentifier.
     * @param resourceIdentifier
     */
    head: (resourceIdentifier: string) => Promise<Response>

    /**
     * Performs an HTTP POST request on the resourceIdentifier.
     * default header: content-type=text/turtle
     * @param resourceIdentifier
     * @param headers
     */
    post: (resourceIdentifier: string, body?: string, headers?: Headers) => Promise<Response>

    /**
     * Performs an HTTP PUT request on the resourceIdentifier.
     * default header: content-type=text/turtle
     * @param resourceIdentifier
     * @param headers
     */
    put: (resourceIdentifier: string, body?: string, headers?: Headers) => Promise<Response>

    /**
     * Performs an HTTP PATCH request on the resourceIdentifier.
     * default header: content-type=application/sparql-update
     * @param resourceIdentifier
     * @param headers
     */
    patch: (resourceIdentifier: string, body?: string, headers?: Headers) => Promise<Response>

    /**
     * Performs an HTTP DELETE request on the resourceIdentifier.
     * @param resourceIdentifier
     */
    delete: (resourceIdentifier: string) => Promise<Response>
}
