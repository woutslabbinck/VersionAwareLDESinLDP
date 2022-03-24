/***************************************
 * Title: IdentifierUtil
 * Description: Utility functions about identifiers
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 24/03/2022
 *****************************************/
export function isContainerIdentifier(resourceIdentifier: string): boolean {
    // maybe also an http/https check?
    return resourceIdentifier.endsWith('/')
}
