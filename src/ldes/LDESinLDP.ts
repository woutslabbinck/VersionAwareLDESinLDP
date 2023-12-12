import {ILDES} from "./ILDES";
import {Communication} from "../ldp/Communication";
import {Logger} from "../logging/Logger";
import {filterRelation} from "../util/LdesUtil";
import {ILDESinLDPMetadata} from "../metadata/LDESinLDPMetadata";
import {DataFactory, Literal, Store} from "n3";
import {Readable} from "stream";
import {MetadataParser} from "../metadata/MetadataParser";
import {MetadataInitializer} from "../metadata/MetadataInitializer";
import {isContainerIdentifier} from "../util/IdentifierUtil";
import {
    createContainer,
    extractMembers,
    getRelationIdentifier,
    retrieveDateTimeFromInbox,
    retrieveWriteLocation
} from "./Util";
import {storeToString, turtleStringToStore} from "../util/Conversion";
import {LILConfig} from "../metadata/LILConfig";
import {LDP, TREE} from "../util/Vocabularies";
import {GreaterThanOrEqualToRelation} from "../metadata/util/Components";
import {Status} from "./Status";
// @ts-ignore
import * as WacAllow from 'wac-allow';
import {extractDateFromLiteral} from "../util/TimestampUtil";
import {patchSparqlUpdateDelete, patchSparqlUpdateInsert} from "../util/PatchUtil";
import {quad} from "@rdfjs/data-model";
import {Member} from "@treecg/types";
import {extractDateFromMember} from "../util/MemberUtil";
import namedNode = DataFactory.namedNode;

