/***************************************
 * Title: Util
 * Description: Utility functions helping the LDES in LDP protocol
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 23/03/2022
 *****************************************/
import {Communication} from "../ldp/Communication";
import {LDP} from "../util/Vocabularies";

const parse = require('parse-link-header');

/**
 * Retrieves the location of the ldp:container to which can be written based on the ldp:inbox relation
 * @param resourceIdentifier the base identifier of the LDES in LDP
 * @param communication interface for HTTP requests
 * @returns {Promise<void>}
 */
export async function retrieveWriteLocation(resourceIdentifier: string, communication: Communication): Promise<string> {
    const response = await communication.head(resourceIdentifier);
    const linkHeaders = parse(response.headers.get('link'));
    if (!linkHeaders) {
        throw new Error('No Link Header present.');
    }
    const inboxLink = linkHeaders[LDP.inbox];
    if (!inboxLink) {
        throw new Error('No http://www.w3.org/ns/ldp#inbox Link Header present.');
    }
    return inboxLink.url
}
