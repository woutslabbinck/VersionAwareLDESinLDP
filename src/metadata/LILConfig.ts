/***************************************
 * Title: LILConfig
 * Description: Interface used for LDES in LDP initialisation
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 08/11/2022
 *****************************************/
export interface LILConfig {
    /**
     * SHACL property path used to indicate on which member property the relation applies
     * NOTE: currently simplified through a simple property path
     */
    treePath: string

    /**
     * URL to a shape file to which each member within the LDES MUST apply
     */
    shape?: string

    /**
     * Also mentioned as bucket size en @treecg/types.
     * When a fragmentation has greater or equal amount of members than `size`, a new relation MUST be added
     */
    pageSize?: number

    /**
     * Date of the value of the relation that will be created
     */
    date?: Date
}

