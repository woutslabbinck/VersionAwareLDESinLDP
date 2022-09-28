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

    LDESinLDPIdentifier: string;

    /**
     * Initialises an LDES in LDP using from the config the base, possibly a shape and the treePath.
     * By default, ldes:versionOfPath is dct:isVersionOf, ldes:timestampPath is dc:created and tree:relation is tree:GreaterThanOrEqualToRelation.
     * @param config
     */
    initialise: (config: LDESinLDPConfig) => Promise<void>

    /**
     * Creates a new resource in the LDESinLDP.
     * Uses the LDESinLDP protocol to find the location.
     * Returns the URL of the created resource.
     * @param store first state of the resource
     */
    create: (store: Store) => Promise<string>

    /**
     * Reads the resource in the LDESinLDP.
     * @param resourceIdentifier
     */
    read: (resourceIdentifier: string) => Promise<Store>

    /**
     * Updates a resource in the LDESinLDP.
     * Uses the create operation to add the updated version of the resource to the LDESinLDP.
     * Returns the URL of the updated resource.
     * @param store updated version of the resource
     */
    update: (store: Store) => Promise<string>

    /**
     * Marks the resource in the LDESinLDP as deleted.
     * Returns the URL of the deleted resource.
     * @param store previous version of the resource
     */
    delete: (store: Store) => Promise<string>

    /**
     * Create a new GTE relation (fragment) in the LDESinLDP
     * @param date
     */
    newRelation: (date?: Date) => Promise<void>

    /**
     * Reads all the metadata of the LDESinLDP.
     * Metadata includes the tree:relations, tree:path, ldes:timestampPath, ldes:versionOfPath, base of the LDESinLDP and optionally the tree:shape.
     * Throws an error when an obligated property is missing from the base.
     */
    readMetadata: () => Promise<Store>

    /**
     * Returns all the resources (members) of the LDESinLDP and returns them as a Member Stream
     * If a date is given, it stops early based on the relations and the ldes:timestampPath in the resource.
     * @param until
     */
    readAllMembers: (from?: Date, until?: Date) => Promise<Readable>

    /**
     * Return all the resources (members) of a container as an Iterable.
     * @param containerURL
     */
    readChildren: (containerURL: string) => AsyncIterable<Store>
}
