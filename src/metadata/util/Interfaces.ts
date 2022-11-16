/***************************************
 * Title: Interfaces
 * Description: Contains interfaces that model tree:node, tree:ViewDescription, tree:Relation and tree:BucketizeStrategy
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/

import {Store} from "n3";

/**
 * Provides methods to work with an N3 Store.
 */
export interface N3Support {
    getStore: () => Store
}

/**
 * An interface that holds the properties for a `tree:Node` (TREE hypermedia specification §6.1.2).
 */
export interface INode extends N3Support {
    id: string
    relations: IRelation[]
    viewDescription?: IViewDescription
}

/**
 * An interface that holds the properties for a `tree:ViewDescription` (LDES in LDP specification §5.2 and
 * https://github.com/Informatievlaanderen/OSLOthema-ldes/issues/4).
 */
export interface IViewDescription extends N3Support {
    id: string
    managedBy: ILDESinLDPClient
    servesDataset: string // LDESinLDPMetadata.eventStreamIdentifier
    endpointURL: string // Node.id
}

/**
 * An interface that holds the properties for a `ldes:LDESinLDPClient` (LDES in LDP specification §5.2).
 */
export interface ILDESinLDPClient extends N3Support {
    id: string
    bucketizeStrategy: IBucketizeStrategy
}

/**
 * An interface that holds the properties for a `ldes:BucketizeStrategy` (LDES in LDP specification §5.2,
 * https://github.com/ajuvercr/sds-processors/blob/master/bucketizeStrategy.ttl and
 * https://github.com/Informatievlaanderen/OSLOthema-ldes/issues/4).
 */
export interface IBucketizeStrategy extends N3Support {
    id: string
    bucketType: string
    path: string // should be SHACLPath
    pageSize?: number
}

/**
 * An interface that holds the properties for a `tree:Relation` (TREE hypermedia specification §6.1.3).
 */
export interface IRelation extends N3Support {
    type: string
    value: string
    node: string
    path: string // should be SHACLPath
}
