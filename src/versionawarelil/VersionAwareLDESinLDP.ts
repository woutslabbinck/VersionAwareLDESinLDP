/***************************************
 * Title: VersionAwareLDESinLDP
 * Description: The operations to interact with a versioned LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 22/03/2022
 *****************************************/
import {ILDESinLDP} from "../ldesinldp/ILDESinLDP";
import {DataFactory, Store} from "n3";
import {SnapshotTransform} from "@treecg/ldes-snapshot";
import {DCT, LDES, LDP, RDF} from "../util/Vocabularies";
import {isContainerIdentifier} from "../util/IdentifierUtil";
import {ISnapshotOptions} from "@treecg/ldes-snapshot/dist/src/SnapshotTransform";
import {Member} from '@treecg/types'
import {extractLdesMetadata, LDESMetadata} from "../util/LdesUtil";
import {addDeletedTriple, addVersionSpecificTriples, isDeleted, removeVersionSpecificTriples} from "./Util";
import namedNode = DataFactory.namedNode;

export class VersionAwareLDESinLDP {
    private readonly LDESinLDP: ILDESinLDP;

    constructor(LDESinLDP: ILDESinLDP) {
        this.LDESinLDP = LDESinLDP
    }

    /**
     * Initialises an LDES in LDP at the base using as tree:path dc:created and optionally the shape URL as tree:shape.
     * @param ldpContainerIdentifier base URL where the LDES in LDP will reside
     * @param shape shape URL
     * @returns {Promise<any>}
     */
    public async initialise(ldpContainerIdentifier: string, shape?: string): Promise<void> {
        await this.LDESinLDP.initialise({
            LDESinLDPIdentifier: ldpContainerIdentifier,
            shape: shape,
            treePath: DCT.created
        })
    }

