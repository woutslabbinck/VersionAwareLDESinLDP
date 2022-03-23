/***************************************
 * Title: LDESinLDP
 * Description: LDES in LDP (implementation uses the Community Solid Server (CSS) with acl public in the root)
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {ILDESinLDP} from "./ILDESinLDP";
import {Communication} from "../ldp/Communication";
import {LDESinLDPConfig} from "./LDESinLDPConfig";
import {DataFactory, Store} from "n3";
import {Readable} from "stream";
import {storeToString, turtleStringToStore} from "../util/Conversion";
import namedNode = DataFactory.namedNode;
import {DCT, LDES, LDP, RDF, TREE} from "../util/Vocabularies";
import {dateToLiteral} from "../util/TimestampUtil";

export class LDESinLDP implements ILDESinLDP {
    private readonly LDESinLDPIdentifier: string;
    private readonly communication: Communication

    public constructor(LDESinLDPIdentifier: string, communication: Communication) {
        this.LDESinLDPIdentifier = LDESinLDPIdentifier;
        this.communication = communication;
        if (!this.isContainerIdentifier(LDESinLDPIdentifier)) {
            throw Error(`${LDESinLDPIdentifier} is not a container identifier as it does not end with "/".`)
        }
    }

    public async initialise(config: LDESinLDPConfig): Promise<void> {
        if (!this.isContainerIdentifier(config.LDESinLDPIdentifier)) {
            throw Error(`${config.LDESinLDPIdentifier} is not a container identifier as it does not end with "/".`)
        }
        const date = new Date()
        // create root container and add the metadata for the root, shape and inbox
        const store = new Store()

        // ldes
        const eventStreamNode = namedNode(config.LDESinLDPIdentifier + '#EventStream')
        const rootNode = namedNode(config.LDESinLDPIdentifier)
        const relationIdentifier = config.LDESinLDPIdentifier + date.valueOf() + '/'

        store.addQuad(eventStreamNode, namedNode(RDF.type), namedNode(LDES.EventStream))
        store.addQuad(eventStreamNode, namedNode(LDES.versionOfPath), namedNode(DCT.isVersionOf))
        store.addQuad(eventStreamNode, namedNode(TREE.view), rootNode)

        if (config.shape) {
            store.addQuad(eventStreamNode, namedNode(TREE.shape), namedNode(config.shape))
        }

        // rootNode
        const relationNode = store.createBlankNode();
        store.addQuad(rootNode, namedNode(RDF.type), namedNode(TREE.Node))
        store.addQuad(rootNode, namedNode(TREE.relation), relationNode)

        // add relation
        store.addQuad(relationNode, namedNode(RDF.type), namedNode(TREE.GreaterThanOrEqualToRelation));
        store.addQuad(relationNode, namedNode(TREE.node), namedNode(relationIdentifier));
        store.addQuad(relationNode, namedNode(TREE.path), namedNode(DCT.issued));
        store.addQuad(relationNode, namedNode(TREE.value), dateToLiteral(date));

        // add inbox
        store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDP.inbox), namedNode(relationIdentifier))

        // send request to server to create
        await this.createContainer(config.LDESinLDPIdentifier, storeToString(store))

        // create first relation container
        await this.createContainer(relationIdentifier)
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

    private async createContainer(resourceIdentifier: string, body?: string): Promise<void> {
        const response = await this.communication.put(resourceIdentifier, body)
        if (response.status !== 201) {
            console.log(body)
            console.log(await response.text())
            throw Error(`The container ${resourceIdentifier} was not created | status code: ${response.status}`)
        }
        console.log(`LDP Container created: ${response.url}`)
    }

    private isContainerIdentifier(resourceIdentifier: string): boolean {
        // maybe also an http/https check?
        return resourceIdentifier.endsWith('/')
    }
}
