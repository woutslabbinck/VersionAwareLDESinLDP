/***************************************
 * Title: VersionAwareLDESinLDP
 * Description: The operations to interact with a versioned LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 22/03/2022
 *****************************************/
import {ILDES} from "../ldes/ILDES";
import {DataFactory, Store} from "n3";
import {SnapshotTransform} from "@treecg/ldes-snapshot";
import {DCT, LDES, LDP, RDF} from "../util/Vocabularies";
import {isContainerIdentifier} from "../util/IdentifierUtil";
import {ISnapshotOptions} from "@treecg/ldes-snapshot/dist/src/SnapshotTransform";
import {Member} from '@treecg/types'
import {filterRelation} from "../util/LdesUtil";
import {addDeletedTriple, addVersionObjectTriples, isDeleted, removeVersionSpecificTriples} from "./Util";
import {extractDate, extractMaterializedId, extractVersionId} from "@treecg/ldes-snapshot/dist/src/util/SnapshotUtil";
import {VLILConfig} from "../metadata/VLILConfig";
import {MetadataParser} from "../metadata/MetadataParser";
import {IVersionedLDESinLDPMetadata} from "../metadata/VersionedLDESinLDPMetadata";
import {IRelation} from "../metadata/util/Interfaces";
import namedNode = DataFactory.namedNode;
import {Status} from "../ldes/Status";
import {ILDESinLDPMetadata} from "../metadata/LDESinLDPMetadata";
import {Logger} from "../logging/Logger";

export class VersionAwareLDESinLDP {
    private readonly LDESinLDP: ILDES;
    private readonly logger: Logger = new Logger(this);

    constructor(LDESinLDP: ILDES) {
        this.LDESinLDP = LDESinLDP
    }

    private get LDESinLDPIdentifier(): string {
        return this.LDESinLDP.LDESinLDPIdentifier
    }

    /**
     * Checks the {@link Status} of the versioned LDES in LDP.
     * Calls the {@link ILDES} status and when it is a valid {@link ILDESinLDPMetadata},
     * it performs a check to validate whether it is a valid {@link IVersionedLDESinLDPMetadata}.
     * @returns {Promise<Status>}
     */
    public async status(): Promise<Status> {
        let metadata: ILDESinLDPMetadata | undefined
        const status = await this.LDESinLDP.status()
        if (status.valid) {
            try {
                metadata = MetadataParser.extractVersionedLDESinLDPMetadata(await this.LDESinLDP.readMetadata())
            } catch (e) {

            }
            if (!metadata) {
                status.valid = false
            }
        }
        return status
    }

    /**
     * Initialises an LDES in LDP at the base using as tree:path dc:created and optionally the shape URL as tree:shape.
     * @param config
     * @returns {Promise<any>}
     */
    public async initialise(config?: VLILConfig): Promise<void> {
        const status = await this.status()
        if (status.found) {
            if (!status.valid) {
                this.logger.info(`Container (but not a versioned LDES in LDP) already exists at ${this.LDESinLDP.LDESinLDPIdentifier}.`)
            } else {
                this.logger.info(`Versioned LDES in LDP ${this.LDESinLDPIdentifier} already exists.`)
            }
            return
        }
        config = config ?? {treePath: DCT.created, versionOfPath: DCT.isVersionOf}
        // init normal LIL
        await this.LDESinLDP.initialise(config)
        // add version triples
        const lilMetadata = MetadataParser.extractLDESinLDPMetadata(await this.LDESinLDP.readMetadata())
        const ldesIdentifier = lilMetadata.eventStreamIdentifier

        // maybe in lil? It uses the communication already
        const response = await this.LDESinLDP.communication.patch(this.LDESinLDP.LDESinLDPIdentifier + ".meta", // Note: currently meta hardcoded
            `INSERT DATA { <${ldesIdentifier}> <${LDES.timestampPath}> <${config.treePath}> .
<${ldesIdentifier}> <${LDES.versionOfPath}> <${config.versionOfPath}> .}`)
        if (response.status > 299 || response.status < 200) {
            throw Error(`Failed to add version specific triples to ${this.LDESinLDP.LDESinLDPIdentifier} | status code: ${response.status}`)
        }
    }