    /**
     * Creates a new resource in the LDES in LDP using the protocol.
     * Also adds the timestamp and version triples.
     * Throws an error if the identifier already exists in the LDES in LDP
     * @param materializedResourceIdentifier Identifier for the graph that you want to store
     * @param store Graph that you want to store
     * @param versionSpecificIdentifier Identifier that is the base of the RDF graph you are trying to store | TODO: properly explain
     * @returns {Promise<any>}
     */
    public async create(materializedResourceIdentifier: string, store: Store, versionSpecificIdentifier?: string): Promise<void> {
        // check whether it exists already
        let exists: boolean
        try {
            await this.read(materializedResourceIdentifier)
            exists = true
        } catch (e) {
            exists = false
        }
        if (exists) {
            throw Error(`Could not create ${materializedResourceIdentifier} as it already exists`)
        }

        // add version specific triples (defined in the LDES specification)
        const metadata = await this.extractLdesMetadata()
        versionSpecificIdentifier = versionSpecificIdentifier ? versionSpecificIdentifier : "#resource";
        addVersionSpecificTriples(store, materializedResourceIdentifier, versionSpecificIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.create(store)
    }

    /**
     * Reads the materialized version of the resource if it exists.
     * When it does not exist OR when it is marked deleted, a not found error is returned.
     * In this materialized representation, the TREE/LDES specific triples are removed.
     * When the identifier is the base container, the returned representation is an ldp:BasicContainer representation
     * where each materialized identifier is added to the representation via an ldp:contains predicate.
     *
     * NOTE: this means without caching, each read will query over the entire LDES in LDP.
     *  This means that the biggest optimization will be achieved here.
     * @param materializedResourceIdentifier
     * @param options
     * @returns {Promise<Store>} materialized representation of the resource if it exists
     */
    public async read(materializedResourceIdentifier: string, options?: ReadOptions): Promise<Store> {

        let date = new Date()
        let materialized = true
        let derived = false
        if (options) {
            date = options.date ?? date
            materialized = options.materialized ?? materialized
            derived = options.derived ?? derived
        }
        const memberStream = await this.LDESinLDP.readAllMembers(new Date(), date)

        const ldesMetadata = await this.extractLdesMetadata()
        const snapshotOptions: ISnapshotOptions = {
            date: date,
            ldesIdentifier: ldesMetadata.ldesEventStreamIdentifier,
            materialized: materialized,
            snapshotIdentifier: this.LDESinLDP.LDESinLDPIdentifier, //todo: is this right?
            timestampPath: ldesMetadata.timestampPath,
            versionOfPath: ldesMetadata.versionOfPath

        }

        const snapshotTransformer = new SnapshotTransform(snapshotOptions)
        const transformedStream = memberStream.pipe(snapshotTransformer)
        const store = new Store()

        if (isContainerIdentifier(materializedResourceIdentifier)) {
            // create ldp:BasicContainer representation
            if (this.LDESinLDP.LDESinLDPIdentifier === materializedResourceIdentifier) {
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
                if (materializedIDMember === materializedResourceIdentifier) {
                    if (isDeleted(member, ldesMetadata)) {
                        throw Error("Member has been deleted.")
                    } else {
                        memberResource = member
                    }
                    break
                }
            }

            if (!memberResource) {
                throw Error(`404 Resource "${materializedResourceIdentifier}" was not found`)
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
     * Updates a resource in the LDES in LDP using the protocol.
     * Also adds the timestamp and version triples.
     * Throws an error if the identifier does not exist yet in the LDES in LDP
     * @param materializedResourceIdentifier
     * @param store
     * @param versionSpecificIdentifier
     * @returns {Promise<any>}
     */
    public async update(materializedResourceIdentifier: string, store: Store, versionSpecificIdentifier?: string): Promise<void> {
        // check whether it exists already
        try {
            await this.read(materializedResourceIdentifier)
        } catch (e) {
            throw Error(`Could not update ${materializedResourceIdentifier} as it does not exist already.`)
        }

        // add version specific triples (defined in the LDES specification)
        const metadata = await this.extractLdesMetadata()
        versionSpecificIdentifier = versionSpecificIdentifier ? versionSpecificIdentifier : "#resource";
        addVersionSpecificTriples(store, materializedResourceIdentifier, versionSpecificIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.update(store)
    }

    /**
     * Marks this resource as deleted from the LDES in LDP.
     * It is done by copying the latest non materialized resource, making it ldes:DeletedLDPResource class and performing the update operation.
     *
     * NOTE: this operation will not update the event stream when the latest non materialized resource was already deleted
     * @param materializedResourceIdentifier
     * @returns {Promise<void>}
     */
    public async delete(materializedResourceIdentifier: string): Promise<void> {
        let materializedResource: Store
        try {
            materializedResource = await this.read(materializedResourceIdentifier)
        } catch (e) {
            throw Error(`Could not delete ${materializedResourceIdentifier} as it does not exist already.`)
        }

        const versionSpecificIdentifier = "#resource"
        const store = new Store()

        // copy latest version of the resource
        const quads = materializedResource.getQuads(null, null, null, null)
        for (const q of quads) {
            // transform quads which are coming from materializedResourceIdentifier
            if (q.subject.value === materializedResourceIdentifier) {
                // give new version specific identifier
                store.addQuad(namedNode(versionSpecificIdentifier), q.predicate, q.object)
            } else {
                // copy all others
                store.addQuad(q)
            }
        }

        // add version specific triples and deleted triple
        const metadata = await this.extractLdesMetadata()
        addVersionSpecificTriples(store, materializedResourceIdentifier, versionSpecificIdentifier, metadata)
        addDeletedTriple(store, versionSpecificIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.delete(store)
    }

    /**
     * Extract some basic LDES metadata
     *
     * @returns {Promise<LDESMetadata>}
     */
    private async extractLdesMetadata(): Promise<LDESMetadata> {
        const metadataStore = await this.LDESinLDP.readMetadata() // can fail (what if configuration is wrong)
        const ldesIdentifier = metadataStore.getSubjects(RDF.type, LDES.EventStream, null)[0].value
        // maybe check if this.LDESinLDP.LDESinLDPIdentifier is in ldesIdentifier

        return extractLdesMetadata(metadataStore, ldesIdentifier)
    }
}


export interface ReadOptions {
    date?: Date
    materialized?: boolean
    derived?: boolean
}

function extractMaterializedId(member: Member, versionOfPath: string): string { // todo: test and import from snapshot
    const store = new Store(member.quads)
    const versionIds = store.getObjects(member.id, namedNode(versionOfPath), null)
    if (versionIds.length !== 1) {
        throw Error(`Found ${versionIds.length} identifiers following the version paths of ${member.id.value}; expected one such identifier.`)
    }
    return versionIds[0].value
}
