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
import {Readable, Transform} from "stream";
import {storeToString, turtleStringToStore} from "../util/Conversion";
import {DCT, LDES, LDP, RDF, TREE} from "../util/Vocabularies";
import {extractDateFromLiteral} from "../util/TimestampUtil";
import {createContainer, createVersionedEventStream, retrieveWriteLocation} from "./Util";
import {isContainerIdentifier} from "../util/IdentifierUtil";
import {Logger} from "../logging/Logger";
import namedNode = DataFactory.namedNode;

export class LDESinLDP implements ILDESinLDP {
    private readonly _LDESinLDPIdentifier: string;
    private readonly communication: Communication;
    private readonly logger: Logger = new Logger(this);

    public constructor(LDESinLDPIdentifier: string, communication: Communication) {
        this._LDESinLDPIdentifier = LDESinLDPIdentifier;
        this.communication = communication;
        if (!isContainerIdentifier(LDESinLDPIdentifier)) {
            throw Error(`${LDESinLDPIdentifier} is not a container identifier as it does not end with "/".`)
        }
    }

    get LDESinLDPIdentifier(): string {
        return this._LDESinLDPIdentifier;
    }

    public async initialise(config: LDESinLDPConfig): Promise<void> {
        if (!isContainerIdentifier(config.LDESinLDPIdentifier)) {
            throw Error(`${config.LDESinLDPIdentifier} is not a container identifier as it does not end with "/".`)
        }
        // maybe extra check to see whether it exists already?

        const date = new Date()
        // create root container and add the metadata for the root, shape and inbox
        const store = new Store()

        // create versioned LDES and its view (with corresponding relation) and shape according to LDES specification
        // and add it to the store
        createVersionedEventStream(store, config, date)

        const relationIdentifier = config.LDESinLDPIdentifier + date.valueOf() + '/'

        // add inbox
        store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDP.inbox), namedNode(relationIdentifier))

        // send request to server to create base of the LDES in LDP
        await createContainer(config.LDESinLDPIdentifier, this.communication, storeToString(store))

        // create first relation container
        await createContainer(relationIdentifier, this.communication)
    }

    public async create(store: Store): Promise<string> {
        const location = await retrieveWriteLocation(this._LDESinLDPIdentifier, this.communication);
        const response = await this.communication.post(location, storeToString(store))
        if (response.status !== 201) {
            throw Error(`The resource was not be created at ${location} 
            | status code: ${response.status}`)
        }
        const resourceLocation = response.headers.get('Location')
        if (!resourceLocation) {
            throw Error("Did not receive the location of the created resource.")
        }
        this.logger.info(`LDP Resource created at: ${resourceLocation}`)
        return resourceLocation
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

    public async update(store: Store): Promise<string> {
        return await this.create(store)
    }

    public async delete(store: Store): Promise<string> {
        return await this.create(store)
    }

    public async readMetadata(): Promise<Store> {
        const rootStore = await this.read(this._LDESinLDPIdentifier)

        const metadataStore = new Store()
        try {
            const eventStreamNode = rootStore.getQuads(null, RDF.type, LDES.EventStream, null)[0].subject
            const relationTriple = rootStore.getQuads(this._LDESinLDPIdentifier, TREE.relation, null, null)[0]

            // add event stream
            metadataStore.addQuads(rootStore.getQuads(eventStreamNode, null, null, null))

            // add root node
            metadataStore.addQuad(namedNode(this._LDESinLDPIdentifier), namedNode(RDF.type), namedNode(TREE.Node))
            metadataStore.addQuad(relationTriple)

            // add ldp:inbox
            metadataStore.addQuads(rootStore.getQuads(this._LDESinLDPIdentifier, LDP.inbox, null, null))

            // add relation
            metadataStore.addQuads(rootStore.getQuads(relationTriple.object, null, null, null))
        } catch (e) {
            throw Error(`${this._LDESinLDPIdentifier} is not an actual base of an LDES in LDP.`);
        }
        return rootStore
    }

// todo: ask Ruben D if this makes sense or not. Maybe I need make this a sync function?
    public async readAllMembers(until?: Date): Promise<Readable> {
        until = until ? until : new Date()
        const rootStore = await this.readMetadata()
// note: maybe with a sparql query in comunica?
        // get all relations of the root node (Note: only works with tree:collections of one level deep)
        const relationIdentifiers = rootStore.getObjects(this._LDESinLDPIdentifier, TREE.relation, null).map(object => object)

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
            async transform(chunk, encoding, callback) {
                const resourceStore = await comm.read(chunk)
                const memberId = resourceStore.getSubjects(DCT.isVersionOf, null, null)[0].value
                this.push({
                    id: namedNode(memberId),
                    quads: resourceStore.getQuads(null, null, null, null)
                })
            }
        })
        return resourceIdentifierStream.pipe(transformer);
    }
}
