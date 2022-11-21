/***************************************
 * Title: LDESinLDPMetadata
 * Description: Contains the interface and implementation for the metadata of an LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
import {Store} from "n3";
import {LDES, LDP, RDF, TREE} from "../util/Vocabularies";
import {namedNode} from "@rdfjs/data-model";
import {INode, N3Support} from "./util/Interfaces";

/**
 * Holds the properties of an LDES in LDP (LDES in LDP Protocol §2).
 */
export interface ILDESinLDPMetadata extends N3Support {
    eventStreamIdentifier: string
    view: INode
    inbox: string
    shape?: string

    rootNodeIdentifier: string // view identifier
    fragmentSize: number // Infinity if not present
}

export class LDESinLDPMetadata implements ILDESinLDPMetadata {
    private _eventStreamIdentifier: string
    private _view: INode
    private _inbox: string
    private _shape: string | undefined

    constructor(eventStreamIdentifier: string, view: INode, inbox: string, shape?: string) {
        this._eventStreamIdentifier = eventStreamIdentifier
        this._view = view
        this._inbox = inbox
        this._shape = shape
    }

    get eventStreamIdentifier(): string {
        return this._eventStreamIdentifier;
    }

    get view(): INode {
        return this._view;
    }

    get inbox(): string {
        return this._inbox;
    }

    set inbox(value: string) {
        this._inbox = value;
    }

    get shape(): string | undefined {
        return this._shape;
    }

    get fragmentSize(): number {
        if (!this.view.viewDescription) {
            return Infinity
        }
        return this.view.viewDescription.managedBy.bucketizeStrategy.pageSize ?? Infinity;
    }

    public getStore(): Store {
        const store = new Store()
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(RDF.type), namedNode(LDES.EventStream))
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(TREE.view), namedNode(this.view.id))

        store.addQuads(this.view.getStore().getQuads(null, null, null, null))
        if (this.shape) {
            store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(TREE.shape), namedNode(this.shape))
        }
        store.addQuad(namedNode(this.rootNodeIdentifier), namedNode(LDP.inbox), namedNode(this.inbox))
        return store;
    }

    get rootNodeIdentifier(): string {
        return this.view.id
    }
}
