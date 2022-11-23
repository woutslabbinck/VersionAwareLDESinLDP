/***************************************
 * Title: PatchUtil
 * Description: Contains methods to create patch queries
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 23/11/2022
 *****************************************/
import {Store} from "n3";
import {storeToString} from "./Conversion";

// if the methods must be more expressive, https://www.npmjs.com/package/sparqlalgebrajs could be used
/**
 * Creates a SPARQL Update query to insert a collection of triples into a graph
 * @param store an N3 Store that contains the triples that must be added to the graph
 * @returns {string} the SPARQL UPDATE INSERT query serialized as a string
 */
export function patchSparqlUpdateInsert(store: Store): string {
    return `INSERT DATA {${storeToString(store)}};`
}

/**
 * Creates a SPARQL Update query to delete a collection of triples from a graph
 * @param store an N3 Store that contains the triples that must be deleted from the graph
 * @returns {string} the SPARQL UPDATE DELETE query serialized as a string
 */
export function patchSparqlUpdateDelete(store: Store): string {
    return `DELETE DATA {${storeToString(store)}};`
}
