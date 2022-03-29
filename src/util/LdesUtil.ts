/***************************************
 * Title: LdesUtil
 * Description: Utility function for LDESes
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 29/03/2022
 *****************************************/
import {Store} from "n3";
import {extractSnapshotOptions} from "@treecg/ldes-snapshot/dist/src/util/SnapshotUtil";
import {LDES, LDP, TREE} from "./Vocabularies";
import {ISnapshotOptions} from "@treecg/ldes-snapshot/dist/src/SnapshotTransform";

export interface LDESMetadata {
    ldesEventStreamIdentifier: string
    timestampPath: string
    versionOfPath: string
    deletedType: string
    views: {
        id: string
        relationNodeIdentifiers: string[]
    }[]
    inbox: string
}

export function extractLdesMetadata(store: Store, ldesIdentifier: string): LDESMetadata {
    let snapshotOptions: ISnapshotOptions
    const views = []
    let inbox: string
    try {
        snapshotOptions = extractSnapshotOptions(store, ldesIdentifier)
        const viewIdentifiers = store.getObjects(ldesIdentifier, TREE.view, null).map(object => object.value)
        for (const viewIdentifier of viewIdentifiers) {
            const relationIdentifiers = store.getObjects(viewIdentifier, TREE.relation, null)
            const relationNodeIdentifiers = []
            for (const relationIdentifier of relationIdentifiers) {
                relationNodeIdentifiers.push(store.getObjects(relationIdentifier, TREE.node, null).map(object => object.value)[0])
            }
            views.push({id: viewIdentifier, relationNodeIdentifiers})
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
        inbox: inbox
    }
}
