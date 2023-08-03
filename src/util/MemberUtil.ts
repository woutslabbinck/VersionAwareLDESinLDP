/***************************************
 * Title: MemberUtil.ts
 * Description: Utility function for Members
 * Author: Wout Slabbinck (wout.slabbinck@ugent.be)
 * Created on 03/08/2023
 *****************************************/
import {Member} from "@treecg/types";
import {Literal, Store} from "n3";
import {extractDateFromLiteral} from "./TimestampUtil";

/**
 * Utility function that extracts the timestamp (formatted as {@link Date} of a member using a SHACL property path.
 *
 * @param member
 * @param path
 */
export function extractDateFromMember(member: Member, path: string): Date{
    const store = new Store(member.quads);

    // member date
    const dateLiteral = store.getObjects(member.id, path, null)[0] as Literal;
    const memberDateTime = extractDateFromLiteral(dateLiteral);
    return memberDateTime
}
