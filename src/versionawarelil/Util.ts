/***************************************
 * Title: Util
 * Description: Some utility functions for a Version Aware LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 01/04/2022
 *****************************************/
import {Member} from "@treecg/types";
import {LDESMetadata, Relation} from "../util/LdesUtil";
import {DataFactory, Store} from "n3";
import {DCT, RDF, TREE} from "../util/Vocabularies";
import {dateToLiteral} from "../util/TimestampUtil";
import namedNode = DataFactory.namedNode;
import {IVersionedLDESinLDPMetadata} from "../metadata/VersionedLDESinLDPMetadata";

/**
 * Verifies whether a member is marked as deleted
 * @param member
 * @param metadata
 * @returns {boolean}
 */
export function isDeleted(member: Member, metadata: IVersionedLDESinLDPMetadata): boolean {
    const store = new Store(member.quads)
    return store.getQuads(member.id, namedNode(RDF.type), namedNode(metadata.deletedType), null).length > 0
}

/**
 * Adds version object triples (timestamp and version) to the quads of the member.
 * Also add member triple to the store
 * @param store
 * @param versionIdentifier
 * @param memberIdentifier
 * @param metadata
 */
export function addVersionObjectTriples(store: Store, versionIdentifier: string, memberIdentifier: string, metadata: IVersionedLDESinLDPMetadata): void {
    const id = namedNode(memberIdentifier)
    // add member triple
    store.addQuad(namedNode(metadata.eventStreamIdentifier), namedNode(TREE.member), id)
    // add version object triples
    store.addQuad(id, namedNode(metadata.versionOfPath), namedNode(versionIdentifier))
    store.addQuad(id, namedNode(metadata.timestampPath), dateToLiteral(new Date()))
}

/**
 * Adds the deleted type the version specific resource (i.e. to the quads of the member)
 * @param store
 * @param versionSpecificIdentifier
 * @param metadata
 */
export function addDeletedTriple(store: Store, versionSpecificIdentifier: string, metadata: IVersionedLDESinLDPMetadata): void {
    const id = namedNode(versionSpecificIdentifier)
    store.addQuad(id, namedNode(RDF.type), namedNode(metadata.deletedType))
}

/**
 * Removes version specific triples from a materialized member
 * @param member
 * @param metadata
 */
export function removeVersionSpecificTriples(member: Member, metadata: IVersionedLDESinLDPMetadata): void {
    const store = new Store(member.quads)
    store.removeQuads(store.getQuads(member.id, namedNode(metadata.timestampPath), null, null))
    store.removeQuads(store.getQuads(member.id, namedNode(metadata.versionOfPath), null, null))
    store.removeQuads(store.getQuads(member.id, namedNode(metadata.deletedType), null, null))

    store.removeQuads(store.getQuads(member.id, namedNode(DCT.hasVersion), null, null))
    member.quads = store.getQuads(null, null, null, null)

}
