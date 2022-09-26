/***************************************
 * Title: Util
 * Description: Some utility functions for a Version Aware LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 01/04/2022
 *****************************************/
/**
 * Checks whether the materialized member is marked deleted or not
 * @param member
 * @param metadata
 */
import {Member} from "@treecg/types";
import {LDESMetadata} from "../util/LdesUtil";
import {DataFactory, Store} from "n3";
import {DCT, RDF} from "../util/Vocabularies";
import {dateToLiteral} from "../util/TimestampUtil";
import namedNode = DataFactory.namedNode;

/**
 * Verifies whether a member is marked as deleted based
 * @param member
 * @param metadata
 * @returns {boolean}
 */
export function isDeleted(member: Member, metadata: LDESMetadata): boolean {
    const store = new Store(member.quads)
    return store.getQuads(member.id, namedNode(RDF.type), namedNode(metadata.deletedType), null).length > 0
}

/**
 * Adds version specific triples (timestamp and version) to the quads of the member
 * @param store
 * @param versionIdentifier
 * @param memberIdentifier
 * @param metadata
 */
export function addVersionSpecificTriples(store: Store, versionIdentifier: string, memberIdentifier: string, metadata: LDESMetadata): void {
    const id = namedNode(memberIdentifier)
    store.addQuad(id, namedNode(metadata.versionOfPath), namedNode(versionIdentifier))
    store.addQuad(id, namedNode(metadata.timestampPath), dateToLiteral(new Date()))
}

/**
 * Adds the deleted type the version specific resource (i.e. to the quads of the member)
 * @param store
 * @param versionSpecificIdentifier
 * @param metadata
 */
export function addDeletedTriple(store: Store, versionSpecificIdentifier: string, metadata: LDESMetadata): void {
    const id = namedNode(versionSpecificIdentifier)
    store.addQuad(id, namedNode(RDF.type), namedNode(metadata.deletedType))
}

/**
 * Removes version specific triples from a materialized member
 * @param member
 * @param metadata
 */
export function removeVersionSpecificTriples(member: Member, metadata: LDESMetadata): void {
    const store = new Store(member.quads)
    store.removeQuads(store.getQuads(member.id, namedNode(metadata.timestampPath), null, null))
    store.removeQuads(store.getQuads(member.id, namedNode(metadata.versionOfPath), null, null))
    store.removeQuads(store.getQuads(member.id, namedNode(metadata.deletedType), null, null))

    store.removeQuads(store.getQuads(member.id, namedNode(DCT.hasVersion), null, null))
    member.quads = store.getQuads(null, null, null, null)

}
