/***************************************
 * Title: ILDES
 * Description: Interface for LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 21/03/2022
 *****************************************/
import {Store} from "n3";
import {Readable} from "stream";
import {LILConfig} from "../metadata/LILConfig";
import {Communication} from "../ldp/Communication";
import {Status} from "./Status";

export interface ILDES {

    LDESinLDPIdentifier: string;
    eventStreamIdentifier: string;
    communication: Communication;

    /**
     * Calculates and returns the {@link Status} of an LDES in LDP
     */
    status: () => Promise<Status>

    /**
     * Initialises an LDES in LDP using `tree:path`.
     * @param config
     */
    initialise: (config: LILConfig) => Promise<void>

    /**
     * Appends a member to the LDES.
     * Translated to LDES in LDP, this means creating a new ldp:resource to the write location.
     * The LDESinLDP protocol is used to find the location.
     * Returns the URL of the created resource.
     * @param store first state of the resource
     */
    append: (store: Store) => Promise<string>

    /**
     * Reads the member (ldp:resource) in the LDESinLDP.
     * @param resourceIdentifier
     */
    read: (resourceIdentifier: string) => Promise<Store>

    /**
     * Create a new GTE relation (fragment) in the LDES in LDP
     *
     * @param date
     */
    newFragment: (date?: Date) => Promise<void>

    /**
     * Reads all the metadata of the LDESinLDP and returns that as an N3 Store.
     * Metadata includes the tree:relations, tree:path, base of the LDESinLDP and optionally the tree:shape.
     * Throws an error when an obligated property is missing from the base.
     */
    readMetadata: () => Promise<Store>

    /**
     * Returns all the resources (members) of the LDESinLDP and returns them as a Member Stream
     * If a date is given, it stops early based on the relations and the tree:path in the resource.
     * Optionally a window [from, until], which results in a memberStream with only members within that window.
     *
     * @param from
     * @param until
     */
    readAllMembers: (from?: Date, until?: Date) => Promise<Readable>

    /**
     * Returns all the resources (members) of the LDESinLDP and returns them as a Member Stream.
     * It sorts the members based on the `tree:path` in the resource.
     * If a date is given, it stops early based on the relations and the tree:path in the resource.
     * Optionally a window [from, until], which results in a memberStream with only members within that window.
     */

    readMembersSorted: (opts?: {from?: Date, until?: Date, chronological?: boolean}) => Promise<Readable>
    /**
     * Return all the members (resources) of a fragment (container) as an Iterable.
     * @param pageUrl
     */
    readPage: (pageUrl: string) => AsyncIterable<Store>
}
