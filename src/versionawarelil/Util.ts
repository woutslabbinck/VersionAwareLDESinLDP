/***************************************
 * Title: Util
 * Description: Some utility functions for a Version Aware LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 01/04/2022
 *****************************************/
import {Member} from "@treecg/types";
import {LDESMetadata, Relation} from "../util/LdesUtil";
import {DataFactory, Store} from "n3";
import {DCT, RDF} from "../util/Vocabularies";
import {dateToLiteral} from "../util/TimestampUtil";
import namedNode = DataFactory.namedNode;

/**
 * Verifies whether a member is marked as deleted
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

/**
 * Filters out the relations from a time-based LDES (all TREE GTE relations) that have members within the given time window [startDate, endDate].
 * @param metadata The LDES metadata
 * @param startDate The start time of the time window (Date object)
 * @param endDate The end time of the time window (Date object)
 * @returns {Relation[]}
 */
export function filterRelation(metadata: LDESMetadata, startDate: Date, endDate: Date): Relation[]{
    if (metadata.views.length===0){
        throw Error('There is no view in the LDES.')
    }

    // relations chronologically sorted
    const metadataRelations = metadata.views[0].relations.sort((a, b) => {
        // assumption: value is valid xsd:DateTime
        const dateA = new Date(a.value)
        const dateB = new Date(b.value)
        return dateA.getTime() - dateB.getTime()
    })

    if (metadataRelations.length === 0) return []

    const filteredRelations: Relation[] = []
    // assumption: all relations are GTE
    for (let i = 0; i < metadataRelations.length - 1; i++) {
        const relation = metadataRelations[i]
        const relationDateTimeStart = new Date(relation.value)
        const relationDateTimeEnd = new Date(metadataRelations[i + 1].value)

        if (!(startDate > relationDateTimeEnd || endDate < relationDateTimeStart)) {
            // see Notes 26/9
            filteredRelations.push(relation)
        }
    }

    const lastRelation = metadataRelations[metadataRelations.length - 1]
    if (new Date(lastRelation.value) <= endDate) {
        filteredRelations.push(lastRelation)
    }
    return filteredRelations
}
