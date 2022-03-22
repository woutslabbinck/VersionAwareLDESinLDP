/***************************************
 * Title: LDESinLDP
 * Description: LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {ILDESinLDP} from "./ILDESinLDP";
import {Communication} from "../ldp/Communication";
import {LDESinLDPConfig} from "./LDESinLDPConfig";
import {Store} from "n3";
import {Readable} from "stream";
import {storeToString, stringToStore, turtleStringToStore} from "../util/Conversion";

export class LDESinLDP implements ILDESinLDP {
    private readonly LDESinLDPIdentifier: string;
    private readonly communication: Communication

    public constructor(LDESinLDPIdentifier: string, communication: Communication) {
        this.LDESinLDPIdentifier = LDESinLDPIdentifier;
        this.communication = communication;
    }

    public async initialise(config: LDESinLDPConfig): Promise<void> {
        return Promise.resolve(undefined);
    }

    public async create(materializedResourceIdentifier: string, store: Store): Promise<void> {
        return Promise.resolve(undefined);
    }

    public async read(resourceIdentifier: string): Promise<Store> {
        const response = await this.communication.get(resourceIdentifier)

        if (response.status !== 200) {
            throw new Error('Resource not found') //todo: maybe add error classes?
        }
        if (response.headers.get('content-type') !== 'text/turtle') {
            throw new Error('Works only on rdf data')
        }
        const text = await response.text()
        return await turtleStringToStore(text)
    }

    public async update(materializedResourceIdentifier: string, store: Store): Promise<void> {
        return Promise.resolve(undefined);
    }

    public async delete(materializedResourceIdentifier: string, store: Store): Promise<void> {
        return Promise.resolve(undefined);
    }

    public async readMetadata(): Promise<Store> {
        return Promise.resolve(new Store());
    }

    public async readAllMembers(until: Date | undefined): Promise<Readable> {
        return Promise.resolve(new Readable());
    }


}