/***************************************
 * Title: LDESinLDP
 * Description: LDES in LDP (implementation uses the Community Solid Server (CSS))
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
export class LDESinLDP implements ILDES {
    private readonly _LDESinLDPIdentifier: string;
    private readonly _eventStreamIdentifier: string;

    private readonly _communication: Communication;
    private readonly logger: Logger = new Logger(this);
    private metadata: ILDESinLDPMetadata;

    constructor(LDESinLDPIdentifier: string, communication: Communication, args?: { eventStreamIdentifier?: string }) {
        this._LDESinLDPIdentifier = LDESinLDPIdentifier;
        this._communication = communication;
        this.metadata = MetadataInitializer.generateLDESinLDPMetadata(LDESinLDPIdentifier, args)
        this._eventStreamIdentifier = this.metadata.eventStreamIdentifier
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

    get eventStreamIdentifier(): string {
        return this._eventStreamIdentifier;
    }

    async status(): Promise<Status> {
        const status: Status = {
            empty: false, found: false, full: false, valid: false, writable: false
        }
        let foundResponse: Response | undefined
        let metadata: ILDESinLDPMetadata | undefined

        try {
            foundResponse = await this.communication.head(this.LDESinLDPIdentifier)
            if (foundResponse.status !== 200) {
                return status
            }
            const store = await this.read(this.LDESinLDPIdentifier)
            metadata = MetadataParser.extractLDESinLDPMetadata(store, this.eventStreamIdentifier)
        } catch (e) {

        }
        if (!foundResponse) {
            return status
        }
        status.found = true
        if (!metadata) {
            return status
        }
        status.valid = true

        const {user} = WacAllow.parse(foundResponse)
        status.writable = user.has('write')

        if (metadata.view.relations.length === 1) {
            const nodeURL = metadata.view.relations[0].node
            const relationResponse = await this.read(nodeURL)
            status.empty = relationResponse.getQuads(nodeURL, LDP.contains, null, null).length === 0
        }
        // currently, full will always be false: https://github.com/woutslabbinck/VersionAwareLDESinLDP/issues/16#issuecomment-1321817921
        return status;
    }


    public async initialise(config: LILConfig): Promise<void> {
        const status = await this.status()
        if (status.found) {
            if (!status.valid) {
                this.logger.info(`Container (but not an LDES in LDP) already exists at ${this.LDESinLDPIdentifier}.`)
            } else {
                this.logger.info(`LDES in LDP ${this.LDESinLDPIdentifier} already exists.`)
                this.metadata = await this.extractLdesMetadata()
            }
            return
        }
        const date = config.date ?? new Date()

        const metadata = MetadataInitializer.generateLDESinLDPMetadata(this.LDESinLDPIdentifier, {
            lilConfig: config,
            date: date,
            eventStreamIdentifier: this.eventStreamIdentifier
        })
        const store = metadata.getStore()

        // send request to server to create base of the LDES in LDP
        await createContainer(this.LDESinLDPIdentifier, this.communication)
        const response = await this.communication.patch(this.LDESinLDPIdentifier + '.meta', // Note: currently meta hardcoded
            patchSparqlUpdateInsert(store))

        if (response.status > 299 || response.status < 200) {
            throw Error(`The container ${this.LDESinLDPIdentifier} its metadata was not updated | status code: ${response.status}`)
        }
        // create first relation container
        await createContainer(metadata.view.relations[0].node, this.communication)

        // update ldes metadata
        this.metadata = MetadataParser.extractLDESinLDPMetadata(store, this.eventStreamIdentifier)
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

    public async newFragment(date?: Date): Promise<void> {
        date = date ?? new Date()
        await this.updateMetadata()
        const currentInbox = this.metadata.inbox
        let treePath: string

        if (this.metadata.view.viewDescription) {
            treePath = this.metadata.view.viewDescription.managedBy.bucketizeStrategy.path
        } else {
            // will fail if there is no relation in the LIL
            treePath = this.metadata.view.relations[0].path
        }

        // create new container
        const relationIdentifier = getRelationIdentifier(this.LDESinLDPIdentifier, date)
        await createContainer(relationIdentifier, this.communication)

        const newRelation = new GreaterThanOrEqualToRelation(relationIdentifier, treePath, date.toISOString())
        const newRelationStore = newRelation.getStore()
        const relationNode = newRelationStore.getSubjects(null, null, null)[0]
        newRelationStore.addQuad(namedNode(this.metadata.rootNodeIdentifier), TREE.terms.relation, relationNode)


        // update metadata for the new relation (both local and remote)
        this.metadata.view.relations.push(newRelation)
        const inboxDateTime = retrieveDateTimeFromInbox(this.metadata)
        const queries = []
        let sparqlUpdateQuery = ""
        if (inboxDateTime < date) {
            // update the inbox if necessary
            const removeOldInboxStore = new Store([quad(namedNode(this.LDESinLDPIdentifier), LDP.terms.inbox, namedNode(currentInbox))])
            const addNewInboxStore = new Store([quad(namedNode(this.LDESinLDPIdentifier), LDP.terms.inbox, namedNode(relationIdentifier))])

            queries.push(patchSparqlUpdateDelete(removeOldInboxStore))
            queries.push(patchSparqlUpdateInsert(addNewInboxStore))
            this.metadata.inbox = relationIdentifier
        }
        queries.push(patchSparqlUpdateInsert(newRelationStore))
        sparqlUpdateQuery += queries.join("\n")

        const response = await this.communication.patch(this._LDESinLDPIdentifier + '.meta', sparqlUpdateQuery)
        if (response.status > 299 || response.status < 200) {
            const deleteContainerResponse = await this.communication.delete(relationIdentifier)
            this.logger.info(`Removing container ${relationIdentifier} | status code ${deleteContainerResponse.status}`)
            this.logger.info(await response.text())
            throw Error(`The LDES metadata ${this.metadata.eventStreamIdentifier} was not updated for the new relation ${relationIdentifier} | status code: ${response.status}`)
        }
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
            const resources = comm.readPage(relation.node,{from, until})
            for await (const resource of resources) {
                // member ID is based on tree:path
                let memberId = resource.getSubjects(relation.path, null, null)[0].value

                // remove containment triple if present (<ldesIdentifer> <tree:member> memberId.)
                resource.removeQuads(resource.getQuads(this.metadata.eventStreamIdentifier, TREE.member, null, null))

                // member date
                const dateLiteral = resource.getObjects(memberId, relation.path, null)[0] as Literal
                const memberDateTime = extractDateFromLiteral(dateLiteral)
                // add only members within window to stream
                if (from <= memberDateTime && memberDateTime <= until) {
                    memberStream.push({
                        id: namedNode(memberId),
                        quads: resource.getQuads(null, null, null, null)
                    })
                }
            }
        }
        memberStream.push(null)
        return memberStream
    }

    public async readMembersSorted(opts?: { from?: Date; until?: Date; chronological?: boolean }): Promise<Readable> {
        opts = opts ?? {}
        const from = opts.from ?? new Date(0)
        const until = opts.until ?? new Date()
        const chronological = opts.chronological ?? true;

        const comm = this

        // Note: currently only implemented for chronological
        const metadata = await this.extractLdesMetadata()
        const relations = filterRelation(metadata, from, until)

        const memberStream = new Readable({
            objectMode: true,
            read() {
            }
        })

        for (const relation of relations) {
            const resources = comm.readPage(relation.node,{from, until})
            const members: Member[] = []
            for await (const resource of resources) {
                // member ID is based on tree:path
                let memberId = resource.getSubjects(relation.path, null, null)[0].value

                // remove containment triple if present (<ldesIdentifer> <tree:member> memberId.)
                resource.removeQuads(resource.getQuads(this.metadata.eventStreamIdentifier, TREE.member, null, null))

                const member: Member = {
                    id: namedNode(memberId),
                    quads: resource.getQuads(null, null, null, null)

                }

                // member date
                const memberDateTime = extractDateFromMember(member, relation.path);

                // add only members within window to stream
                if (from <= memberDateTime && memberDateTime <= until) {
                    members.push({
                        id: namedNode(memberId),
                        quads: resource.getQuads(null, null, null, null),
                    })
                }
            }
            // sort member chronologically
            const sortedMembers = members.sort((a: Member, b: Member) => {
                const dateA = extractDateFromMember(a, relation.path);
                const dateB = extractDateFromMember(b, relation.path);
                return dateA.getTime() - dateB.getTime()
            })

            // push members o stream
            sortedMembers.forEach(member => memberStream.push(member))
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
            MetadataParser.extractLDESinLDPMetadata(rootStore, this.eventStreamIdentifier)
        } catch (e) {
            throw Error(`${this.LDESinLDPIdentifier} is not an actual base of an LDES in LDP.`);
        }
        return rootStore
    }

    /**
     * Return all the resources (members) of a container as an Iterable.
     * @param containerURL
     * @param opts : optional argument that can help filter out members within a range (can only be used if there is metadata in the container)
     */
    public async* readPage(containerURL: string, opts?: {
        from?: Date;
        until?: Date;
    }): AsyncIterable<Store> {
        if (isContainerIdentifier(containerURL)) {
            const store = await this.read(containerURL)
            const pageMetadata = await this.pageMedata(containerURL, store)
            let children: string[] = []

            if (opts?.from && opts?.until && pageMetadata) {
                // https://github.com/woutslabbinck/VersionAwareLDESinLDP/issues/34
                children = filterRelation(pageMetadata, opts.from, opts.until).map(relation => relation.node)
            } else {
                children = store.getObjects(containerURL, LDP.contains, null).map(value => value.value)
            }
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
     * @returns {Promise<ILDESinLDPMetadata>}
     */
    private async extractLdesMetadata(): Promise<ILDESinLDPMetadata> {
        const metadataStore = await this.readMetadata()
        return MetadataParser.extractLDESinLDPMetadata(metadataStore, this.eventStreamIdentifier)
    }

    /**
     * Updates the metadata of the LDES.
     *
     * If an inbox argument is given, and it is different from the current metadata, the metadata must also be updated.
     * Otherwise, it is still up-to-date.
     * @param inboxURL
     * @returns {Promise<void>}
     */
    private async updateMetadata(inboxURL?: string): Promise<void> {
        if (!inboxURL) {
            this.metadata = await this.extractLdesMetadata()
            return
        }
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

    private async pageMedata(containerURL: string, store: Store): Promise<ILDESinLDPMetadata | undefined> {
        let pageMetadata = undefined
        store.addQuad(namedNode(this._LDESinLDPIdentifier), LDP.terms.inbox, namedNode(containerURL))
        try {
            pageMetadata = MetadataParser.extractLDESinLDPMetadata(store)
        } catch (e) {
        }
        return pageMetadata
    }
}
