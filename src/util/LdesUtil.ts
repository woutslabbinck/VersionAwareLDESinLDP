/***************************************
 * Title: LdesUtil
 * Description: Utility function for LDESes
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 29/03/2022
 *****************************************/
import {Store} from "n3";
import {extractSnapshotOptions} from "@treecg/ldes-snapshot/dist/src/util/SnapshotUtil";
import {LDES, LDP, RDF, TREE} from "./Vocabularies";
import {ISnapshotOptions} from "@treecg/ldes-snapshot/dist/src/SnapshotTransform";
import {storeToString} from "./Conversion";
import {ILDESinLDPMetadata} from "../metadata/LDESinLDPMetadata";

export interface Relation {
    type: string
    value: string
    node: string
    path: string // should be SHACLPath
}


export interface LDESMetadata {
    ldesEventStreamIdentifier: string
    timestampPath: string
    versionOfPath: string
    deletedType: string
    fragmentSize?: number // Note: temporary -> after discussion with Arthur should be changed
    views: {
        id: string
        relations: Relation[]
    }[]
    inbox: string
}

export function extractLdesMetadata(store: Store, ldesIdentifier: string): LDESMetadata {
    let snapshotOptions: ISnapshotOptions
    const views = []
    let inbox: string
    const str = storeToString(store)
    let fragmentSize: number | undefined
    try {
        snapshotOptions = extractSnapshotOptions(store, ldesIdentifier)
        const viewIdentifiers = store.getObjects(ldesIdentifier, TREE.view, null).map(object => object.value)
        for (const viewIdentifier of viewIdentifiers) {
            const relationIdentifiers = store.getObjects(viewIdentifier, TREE.relation, null)
            const relations = []
            for (const relationIdentifier of relationIdentifiers) {
                let relation: Relation = {
                    node: store.getObjects(relationIdentifier, TREE.node, null).map(object => object.value)[0],
                    type: store.getObjects(relationIdentifier, RDF.type, null).map(object => object.value)[0],
                    value: store.getObjects(relationIdentifier, TREE.value, null).map(object => object.value)[0],
                    path: store.getObjects(relationIdentifier, TREE.path, null).map(object => object.value)[0]
                }
                relations.push(relation)
            }
            views.push({id: viewIdentifier, relations: relations})

            if (store.getObjects(viewIdentifier, LDES.pageSize, null)[0]) { // NOTE: might be changed based on viewDescription
                fragmentSize = parseInt(store.getObjects(viewIdentifier, LDES.pageSize, null)[0].value)
            }

        }

        inbox = store.getObjects(null, LDP.inbox, null)[0].value
    } catch (e) {
        throw Error(`Could not extract LDES metadata for ${ldesIdentifier}.`)
    }
    return {
        deletedType: LDES.DeletedLDPResource,
        ldesEventStreamIdentifier: extractLDESIdentifier(store),
        views: views,
        timestampPath: snapshotOptions.timestampPath!,
        versionOfPath: snapshotOptions.versionOfPath!,
        inbox: inbox,
        fragmentSize
    }
}

export function extractLDESIdentifier(store: Store) {
    const ldes = store.getSubjects(RDF.type, LDES.EventStream, null)
    if (ldes.length > 1) {
        console.log(`Multiple LDESes detected. ${ldes[0].value} was extracted`)
    }
    return ldes[0].value
}

/**
 * Filters out the relations from a time-based LDES (all TREE GTE relations) that have members within the given time window [startDate, endDate].
 * @param metadata The LDES metadata
 * @param startDate The start time of the time window (Date object)
 * @param endDate The end time of the time window (Date object)
 * @returns {Relation[]}
 */
export function filterRelation(metadata: ILDESinLDPMetadata, startDate: Date, endDate: Date): Relation[]{
    // relations chronologically sorted
    const metadataRelations = metadata.view.relations.sort((a, b) => {
        // assumption: value is valid xsd:DateTime
        const dateA = new Date(a.value)
        const dateB = new Date(b.value)
        return dateA.getTime() - dateB.getTime()
    })

    if (metadataRelations.length === 0) return []

    const filteredRelations: Relation[] = []

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
