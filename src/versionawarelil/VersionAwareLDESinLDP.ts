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
import namedNode = DataFactory.namedNode;
import {dateToLiteral} from "../util/TimestampUtil";

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
        return Promise.resolve(undefined)
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
        const containerStore = await this.read(this.LDESinLDP.LDESinLDPIdentifier)

        // check whether it exists already
        if (containerStore.getQuads(null, null, materializedResourceIdentifier, null).length > 0) {
            throw Error(`Could not create ${materializedResourceIdentifier} as it already exists`)
        }

        // add version specific triples (defined in the LDES specification)
        const metadata = await this.extractLdesMetadata()
        versionSpecificIdentifier = versionSpecificIdentifier ? versionSpecificIdentifier : "#resource";
        const id = namedNode(versionSpecificIdentifier)
        store.addQuad(id, namedNode(metadata.versionOfPath!), namedNode(materializedResourceIdentifier))
        store.addQuad(id, namedNode(metadata.timestampPath!), dateToLiteral(new Date()))

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
     * @returns {Promise<Store>} materialized representation of the resource if it exists
     */
    public async read(materializedResourceIdentifier: string): Promise<Store> {
        // TODO: maybe add optional parameter of the date?
        const memberStream = await this.LDESinLDP.readAllMembers()

        const snapshotOptions = await this.extractLdesMetadata()
        snapshotOptions.materialized = true
        snapshotOptions.date = new Date()
        snapshotOptions.snapshotIdentifier = this.LDESinLDP.LDESinLDPIdentifier

        const snapshotTransformer = new SnapshotTransform(snapshotOptions)
        const transformedStream = memberStream.pipe(snapshotTransformer)
        const store = new Store()

        if (isContainerIdentifier(materializedResourceIdentifier)) {
            if (this.LDESinLDP.LDESinLDPIdentifier === materializedResourceIdentifier) {
                store.addQuad(namedNode(this.LDESinLDP.LDESinLDPIdentifier), namedNode(RDF.type), namedNode(LDP.BasicContainer))
                for await (const member of transformedStream) {
                    store.addQuad(namedNode(this.LDESinLDP.LDESinLDPIdentifier), namedNode(LDP.contains), member.id)
                }
            } else {
                throw Error("A container can only be read if it is the base container (currently).")
            }
        } else {
            // filter out materialized resource
            for await (const member of transformedStream) {
                if (member.id.value === materializedResourceIdentifier) {
                    store.addQuads(member.quads)
                    break
                }
            }

            // remove TREE/LDES specific triples
            store.removeQuads(store.getQuads(namedNode(materializedResourceIdentifier), namedNode(DCT.created), null, null))
            store.removeQuads(store.getQuads(namedNode(materializedResourceIdentifier), namedNode(DCT.hasVersion), null, null))
        }
        return store
    }

    /**
     * Updates a resource in the LDES in LDP using the protocol.
     * Also adds the timestamp and version triples.
     * Throws an error if the identifier does not exist yet in the LDES in LDP
     * @param materializedResourceIdentifier
     * @param store
     * @returns {Promise<any>}
     */
    public async update(materializedResourceIdentifier: string, store: Store): Promise<void> {
        return Promise.resolve(undefined)
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

    }

    /**
     * extract some basic LDES metadata
     *
     * Note: currently it only extracts the snapshot options from the LDES in LDP
     * @param store
     * @returns {Promise<ISnapshotOptions>}
     */
    private async extractLdesMetadata(): Promise<ISnapshotOptions> {
        const metadataStore = await this.LDESinLDP.readMetadata()
        const ldesIdentifier = metadataStore.getSubjects(RDF.type, LDES.EventStream, null)[0].value

        return extractSnapshotOptions(metadataStore, ldesIdentifier)
    }
}