    /**
     * Creates a new resource in the LDES in LDP using the protocol.
     * Also adds the timestamp and version triples.
     * Throws an error if the identifier already exists in the LDES in LDP
     *
     * Note: the memberID must correspond to the main subject in the graph
     * @param versionIdentifier The identifier of the version object
     * @param store Graph that you want to store
     * @param memberIdentifier The member identifier (used within the LDES)
     * @returns {Promise<any>}
     */
    public async create(versionIdentifier: string, store: Store, memberIdentifier?: string): Promise<void> {
        // check whether the version Identifier already exists
        let exists: boolean
        try {
            await this.read(versionIdentifier)
            exists = true
        } catch (e) {
            exists = false
        }
        if (exists) {
            throw Error(`Could not create ${versionIdentifier} as it already exists`)
        }

        // add version specific triples (defined in the LDES specification)
        const metadata = await this.extractLdesMetadata()
        memberIdentifier = memberIdentifier ? memberIdentifier : "#resource";
        addVersionObjectTriples(store, versionIdentifier, memberIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.append(store)
    }

    /**
     * Reads the (materialized) version of the resource if it exists.
     * When it does not exist OR when it is marked deleted, a not found error is returned.
     * In the materialized representation, the TREE/LDES specific triples are removed.
     * When the identifier is the base container, the returned representation is an ldp:BasicContainer representation
     * where each materialized identifier is added to the representation via an ldp:contains predicate.
     *
     * NOTE: this means without caching, each read will query over the entire LDES in LDP.
     *  This means that the biggest optimization will be achieved here.
     * @param versionIdentifier The identifier of the version object
     * @param options
     * @returns {Promise<Store>} (materialized) representation of the resource if it exists
     */
    public async read(versionIdentifier: string, options?: ReadOptions): Promise<Store> {

        let date = new Date()
        let materialized = true
        let derived = false
        if (options) {
            date = options.date ?? date
            materialized = options.materialized ?? materialized
            derived = options.derived ?? derived
        }
        const memberStream = await this.LDESinLDP.readAllMembers(new Date(0), date)

        const ldesMetadata = await this.extractLdesMetadata()
        const snapshotOptions: ISnapshotOptions = {
            date: date,
            ldesIdentifier: ldesMetadata.eventStreamIdentifier,
            materialized: materialized,
            snapshotIdentifier: this.LDESinLDP.LDESinLDPIdentifier, // is this right? The snapshot is derived from the original LDES in LDP
            timestampPath: ldesMetadata.timestampPath,
            versionOfPath: ldesMetadata.versionOfPath

        }

        const snapshotTransformer = new SnapshotTransform(snapshotOptions)
        const transformedStream = memberStream.pipe(snapshotTransformer)
        const store = new Store()

        if (isContainerIdentifier(versionIdentifier)) {
            // create ldp:BasicContainer representation
            if (this.LDESinLDP.LDESinLDPIdentifier === versionIdentifier) {
                store.addQuad(namedNode(this.LDESinLDP.LDESinLDPIdentifier), namedNode(RDF.type), namedNode(LDP.BasicContainer))
                for await (const member of transformedStream) {
                    if (!isDeleted(member, ldesMetadata)) {
                        // add resource to the container via ldp:contains
                        store.addQuad(namedNode(this.LDESinLDP.LDESinLDPIdentifier), namedNode(LDP.contains), member.id)

                        // add resource content when the option is derived
                        if (derived) {
                            // remove TREE/LDES specific triples when reading materialized
                            if (materialized) {
                                removeVersionSpecificTriples(member, ldesMetadata)
                            }
                            store.addQuads(member.quads)
                        }
                    }
                }
            } else {
                throw Error("A container can only be read if it is the base container (currently).")
            }
        } else {
            // filter out resource
            let memberResource = undefined
            for await (const member of transformedStream) {
                let materializedIDMember: string
                if (materialized) {
                    materializedIDMember = member.id.value
                } else {
                    materializedIDMember = extractMaterializedId(member, ldesMetadata.versionOfPath)
                }
                if (materializedIDMember === versionIdentifier) {
                    if (isDeleted(member, ldesMetadata)) {
                        throw Error("Member has been deleted.")
                    } else {
                        memberResource = member
                    }
                    break
                }
            }

            if (!memberResource) {
                throw Error(`404 Resource "${versionIdentifier}" was not found`)
            }

            // remove TREE/LDES specific triples when reading materialized
            if (materialized) {
                removeVersionSpecificTriples(memberResource, ldesMetadata)
            }

            // add quads to the store that will be returned
            store.addQuads(memberResource.quads)
        }
        return store
    }

    /**
     * Creates a new resource in the LDES in LDP using the protocol.
     * Also adds the timestamp and version triples.
     *
     * Note: the memberID must correspond to the main subject in the graph
     * @param versionIdentifier The identifier of the version object
     * @param store Graph that you want to store
     * @param memberIdentifier The member identifier (used within the LDES)
     * @returns {Promise<any>}
     */
    public async update(versionIdentifier: string, store: Store, memberIdentifier?: string): Promise<void> {
        // add version specific triples (defined in the LDES specification)
        const metadata = await this.extractLdesMetadata()
        memberIdentifier = memberIdentifier ? memberIdentifier : "#resource";
        addVersionObjectTriples(store, versionIdentifier, memberIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.append(store)
    }

    /**
     * Marks this resource as deleted from the LDES in LDP.
     * It is done by copying the latest non materialized resource, making it ldes:DeletedLDPResource class and performing the update operation.
     *
     * NOTE: this operation will not update the event stream when the latest non materialized resource was already deleted
     * @param versionIdentifier The identifier of the version object
     * @returns {Promise<void>}
     */
    public async delete(versionIdentifier: string): Promise<void> {
        let materializedResource: Store
        try {
            materializedResource = await this.read(versionIdentifier)
        } catch (e) {
            throw Error(`Could not delete ${versionIdentifier} as it does not exist already.`)
        }

        const newMemberIdentifier = "#resource" // maybe change later with uuid or something?
        const store = new Store()

        // copy latest version of the resource
        const quads = materializedResource.getQuads(null, null, null, null)
        for (const q of quads) {
            // transform quads which are coming from versionIdentifier
            if (q.subject.value === versionIdentifier) {
                // give new version specific identifier
                store.addQuad(namedNode(newMemberIdentifier), q.predicate, q.object)
            } else {
                // copy all others
                store.addQuad(q)
            }
        }

        // add version specific triples and deleted triple
        const metadata = await this.extractLdesMetadata()
        addVersionObjectTriples(store, versionIdentifier, newMemberIdentifier, metadata)
        addDeletedTriple(store, newMemberIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.append(store)
    }

    /**
     * Extract some basic LDES metadata
     *
     * @returns {Promise<IVersionedLDESinLDPMetadata>}
     */
    private async extractLdesMetadata(): Promise<IVersionedLDESinLDPMetadata> {
        const metadataStore = await this.LDESinLDP.readMetadata() // can fail (what if configuration is wrong)

        return MetadataParser.extractVersionedLDESinLDPMetadata(metadataStore)
    }

    public async extractVersions(versionIdentifier: string, extractOptions: ExtractOptions = {
        chronologically: false,
        amount: 1
    }): Promise<Member[]> {
        const startDate = extractOptions.startDate ?? new Date(0)
        const endDate = extractOptions.endDate ?? new Date()
        const amount = extractOptions.amount ?? Infinity

        // 1. filter out relations from TREE metadata that may contain versions
        const metadata = await this.extractLdesMetadata();
        const filteredRelations: IRelation[] = filterRelation(metadata, startDate, endDate)

        // 2. filter out different versions for the versionIdentifier (contained in the time window)
        if (!extractOptions.chronologically) {
            filteredRelations.reverse()
        }

        const datedMembers: MemberDate [] = []
        for (const relation of filteredRelations) {
            const resources = this.LDESinLDP.readPage(relation.node)

            for await (const resource of resources) {
                const resourceVersionID = extractVersionId(resource, metadata.versionOfPath)
                const resourceDate = extractDate(resource, metadata.timestampPath)
                if (resourceVersionID === versionIdentifier && resourceDate >= startDate && resourceDate <= endDate) {
                    const memberTerm = resource.getSubjects(metadata.versionOfPath, null, null)[0]
                    datedMembers.push({
                        id: memberTerm,
                        quads: resource.getQuads(null, null, null, null),
                        date: resourceDate
                    })
                }
            }
            if (datedMembers.length >= amount) {
                break
            }
        }

        datedMembers.sort((a, b) => {
            return a.date.getTime() - b.date.getTime()
        })

        if (!extractOptions.chronologically) {
            datedMembers.reverse()
        }
        return datedMembers.slice(0, extractOptions.amount)
    }
}

interface MemberDate extends Member {
    date: Date
}

export interface ReadOptions {
    date?: Date
    materialized?: boolean
    derived?: boolean
}

export interface ExtractOptions {
    /**
     * When true, versions are extracted from the earliest point in time
     */
    chronologically: boolean
    /**
     * Amount of versions to be extracted
     */
    amount?: number
    /**
     * Start dateTime of the extraction
     */
    startDate?: Date;
    /**
     * End dateTime of the extraction
     */
    endDate?: Date;
}
