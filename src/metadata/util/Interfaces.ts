/***************************************
 * Title: Interfaces
 * Description: Contains interfaces that model tree:node, tree:ViewDescription, tree:Relation and tree:BucketizeStrategy
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/

import {Store} from "n3";

export interface INode {
    id: string
    relations: IRelation[]
    viewDescription?: IViewDescription

    getStore: () => Store
}

export interface IViewDescription {
    id: string
    managedBy: ILDESinLDPClient
    servesDataset: string // LDESinLDPMetadata.eventStreamIdentifier
    endpointURL: string // Node.id

    getStore: () => Store
}

export interface ILDESinLDPClient {
    id: string
    bucketizeStrategy: IBucketizeStrategy

    getStore: () => Store
}

export interface IBucketizeStrategy {
    id: string
    bucketType: string
    path: string // should be SHACLPath
    pageSize?: number

    getStore: () => Store
}

export interface IRelation {
    type: string
    value: string
    node: string
    path: string // should be SHACLPath

    getStore: () => Store
}
