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

export interface Relation {
    type: string
    value: string
    node: string
    path: string
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
        ldesEventStreamIdentifier: ldesIdentifier,
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
