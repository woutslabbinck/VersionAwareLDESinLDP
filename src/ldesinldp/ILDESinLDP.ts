/***************************************
 * Title: ILDESinLDP
 * Description: Interface for LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {LDESinLDPConfig} from "./LDESinLDPConfig";
import {Store} from "n3";
import {Readable} from "stream";

export interface ILDESinLDP {
    /**
     * Initialises an LDES in LDP using from the config the base, possibly a shape and the treePath.
     * By default, ldes:versionOfPath is dct:isVersionOf, ldes:timestampPath is dc:issued and tree:relation is tree:GreaterThanOrEqualRelation.
     * @param config
     */
    initialise: (config: LDESinLDPConfig) => Promise<void>

    /**
     * Creates a new resource in the LDESinLDP.
     * Uses the LDESinLDP protocol to find the location.
     * @param materializedResourceIdentifier
     * @param store first state of the resource
     */
    create: (materializedResourceIdentifier: string, store: Store) => Promise<void>

    /**
     * Reads the resource in the LDESinLDP.
     * @param resourceIdentifier
     */
    read: (resourceIdentifier: string) => Promise<Store>

    /**
     * Updates a resource in the LDESinLDP.
     * Uses the LDESinLDP protocol to find the location.
     * @param materializedResourceIdentifier
     * @param store updated state of the resource
     */
    update: (materializedResourceIdentifier: string, store: Store) => Promise<void>

    /**
     * Marks the resource in the LDESinLDP as deleted.
     *
     * @param materializedResourceIdentifier
     * @param store previous state of the resource
     */
    delete: (materializedResourceIdentifier: string, store: Store) => Promise<void>

    /**
     * Reads all the metadata of the LDESinLDP.
     * Metadata includes the tree:relations, tree:path, ldes:timestampPath, ldes:versionOfPath, base of the LDESinLDP and optionally the tree:shape.
     * Throws an error when an obligated property is missing from the base.
     */
    readMetadata: () => Promise<Store>

    /**
     * Returns all the resources (members) of the LDESinLDP and returns them.
     * If a date is given, it stops early based on the relations and the ldes:timestampPath in the resource.
     * @param until
     */
    readAllMembers: (until?: Date) => Promise<Readable>
}
