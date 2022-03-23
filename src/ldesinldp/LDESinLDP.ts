/***************************************
 * Title: LDESinLDP
 * Description: LDES in LDP (implementation uses the Community Solid Server (CSS) with acl public in the root)
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {ILDESinLDP} from "./ILDESinLDP";
import {Communication} from "../ldp/Communication";
import {LDESinLDPConfig} from "./LDESinLDPConfig";
import {DataFactory, Literal, Store} from "n3";
import {Readable,Transform} from "stream";
import {storeToString, turtleStringToStore} from "../util/Conversion";
import namedNode = DataFactory.namedNode;
import {DCT, LDES, LDP, RDF, TREE} from "../util/Vocabularies";
import {dateToLiteral, extractDateFromLiteral} from "../util/TimestampUtil";
import {retrieveWriteLocation} from "./Util";

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
        store.addQuad(eventStreamNode, namedNode(LDES.timestampPath), namedNode(config.treePath))
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
        store.addQuad(relationNode, namedNode(TREE.path), namedNode(config.treePath));
        store.addQuad(relationNode, namedNode(TREE.value), dateToLiteral(date));

        // add inbox
        store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDP.inbox), namedNode(relationIdentifier))

        // send request to server to create
        await this.createContainer(config.LDESinLDPIdentifier, storeToString(store))

        // create first relation container
        await this.createContainer(relationIdentifier)
    }

    public async create(store: Store): Promise<void> {
        const location = await retrieveWriteLocation(this.LDESinLDPIdentifier, this.communication);
        const response = await this.communication.post(location, storeToString(store))
        if (response.status !== 201) {
            throw Error(`The resource was not be created at ${location} 
            | status code: ${response.status}`)
        }
        console.log(`LDP Resource created at: ${response.headers.get('Location')}`)

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
        return await turtleStringToStore(text, resourceIdentifier)
    }

    public async update(store: Store): Promise<void> {
        await this.create(store)
    }

    public async delete(store: Store): Promise<void> {
        await this.create(store)
    }

    public async readMetadata(): Promise<Store> {
        // Note to self: Should this be a store or just an interface or sth?
        // what if the ldesinldp is not actually an ldes in ldp? Error handling?
        const rootStore = await this.read(this.LDESinLDPIdentifier)

        const metadataStore = new Store()
        const eventStreamNode = rootStore.getQuads(null, RDF.type, LDES.EventStream, null)[0].subject
        const relationTriple = rootStore.getQuads(this.LDESinLDPIdentifier, TREE.relation, null, null)[0]

        // add event stream
        metadataStore.addQuads(rootStore.getQuads(eventStreamNode, null, null, null))

        // add root node
        metadataStore.addQuad(namedNode(this.LDESinLDPIdentifier), namedNode(RDF.type), namedNode(TREE.Node))
        metadataStore.addQuad(relationTriple)

        // add ldp:inbox
        metadataStore.addQuads(rootStore.getQuads(this.LDESinLDPIdentifier, LDP.inbox, null, null))

        // add relation
        metadataStore.addQuads(rootStore.getQuads(relationTriple.object, null, null, null))
        return rootStore
    }

    public async readAllMembers(until: Date | undefined): Promise<Readable> {
        until = until ? until : new Date()
        const rootStore = await this.readMetadata()
// note: maybe with a sparql query in comunica?
        // get all relations of the root node
        const relationIdentifiers = rootStore.getObjects(this.LDESinLDPIdentifier, TREE.relation, null).map(object => object)

        // get all nodes in the ldes in ldp
        const nodeIdentifiers: string[] = []
        for (const relationIdentifier of relationIdentifiers) {
            const relation = new Store(rootStore.getQuads(relationIdentifier, null, null, null))
            // todo error checking
            const relationValue = extractDateFromLiteral(relation.getObjects(null, TREE.value, null)[0] as Literal)

            if (until.getTime() > relationValue.getTime()) {
                // todo error checking
                nodeIdentifiers.push(relation.getObjects(null, TREE.node, null)[0].value)
            }
        }
        const comm = this
        // stream of resources within the ldes in ldp
        const resourceIdentifierStream = new Readable({
            objectMode: true,
            async read() {
                for (const nodeIdentifier of nodeIdentifiers) {
                    // todo: defensive, what if this errors?
                    const nodeStore = await comm.read(nodeIdentifier)
                    const identifiers: string[] = nodeStore.getObjects(nodeIdentifier, LDP.contains, null).map(object => object.value)

                    for (const identifier of identifiers) {
                        this.push(identifier)
                    }
                }
                this.push(null)
            }
        })

        // stream of all members
        const transformer = new Transform({
            objectMode: true,
            async transform(chunk, encoding, callback){
                const resourceStore = await comm.read(chunk)
                this.push({
                    id: namedNode(chunk),
                    quads: resourceStore.getQuads(null,null,null,null)
                })
            }
        })
        return Promise.resolve(resourceIdentifierStream.pipe(transformer));
    }

    private async createContainer(resourceIdentifier: string, body?: string): Promise<void> {
        const response = await this.communication.put(resourceIdentifier, body)
        if (response.status !== 201) {
            throw Error(`The container ${resourceIdentifier} was not created | status code: ${response.status}`)
        }
        console.log(`LDP Container created: ${response.url}`)
    }

    private isContainerIdentifier(resourceIdentifier: string): boolean {
        // maybe also an http/https check?
        return resourceIdentifier.endsWith('/')
    }
}
