/***************************************
 * Title: Status
 * Description: Interface to indicate the status of an LDES in LDP
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 16/11/2022
 *****************************************/
/**
 * Indicates the status of the LDES in LDP.
 */
export interface Status {
    /**
     * Whether the LDES in LDP is reachable on the internet based on the LIL root URL.
     * True when a HEAD request results in a HTTP Status code 200.
     */
    found: boolean
    /**
     * Whether the root of the LDES adheres to the LDES in LDP Protocol.
     * True when it can be parsed to the appropriate {@link ILDESinLDPMetadata}.
     */
    valid: boolean
    /**
     * Whether the given {@link Communication} has write access to the LIL root and recursively all its children `ldp:Resources`.
     */
    writable: boolean
    /**
     * Whether the LDES in LDP contains any members.
     * True when there is only one `tree:relation` in the metadata which, when traversed, results into zero members.
     */
    empty: boolean
    /**
     * Whether the LDES in LDP is considered full according to the retention policy.
     * True is based on the `ldes:RetentionPolicy`
     * and the property `tree:pageSize` in the `ldes:BucketizeStrategy` and the number of relations
     * (in case of a `ldes:LatestVersionSubset`)
     * or based on the relation values (in case of an `ldes:DurationAgoPolicy).
     */
    full: boolean
}
