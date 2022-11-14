import {ILDES} from "./ILDES";
import {Communication} from "../ldp/Communication";
import {Logger} from "../logging/Logger";
import {filterRelation, LDESMetadata} from "../util/LdesUtil";
import {ILDESinLDPMetadata} from "../metadata/LDESinLDPMetadata";
import {DataFactory, Store} from "n3";
import {Readable} from "stream";
import {MetadataParser} from "../metadata/MetadataParser";
import {MetadataInitializer} from "../metadata/MetadataInitializer";
import {isContainerIdentifier} from "../util/IdentifierUtil";
import {createContainer, extractMembers, getRelationIdentifier, retrieveWriteLocation} from "./Util";
import {storeToString, turtleStringToStore} from "../util/Conversion";
import {LILConfig} from "../metadata/LILConfig";
import {LDP, TREE} from "../util/Vocabularies";
import {GreaterThanOrEqualToRelation} from "../metadata/util/Components";
import namedNode = DataFactory.namedNode;

/***************************************
 * Title: LDESinLDP
 * Description: LDES in LDP (implementation uses the Community Solid Server (CSS))
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
export class LDESinLDP implements ILDES {
    private readonly _LDESinLDPIdentifier: string;
    private readonly _communication: Communication;
    private readonly logger: Logger = new Logger(this);
    private metadata: ILDESinLDPMetadata;


    constructor(LDESinLDPIdentifier: string, communication: Communication) {
        this._LDESinLDPIdentifier = LDESinLDPIdentifier;
        this._communication = communication;
        this.metadata = MetadataInitializer.createLDESinLDPMetadata(LDESinLDPIdentifier)

        if (!isContainerIdentifier(LDESinLDPIdentifier)) {
            throw Error(`${LDESinLDPIdentifier} is not a container identifier as it does not end with "/".`)
        }
    }

    get LDESinLDPIdentifier(): string {
        return this._LDESinLDPIdentifier;
    }

    get communication(): Communication {
        return this._communication;
    }

    private get fragmentSize(): number {
        return this.metadata.fragmentSize
    }

    public async append(store: Store): Promise<string> {
        const inboxURL = await retrieveWriteLocation(this.LDESinLDPIdentifier, this.communication);
        // update metadata if write location is different from current inboxURL based on metadata
        await this.updateMetadata(inboxURL)
        await this.maybeNewFragment();

        this.logger.debug("page size" + this.metadata.fragmentSize)
        const response = await this.communication.post(this.metadata.inbox, storeToString(store))
        if (response.status !== 201) {
            throw Error(`The resource was not be created at ${this.metadata.inbox} 
            | status code: ${response.status}`)
        }
        const resourceLocation = response.headers.get('Location')
        if (!resourceLocation) {
            throw Error("Did not receive the location of the created resource.")
        }
        this.logger.info(`LDP Resource created at: ${resourceLocation}`)
        if (store.countQuads(this.metadata.eventStreamIdentifier, TREE.member, null, null) === 0) {
            this.logger.info(`No tree:member triple in resource ${resourceLocation}`)
        }
        return resourceLocation
    }

    public async initialise(config: LILConfig): Promise<void> {
        const containerResponse = await this.communication.head(this.LDESinLDPIdentifier)
        if (containerResponse.status === 200) {
            try {
                this.metadata = await this.extractLdesMetadata()
                this.logger.info(`LDES in LDP ${this.LDESinLDPIdentifier} already exists.`)
            } catch (e) {
                this.logger.info(`Container (but not an LDES in LDP) already exists at ${this.LDESinLDPIdentifier}.`)
            }
            return
        }
        const date = config.date ?? new Date()

        const metadata = MetadataInitializer.createLDESinLDPMetadata(this.LDESinLDPIdentifier, {
            lilConfig: config,
            date: date
        })
        const store = metadata.getStore()

        // send request to server to create base of the LDES in LDP
        await createContainer(this.LDESinLDPIdentifier, this.communication)
        const response = await this.communication.patch(this.LDESinLDPIdentifier + '.meta', // Note: currently meta hardcoded
            `INSERT DATA {${storeToString(store)}}`)


        if (response.status > 299 || response.status < 200) {
            throw Error(`The container ${this.LDESinLDPIdentifier} its metadata was not updated | status code: ${response.status}`)
        }
        // create first relation container
        await createContainer(metadata.view.relations[0].node, this.communication)

        // update ldes metadata
        this.metadata = MetadataParser.extractLDESinLDPMetadata(store)
    }

    public async newFragment(date?: Date): Promise<void> {
        date = date ?? new Date()
        const relationIdentifier = getRelationIdentifier(this.LDESinLDPIdentifier, date)

        // create new container
        await createContainer(relationIdentifier, this.communication)

        let treePath: string
        if (this.metadata.view.viewDescription) {
            treePath = this.metadata.view.viewDescription.managedBy.bucketizeStrategy.path
        } else {
            // will fail if there is no relation in the LIL
            treePath = this.metadata.view.relations[0].path
        }

        const newRelation = new GreaterThanOrEqualToRelation(relationIdentifier, treePath, date.toISOString())
        const newRelationStore = newRelation.getStore()
        const relationNode = newRelationStore.getSubjects(null, null, null)[0]
        newRelationStore.addQuad(namedNode(this.metadata.rootNodeIdentifier), TREE.terms.relation, relationNode)

        const currentInbox = await retrieveWriteLocation(this._LDESinLDPIdentifier, this.communication)
        await this.updateMetadata(currentInbox)
        // TODO search in relations and find the value in the relation (matching with the node)
        //  only if  (current inboxTime > date) change inbox triples
        const sparqlUpdateQuery = `DELETE DATA { <${this.LDESinLDPIdentifier}> <${LDP.inbox}> <${currentInbox}> .};
INSERT DATA { <${this.LDESinLDPIdentifier}> <${LDP.inbox}> <${relationIdentifier}> .
 ${storeToString(newRelationStore)} }`
        const response = await this.communication.patch(this._LDESinLDPIdentifier + '.meta', sparqlUpdateQuery)
        if (response.status > 299 || response.status < 200) {
            const deleteContainerResponse = await this.communication.delete(relationIdentifier)
            this.logger.info(`Removing container ${relationIdentifier} | status code ${deleteContainerResponse.status}`)
            this.logger.info(await response.text())
            throw Error(`The LDES metadata ${this.metadata.eventStreamIdentifier} was not updated for the new relation ${relationIdentifier} | status code: ${response.status}`)
        }
        // todo: update metadata -> need methods in ILILMetadata to add relation and to change inbox
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

    public async readAllMembers(from?: Date, until?: Date): Promise<Readable> {
        // from and until only makes sense when working with GTE relation as defined in the LDES in LDP spec
        from = from ?? new Date(0)
        until = until ?? new Date()

        const metadata = await this.extractLdesMetadata()
        const relations = filterRelation(metadata, from, until)

        const comm = this
        // stream of resources within the ldes in ldp

        const memberStream = new Readable({
            objectMode: true,
            read() {
            }
        })

        for (const relation of relations) {
            const resources = comm.readPage(relation.node)
            for await (const resource of resources) {
                // member ID is based on tree:path
                let memberId = resource.getSubjects(relation.value, null, null)[0].value
                if (resource.getQuads(this.metadata.eventStreamIdentifier, TREE.member, null, null).length === 1) { // TODO check if this ever happens and if useful
                    memberId = resource.getQuads(this.metadata.eventStreamIdentifier, TREE.member, null, null)[0].object.value
                }

                // remove containment triple if present (<ldesIdentifer> <tree:member> memberId.)
                resource.removeQuads(resource.getQuads(this.metadata.eventStreamIdentifier, TREE.member, null, null))
                memberStream.push({
                    id: namedNode(memberId),
                    quads: resource.getQuads(null, null, null, null)
                })
            }
        }
        memberStream.push(null)
        return memberStream
    }

    public async readMetadata(): Promise<Store> {
        // This function only retrieves metadata of one layer deep
        // A proper read metadata MUST follow all the relation nodes (via link traversal)
        const rootStore = await this.read(this.LDESinLDPIdentifier)

        // test whether it is indeed an LIL EventStream
        try {
            MetadataParser.extractLDESinLDPMetadata(rootStore)
        } catch (e) {
            throw Error(`${this.LDESinLDPIdentifier} is not an actual base of an LDES in LDP.`);
        }
        return rootStore
    }

    /**
     * Return all the resources (members) of a container as an Iterable.
     * @param containerURL
     */
    public async* readPage(containerURL: string): AsyncIterable<Store> {
        if (isContainerIdentifier(containerURL)) {
            const store = await this.read(containerURL)
            const children = store.getObjects(containerURL, LDP.contains, null).map(value => value.value)
            for (const childURL of children) {
                const resourceStore = await this.read(childURL)
                if (resourceStore.countQuads(this.metadata.eventStreamIdentifier, TREE.member, null, null) === 0) {
                    yield resourceStore
                } else {
                    // extract members
                    const members = extractMembers(resourceStore, this.metadata.eventStreamIdentifier)
                    for (const member of members) {
                        yield member
                    }
                }
            }
        }
    }

    /**
     * Extract some basic LDES metadata
     *
     * @returns {Promise<LDESMetadata>}
     */
    private async extractLdesMetadata(): Promise<ILDESinLDPMetadata> {
        const metadataStore = await this.readMetadata()
        return MetadataParser.extractLDESinLDPMetadata(metadataStore)
    }

    /**
     * Update the metadata based on the inbox? TODO check if makes sense
     * @param inboxURL
     * @returns {Promise<void>}
     */
    private async updateMetadata(inboxURL: string): Promise<void> {
        if (this.metadata.inbox !== inboxURL) {
            this.metadata = await this.extractLdesMetadata()
        }
    }

    /**
     * Create new fragment based on fragment size
     * @returns {Promise<void>}
     */
    private async maybeNewFragment(): Promise<void> {
        if (this.fragmentSize !== Infinity) {
            const fragmentStore = await this.read(this.metadata.inbox)
            const numberChildren = fragmentStore.countQuads(this.metadata.inbox, LDP.contains, null, null)

            if (numberChildren >= this.fragmentSize) {
                await this.newFragment()
            }
        }
    }
}
