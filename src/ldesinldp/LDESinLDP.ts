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
import {
    addRelationToNode,
    createContainer,
    createVersionedEventStream,
    getRelationIdentifier,
    retrieveWriteLocation
} from "./Util";
import {isContainerIdentifier} from "../util/IdentifierUtil";
import {Logger} from "../logging/Logger";
import namedNode = DataFactory.namedNode;
import {extractLdesMetadata} from "../util/LdesUtil";
import {filterRelation} from "../versionawarelil/Util";

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

        const relationIdentifier = getRelationIdentifier(config.LDESinLDPIdentifier, date)

        // add inbox
        store.addQuad(namedNode(config.LDESinLDPIdentifier), namedNode(LDP.inbox), namedNode(relationIdentifier))

        // send request to server to create base of the LDES in LDP
        await createContainer(config.LDESinLDPIdentifier, this.communication)
        const response = await this.communication.patch(config.LDESinLDPIdentifier + '.meta', // Note: currently meta hardcoded
            `INSERT DATA {${storeToString(store)}}`)


        if (response.status > 299 || response.status < 200) {
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
            throw new Error(`Resource not found: ${resourceIdentifier}`)
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

    public async newFragment(date?: Date) {
        date = date ?? new Date()
        const relationIdentifier = this._LDESinLDPIdentifier + date.getTime() + '/'

        // create new container
        await createContainer(relationIdentifier, this.communication)

        // get tree path from other relations
        // Assumptions: one view and at least one relation (all relations GTE)
        const metadataStore = await this.readMetadata()
        const eventStreamURI = metadataStore.getQuads(null, RDF.type, LDES.EventStream, null)[0].subject.value
        const metadata = extractLdesMetadata(metadataStore, eventStreamURI)
        const treePath = metadata.views[0].relations[0].path

        // create new relation
        const relationStore = new Store()
        addRelationToNode(relationStore, {date, nodeIdentifier: this._LDESinLDPIdentifier, treePath: treePath})

        // update metadata: both the relation and the inbox
        const currentInbox = await retrieveWriteLocation(this._LDESinLDPIdentifier, this.communication)
        const sparqlUpdateQuery = `DELETE DATA { <${this._LDESinLDPIdentifier}> <${LDP.inbox}> <${currentInbox}> .};
INSERT DATA { <${this._LDESinLDPIdentifier}> <${LDP.inbox}> <${relationIdentifier}> .
 ${storeToString(relationStore)} }`
        const response = await this.communication.patch(this._LDESinLDPIdentifier + '.meta', sparqlUpdateQuery)
        if (response.status > 299 || response.status < 200) {
            const deleteContainerResponse = await this.communication.delete(relationIdentifier)
            console.log(`Removing container ${relationIdentifier} | status code ${deleteContainerResponse.status}`)
            console.log(await response.text())
            throw Error(`The LDES metadata ${eventStreamURI} was not updated for the new relation ${relationIdentifier} | status code: ${response.status}`)
        }
    }


    public async readMetadata(): Promise<Store> {
        const rootStore = await this.read(this._LDESinLDPIdentifier)
        // This function only retrieves metadata of one layer deep
        // A proper read metadata MUST follow all the relation nodes (via link traversal)
        const metadataStore = new Store()

        // test whether it is indeed an EventStream
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

        const relations = filterRelation(ldesMetadata, from, until)

        const comm = this
        // stream of resources within the ldes in ldp

        const memberStream = new Readable({
            objectMode: true,
            read() {
            }
        })
        for (const relation of relations) {
            const resources = comm.readChildren(relation.node)
            for await (const resource of resources) {
                const memberId = resource.getSubjects(DCT.isVersionOf, null, null)[0].value
                memberStream.push({
                    id: namedNode(memberId),
                    quads: resource.getQuads(null, null, null, null)
                })
            }
        }
        memberStream.push(null)
        return memberStream
    }

    public async* readChildren(containerURL: string): AsyncIterable<Store> {
        if (isContainerIdentifier(containerURL)) {
            const store = await this.read(containerURL)
            const children = store.getObjects(containerURL, LDP.contains, null).map(value => value.value)
            for (const childURL of children) {
                const resourceStore = await this.read(childURL)
                yield resourceStore
            }
        }
    }
}
