/***************************************
 * Title: VersionAwareLDESinLDP
 * Description: TODO
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 22/03/2022
 *****************************************/
import {ILDESinLDP} from "../ldesinldp/ILDESinLDP";
import {DataFactory, Store} from "n3";
import {SnapshotTransform} from "@treecg/ldes-snapshot";
import {DCT, LDES, LDP, RDF} from "../util/Vocabularies";
import {isContainerIdentifier} from "../util/IdentifierUtil";
import {extractSnapshotOptions} from "@treecg/ldes-snapshot/dist/src/util/SnapshotUtil";
import {ISnapshotOptions} from "@treecg/ldes-snapshot/dist/src/SnapshotTransform";
import {dateToLiteral} from "../util/TimestampUtil";
import {Member} from '@treecg/types'
import namedNode = DataFactory.namedNode;
import quad = DataFactory.quad;

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
        let exists = false
        try {
            await this.read(materializedResourceIdentifier)
            exists = true
        } catch (e) {
            exists = false
        }
        if (exists) {
            throw Error(`Could not create ${materializedResourceIdentifier} as it already exists`)
        }

        const member = {id: namedNode(materializedResourceIdentifier), quads: store.getQuads(null, null, null, null)}

        // add version specific triples (defined in the LDES specification)
        const metadata = await this.extractLdesMetadata()
        versionSpecificIdentifier = versionSpecificIdentifier ? versionSpecificIdentifier : "#resource";
        VersionAwareLDESinLDP.addVersionSpecificTriples(member, versionSpecificIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.create(new Store(member.quads))
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
     * @returns {Promise<Store>} materialized representation of the resource if it exists
     */
    public async read(materializedResourceIdentifier: string): Promise<Store> {
        // TODO: maybe add optional parameter of the date?
        const memberStream = await this.LDESinLDP.readAllMembers()

        const ldesMetadata = await this.extractLdesMetadata()
        const snapshotOptions: ISnapshotOptions = {
            date: new Date(),
            ldesIdentifier: ldesMetadata.ldesEventStreamIdentifier,
            materialized: true,
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
                    if (!VersionAwareLDESinLDP.isDeleted(member, ldesMetadata)) {
                        store.addQuad(namedNode(this.LDESinLDP.LDESinLDPIdentifier), namedNode(LDP.contains), member.id)
                        // todo: remove experimental virtual containers OR make it possible via options
                        //  feedback Pieter: also make it possible to not be version materialized
                        // VersionAwareLDESinLDP.removeVersionSpecificTriples(member, ldesMetadata)
                        // store.addQuads(member.quads)
                    }
                }
            } else {
                throw Error("A container can only be read if it is the base container (currently).")
            }
        } else {
            // filter out materialized resource
            let materializedResource = undefined
            for await (const member of transformedStream) {
                if (member.id.value === materializedResourceIdentifier) {
                    if (VersionAwareLDESinLDP.isDeleted(member, ldesMetadata)) {
                        throw Error("Member has been deleted.")
                    } else {
                        materializedResource = member
                    }
                    break
                }
            }

            // remove TREE/LDES specific triples
            if (materializedResource) {
                VersionAwareLDESinLDP.removeVersionSpecificTriples(materializedResource, ldesMetadata)
                store.addQuads(materializedResource.quads)
            } else {
                throw Error("404 Resource was not found")
            }
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

        const member: Member = {
            id: namedNode(materializedResourceIdentifier),
            quads: store.getQuads(null, null, null, null)
        }

        // add version specific triples (defined in the LDES specification)
        const metadata = await this.extractLdesMetadata()
        versionSpecificIdentifier = versionSpecificIdentifier ? versionSpecificIdentifier : "#resource";
        VersionAwareLDESinLDP.addVersionSpecificTriples(member, versionSpecificIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.update(new Store(member.quads))
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
        let materializedResource: Store | undefined
        try {
            materializedResource = await this.read(materializedResourceIdentifier)
        } catch (e) {
            throw Error(`Could not delete ${materializedResourceIdentifier} as it does not exist already.`)
        }
        const metadata = await this.extractLdesMetadata()

        const versionSpecificIdentifier = "#resource"
        const member: Member = {
            id: namedNode(materializedResourceIdentifier),
            quads: []

        }

        // copy latest version of the resource
        const quads = materializedResource.getQuads(null, null, null, null)
        for (const q of quads) {
            // transform quads which are coming from materializedResourceIdentifier
            if (q.subject.value === materializedResourceIdentifier) {
                member.quads.push(quad(namedNode(versionSpecificIdentifier), q.predicate, q.object))
            } else {
                // copy all others
                member.quads.push(q)
            }
        }
        // add version specific triples and deleted triple
        VersionAwareLDESinLDP.addVersionSpecificTriples(member, versionSpecificIdentifier, metadata)
        VersionAwareLDESinLDP.addDeletedTriple(member, versionSpecificIdentifier, metadata)

        // store in the ldes in ldp
        await this.LDESinLDP.delete(new Store(member.quads))
    }

    /**
     * Extract some basic LDES metadata
     *
     * Note: currently it only extracts the snapshot options from the LDES in LDP
     * @returns {Promise<LDESMetadata>}
     */
    private async extractLdesMetadata(): Promise<LDESMetadata> {
        const metadataStore = await this.LDESinLDP.readMetadata()
        const ldesIdentifier = metadataStore.getSubjects(RDF.type, LDES.EventStream, null)[0].value

        const snapshotOptions = extractSnapshotOptions(metadataStore, ldesIdentifier)
        return {
            deletedType: LDES.DeletedLDPResource,
            ldesEventStreamIdentifier: ldesIdentifier,
            rootNodeIdentifiers: [],
            timestampPath: snapshotOptions.timestampPath!,
            versionOfPath: snapshotOptions.versionOfPath!
        }
    }

    // todo: move static into utility class
    /**
     * Checks whether the materialized member is marked deleted or not
     * @param member
     * @param metadata
     */
    private static isDeleted(member: Member, metadata: LDESMetadata): boolean {
        const store = new Store(member.quads)
        return store.getQuads(member.id, namedNode(RDF.type), namedNode(metadata.deletedType), null).length > 0
    }

    /**
     * Adds version specific triples (timestamp and version) to the quads of the member
     * @param member
     * @param versionSpecificIdentifier
     * @param metadata
     */
    private static addVersionSpecificTriples(member: Member, versionSpecificIdentifier: string, metadata: LDESMetadata): void {
        const id = namedNode(versionSpecificIdentifier)
        member.quads.push(quad(id, namedNode(metadata.versionOfPath), namedNode(member.id.value)))
        member.quads.push(quad(id, namedNode(metadata.timestampPath), dateToLiteral(new Date())))
    }

    /**
     * Adds the deleted type the version specific resource (i.e. to the quads of the member)
     * @param member
     * @param versionSpecificIdentifier
     * @param metadata
     */
    private static addDeletedTriple(member: Member, versionSpecificIdentifier: string, metadata: LDESMetadata): void {
        const id = namedNode(versionSpecificIdentifier)
        member.quads.push(quad(id, namedNode(RDF.type), namedNode(metadata.deletedType)))
    }

    /**
     * Removes version specific triples from a materialized member
     * @param member
     * @param metadata
     */
    private static removeVersionSpecificTriples(member: Member, metadata: LDESMetadata): void {
        const store = new Store(member.quads)
        store.removeQuads(store.getQuads(member.id, namedNode(metadata.timestampPath), null, null))
        store.removeQuads(store.getQuads(member.id, namedNode(metadata.versionOfPath), null, null))
        store.removeQuads(store.getQuads(member.id, namedNode(metadata.deletedType), null, null))

        store.removeQuads(store.getQuads(member.id, namedNode(DCT.hasVersion), null, null))
        member.quads = store.getQuads(null, null, null, null)

    }
}

interface LDESMetadata {
    ldesEventStreamIdentifier: string,
    rootNodeIdentifiers: string[],
    timestampPath: string,
    versionOfPath: string,
    deletedType: string
}