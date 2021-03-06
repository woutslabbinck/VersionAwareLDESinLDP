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
import {extractLdesMetadata} from "../util/LdesUtil";

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

    public async initialise(config: LDESinLDPConfig, date?: Date): Promise<void> {
        if (!isContainerIdentifier(config.LDESinLDPIdentifier)) {
            throw Error(`${config.LDESinLDPIdentifier} is not a container identifier as it does not end with "/".`)
        }
        // maybe extra check to see whether it exists already?
        const containerResponse = await this.communication.head(config.LDESinLDPIdentifier)
        if (containerResponse.status === 200) {
            this.logger.info(`LDES in LDP ${config.LDESinLDPIdentifier} already exists.`)
            return
        }
        date = date ?? new Date()
        // create root container and add the metadata for the root, shape and inbox
        const store = new Store()

        // create versioned LDES and its view (with corresponding relation) and shape according to LDES specification
        // and add it to the store
        createVersionedEventStream(store, config, date)

        const relationIdentifier = config.LDESinLDPIdentifier + date.valueOf() + '/'

        // add inbox
        store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDP.inbox), namedNode(relationIdentifier))

        // send request to server to create base of the LDES in LDP
        await createContainer(config.LDESinLDPIdentifier, this.communication)
        const response = await this.communication.patch(config.LDESinLDPIdentifier + '.meta', // Note: currently meta hardcoded
            `INSERT DATA {${storeToString(store)}}`)

        if (response.status !== 205) {
            throw Error(`The container ${config.LDESinLDPIdentifier} its metadata was not updated | status code: ${response.status}`)
        }
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
        // Note: only retrieve metdata of one layer deep -> it should actually follow all the relation nodes
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

    public async readAllMembers(from?: Date, until?: Date): Promise<Readable> {
        // from and until only makes sense when working with GTE relation as defined in the LDES in LDP spec
        from = from ?? new Date(0)
        until = until ?? new Date()
        const rootStore = await this.readMetadata()
        const ldesIdentifier = rootStore.getSubjects(RDF.type, LDES.EventStream, null)[0].value
        const ldesMetadata = extractLdesMetadata(rootStore, ldesIdentifier)
// note: maybe with a sparql query in comunica?

        // complicated code to narrow down the number of nodes based on the GTE relations
        // if this errors, the relation value is not right in the metadata
        const timestamps = ldesMetadata.views[0].relations.map(({value}) => {
            return new Date(value).getTime()
        })
        const lowerthanFromTimestamps = timestamps.filter(timestamp => timestamp < from!.getTime())

        // the highest date in all relations smaller than (earlier than) from, that is just below from OR new Date(0)
        const fromRelationDate = timestamps.length > 0 ? new Date(Math.max(...lowerthanFromTimestamps)) : new Date(0)

        // node identifiers of the relations that have members in between from - until
        const nodeIdentifiers = ldesMetadata.views[0].relations.filter(({value}) => {
            const relationValue = new Date(value)

            if (relationValue.getTime() > fromRelationDate.getTime()) {
                return false
            }
            // if until is smaller than the relation value, then the relation is not needed
            return relationValue.getTime() < until!.getTime();
        }).map(({node}) => node)

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
                // can fail if it was actually not a member in the ldes
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
