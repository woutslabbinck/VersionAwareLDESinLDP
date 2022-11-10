/***************************************
 * Title: VersionedLDESinLDPMetadata.ts
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
import {ILDESinLDPMetadata, LDESinLDPMetadata} from "./LDESinLDPMetadata";
import {INode} from "./util/Interfaces";
import {DCT, LDES} from "../util/Vocabularies";
import {Store} from "n3";
import {namedNode} from "@rdfjs/data-model";

export interface IVersionedLDESinLDPMetadata extends ILDESinLDPMetadata {
    timestampPath: string
    versionOfPath: string
    deletedType: string
}

export class VersionedLDESinLDPMetadata extends LDESinLDPMetadata implements IVersionedLDESinLDPMetadata {
    private _deletedType: string;
    private _timestampPath: string;
    private _versionOfPath: string;

    constructor(eventStreamIdentifier: string, view: INode, inbox: string,
                versionLDESArgs?: { deletedType?: string, timestampPath?: string, versionOfPath?: string }, shape?: string) {
        super(eventStreamIdentifier, view, inbox, shape);
        versionLDESArgs = versionLDESArgs ?? {}
        this._deletedType = versionLDESArgs.deletedType ?? LDES.DeletedLDPResource;
        this._timestampPath = versionLDESArgs.timestampPath ?? DCT.created;
        this._versionOfPath = versionLDESArgs.versionOfPath ?? DCT.isVersionOf;
    }

    getStore(): Store {
        const store = super.getStore();
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(LDES.versionOfPath), namedNode(this._versionOfPath))
        store.addQuad(namedNode(this.eventStreamIdentifier), namedNode(LDES.timestampPath), namedNode(this._timestampPath))
        return store
    }

    get deletedType(): string {
        return this._deletedType;
    }

    get timestampPath(): string {
        return this._timestampPath;
    }

    get versionOfPath(): string {
        return this._versionOfPath;
    }
}
